"""
Streaming Worker - Celery Tasks

Provides Celery tasks for:
- Consuming messages from Kafka topics
- Checking batch trigger conditions
- Processing micro-batches
"""

from celery import Celery
from datetime import datetime, timedelta
import logging

from database import SessionLocal
import models
from services.batch_aggregator import BatchAggregator, get_pending_stats

# Use the same Celery app as the main worker
from worker import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name='streaming.consume_topic')
def consume_topic_task(topic_id: str, max_messages: int = 1000):
    """
    Consume messages from a Kafka topic and buffer them.
    
    This task runs for a limited number of messages or until polling timeout,
    then exits. It should be scheduled to run frequently (e.g., every 10s).
    """
    from services.stream_consumer import StreamingConsumer
    from uuid import UUID
    
    db = SessionLocal()
    try:
        topic = db.query(models.StreamingTopic).filter(
            models.StreamingTopic.id == UUID(topic_id),
            models.StreamingTopic.is_active == True
        ).first()
        
        if not topic:
            logger.warning(f"Topic {topic_id} not found or inactive")
            return {"status": "skipped", "reason": "topic not found or inactive"}
        
        consumer = StreamingConsumer(topic, db)
        consumed = consumer.consume_batch(max_messages)
        
        return {
            "status": "success",
            "topic": topic.name,
            "consumed": consumed
        }
    except Exception as e:
        logger.error(f"Error consuming topic {topic_id}: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        db.close()


@celery_app.task(name='streaming.check_batch_triggers')
def check_batch_triggers_task():
    """
    Check all streaming-enabled reports for trigger conditions.
    
    This task should run periodically (e.g., every minute) via Celery Beat.
    It checks both time-window and threshold conditions for each report
    with streaming enabled.
    """
    db = SessionLocal()
    triggered_batches = []
    
    try:
        # Find all reports with streaming enabled
        reports = db.query(models.Report).filter(
            models.Report.streaming_config.isnot(None)
        ).all()
        
        for report in reports:
            config = report.streaming_config
            if not config or not config.get('enabled'):
                continue
            
            topic_id = config.get('topic_id')
            if not topic_id:
                continue
            
            trigger_mode = config.get('trigger_mode', 'combined')
            window_minutes = config.get('window_minutes', 15)
            threshold_count = config.get('threshold_count', 10000)
            
            # Create aggregator and check triggers
            aggregator = BatchAggregator(
                db=db,
                topic_id=topic_id,
                report_id=report.id
            )
            
            mode = models.StreamingTriggerMode(trigger_mode)
            batch_id = aggregator.check_and_trigger(
                trigger_mode=mode,
                window_minutes=window_minutes,
                threshold_count=threshold_count
            )
            
            if batch_id:
                triggered_batches.append({
                    "report_id": str(report.id),
                    "report_name": report.name,
                    "batch_id": str(batch_id)
                })
                logger.info(f"Triggered batch {batch_id} for report {report.name}")
        
        return {
            "status": "success",
            "reports_checked": len(reports),
            "batches_triggered": triggered_batches
        }
    except Exception as e:
        logger.error(f"Error checking batch triggers: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        db.close()


@celery_app.task(name='streaming.force_batch')
def force_batch_task(report_id: str):
    """
    Force trigger a batch for a specific report regardless of conditions.
    
    Used for manual batch triggering from the UI.
    """
    from uuid import UUID
    
    db = SessionLocal()
    try:
        report = db.query(models.Report).filter(
            models.Report.id == UUID(report_id)
        ).first()
        
        if not report:
            return {"status": "error", "message": "Report not found"}
        
        config = report.streaming_config
        if not config or not config.get('topic_id'):
            return {"status": "error", "message": "Streaming not configured for this report"}
        
        aggregator = BatchAggregator(
            db=db,
            topic_id=config['topic_id'],
            report_id=report.id
        )
        
        batch_id = aggregator.force_trigger()
        
        if batch_id:
            return {
                "status": "success",
                "batch_id": str(batch_id),
                "report_name": report.name
            }
        else:
            return {"status": "skipped", "reason": "No pending messages to process"}
    except Exception as e:
        logger.error(f"Error forcing batch for report {report_id}: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        db.close()


@celery_app.task(name='streaming.get_buffer_stats')
def get_buffer_stats_task(topic_id: str):
    """Get current buffer statistics for a topic"""
    from uuid import UUID
    
    db = SessionLocal()
    try:
        stats = get_pending_stats(db, UUID(topic_id))
        return {"status": "success", "stats": stats}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        db.close()


# === Celery Beat Schedule Entry ===
# Add this to celeryconfig.py or worker.py beat_schedule:
#
# 'check-streaming-triggers': {
#     'task': 'streaming.check_batch_triggers',
#     'schedule': 60.0,  # Every 60 seconds
# },
