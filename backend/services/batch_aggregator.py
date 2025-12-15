"""
Batch Aggregator Service

Handles micro-batch processing of buffered streaming transactions.
Supports both time-windowed and threshold-based triggering.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID
import uuid

from sqlalchemy.orm import Session
from sqlalchemy import func

import models

logger = logging.getLogger(__name__)


class BatchAggregator:
    """
    Aggregates buffered streaming transactions into batches for report execution.
    
    Trigger modes:
    - TIME_WINDOW: Trigger after N minutes since last batch
    - THRESHOLD: Trigger after N messages buffered
    - COMBINED: Trigger on whichever comes first
    - MANUAL: Only trigger via explicit API call
    """
    
    def __init__(self, db: Session, topic_id: UUID, report_id: UUID):
        self.db = db
        self.topic_id = topic_id
        self.report_id = report_id
    
    def check_and_trigger(
        self,
        trigger_mode: models.StreamingTriggerMode,
        window_minutes: int = 15,
        threshold_count: int = 10000
    ) -> Optional[UUID]:
        """
        Check if trigger conditions are met and execute batch if so.
        
        Returns batch_id if triggered, None otherwise.
        """
        pending_count = self._get_pending_count()
        
        if pending_count == 0:
            return None
        
        should_trigger = False
        reason = ""
        
        if trigger_mode == models.StreamingTriggerMode.TIME_WINDOW:
            elapsed = self._minutes_since_oldest_pending()
            if elapsed >= window_minutes:
                should_trigger = True
                reason = f"Time window exceeded ({elapsed} >= {window_minutes} minutes)"
        
        elif trigger_mode == models.StreamingTriggerMode.THRESHOLD:
            if pending_count >= threshold_count:
                should_trigger = True
                reason = f"Threshold reached ({pending_count} >= {threshold_count})"
        
        elif trigger_mode == models.StreamingTriggerMode.COMBINED:
            elapsed = self._minutes_since_oldest_pending()
            if pending_count >= threshold_count:
                should_trigger = True
                reason = f"Threshold reached ({pending_count})"
            elif elapsed >= window_minutes:
                should_trigger = True
                reason = f"Time window exceeded ({elapsed} min)"
        
        elif trigger_mode == models.StreamingTriggerMode.MANUAL:
            # Manual mode never auto-triggers
            return None
        
        if should_trigger:
            logger.info(f"Triggering batch: {reason}")
            return self._execute_batch()
        
        return None
    
    def force_trigger(self) -> Optional[UUID]:
        """Force trigger a batch regardless of conditions"""
        pending_count = self._get_pending_count()
        if pending_count == 0:
            return None
        return self._execute_batch()
    
    def _get_pending_count(self) -> int:
        """Get count of pending (unprocessed) messages"""
        return self.db.query(models.StreamingBuffer).filter(
            models.StreamingBuffer.topic_id == self.topic_id,
            models.StreamingBuffer.processed == False
        ).count()
    
    def _minutes_since_oldest_pending(self) -> float:
        """Get minutes since the oldest pending message was received"""
        oldest = self.db.query(models.StreamingBuffer).filter(
            models.StreamingBuffer.topic_id == self.topic_id,
            models.StreamingBuffer.processed == False
        ).order_by(models.StreamingBuffer.received_at.asc()).first()
        
        if not oldest:
            return 0
        
        elapsed = datetime.utcnow() - oldest.received_at.replace(tzinfo=None)
        return elapsed.total_seconds() / 60
    
    def _execute_batch(self) -> UUID:
        """
        Mark pending messages as a batch and trigger report execution.
        
        Returns the batch_id (which becomes the job run reference).
        """
        batch_id = uuid.uuid4()
        now = datetime.utcnow()
        
        # Mark all pending messages with this batch ID
        pending = self.db.query(models.StreamingBuffer).filter(
            models.StreamingBuffer.topic_id == self.topic_id,
            models.StreamingBuffer.processed == False
        ).all()
        
        for msg in pending:
            msg.processed = True
            msg.processed_at = now
            msg.batch_id = batch_id
        
        self.db.commit()
        
        # Trigger report execution with streaming data source
        self._trigger_report(batch_id, len(pending))
        
        logger.info(f"Created batch {batch_id} with {len(pending)} messages")
        return batch_id
    
    def _trigger_report(self, batch_id: UUID, record_count: int):
        """Trigger report execution for this batch"""
        from worker import execute_report_task
        
        # Queue the report execution with special streaming parameters
        execute_report_task.delay(
            report_id=str(self.report_id),
            parameters={
                "data_source": "streaming_buffer",
                "batch_id": str(batch_id),
                "record_count": record_count
            }
        )


def get_batch_data(db: Session, batch_id: UUID) -> List[Dict[str, Any]]:
    """
    Retrieve all transaction payloads for a given batch.
    
    Used by the report executor when data_source='streaming_buffer'.
    """
    messages = db.query(models.StreamingBuffer).filter(
        models.StreamingBuffer.batch_id == batch_id
    ).order_by(models.StreamingBuffer.received_at.asc()).all()
    
    return [msg.payload for msg in messages]


def get_pending_stats(db: Session, topic_id: UUID) -> Dict[str, Any]:
    """Get statistics about pending messages for a topic"""
    pending = db.query(models.StreamingBuffer).filter(
        models.StreamingBuffer.topic_id == topic_id,
        models.StreamingBuffer.processed == False
    )
    
    count = pending.count()
    
    if count == 0:
        return {
            "pending_count": 0,
            "oldest_age_minutes": 0,
            "newest_age_minutes": 0
        }
    
    oldest = pending.order_by(models.StreamingBuffer.received_at.asc()).first()
    newest = pending.order_by(models.StreamingBuffer.received_at.desc()).first()
    
    now = datetime.utcnow()
    oldest_age = (now - oldest.received_at.replace(tzinfo=None)).total_seconds() / 60
    newest_age = (now - newest.received_at.replace(tzinfo=None)).total_seconds() / 60
    
    return {
        "pending_count": count,
        "oldest_age_minutes": round(oldest_age, 1),
        "newest_age_minutes": round(newest_age, 1)
    }
