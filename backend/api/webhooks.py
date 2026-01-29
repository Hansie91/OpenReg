"""
Webhook API endpoints.

Provides webhook management for partners to receive real-time
event notifications about job executions, artifacts, etc.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, HttpUrl, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

from database import get_db
from services.auth import get_current_user, log_audit
from services.webhooks import WebhookService
import models

router = APIRouter()


# === Pydantic Schemas ===

class WebhookCreateRequest(BaseModel):
    """Request to create a webhook."""
    name: str
    url: HttpUrl
    events: List[str]
    description: Optional[str] = None
    headers: Optional[Dict[str, str]] = None
    allowed_ips: Optional[List[str]] = None
    report_ids: Optional[List[str]] = None
    timeout_seconds: Optional[int] = 30
    retry_policy: Optional[Dict[str, Any]] = None

    @field_validator('events')
    @classmethod
    def validate_events(cls, v):
        valid_events = [e.value for e in models.WebhookEventType]
        for event in v:
            if event not in valid_events:
                raise ValueError(f"Invalid event type: {event}. Valid types: {valid_events}")
        return v

    @field_validator('timeout_seconds')
    @classmethod
    def validate_timeout(cls, v):
        if v is not None and (v < 5 or v > 60):
            raise ValueError("Timeout must be between 5 and 60 seconds")
        return v


class WebhookUpdateRequest(BaseModel):
    """Request to update a webhook."""
    name: Optional[str] = None
    url: Optional[HttpUrl] = None
    events: Optional[List[str]] = None
    description: Optional[str] = None
    headers: Optional[Dict[str, str]] = None
    allowed_ips: Optional[List[str]] = None
    report_ids: Optional[List[str]] = None
    timeout_seconds: Optional[int] = None
    retry_policy: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

    @field_validator('events')
    @classmethod
    def validate_events(cls, v):
        if v is not None:
            valid_events = [e.value for e in models.WebhookEventType]
            for event in v:
                if event not in valid_events:
                    raise ValueError(f"Invalid event type: {event}")
        return v


class WebhookResponse(BaseModel):
    """Response for a webhook."""
    id: str
    name: str
    description: Optional[str]
    url: str
    events: List[str]
    headers: Dict[str, str]
    allowed_ips: List[str]
    report_ids: List[str]
    timeout_seconds: int
    retry_policy: Dict[str, Any]
    is_active: bool
    total_deliveries: int
    successful_deliveries: int
    failed_deliveries: int
    last_triggered_at: Optional[datetime]
    last_success_at: Optional[datetime]
    last_failure_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WebhookCreateResponse(BaseModel):
    """Response after creating a webhook (includes secret)."""
    webhook: WebhookResponse
    secret: str  # Only shown once at creation


class WebhookDeliveryResponse(BaseModel):
    """Response for a webhook delivery."""
    id: str
    webhook_id: str
    event_type: str
    event_id: str
    status: str
    attempt_count: int
    max_attempts: int
    request_url: str
    response_status_code: Optional[int]
    response_time_ms: Optional[int]
    error_message: Optional[str]
    next_retry_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


# === Helper Functions ===

def webhook_to_response(webhook: models.Webhook) -> WebhookResponse:
    """Convert a Webhook model to response schema."""
    return WebhookResponse(
        id=str(webhook.id),
        name=webhook.name,
        description=webhook.description,
        url=webhook.url,
        events=webhook.events or [],
        headers=webhook.headers or {},
        allowed_ips=webhook.allowed_ips or [],
        report_ids=webhook.report_ids or [],
        timeout_seconds=webhook.timeout_seconds,
        retry_policy=webhook.retry_policy or {},
        is_active=webhook.is_active,
        total_deliveries=webhook.total_deliveries,
        successful_deliveries=webhook.successful_deliveries,
        failed_deliveries=webhook.failed_deliveries,
        last_triggered_at=webhook.last_triggered_at,
        last_success_at=webhook.last_success_at,
        last_failure_at=webhook.last_failure_at,
        created_at=webhook.created_at,
        updated_at=webhook.updated_at
    )


# === Endpoints ===

@router.post("", response_model=WebhookCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    request: WebhookCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new webhook.

    The webhook secret is returned only once in this response.
    Store it securely as it cannot be retrieved again.
    """
    webhook, secret = WebhookService.create_webhook(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        name=request.name,
        url=str(request.url),
        events=request.events,
        description=request.description,
        headers=request.headers,
        allowed_ips=request.allowed_ips,
        report_ids=request.report_ids,
        timeout_seconds=request.timeout_seconds or 30,
        retry_policy=request.retry_policy
    )

    log_audit(db, current_user, models.AuditAction.CREATE, "Webhook", str(webhook.id),
              changes={"name": request.name, "url": str(request.url), "events": request.events})

    return WebhookCreateResponse(
        webhook=webhook_to_response(webhook),
        secret=secret
    )


@router.get("", response_model=List[WebhookResponse])
async def list_webhooks(
    skip: int = 0,
    limit: int = 50,
    is_active: Optional[bool] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all webhooks for the tenant."""
    query = db.query(models.Webhook).filter(
        models.Webhook.tenant_id == current_user.tenant_id
    )

    if is_active is not None:
        query = query.filter(models.Webhook.is_active == is_active)

    webhooks = query.order_by(models.Webhook.created_at.desc()).offset(skip).limit(limit).all()

    return [webhook_to_response(w) for w in webhooks]


@router.get("/{webhook_id}", response_model=WebhookResponse)
async def get_webhook(
    webhook_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific webhook."""
    webhook = db.query(models.Webhook).filter(
        models.Webhook.id == webhook_id,
        models.Webhook.tenant_id == current_user.tenant_id
    ).first()

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    return webhook_to_response(webhook)


@router.patch("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: UUID,
    request: WebhookUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a webhook configuration."""
    webhook = db.query(models.Webhook).filter(
        models.Webhook.id == webhook_id,
        models.Webhook.tenant_id == current_user.tenant_id
    ).first()

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    # Update fields
    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "url":
            value = str(value)
        setattr(webhook, field, value)

    webhook.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(webhook)

    # Exclude secret from logged changes (though webhook update doesn't include secret)
    safe_changes = {k: v for k, v in update_data.items() if k != "secret"}
    log_audit(db, current_user, models.AuditAction.UPDATE, "Webhook", str(webhook.id), changes=safe_changes)

    return webhook_to_response(webhook)


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a webhook."""
    webhook = db.query(models.Webhook).filter(
        models.Webhook.id == webhook_id,
        models.Webhook.tenant_id == current_user.tenant_id
    ).first()

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    webhook_id_str = str(webhook.id)
    log_audit(db, current_user, models.AuditAction.DELETE, "Webhook", webhook_id_str)

    db.delete(webhook)
    db.commit()


@router.post("/{webhook_id}/rotate-secret")
async def rotate_webhook_secret(
    webhook_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Rotate a webhook's signing secret.

    The new secret is returned only once. Store it securely.
    """
    webhook = db.query(models.Webhook).filter(
        models.Webhook.id == webhook_id,
        models.Webhook.tenant_id == current_user.tenant_id
    ).first()

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    new_secret = WebhookService.rotate_secret(db, webhook)

    log_audit(db, current_user, models.AuditAction.UPDATE, "Webhook", str(webhook.id),
              changes={"action": "rotate_secret"})

    return {
        "message": "Secret rotated successfully",
        "secret": new_secret
    }


@router.post("/{webhook_id}/test")
async def test_webhook(
    webhook_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send a test event to a webhook.

    Sends a test.ping event to verify the webhook is configured correctly.
    """
    webhook = db.query(models.Webhook).filter(
        models.Webhook.id == webhook_id,
        models.Webhook.tenant_id == current_user.tenant_id
    ).first()

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    if not webhook.is_active:
        raise HTTPException(status_code=400, detail="Webhook is inactive")

    # Create test payload
    payload = {
        "event": "test.ping",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "tenant_id": str(current_user.tenant_id),
        "data": {
            "message": "This is a test webhook delivery",
            "webhook_id": str(webhook.id),
            "webhook_name": webhook.name
        }
    }

    # Attempt delivery synchronously for test
    import httpx
    import json

    secret = WebhookService.get_secret(webhook)
    payload_str = json.dumps(payload, default=str, separators=(',', ':'))
    timestamp = str(int(datetime.utcnow().timestamp()))
    signature = WebhookService.sign_payload(payload_str, secret, timestamp)

    headers = {
        "Content-Type": "application/json",
        WebhookService.SIGNATURE_HEADER: signature,
        WebhookService.TIMESTAMP_HEADER: timestamp,
        WebhookService.EVENT_HEADER: "test.ping",
        "User-Agent": "OpenReg-Webhook/1.0"
    }

    if webhook.headers:
        headers.update(webhook.headers)

    try:
        response = httpx.post(
            webhook.url,
            content=payload_str,
            headers=headers,
            timeout=webhook.timeout_seconds
        )

        return {
            "success": 200 <= response.status_code < 300,
            "status_code": response.status_code,
            "response_time_ms": int(response.elapsed.total_seconds() * 1000),
            "response_body": response.text[:1000] if response.text else None
        }

    except httpx.TimeoutException:
        return {
            "success": False,
            "error": "Request timed out",
            "timeout_seconds": webhook.timeout_seconds
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@router.get("/{webhook_id}/deliveries", response_model=List[WebhookDeliveryResponse])
async def list_webhook_deliveries(
    webhook_id: UUID,
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    event_type: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List delivery attempts for a webhook."""
    # Verify webhook belongs to tenant
    webhook = db.query(models.Webhook).filter(
        models.Webhook.id == webhook_id,
        models.Webhook.tenant_id == current_user.tenant_id
    ).first()

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    query = db.query(models.WebhookDelivery).filter(
        models.WebhookDelivery.webhook_id == webhook_id
    )

    if status:
        try:
            status_enum = models.WebhookDeliveryStatus(status)
            query = query.filter(models.WebhookDelivery.status == status_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

    if event_type:
        try:
            event_enum = models.WebhookEventType(event_type)
            query = query.filter(models.WebhookDelivery.event_type == event_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid event type: {event_type}")

    deliveries = query.order_by(
        models.WebhookDelivery.created_at.desc()
    ).offset(skip).limit(limit).all()

    return [
        WebhookDeliveryResponse(
            id=str(d.id),
            webhook_id=str(d.webhook_id),
            event_type=d.event_type.value,
            event_id=d.event_id,
            status=d.status.value,
            attempt_count=d.attempt_count,
            max_attempts=d.max_attempts,
            request_url=d.request_url,
            response_status_code=d.response_status_code,
            response_time_ms=d.response_time_ms,
            error_message=d.error_message,
            next_retry_at=d.next_retry_at,
            completed_at=d.completed_at,
            created_at=d.created_at
        )
        for d in deliveries
    ]


@router.get("/{webhook_id}/deliveries/{delivery_id}")
async def get_webhook_delivery(
    webhook_id: UUID,
    delivery_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific delivery attempt."""
    # Verify webhook belongs to tenant
    webhook = db.query(models.Webhook).filter(
        models.Webhook.id == webhook_id,
        models.Webhook.tenant_id == current_user.tenant_id
    ).first()

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    delivery = db.query(models.WebhookDelivery).filter(
        models.WebhookDelivery.id == delivery_id,
        models.WebhookDelivery.webhook_id == webhook_id
    ).first()

    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    return {
        "id": str(delivery.id),
        "webhook_id": str(delivery.webhook_id),
        "event_type": delivery.event_type.value,
        "event_id": delivery.event_id,
        "payload": delivery.payload,
        "status": delivery.status.value,
        "attempt_count": delivery.attempt_count,
        "max_attempts": delivery.max_attempts,
        "request": {
            "url": delivery.request_url,
            "headers": delivery.request_headers,
            "timestamp": delivery.request_timestamp
        },
        "response": {
            "status_code": delivery.response_status_code,
            "headers": delivery.response_headers,
            "body": delivery.response_body,
            "timestamp": delivery.response_timestamp,
            "time_ms": delivery.response_time_ms
        },
        "error_message": delivery.error_message,
        "next_retry_at": delivery.next_retry_at,
        "completed_at": delivery.completed_at,
        "created_at": delivery.created_at
    }


@router.post("/{webhook_id}/deliveries/{delivery_id}/retry")
async def retry_webhook_delivery(
    webhook_id: UUID,
    delivery_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually retry a failed delivery."""
    from tasks.webhook_tasks import deliver_webhook_task

    # Verify webhook belongs to tenant
    webhook = db.query(models.Webhook).filter(
        models.Webhook.id == webhook_id,
        models.Webhook.tenant_id == current_user.tenant_id
    ).first()

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    delivery = db.query(models.WebhookDelivery).filter(
        models.WebhookDelivery.id == delivery_id,
        models.WebhookDelivery.webhook_id == webhook_id
    ).first()

    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    if delivery.status == models.WebhookDeliveryStatus.SUCCESS:
        raise HTTPException(status_code=400, detail="Cannot retry successful delivery")

    # Reset for retry
    delivery.status = models.WebhookDeliveryStatus.PENDING
    delivery.attempt_count = 0
    delivery.error_message = None
    delivery.next_retry_at = None
    db.commit()

    # Queue delivery
    deliver_webhook_task.delay(str(delivery.id))

    return {
        "message": "Delivery retry queued",
        "delivery_id": str(delivery.id)
    }


@router.get("/events/types")
async def list_event_types(
    current_user: models.User = Depends(get_current_user)
):
    """List all available webhook event types."""
    return {
        "event_types": [
            {
                "value": e.value,
                "description": _get_event_description(e)
            }
            for e in models.WebhookEventType
        ]
    }


def _get_event_description(event_type: models.WebhookEventType) -> str:
    """Get a human-readable description for an event type."""
    descriptions = {
        models.WebhookEventType.JOB_STARTED: "Fired when a report job begins execution",
        models.WebhookEventType.JOB_COMPLETED: "Fired when a report job completes successfully",
        models.WebhookEventType.JOB_FAILED: "Fired when a report job fails",
        models.WebhookEventType.ARTIFACT_CREATED: "Fired when a new artifact is generated",
        models.WebhookEventType.DELIVERY_COMPLETED: "Fired when an artifact is delivered to a destination",
        models.WebhookEventType.DELIVERY_FAILED: "Fired when artifact delivery fails",
        models.WebhookEventType.VALIDATION_FAILED: "Fired when validation rules fail during execution",
        models.WebhookEventType.WORKFLOW_STATE_CHANGED: "Fired when workflow state transitions",
    }
    return descriptions.get(event_type, "No description available")
