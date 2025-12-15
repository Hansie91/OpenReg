"""
Script to check the latest failed job run and see the error
"""

import sys
import os
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from database import SessionLocal
import models

def check_latest_runs():
    db = SessionLocal()
    try:
        # Get latest job runs
        runs = db.query(models.JobRun).order_by(
            models.JobRun.created_at.desc()
        ).limit(5).all()
        
        print(f"\n{'='*60}")
        print(f"Latest {len(runs)} job run(s)")
        print(f"{'='*60}\n")
        
        for run in runs:
            # Get report name
            version = db.query(models.ReportVersion).filter(
                models.ReportVersion.id == run.report_version_id
            ).first()
            report = None
            if version:
                report = db.query(models.Report).filter(
                    models.Report.id == version.report_id
                ).first()
            
            print(f"📋 Run ID: {str(run.id)[:8]}...")
            print(f"   Report: {report.name if report else 'Unknown'}")
            print(f"   Status: {run.status.value}")
            print(f"   Created: {run.created_at}")
            print(f"   Started: {run.started_at}")
            print(f"   Ended: {run.ended_at}")
            
            if run.error_message:
                print(f"\n   ❌ ERROR:")
                print(f"   {run.error_message}")
            
            # Check for logs
            logs = db.query(models.JobRunLog).filter(
                models.JobRunLog.job_run_id == run.id
            ).order_by(models.JobRunLog.line_number.desc()).limit(10).all()
            
            if logs:
                print(f"\n   📜 Last {len(logs)} log entries:")
                for log in reversed(logs):
                    print(f"      [{log.level.value}] {log.message[:80]}")
            
            print(f"\n{'-'*60}\n")
            
    finally:
        db.close()

if __name__ == "__main__":
    check_latest_runs()
