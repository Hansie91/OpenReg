"""
Test Data Insertion Script

Run this inside the Docker container or with proper database access to insert
sample data for testing log streaming and record lifecycle features.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, date, timedelta
from uuid import uuid4
import random

from database import SessionLocal, engine, Base
import models

# Create tables
Base.metadata.create_all(bind=engine)

def create_test_data():
    db = SessionLocal()
    
    try:
        # Get or create tenant
        tenant = db.query(models.Tenant).first()
        if not tenant:
            tenant = models.Tenant(
                id=uuid4(),
                name="Demo Tenant",
                slug="demo",
                is_active=True
            )
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
        
        # Get or create user
        user = db.query(models.User).filter(models.User.tenant_id == tenant.id).first()
        if not user:
            from services.auth import get_password_hash
            user = models.User(
                id=uuid4(),
                tenant_id=tenant.id,
                email="admin@demo.com",
                hashed_password=get_password_hash("admin123"),
                full_name="Demo Admin",
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        
        # Get or create report
        report = db.query(models.Report).filter(models.Report.tenant_id == tenant.id).first()
        if not report:
            report = models.Report(
                id=uuid4(),
                tenant_id=tenant.id,
                name="MiFIR Transaction Report",
                description="Sample MiFIR report",
                is_active=True,
                created_by=user.id
            )
            db.add(report)
            db.commit()
            db.refresh(report)
        
        # Get or create report version
        report_version = db.query(models.ReportVersion).filter(
            models.ReportVersion.report_id == report.id
        ).first()
        if not report_version:
            report_version = models.ReportVersion(
                id=uuid4(),
                report_id=report.id,
                version_number=1,
                python_code="# Sample code\ndf = query_db('SELECT * FROM transactions')",
                status=models.ReportVersionStatus.ACTIVE,
                created_by=user.id
            )
            db.add(report_version)
            db.commit()
            db.refresh(report_version)
        
        # Create validation rule
        validation_rule = db.query(models.ValidationRule).filter(
            models.ValidationRule.tenant_id == tenant.id
        ).first()
        if not validation_rule:
            validation_rule = models.ValidationRule(
                id=uuid4(),
                tenant_id=tenant.id,
                name="LEI Validation",
                description="Validates LEI format",
                rule_type=models.ValidationRuleType.PYTHON_EXPR,
                expression="len(row.get('lei', '')) == 20",
                severity=models.ValidationSeverity.BLOCKING,
                error_message="Invalid LEI format - must be 20 characters",
                is_active=True,
                created_by=user.id
            )
            db.add(validation_rule)
            db.commit()
            db.refresh(validation_rule)
        
        # Create sample job runs with different business dates
        business_dates = [
            date.today(),
            date.today() - timedelta(days=1),
            date.today() - timedelta(days=2),
            date.today() - timedelta(days=7)
        ]
        
        for biz_date in business_dates:
            # Create job run
            job_run = models.JobRun(
                id=uuid4(),
                tenant_id=tenant.id,
                report_version_id=report_version.id,
                triggered_by=models.TriggeredBy.SCHEDULE,
                status=random.choice([models.JobRunStatus.SUCCESS, models.JobRunStatus.PARTIAL, models.JobRunStatus.FAILED]),
                parameters={"business_date": biz_date.isoformat()},
                started_at=datetime.combine(biz_date, datetime.min.time().replace(hour=6)),
                ended_at=datetime.combine(biz_date, datetime.min.time().replace(hour=6, minute=5))
            )
            db.add(job_run)
            db.commit()
            db.refresh(job_run)
            
            # Add log entries for this run
            log_messages = [
                ("info", "Starting report execution..."),
                ("info", f"Business date: {biz_date}"),
                ("info", "Connecting to data source..."),
                ("info", "Executing SQL query..."),
                ("info", "Retrieved 1250 records"),
                ("info", "Running pre-validation checks..."),
                ("warning", "Found 3 records with warnings"),
                ("info", "Generating XML output..."),
                ("info", "File generated: MIFIR_20241212.xml"),
                ("info", "Report execution completed"),
            ]
            
            for i, (level, msg) in enumerate(log_messages):
                log_entry = models.JobRunLog(
                    id=uuid4(),
                    job_run_id=job_run.id,
                    line_number=i + 1,
                    level=models.LogLevel(level),
                    message=msg,
                    context={"business_date": biz_date.isoformat()}
                )
                db.add(log_entry)
            
            # Create file submission
            file_submission = models.FileSubmission(
                id=uuid4(),
                tenant_id=tenant.id,
                job_run_id=job_run.id,
                business_date=biz_date,
                submission_sequence=1,
                file_name=f"MIFIR_{biz_date.strftime('%Y%m%d')}.xml",
                status=random.choice([
                    models.FileSubmissionStatus.ACCEPTED,
                    models.FileSubmissionStatus.PARTIAL,
                    models.FileSubmissionStatus.SUBMITTED
                ]),
                record_count=random.randint(50, 200),
                submitted_at=datetime.combine(biz_date, datetime.min.time().replace(hour=7))
            )
            db.add(file_submission)
            db.commit()
            db.refresh(file_submission)
            
            # Create sample record submissions
            for row_num in range(1, 6):
                record_status = random.choice([
                    models.RecordStatus.ACCEPTED,
                    models.RecordStatus.RECORD_REJECTED,
                    models.RecordStatus.PRE_VALIDATION_FAILED
                ])
                
                record = models.RecordSubmission(
                    id=uuid4(),
                    tenant_id=tenant.id,
                    file_submission_id=file_submission.id if record_status != models.RecordStatus.PRE_VALIDATION_FAILED else None,
                    job_run_id=job_run.id,
                    business_date=biz_date,
                    record_ref=f"TXN-{biz_date.strftime('%Y%m%d')}-{str(row_num).zfill(4)}",
                    row_number=row_num,
                    original_data={
                        "transaction_id": f"TXN-{random.randint(10000, 99999)}",
                        "lei": "529900T8BM49AURSDO55" if record_status == models.RecordStatus.ACCEPTED else "INVALID_LEI",
                        "amount": random.uniform(1000, 100000),
                        "currency": "EUR",
                        "trade_date": biz_date.isoformat()
                    },
                    status=record_status,
                    rejection_source=models.ExceptionSource.REGULATOR_RECORD if record_status == models.RecordStatus.RECORD_REJECTED else (
                        models.ExceptionSource.PRE_VALIDATION if record_status == models.RecordStatus.PRE_VALIDATION_FAILED else None
                    ),
                    rejection_code="ESMA-001" if record_status == models.RecordStatus.RECORD_REJECTED else None,
                    rejection_message="Invalid LEI format" if record_status != models.RecordStatus.ACCEPTED else None
                )
                db.add(record)
            
            # Create validation exceptions
            for row_num in range(1, 4):
                exception = models.ValidationException(
                    id=uuid4(),
                    job_run_id=job_run.id,
                    validation_rule_id=validation_rule.id,
                    row_number=row_num,
                    original_data={
                        "transaction_id": f"TXN-{random.randint(10000, 99999)}",
                        "lei": "BADLEI123",
                        "amount": random.uniform(1000, 100000),
                        "trade_date": biz_date.isoformat()
                    },
                    error_message="Invalid LEI format - must be 20 characters",
                    status=random.choice([
                        models.ExceptionStatus.PENDING,
                        models.ExceptionStatus.AMENDED,
                        models.ExceptionStatus.RESOLVED
                    ])
                )
                db.add(exception)
        
        db.commit()
        print(f"✅ Test data created successfully!")
        print(f"   - Tenant: {tenant.name}")
        print(f"   - User: {user.email}")
        print(f"   - Report: {report.name}")
        print(f"   - Job Runs: {len(business_dates)} runs for different business dates")
        print(f"   - Log entries, file submissions, record submissions, and exceptions added")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating test data: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    create_test_data()
