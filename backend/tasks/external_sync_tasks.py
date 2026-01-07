"""
Celery Tasks for External API Synchronization

Tasks for syncing regulatory data from external APIs,
including scheduled syncs, manual triggers, and cleanup.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from celery import shared_task
from croniter import croniter

from database import SessionLocal
import models
from models import ExternalAPIConfig, SyncModeType, SyncTriggerType
from services.external_api import ExternalAPISyncService

logger = logging.getLogger(__name__)


def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        return db
    except Exception:
        db.close()
        raise


@shared_task(bind=True, max_retries=3)
def sync_external_api_task(
    self,
    api_config_id: str,
    mode: str = "differential",
    triggered_by: str = "manual",
    trigger_user_id: Optional[str] = None
):
    """
    Main sync task for external API.

    Args:
        api_config_id: UUID of the ExternalAPIConfig
        mode: "full" or "differential"
        triggered_by: "scheduled", "manual", or "api"
        trigger_user_id: UUID of user who triggered (if manual)

    Returns:
        Dict with sync results
    """
    db = get_db()
    try:
        # Get API config
        api_config = db.query(ExternalAPIConfig).filter(
            ExternalAPIConfig.id == api_config_id
        ).first()

        if not api_config:
            logger.error(f"API config not found: {api_config_id}")
            return {"success": False, "error": "API config not found"}

        if not api_config.is_active:
            logger.warning(f"API config is inactive: {api_config_id}")
            return {"success": False, "error": "API config is inactive"}

        # Initialize sync service
        sync_service = ExternalAPISyncService(db, api_config)

        # Run async sync
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                sync_service.sync_all(
                    mode=SyncModeType(mode),
                    triggered_by=SyncTriggerType(triggered_by),
                    trigger_user_id=trigger_user_id
                )
            )
        finally:
            loop.close()

        logger.info(f"Sync completed for {api_config.name}: {result}")

        return {
            "success": result.success,
            "items_fetched": result.items_fetched,
            "reports_created": result.reports_created,
            "reports_updated": result.reports_updated,
            "validations_created": result.validations_created,
            "validations_updated": result.validations_updated,
            "reference_data_created": result.reference_data_created,
            "reference_data_updated": result.reference_data_updated,
            "schedules_created": result.schedules_created,
            "schedules_updated": result.schedules_updated,
            "conflicts_detected": result.conflicts_detected,
            "errors": result.errors[:10],  # First 10 errors
            "api_response_time_ms": result.api_response_time_ms,
        }

    except Exception as e:
        logger.error(f"Sync task failed: {e}", exc_info=True)

        # Retry with exponential backoff
        retry_countdown = min(300, 60 * (2 ** self.request.retries))
        raise self.retry(exc=e, countdown=retry_countdown)

    finally:
        db.close()


@shared_task
def check_scheduled_syncs_task():
    """
    Periodic task to check which API configs need syncing.

    Runs every minute via Celery Beat. Checks each active API config's
    sync_schedule (cron expression) and queues sync tasks as needed.

    Returns:
        Dict with number of syncs queued
    """
    db = get_db()
    try:
        now = datetime.utcnow()
        queued = 0

        # Find all active API configs with auto_sync_enabled
        configs = db.query(ExternalAPIConfig).filter(
            ExternalAPIConfig.is_active == True,
            ExternalAPIConfig.auto_sync_enabled == True,
            ExternalAPIConfig.sync_schedule.isnot(None)
        ).all()

        for config in configs:
            try:
                # Parse cron expression
                if not config.sync_schedule:
                    continue

                # Calculate next run time based on cron
                base_time = config.last_sync_at or (now - timedelta(days=1))
                cron = croniter(config.sync_schedule, base_time)
                next_run = cron.get_next(datetime)

                # Check if it's time to run
                if next_run <= now:
                    logger.info(f"Scheduling sync for {config.name} (next_run={next_run})")

                    # Queue sync task
                    sync_external_api_task.delay(
                        api_config_id=str(config.id),
                        mode="differential",
                        triggered_by="scheduled"
                    )
                    queued += 1

            except Exception as e:
                logger.error(f"Error checking schedule for {config.name}: {e}")
                continue

        logger.info(f"Scheduled syncs check: queued {queued} tasks")
        return {"queued": queued, "checked": len(configs)}

    finally:
        db.close()


@shared_task
def cleanup_old_sync_logs_task(days: int = 90):
    """
    Clean up old sync logs.

    Args:
        days: Delete logs older than this many days

    Returns:
        Dict with number of logs deleted
    """
    db = get_db()
    try:
        cutoff = datetime.utcnow() - timedelta(days=days)

        deleted = db.query(models.ExternalAPISyncLog).filter(
            models.ExternalAPISyncLog.completed_at < cutoff,
            models.ExternalAPISyncLog.status.in_(["success", "failed"])
        ).delete(synchronize_session=False)

        db.commit()

        logger.info(f"Cleaned up {deleted} old sync logs (older than {days} days)")
        return {"deleted": deleted}

    except Exception as e:
        logger.error(f"Failed to cleanup sync logs: {e}")
        db.rollback()
        return {"deleted": 0, "error": str(e)}

    finally:
        db.close()


@shared_task
def sync_all_tenants_task(mode: str = "differential"):
    """
    Sync all active API configs across all tenants.

    Useful for administrative bulk sync operations.

    Args:
        mode: "full" or "differential"

    Returns:
        Dict with sync results per config
    """
    db = get_db()
    try:
        configs = db.query(ExternalAPIConfig).filter(
            ExternalAPIConfig.is_active == True,
            ExternalAPIConfig.auto_sync_enabled == True
        ).all()

        queued = 0
        for config in configs:
            sync_external_api_task.delay(
                api_config_id=str(config.id),
                mode=mode,
                triggered_by="api"
            )
            queued += 1

        logger.info(f"Queued {queued} sync tasks for all tenants")
        return {"queued": queued, "total_configs": len(configs)}

    finally:
        db.close()
