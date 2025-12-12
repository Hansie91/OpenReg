"""
Log Streaming API

Provides HTTP polling and WebSocket endpoints for real-time job run log streaming.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from uuid import UUID
import asyncio

from database import get_db
from services.auth import get_current_user
import models

router = APIRouter()


# === Pydantic Models ===

class LogEntry(BaseModel):
    id: UUID
    line_number: int
    timestamp: datetime
    level: str
    message: str
    context: Optional[dict] = None

    class Config:
        from_attributes = True


class LogsResponse(BaseModel):
    job_run_id: UUID
    status: str
    total_lines: int
    logs: List[LogEntry]
    has_more: bool


class LogStreamStats(BaseModel):
    total_lines: int
    info_count: int
    warning_count: int
    error_count: int


# === HTTP Endpoints ===

@router.get("/{run_id}/logs", response_model=LogsResponse)
async def get_run_logs(
    run_id: UUID,
    after_line: int = Query(0, ge=0, description="Fetch logs after this line number"),
    limit: int = Query(100, ge=1, le=500, description="Maximum logs to return"),
    level: Optional[str] = Query(None, description="Filter by log level"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch logs for a job run with pagination.
    
    Use `after_line` for polling - pass the last line_number you received
    to get only new logs.
    """
    # Verify run exists and user has access
    job_run = db.query(models.JobRun).filter(
        models.JobRun.id == run_id,
        models.JobRun.tenant_id == current_user.tenant_id
    ).first()
    
    if not job_run:
        raise HTTPException(status_code=404, detail="Job run not found")
    
    # Build query
    query = db.query(models.JobRunLog).filter(
        models.JobRunLog.job_run_id == run_id,
        models.JobRunLog.line_number > after_line
    )
    
    if level:
        try:
            level_enum = models.LogLevel(level.lower())
            query = query.filter(models.JobRunLog.level == level_enum)
        except ValueError:
            pass
    
    # Get total count for this run
    total_count = db.query(func.count(models.JobRunLog.id)).filter(
        models.JobRunLog.job_run_id == run_id
    ).scalar() or 0
    
    # Fetch logs
    logs = query.order_by(models.JobRunLog.line_number).limit(limit + 1).all()
    
    has_more = len(logs) > limit
    if has_more:
        logs = logs[:limit]
    
    return LogsResponse(
        job_run_id=run_id,
        status=job_run.status.value,
        total_lines=total_count,
        logs=[
            LogEntry(
                id=log.id,
                line_number=log.line_number,
                timestamp=log.timestamp,
                level=log.level.value,
                message=log.message,
                context=log.context
            )
            for log in logs
        ],
        has_more=has_more
    )


@router.get("/{run_id}/logs/stats", response_model=LogStreamStats)
async def get_log_stats(
    run_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get statistics about logs for a job run."""
    # Verify access
    job_run = db.query(models.JobRun).filter(
        models.JobRun.id == run_id,
        models.JobRun.tenant_id == current_user.tenant_id
    ).first()
    
    if not job_run:
        raise HTTPException(status_code=404, detail="Job run not found")
    
    # Count by level
    stats = db.query(
        models.JobRunLog.level,
        func.count(models.JobRunLog.id)
    ).filter(
        models.JobRunLog.job_run_id == run_id
    ).group_by(models.JobRunLog.level).all()
    
    counts = {level.value: count for level, count in stats}
    
    return LogStreamStats(
        total_lines=sum(counts.values()),
        info_count=counts.get('info', 0),
        warning_count=counts.get('warning', 0),
        error_count=counts.get('error', 0)
    )


# === WebSocket Endpoint ===

class ConnectionManager:
    """Manages WebSocket connections for log streaming."""
    
    def __init__(self):
        self.active_connections: dict[UUID, list[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, run_id: UUID):
        await websocket.accept()
        if run_id not in self.active_connections:
            self.active_connections[run_id] = []
        self.active_connections[run_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, run_id: UUID):
        if run_id in self.active_connections:
            self.active_connections[run_id].remove(websocket)
            if not self.active_connections[run_id]:
                del self.active_connections[run_id]
    
    async def send_logs(self, run_id: UUID, logs: List[dict]):
        if run_id in self.active_connections:
            for connection in self.active_connections[run_id]:
                try:
                    await connection.send_json({"logs": logs})
                except Exception:
                    pass


manager = ConnectionManager()


@router.websocket("/ws/{run_id}/logs")
async def websocket_logs(
    websocket: WebSocket,
    run_id: UUID,
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for real-time log streaming.
    
    Connect to receive new log entries as they are written.
    The connection will close when the job completes or fails.
    """
    await manager.connect(websocket, run_id)
    
    try:
        last_line = 0
        poll_interval = 1.0  # seconds
        
        while True:
            # Check for new logs
            new_logs = db.query(models.JobRunLog).filter(
                models.JobRunLog.job_run_id == run_id,
                models.JobRunLog.line_number > last_line
            ).order_by(models.JobRunLog.line_number).limit(100).all()
            
            if new_logs:
                logs_data = [
                    {
                        "line_number": log.line_number,
                        "timestamp": log.timestamp.isoformat(),
                        "level": log.level.value,
                        "message": log.message,
                        "context": log.context
                    }
                    for log in new_logs
                ]
                await websocket.send_json({"logs": logs_data})
                last_line = new_logs[-1].line_number
            
            # Check if job is complete
            job_run = db.query(models.JobRun).filter(
                models.JobRun.id == run_id
            ).first()
            
            if job_run and job_run.status in [
                models.JobRunStatus.SUCCESS,
                models.JobRunStatus.FAILED,
                models.JobRunStatus.PARTIAL
            ]:
                # Send final status
                await websocket.send_json({
                    "status": "completed",
                    "job_status": job_run.status.value
                })
                break
            
            # Refresh session to see new data
            db.expire_all()
            await asyncio.sleep(poll_interval)
            
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket, run_id)


# === Helper for Worker to Write Logs ===

def write_log(
    db: Session,
    job_run_id: UUID,
    message: str,
    level: str = "info",
    context: Optional[dict] = None
):
    """
    Helper function for workers to write log entries.
    
    Usage in worker:
        from api.logs import write_log
        write_log(db, job_run_id, "Starting data extraction...", "info")
        write_log(db, job_run_id, "Validation failed", "error", {"row": 123})
    """
    # Get next line number
    max_line = db.query(func.max(models.JobRunLog.line_number)).filter(
        models.JobRunLog.job_run_id == job_run_id
    ).scalar() or 0
    
    log_entry = models.JobRunLog(
        job_run_id=job_run_id,
        line_number=max_line + 1,
        level=models.LogLevel(level.lower()),
        message=message,
        context=context
    )
    db.add(log_entry)
    db.commit()
    
    return log_entry
