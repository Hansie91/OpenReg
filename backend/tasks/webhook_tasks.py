"""
Webhook delivery tasks.

Celery tasks for asynchronous webhook delivery with retry support.
"""

import logging
import asyncio
from datetime import datetime
from celery import shared_task
from sqlalchemy.orm import Session

from database import SessionLocal
import models

logger = logging.getLogger(__name__)


def get_db() -> Session:
    """Get database session."""
    return SessionLocal()


@shared_task(bind=True, max_retries=10)
def deliver_webhook_task(self, delivery_id: str):
    """
    Celery task to deliver a webhook.

    Handles async delivery with automatic retry based on webhook's retry policy.

    Args:
        delivery_id: ID of the WebhookDelivery record
    """
    logger.info(f"Processing webhook delivery: {delivery_id}")

    db = get_db()
    try:
        # Get delivery record
        delivery = db.query(models.WebhookDelivery).filter(
            models.WebhookDelivery.id == delivery_id
        ).first()

        if not delivery:
            logger.error(f"Webhook delivery not found: {delivery_id}")
            return {"error": "Delivery not found"}

        # Check if already completed
        if delivery.status == models.WebhookDeliveryStatus.SUCCESS:
            logger.info(f"Delivery {delivery_id} already completed successfully")
            return {"status": "already_completed"}

        # Get webhook
        webhook = db.query(models.Webhook).filter(
            models.Webhook.id == delivery.webhook_id
        ).first()

        if not webhook:
            delivery.status = models.WebhookDeliveryStatus.FAILED
            delivery.error_message = "Webhook not found"
            delivery.completed_at = datetime.utcnow()
            db.commit()
            return {"error": "Webhook not found"}

        if not webhook.is_active:
            delivery.status = models.WebhookDeliveryStatus.FAILED
            delivery.error_message = "Webhook is inactive"
            delivery.completed_at = datetime.utcnow()
            db.commit()
            return {"error": "Webhook inactive"}

        # Run async delivery
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            from services.webhooks import WebhookService
            success = loop.run_until_complete(
                WebhookService.deliver(db, delivery, webhook)
            )
        finally:
            loop.close()

        if success:
            return {
                "status": "success",
                "delivery_id": delivery_id,
                "attempts": delivery.attempt_count
            }
        else:
            # Check if we should retry via Celery
            if delivery.status == models.WebhookDeliveryStatus.RETRYING and delivery.next_retry_at:
                # Calculate delay until next retry
                delay = (delivery.next_retry_at - datetime.utcnow()).total_seconds()
                if delay > 0:
                    logger.info(f"Scheduling retry for delivery {delivery_id} in {delay}s")
                    raise self.retry(
                        countdown=max(1, int(delay)),
                        exc=Exception(f"Delivery failed, retrying: {delivery.error_message}")
                    )

            return {
                "status": "failed",
                "delivery_id": delivery_id,
                "error": delivery.error_message,
                "attempts": delivery.attempt_count
            }

    except self.MaxRetriesExceededError:
        logger.error(f"Max retries exceeded for delivery {delivery_id}")
        # Update delivery status
        try:
            delivery = db.query(models.WebhookDelivery).filter(
                models.WebhookDelivery.id == delivery_id
            ).first()
            if delivery and delivery.status != models.WebhookDeliveryStatus.SUCCESS:
                delivery.status = models.WebhookDeliveryStatus.FAILED
                delivery.completed_at = datetime.utcnow()
                db.commit()
        except Exception:
            pass
        return {"error": "Max retries exceeded"}

    except Exception as e:
        logger.error(f"Webhook delivery task failed: {e}", exc_info=True)
        raise

    finally:
        db.close()


@shared_task
def process_pending_deliveries():
    """
    Process pending webhook deliveries that need retry.

    This task is run periodically to pick up any deliveries
    that may have been missed or need retry.
    """
    logger.info("Processing pending webhook deliveries")

    db = get_db()
    try:
        # Find deliveries that need retry
        pending = db.query(models.WebhookDelivery).filter(
            models.WebhookDelivery.status == models.WebhookDeliveryStatus.RETRYING,
            models.WebhookDelivery.next_retry_at <= datetime.utcnow()
        ).limit(100).all()

        queued = 0
        for delivery in pending:
            deliver_webhook_task.delay(str(delivery.id))
            queued += 1

        logger.info(f"Queued {queued} pending webhook deliveries")
        return {"queued": queued}

    finally:
        db.close()


@shared_task
def cleanup_old_deliveries(days: int = 30):
    """
    Clean up old webhook delivery records.

    Removes completed delivery records older than the specified days
    to prevent database bloat.

    Args:
        days: Number of days to retain delivery records
    """
    from datetime import timedelta

    logger.info(f"Cleaning up webhook deliveries older than {days} days")

    db = get_db()
    try:
        cutoff = datetime.utcnow() - timedelta(days=days)

        # Delete old completed deliveries
        deleted = db.query(models.WebhookDelivery).filter(
            models.WebhookDelivery.completed_at < cutoff,
            models.WebhookDelivery.status.in_([
                models.WebhookDeliveryStatus.SUCCESS,
                models.WebhookDeliveryStatus.FAILED
            ])
        ).delete(synchronize_session=False)

        db.commit()

        logger.info(f"Deleted {deleted} old webhook delivery records")
        return {"deleted": deleted}

    finally:
        db.close()
