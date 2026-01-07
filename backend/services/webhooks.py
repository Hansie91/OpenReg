"""
Webhook service for event notifications.

Handles webhook registration, HMAC signing, and delivery.
"""

import hashlib
import hmac
import json
import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4

import httpx
from sqlalchemy.orm import Session

from config import settings
from services.auth import encrypt_credentials, decrypt_credentials
import models

logger = logging.getLogger(__name__)


class WebhookService:
    """Service for managing webhooks and deliveries."""

    # Webhook signature header name
    SIGNATURE_HEADER = "X-OpenReg-Signature"
    TIMESTAMP_HEADER = "X-OpenReg-Timestamp"
    EVENT_HEADER = "X-OpenReg-Event"
    DELIVERY_HEADER = "X-OpenReg-Delivery"

    @staticmethod
    def generate_secret() -> str:
        """Generate a cryptographically secure webhook secret."""
        return secrets.token_urlsafe(32)

    @staticmethod
    def sign_payload(payload: str, secret: str, timestamp: str) -> str:
        """
        Generate HMAC-SHA256 signature for a webhook payload.

        Args:
            payload: JSON string payload
            secret: Webhook secret key
            timestamp: Unix timestamp string

        Returns:
            Hex-encoded HMAC-SHA256 signature
        """
        # Create signing string: timestamp.payload
        signing_string = f"{timestamp}.{payload}"
        signature = hmac.new(
            secret.encode('utf-8'),
            signing_string.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return f"sha256={signature}"

    @staticmethod
    def verify_signature(payload: str, signature: str, secret: str, timestamp: str) -> bool:
        """
        Verify a webhook signature.

        Args:
            payload: JSON string payload
            signature: Signature from header (format: sha256=...)
            secret: Webhook secret key
            timestamp: Unix timestamp from header

        Returns:
            True if signature is valid
        """
        if not signature.startswith("sha256="):
            return False

        expected = WebhookService.sign_payload(payload, secret, timestamp)
        return hmac.compare_digest(signature, expected)

    @classmethod
    def create_webhook(
        cls,
        db: Session,
        tenant_id: UUID,
        user_id: UUID,
        name: str,
        url: str,
        events: List[str],
        description: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        allowed_ips: Optional[List[str]] = None,
        report_ids: Optional[List[str]] = None,
        timeout_seconds: int = 30,
        retry_policy: Optional[Dict] = None
    ) -> tuple[models.Webhook, str]:
        """
        Create a new webhook.

        Returns:
            Tuple of (webhook, plain_secret) - secret is only returned once
        """
        # Generate and encrypt secret
        plain_secret = cls.generate_secret()
        secret_encrypted = encrypt_credentials({"secret": plain_secret})

        webhook = models.Webhook(
            tenant_id=tenant_id,
            created_by=user_id,
            name=name,
            description=description,
            url=url,
            secret_encrypted=secret_encrypted,
            events=events,
            headers=headers or {},
            allowed_ips=allowed_ips or [],
            report_ids=report_ids or [],
            timeout_seconds=timeout_seconds,
            retry_policy=retry_policy or {
                "max_attempts": 5,
                "backoff": "exponential",
                "base_delay": 5,
                "max_delay": 300
            },
            is_active=True
        )

        db.add(webhook)
        db.commit()
        db.refresh(webhook)

        logger.info(f"Created webhook {webhook.id} for tenant {tenant_id}")
        return webhook, plain_secret

    @classmethod
    def get_secret(cls, webhook: models.Webhook) -> str:
        """Decrypt and return the webhook secret."""
        creds = decrypt_credentials(webhook.secret_encrypted)
        return creds.get("secret", "")

    @classmethod
    def rotate_secret(cls, db: Session, webhook: models.Webhook) -> str:
        """
        Rotate a webhook's secret.

        Returns:
            New plain secret (only returned once)
        """
        plain_secret = cls.generate_secret()
        webhook.secret_encrypted = encrypt_credentials({"secret": plain_secret})
        webhook.updated_at = datetime.utcnow()
        db.commit()

        logger.info(f"Rotated secret for webhook {webhook.id}")
        return plain_secret

    @classmethod
    def get_webhooks_for_event(
        cls,
        db: Session,
        tenant_id: UUID,
        event_type: models.WebhookEventType,
        report_id: Optional[UUID] = None
    ) -> List[models.Webhook]:
        """
        Get all active webhooks subscribed to an event type.

        Args:
            tenant_id: Tenant ID
            event_type: The event type
            report_id: Optional report ID for filtering

        Returns:
            List of matching webhooks
        """
        webhooks = db.query(models.Webhook).filter(
            models.Webhook.tenant_id == tenant_id,
            models.Webhook.is_active == True
        ).all()

        # Filter by event subscription
        matching = []
        for webhook in webhooks:
            if event_type.value not in webhook.events:
                continue

            # Check report filter
            if webhook.report_ids and report_id:
                if str(report_id) not in webhook.report_ids:
                    continue

            matching.append(webhook)

        return matching

    @classmethod
    def create_delivery(
        cls,
        db: Session,
        webhook: models.Webhook,
        event_type: models.WebhookEventType,
        payload: Dict[str, Any],
        job_run_id: Optional[UUID] = None,
        artifact_id: Optional[UUID] = None
    ) -> models.WebhookDelivery:
        """
        Create a webhook delivery record.

        Args:
            webhook: The webhook to deliver to
            event_type: Type of event
            payload: Event payload
            job_run_id: Optional related job run
            artifact_id: Optional related artifact

        Returns:
            WebhookDelivery record
        """
        # Generate unique event ID for idempotency
        event_id = f"{event_type.value}-{uuid4().hex[:16]}-{int(datetime.utcnow().timestamp())}"

        retry_policy = webhook.retry_policy or {}
        max_attempts = retry_policy.get("max_attempts", 5)

        delivery = models.WebhookDelivery(
            webhook_id=webhook.id,
            tenant_id=webhook.tenant_id,
            event_type=event_type,
            event_id=event_id,
            payload=payload,
            job_run_id=job_run_id,
            artifact_id=artifact_id,
            status=models.WebhookDeliveryStatus.PENDING,
            max_attempts=max_attempts,
            request_url=webhook.url,
            request_headers=webhook.headers or {}
        )

        db.add(delivery)

        # Update webhook statistics
        webhook.total_deliveries += 1
        webhook.last_triggered_at = datetime.utcnow()

        db.commit()
        db.refresh(delivery)

        return delivery

    @classmethod
    async def deliver(
        cls,
        db: Session,
        delivery: models.WebhookDelivery,
        webhook: Optional[models.Webhook] = None
    ) -> bool:
        """
        Attempt to deliver a webhook.

        Args:
            db: Database session
            delivery: The delivery record
            webhook: Optional webhook (loaded if not provided)

        Returns:
            True if delivery succeeded
        """
        if not webhook:
            webhook = db.query(models.Webhook).filter(
                models.Webhook.id == delivery.webhook_id
            ).first()

        if not webhook or not webhook.is_active:
            delivery.status = models.WebhookDeliveryStatus.FAILED
            delivery.error_message = "Webhook not found or inactive"
            delivery.completed_at = datetime.utcnow()
            db.commit()
            return False

        # Get secret for signing
        secret = cls.get_secret(webhook)

        # Prepare payload
        payload_str = json.dumps(delivery.payload, default=str, separators=(',', ':'))
        timestamp = str(int(datetime.utcnow().timestamp()))

        # Sign payload
        signature = cls.sign_payload(payload_str, secret, timestamp)

        # Build headers
        headers = {
            "Content-Type": "application/json",
            cls.SIGNATURE_HEADER: signature,
            cls.TIMESTAMP_HEADER: timestamp,
            cls.EVENT_HEADER: delivery.event_type.value,
            cls.DELIVERY_HEADER: str(delivery.id),
            "User-Agent": "OpenReg-Webhook/1.0"
        }

        # Add custom headers from webhook config
        if webhook.headers:
            headers.update(webhook.headers)

        # Update delivery with request details
        delivery.attempt_count += 1
        delivery.request_timestamp = datetime.utcnow()
        delivery.request_headers = headers
        delivery.status = models.WebhookDeliveryStatus.RETRYING
        db.commit()

        # Make HTTP request
        try:
            async with httpx.AsyncClient() as client:
                start_time = datetime.utcnow()
                response = await client.post(
                    webhook.url,
                    content=payload_str,
                    headers=headers,
                    timeout=webhook.timeout_seconds
                )
                end_time = datetime.utcnow()

                # Record response
                delivery.response_status_code = response.status_code
                delivery.response_headers = dict(response.headers)
                delivery.response_body = response.text[:10240]  # Truncate to 10KB
                delivery.response_timestamp = end_time
                delivery.response_time_ms = int((end_time - start_time).total_seconds() * 1000)

                # Check success (2xx status codes)
                if 200 <= response.status_code < 300:
                    delivery.status = models.WebhookDeliveryStatus.SUCCESS
                    delivery.completed_at = datetime.utcnow()
                    webhook.successful_deliveries += 1
                    webhook.last_success_at = datetime.utcnow()
                    db.commit()

                    logger.info(f"Webhook delivery {delivery.id} succeeded: {response.status_code}")
                    return True
                else:
                    # Non-2xx response
                    raise httpx.HTTPStatusError(
                        f"HTTP {response.status_code}",
                        request=response.request,
                        response=response
                    )

        except Exception as e:
            error_msg = str(e)[:1000]  # Truncate error message
            delivery.error_message = error_msg

            logger.warning(f"Webhook delivery {delivery.id} failed (attempt {delivery.attempt_count}): {error_msg}")

            # Check if we should retry
            if delivery.attempt_count < delivery.max_attempts:
                # Calculate next retry time
                retry_policy = webhook.retry_policy or {}
                backoff_type = retry_policy.get("backoff", "exponential")
                base_delay = retry_policy.get("base_delay", 5)
                max_delay = retry_policy.get("max_delay", 300)

                if backoff_type == "exponential":
                    delay = min(base_delay * (2 ** (delivery.attempt_count - 1)), max_delay)
                elif backoff_type == "linear":
                    delay = min(base_delay * delivery.attempt_count, max_delay)
                else:  # fixed
                    delay = base_delay

                delivery.next_retry_at = datetime.utcnow() + timedelta(seconds=delay)
                delivery.status = models.WebhookDeliveryStatus.RETRYING
            else:
                # Max attempts reached
                delivery.status = models.WebhookDeliveryStatus.FAILED
                delivery.completed_at = datetime.utcnow()
                webhook.failed_deliveries += 1
                webhook.last_failure_at = datetime.utcnow()

            db.commit()
            return False

    @classmethod
    def build_event_payload(
        cls,
        event_type: models.WebhookEventType,
        data: Dict[str, Any],
        tenant_id: UUID
    ) -> Dict[str, Any]:
        """
        Build a standardized webhook event payload.

        Args:
            event_type: Type of event
            data: Event-specific data
            tenant_id: Tenant ID

        Returns:
            Standardized payload dict
        """
        return {
            "event": event_type.value,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "tenant_id": str(tenant_id),
            "data": data
        }


class WebhookEventEmitter:
    """Helper class for emitting webhook events from other parts of the system."""

    @classmethod
    def emit_job_started(
        cls,
        db: Session,
        job_run: models.JobRun,
        report: models.Report
    ):
        """Emit job.started event."""
        from tasks.webhook_tasks import deliver_webhook_task

        webhooks = WebhookService.get_webhooks_for_event(
            db,
            job_run.tenant_id,
            models.WebhookEventType.JOB_STARTED,
            report.id
        )

        payload = WebhookService.build_event_payload(
            models.WebhookEventType.JOB_STARTED,
            {
                "job_run_id": str(job_run.id),
                "report_id": str(report.id),
                "report_name": report.name,
                "triggered_by": job_run.triggered_by.value,
                "started_at": job_run.started_at.isoformat() if job_run.started_at else None
            },
            job_run.tenant_id
        )

        for webhook in webhooks:
            delivery = WebhookService.create_delivery(
                db, webhook, models.WebhookEventType.JOB_STARTED,
                payload, job_run_id=job_run.id
            )
            deliver_webhook_task.delay(str(delivery.id))

    @classmethod
    def emit_job_completed(
        cls,
        db: Session,
        job_run: models.JobRun,
        report: models.Report,
        duration_ms: Optional[int] = None
    ):
        """Emit job.completed event."""
        from tasks.webhook_tasks import deliver_webhook_task

        webhooks = WebhookService.get_webhooks_for_event(
            db,
            job_run.tenant_id,
            models.WebhookEventType.JOB_COMPLETED,
            report.id
        )

        # Get artifact count
        artifact_count = db.query(models.Artifact).filter(
            models.Artifact.job_run_id == job_run.id
        ).count()

        payload = WebhookService.build_event_payload(
            models.WebhookEventType.JOB_COMPLETED,
            {
                "job_run_id": str(job_run.id),
                "report_id": str(report.id),
                "report_name": report.name,
                "status": job_run.status.value,
                "started_at": job_run.started_at.isoformat() if job_run.started_at else None,
                "completed_at": job_run.ended_at.isoformat() if job_run.ended_at else None,
                "duration_ms": duration_ms,
                "artifact_count": artifact_count
            },
            job_run.tenant_id
        )

        for webhook in webhooks:
            delivery = WebhookService.create_delivery(
                db, webhook, models.WebhookEventType.JOB_COMPLETED,
                payload, job_run_id=job_run.id
            )
            deliver_webhook_task.delay(str(delivery.id))

    @classmethod
    def emit_job_failed(
        cls,
        db: Session,
        job_run: models.JobRun,
        report: models.Report,
        error_message: Optional[str] = None
    ):
        """Emit job.failed event."""
        from tasks.webhook_tasks import deliver_webhook_task

        webhooks = WebhookService.get_webhooks_for_event(
            db,
            job_run.tenant_id,
            models.WebhookEventType.JOB_FAILED,
            report.id
        )

        payload = WebhookService.build_event_payload(
            models.WebhookEventType.JOB_FAILED,
            {
                "job_run_id": str(job_run.id),
                "report_id": str(report.id),
                "report_name": report.name,
                "error_message": error_message or job_run.error_message,
                "started_at": job_run.started_at.isoformat() if job_run.started_at else None,
                "failed_at": job_run.ended_at.isoformat() if job_run.ended_at else None
            },
            job_run.tenant_id
        )

        for webhook in webhooks:
            delivery = WebhookService.create_delivery(
                db, webhook, models.WebhookEventType.JOB_FAILED,
                payload, job_run_id=job_run.id
            )
            deliver_webhook_task.delay(str(delivery.id))

    @classmethod
    def emit_artifact_created(
        cls,
        db: Session,
        artifact: models.Artifact,
        job_run: models.JobRun,
        report: models.Report
    ):
        """Emit artifact.created event."""
        from tasks.webhook_tasks import deliver_webhook_task

        webhooks = WebhookService.get_webhooks_for_event(
            db,
            job_run.tenant_id,
            models.WebhookEventType.ARTIFACT_CREATED,
            report.id
        )

        payload = WebhookService.build_event_payload(
            models.WebhookEventType.ARTIFACT_CREATED,
            {
                "artifact_id": str(artifact.id),
                "job_run_id": str(job_run.id),
                "report_id": str(report.id),
                "filename": artifact.filename,
                "mime_type": artifact.mime_type,
                "size_bytes": artifact.size_bytes,
                "checksum_sha256": artifact.checksum_sha256
            },
            job_run.tenant_id
        )

        for webhook in webhooks:
            delivery = WebhookService.create_delivery(
                db, webhook, models.WebhookEventType.ARTIFACT_CREATED,
                payload, job_run_id=job_run.id, artifact_id=artifact.id
            )
            deliver_webhook_task.delay(str(delivery.id))

    @classmethod
    def emit_validation_failed(
        cls,
        db: Session,
        job_run: models.JobRun,
        report: models.Report,
        validation_details: Dict[str, Any]
    ):
        """Emit validation.failed event."""
        from tasks.webhook_tasks import deliver_webhook_task

        webhooks = WebhookService.get_webhooks_for_event(
            db,
            job_run.tenant_id,
            models.WebhookEventType.VALIDATION_FAILED,
            report.id
        )

        payload = WebhookService.build_event_payload(
            models.WebhookEventType.VALIDATION_FAILED,
            {
                "job_run_id": str(job_run.id),
                "report_id": str(report.id),
                "report_name": report.name,
                "validation": validation_details
            },
            job_run.tenant_id
        )

        for webhook in webhooks:
            delivery = WebhookService.create_delivery(
                db, webhook, models.WebhookEventType.VALIDATION_FAILED,
                payload, job_run_id=job_run.id
            )
            deliver_webhook_task.delay(str(delivery.id))
