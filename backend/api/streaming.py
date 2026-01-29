"""
Streaming Topics API

Provides CRUD endpoints for managing Kafka/AMQ Streams topic configurations
and testing connections.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime

from database import get_db
from services.auth import get_current_user, log_audit
import models
from services.encryption import encrypt_value, decrypt_value

router = APIRouter(prefix="/streaming", tags=["streaming"])


# === Request/Response Models ===

class StreamingTopicCreate(BaseModel):
    name: str
    description: Optional[str] = None
    bootstrap_servers: str
    topic_name: str
    consumer_group: str
    auth_type: str = "sasl_scram"
    
    # SASL credentials (optional based on auth_type)
    sasl_username: Optional[str] = None
    sasl_password: Optional[str] = None
    sasl_mechanism: Optional[str] = "SCRAM-SHA-512"
    
    # mTLS (optional based on auth_type)
    ssl_ca_cert: Optional[str] = None
    ssl_client_cert: Optional[str] = None
    ssl_client_key: Optional[str] = None
    ssl_key_password: Optional[str] = None
    
    # Schema configuration
    schema_format: str = "json"
    schema_registry_url: Optional[str] = None
    schema_definition: Optional[dict] = None
    
    # Consumer settings
    auto_offset_reset: str = "earliest"
    max_poll_records: int = 500
    session_timeout_ms: int = 30000


class StreamingTopicUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    bootstrap_servers: Optional[str] = None
    topic_name: Optional[str] = None
    consumer_group: Optional[str] = None
    auth_type: Optional[str] = None
    sasl_username: Optional[str] = None
    sasl_password: Optional[str] = None
    sasl_mechanism: Optional[str] = None
    ssl_ca_cert: Optional[str] = None
    ssl_client_cert: Optional[str] = None
    ssl_client_key: Optional[str] = None
    ssl_key_password: Optional[str] = None
    schema_format: Optional[str] = None
    schema_registry_url: Optional[str] = None
    schema_definition: Optional[dict] = None
    auto_offset_reset: Optional[str] = None
    max_poll_records: Optional[int] = None
    session_timeout_ms: Optional[int] = None
    is_active: Optional[bool] = None


class StreamingTopicResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    bootstrap_servers: str
    topic_name: str
    consumer_group: str
    auth_type: str
    schema_format: str
    schema_registry_url: Optional[str]
    auto_offset_reset: str
    max_poll_records: int
    session_timeout_ms: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class BufferStatsResponse(BaseModel):
    topic_id: UUID
    topic_name: str
    total_buffered: int
    processed_count: int
    pending_count: int
    oldest_message: Optional[datetime]
    newest_message: Optional[datetime]


class ConnectionTestResult(BaseModel):
    success: bool
    message: str
    broker_metadata: Optional[dict] = None
    partitions: Optional[List[int]] = None


# === Helper Functions ===

def topic_to_response(topic: models.StreamingTopic) -> dict:
    """Convert topic model to response dict"""
    return {
        "id": topic.id,
        "name": topic.name,
        "description": topic.description,
        "bootstrap_servers": topic.bootstrap_servers,
        "topic_name": topic.topic_name,
        "consumer_group": topic.consumer_group,
        "auth_type": topic.auth_type.value if topic.auth_type else "sasl_scram",
        "schema_format": topic.schema_format.value if topic.schema_format else "json",
        "schema_registry_url": topic.schema_registry_url,
        "auto_offset_reset": topic.auto_offset_reset,
        "max_poll_records": topic.max_poll_records,
        "session_timeout_ms": topic.session_timeout_ms,
        "is_active": topic.is_active,
        "created_at": topic.created_at,
        "updated_at": topic.updated_at
    }


# === Endpoints ===

@router.get("/topics", response_model=List[StreamingTopicResponse])
async def list_topics(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all streaming topic configurations for the tenant"""
    topics = db.query(models.StreamingTopic).filter(
        models.StreamingTopic.tenant_id == current_user.tenant_id
    ).order_by(models.StreamingTopic.name).all()
    
    return [topic_to_response(t) for t in topics]


@router.post("/topics", response_model=StreamingTopicResponse)
async def create_topic(
    request: StreamingTopicCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new streaming topic configuration"""
    # Map auth type string to enum
    auth_type = models.StreamingAuthType(request.auth_type)
    schema_format = models.StreamingSchemaFormat(request.schema_format)
    
    topic = models.StreamingTopic(
        tenant_id=current_user.tenant_id,
        name=request.name,
        description=request.description,
        bootstrap_servers=request.bootstrap_servers,
        topic_name=request.topic_name,
        consumer_group=request.consumer_group,
        auth_type=auth_type,
        sasl_mechanism=request.sasl_mechanism,
        schema_format=schema_format,
        schema_registry_url=request.schema_registry_url,
        schema_definition=request.schema_definition,
        auto_offset_reset=request.auto_offset_reset,
        max_poll_records=request.max_poll_records,
        session_timeout_ms=request.session_timeout_ms
    )
    
    # Encrypt sensitive fields
    if request.sasl_username:
        topic.sasl_username = encrypt_value(request.sasl_username)
    if request.sasl_password:
        topic.sasl_password = encrypt_value(request.sasl_password)
    if request.ssl_ca_cert:
        topic.ssl_ca_cert = encrypt_value(request.ssl_ca_cert)
    if request.ssl_client_cert:
        topic.ssl_client_cert = encrypt_value(request.ssl_client_cert)
    if request.ssl_client_key:
        topic.ssl_client_key = encrypt_value(request.ssl_client_key)
    if request.ssl_key_password:
        topic.ssl_key_password = encrypt_value(request.ssl_key_password)
    
    db.add(topic)
    db.commit()
    db.refresh(topic)

    log_audit(db, current_user, models.AuditAction.CREATE, "StreamingTopic", str(topic.id),
              changes={"name": request.name, "topic_name": request.topic_name})

    return topic_to_response(topic)


@router.get("/topics/{topic_id}", response_model=StreamingTopicResponse)
async def get_topic(
    topic_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific streaming topic configuration"""
    topic = db.query(models.StreamingTopic).filter(
        models.StreamingTopic.id == topic_id,
        models.StreamingTopic.tenant_id == current_user.tenant_id
    ).first()
    
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    return topic_to_response(topic)


@router.put("/topics/{topic_id}", response_model=StreamingTopicResponse)
async def update_topic(
    topic_id: UUID,
    request: StreamingTopicUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a streaming topic configuration"""
    topic = db.query(models.StreamingTopic).filter(
        models.StreamingTopic.id == topic_id,
        models.StreamingTopic.tenant_id == current_user.tenant_id
    ).first()
    
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Update basic fields
    if request.name is not None:
        topic.name = request.name
    if request.description is not None:
        topic.description = request.description
    if request.bootstrap_servers is not None:
        topic.bootstrap_servers = request.bootstrap_servers
    if request.topic_name is not None:
        topic.topic_name = request.topic_name
    if request.consumer_group is not None:
        topic.consumer_group = request.consumer_group
    if request.auth_type is not None:
        topic.auth_type = models.StreamingAuthType(request.auth_type)
    if request.sasl_mechanism is not None:
        topic.sasl_mechanism = request.sasl_mechanism
    if request.schema_format is not None:
        topic.schema_format = models.StreamingSchemaFormat(request.schema_format)
    if request.schema_registry_url is not None:
        topic.schema_registry_url = request.schema_registry_url
    if request.schema_definition is not None:
        topic.schema_definition = request.schema_definition
    if request.auto_offset_reset is not None:
        topic.auto_offset_reset = request.auto_offset_reset
    if request.max_poll_records is not None:
        topic.max_poll_records = request.max_poll_records
    if request.session_timeout_ms is not None:
        topic.session_timeout_ms = request.session_timeout_ms
    if request.is_active is not None:
        topic.is_active = request.is_active
    
    # Update encrypted fields
    if request.sasl_username is not None:
        topic.sasl_username = encrypt_value(request.sasl_username)
    if request.sasl_password is not None:
        topic.sasl_password = encrypt_value(request.sasl_password)
    if request.ssl_ca_cert is not None:
        topic.ssl_ca_cert = encrypt_value(request.ssl_ca_cert)
    if request.ssl_client_cert is not None:
        topic.ssl_client_cert = encrypt_value(request.ssl_client_cert)
    if request.ssl_client_key is not None:
        topic.ssl_client_key = encrypt_value(request.ssl_client_key)
    if request.ssl_key_password is not None:
        topic.ssl_key_password = encrypt_value(request.ssl_key_password)

    db.commit()
    db.refresh(topic)

    # Exclude sensitive fields from audit log
    update_data = request.model_dump(exclude_unset=True)
    sensitive_fields = ["sasl_username", "sasl_password", "ssl_ca_cert", "ssl_client_cert", "ssl_client_key", "ssl_key_password"]
    safe_changes = {k: v for k, v in update_data.items() if v is not None and k not in sensitive_fields}
    log_audit(db, current_user, models.AuditAction.UPDATE, "StreamingTopic", str(topic.id),
              changes=safe_changes)

    return topic_to_response(topic)


@router.delete("/topics/{topic_id}")
async def delete_topic(
    topic_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a streaming topic configuration"""
    topic = db.query(models.StreamingTopic).filter(
        models.StreamingTopic.id == topic_id,
        models.StreamingTopic.tenant_id == current_user.tenant_id
    ).first()
    
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    topic_id_str = str(topic.id)
    log_audit(db, current_user, models.AuditAction.DELETE, "StreamingTopic", topic_id_str)

    db.delete(topic)
    db.commit()

    return {"message": "Topic deleted successfully"}


@router.post("/topics/{topic_id}/test", response_model=ConnectionTestResult)
async def test_connection(
    topic_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test connection to the Kafka/AMQ Streams topic"""
    topic = db.query(models.StreamingTopic).filter(
        models.StreamingTopic.id == topic_id,
        models.StreamingTopic.tenant_id == current_user.tenant_id
    ).first()
    
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    try:
        from services.stream_consumer import test_kafka_connection
        result = test_kafka_connection(topic)
        return result
    except ImportError:
        # Stream consumer not yet implemented
        return ConnectionTestResult(
            success=False,
            message="Stream consumer service not available",
            broker_metadata=None,
            partitions=None
        )
    except Exception as e:
        return ConnectionTestResult(
            success=False,
            message=str(e),
            broker_metadata=None,
            partitions=None
        )


@router.get("/buffer/stats", response_model=List[BufferStatsResponse])
async def get_buffer_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get buffer statistics for all topics"""
    from sqlalchemy import func
    
    topics = db.query(models.StreamingTopic).filter(
        models.StreamingTopic.tenant_id == current_user.tenant_id
    ).all()
    
    stats = []
    for topic in topics:
        buffer_query = db.query(models.StreamingBuffer).filter(
            models.StreamingBuffer.topic_id == topic.id
        )
        
        total = buffer_query.count()
        processed = buffer_query.filter(models.StreamingBuffer.processed == True).count()
        pending = total - processed
        
        oldest = buffer_query.filter(
            models.StreamingBuffer.processed == False
        ).order_by(models.StreamingBuffer.received_at.asc()).first()
        
        newest = buffer_query.filter(
            models.StreamingBuffer.processed == False
        ).order_by(models.StreamingBuffer.received_at.desc()).first()
        
        stats.append(BufferStatsResponse(
            topic_id=topic.id,
            topic_name=topic.name,
            total_buffered=total,
            processed_count=processed,
            pending_count=pending,
            oldest_message=oldest.received_at if oldest else None,
            newest_message=newest.received_at if newest else None
        ))
    
    return stats
