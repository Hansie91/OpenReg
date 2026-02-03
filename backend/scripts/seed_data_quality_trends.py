"""
Data Quality Trend Mock Data Seed Script

Populates the database with realistic data for the Data Quality Analysis page:
- Job runs over the past 90 days
- Validation results with pass/fail data
- Record submissions with various statuses
- Validation exceptions with different statuses

This enables the trend charts and metrics to display meaningful data.
"""

import sys
import os
from datetime import datetime, date, timedelta, timezone
import uuid
import random

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import SessionLocal, engine
from models import (
    Tenant, User, Report, ReportVersion, Connector, Schedule, HolidayCalendar,
    JobRun, ValidationRule, ValidationResult, ValidationException,
    RecordSubmission, FileSubmission,
    JobRunStatus, TriggeredBy, ReportVersionStatus, ValidationSeverity,
    ValidationRuleType, ExecutionPhase, ExceptionStatus, RecordStatus,
    FileSubmissionStatus, ScheduleType, ConnectorType
)


def ensure_connector(db, tenant_id: uuid.UUID, user_id: uuid.UUID) -> uuid.UUID:
    """Ensure a connector exists for the tenant."""
    connector = db.query(Connector).filter(
        Connector.tenant_id == tenant_id,
        Connector.is_active == True
    ).first()

    if not connector:
        connector = Connector(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            name="Demo PostgreSQL",
            description="Demo data source",
            type=ConnectorType.POSTGRESQL,
            config={"host": "localhost", "port": 5432, "database": "demo"},
            is_active=True,
            created_by=user_id
        )
        db.add(connector)
        db.commit()

    return connector.id


def ensure_validation_rules(db, tenant_id: uuid.UUID, user_id: uuid.UUID) -> list:
    """Ensure validation rules exist and return them."""
    existing_rules = db.query(ValidationRule).filter(
        ValidationRule.tenant_id == tenant_id,
        ValidationRule.is_active == True
    ).all()

    if len(existing_rules) >= 5:
        return existing_rules[:10]  # Return first 10 rules

    # Create validation rules
    rule_definitions = [
        ("LEI Format Check", "Validates LEI format follows ISO 17442", ValidationSeverity.BLOCKING, "LEI format must be 20 alphanumeric characters"),
        ("ISIN Format Check", "Validates ISIN format follows ISO 6166", ValidationSeverity.BLOCKING, "ISIN must be 12 characters with valid checksum"),
        ("UTI Format Check", "Validates UTI format follows ISO 23897", ValidationSeverity.BLOCKING, "UTI must be max 52 characters starting with LEI"),
        ("Notional Amount Range", "Validates notional is within acceptable range", ValidationSeverity.WARNING, "Notional amount outside expected range"),
        ("Execution Date Check", "Validates execution date is not in future", ValidationSeverity.BLOCKING, "Execution date cannot be in the future"),
        ("Maturity Date Check", "Validates maturity date is after execution", ValidationSeverity.BLOCKING, "Maturity date must be after execution date"),
        ("Currency Code Check", "Validates ISO 4217 currency codes", ValidationSeverity.CORRECTABLE, "Invalid currency code"),
        ("Counterparty LEI Check", "Validates counterparty LEI exists in GLEIF", ValidationSeverity.CORRECTABLE, "Counterparty LEI not found in GLEIF"),
        ("Price Range Check", "Validates price is within market tolerance", ValidationSeverity.WARNING, "Price outside expected market range"),
        ("MIC Code Check", "Validates MIC code per ISO 10383", ValidationSeverity.CORRECTABLE, "Invalid MIC code format"),
    ]

    rules = []
    for name, desc, severity, error_msg in rule_definitions:
        rule = db.query(ValidationRule).filter(
            ValidationRule.tenant_id == tenant_id,
            ValidationRule.name == name
        ).first()

        if not rule:
            rule = ValidationRule(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                name=name,
                description=desc,
                rule_type=ValidationRuleType.PYTHON_EXPR,
                expression="True",  # Simplified expression
                severity=severity,
                error_message=error_msg,
                is_active=True,
                created_by=user_id
            )
            db.add(rule)
        rules.append(rule)

    db.commit()
    return rules


def ensure_reports(db, tenant_id: uuid.UUID, user_id: uuid.UUID, connector_id: uuid.UUID) -> list:
    """Ensure reports exist for different regulations."""
    regulations = [
        ("EMIR Trade Report", "EMIR"),
        ("MiFIR Transaction Report", "MiFIR"),
        ("SFTR Transaction Report", "SFTR"),
    ]

    reports = []
    for name, regulation in regulations:
        report = db.query(Report).filter(
            Report.tenant_id == tenant_id,
            Report.name == name
        ).first()

        if not report:
            report = Report(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                name=name,
                description=f"Automated {regulation} regulatory report",
                is_active=True,
                created_by=user_id
            )
            db.add(report)
            db.commit()

            # Create report version
            version = ReportVersion(
                id=uuid.uuid4(),
                report_id=report.id,
                major_version=1,
                minor_version=0,
                version_number=1000,
                python_code="# Auto-generated report logic",
                connector_id=connector_id,
                config={"regulation": regulation, "output_format": "xml"},
                status=ReportVersionStatus.ACTIVE,
                created_by=user_id
            )
            db.add(version)
            db.commit()

            # Update report's current version
            report.current_version_id = version.id
            db.commit()

        reports.append(report)

    return reports


def ensure_schedules(db, tenant_id: uuid.UUID, reports: list) -> list:
    """Ensure schedules exist for reports."""
    schedules = []

    for report in reports:
        schedule = db.query(Schedule).filter(
            Schedule.tenant_id == tenant_id,
            Schedule.report_id == report.id,
            Schedule.is_active == True
        ).first()

        if not schedule:
            schedule = Schedule(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                report_id=report.id,
                name=f"{report.name} Daily Schedule",
                schedule_type=ScheduleType.CRON,
                cron_expression="0 18 * * 1-5",  # 6PM weekdays
                is_active=True,
                business_day_offset=1,
                skip_weekends=True,
                skip_holidays=True
            )
            db.add(schedule)
        schedules.append(schedule)

    db.commit()
    return schedules


def generate_job_runs_and_data(
    db,
    tenant_id: uuid.UUID,
    reports: list,
    validation_rules: list,
    days: int = 90
):
    """Generate job runs with validation results and record submissions."""

    today = date.today()
    start_date = today - timedelta(days=days)

    # Quality trend - slightly improving over time
    # Start around 92-94%, end around 96-98%
    base_quality_start = 92.0
    quality_improvement_rate = 0.05  # 0.05% per day average

    print(f"  Generating {days} days of job runs and data...")

    # Track counts
    total_job_runs = 0
    total_records = 0
    total_exceptions = 0

    current_date = start_date
    while current_date <= today:
        # Skip weekends (no runs on Saturday/Sunday typically)
        if current_date.weekday() >= 5:
            current_date += timedelta(days=1)
            continue

        day_offset = (current_date - start_date).days

        # Base quality for this day (improving trend with some noise)
        base_quality = min(99.0, base_quality_start + (day_offset * quality_improvement_rate) + random.uniform(-1.0, 1.0))

        for report in reports:
            # Get report version
            version = db.query(ReportVersion).filter(
                ReportVersion.report_id == report.id,
                ReportVersion.status == ReportVersionStatus.ACTIVE
            ).first()

            if not version:
                continue

            # Determine run status (mostly success, occasional failures)
            status_roll = random.random()
            if status_roll < 0.85:
                status = JobRunStatus.SUCCESS
            elif status_roll < 0.92:
                status = JobRunStatus.PARTIAL
            else:
                status = JobRunStatus.FAILED

            # Create timestamps
            run_time = datetime.combine(current_date, datetime.min.time()).replace(
                hour=random.randint(17, 19),
                minute=random.randint(0, 59),
                tzinfo=timezone.utc
            )
            duration_seconds = random.randint(30, 300)
            end_time = run_time + timedelta(seconds=duration_seconds)

            # Create job run
            job_run = JobRun(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                report_version_id=version.id,
                triggered_by=TriggeredBy.SCHEDULE,
                status=status,
                parameters={"business_date": current_date.isoformat()},
                started_at=run_time,
                ended_at=end_time if status != JobRunStatus.FAILED else run_time + timedelta(seconds=random.randint(5, 30)),
                error_message="Validation threshold exceeded" if status == JobRunStatus.FAILED else None
            )
            db.add(job_run)
            total_job_runs += 1

            # Number of records varies by day and report
            if status == JobRunStatus.FAILED:
                record_count = random.randint(0, 50)  # Failed runs have fewer records
            else:
                record_count = random.randint(500, 2000)

            # Create file submission
            file_submission = FileSubmission(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                job_run_id=job_run.id,
                business_date=current_date,
                submission_sequence=1,
                file_name=f"{report.name.replace(' ', '_')}_{current_date.isoformat()}.xml",
                status=FileSubmissionStatus.ACCEPTED if status == JobRunStatus.SUCCESS else (
                    FileSubmissionStatus.PARTIAL if status == JobRunStatus.PARTIAL else FileSubmissionStatus.REJECTED
                ),
                submitted_at=end_time if status != JobRunStatus.FAILED else None,
                record_count=record_count,
                response_received_at=end_time + timedelta(minutes=random.randint(5, 60)) if status != JobRunStatus.FAILED else None
            )
            db.add(file_submission)

            # Create validation results
            for rule in validation_rules:
                # Calculate pass/fail based on quality target and rule severity
                if rule.severity == ValidationSeverity.BLOCKING:
                    pass_rate = base_quality / 100.0 + random.uniform(-0.02, 0.02)
                elif rule.severity == ValidationSeverity.CORRECTABLE:
                    pass_rate = (base_quality + 2) / 100.0 + random.uniform(-0.02, 0.02)
                else:  # WARNING
                    pass_rate = (base_quality + 3) / 100.0 + random.uniform(-0.02, 0.02)

                pass_rate = min(1.0, max(0.8, pass_rate))  # Clamp to 80-100%

                failed = int(record_count * (1 - pass_rate))
                passed = failed == 0

                validation_result = ValidationResult(
                    id=uuid.uuid4(),
                    job_run_id=job_run.id,
                    validation_rule_id=rule.id,
                    execution_phase=ExecutionPhase.PRE_GENERATION,
                    passed=passed,
                    failed_count=failed,
                    warning_count=0 if rule.severity != ValidationSeverity.WARNING else failed,
                    exception_count=0 if rule.severity != ValidationSeverity.CORRECTABLE else failed,
                    execution_time_ms=random.randint(10, 500)
                )
                db.add(validation_result)

                # Create validation exceptions for blocking/correctable failures
                if failed > 0 and rule.severity in [ValidationSeverity.BLOCKING, ValidationSeverity.CORRECTABLE]:
                    exceptions_to_create = min(failed, random.randint(1, 10))  # Cap at 10 exceptions per rule
                    for exc_idx in range(exceptions_to_create):
                        # Determine exception status
                        exc_status_roll = random.random()
                        if exc_status_roll < 0.5:
                            exc_status = ExceptionStatus.RESOLVED
                        elif exc_status_roll < 0.7:
                            exc_status = ExceptionStatus.PENDING
                        elif exc_status_roll < 0.85:
                            exc_status = ExceptionStatus.AMENDED
                        elif exc_status_roll < 0.95:
                            exc_status = ExceptionStatus.RESUBMITTED
                        else:
                            exc_status = ExceptionStatus.REJECTED

                        exc = ValidationException(
                            id=uuid.uuid4(),
                            job_run_id=job_run.id,
                            validation_rule_id=rule.id,
                            row_number=random.randint(1, record_count),
                            original_data={"field_value": "invalid_data", "row": exc_idx},
                            amended_data={"field_value": "corrected_data"} if exc_status in [ExceptionStatus.AMENDED, ExceptionStatus.RESOLVED] else None,
                            error_message=rule.error_message,
                            status=exc_status,
                            amended_at=run_time + timedelta(hours=random.randint(1, 24)) if exc_status in [ExceptionStatus.AMENDED, ExceptionStatus.RESOLVED] else None
                        )
                        db.add(exc)
                        total_exceptions += 1

            # Create record submissions (sample, not all records)
            sample_size = min(50, record_count)
            for rec_idx in range(sample_size):
                # Determine record status based on quality
                rec_status_roll = random.random()
                if rec_status_roll < base_quality / 100.0:
                    rec_status = RecordStatus.ACCEPTED
                elif rec_status_roll < 0.95:
                    rec_status = random.choice([
                        RecordStatus.PRE_VALIDATION_FAILED,
                        RecordStatus.RECORD_REJECTED,
                        RecordStatus.AMENDED
                    ])
                else:
                    rec_status = RecordStatus.FILE_REJECTED

                record_submission = RecordSubmission(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    file_submission_id=file_submission.id,
                    job_run_id=job_run.id,
                    business_date=current_date,
                    record_ref=f"REC-{job_run.id.hex[:8]}-{rec_idx:06d}",
                    row_number=rec_idx + 1,
                    original_data={"transaction_id": f"TX{rec_idx:08d}"},
                    status=rec_status,
                    rejection_code="VAL001" if rec_status in [RecordStatus.PRE_VALIDATION_FAILED, RecordStatus.RECORD_REJECTED] else None,
                    rejection_message="Validation failed" if rec_status in [RecordStatus.PRE_VALIDATION_FAILED, RecordStatus.RECORD_REJECTED] else None
                )
                db.add(record_submission)
                total_records += 1

        # Commit every day to avoid huge transactions
        db.commit()
        current_date += timedelta(days=1)

    print(f"  Created {total_job_runs} job runs")
    print(f"  Created {total_records} record submissions (sampled)")
    print(f"  Created {total_exceptions} validation exceptions")


def main():
    """Main function to seed data quality trend data."""
    print("=" * 60)
    print("OpenRegReport Data Quality Trend Seeder")
    print("Populating job runs, validations, and submissions")
    print("=" * 60)

    db = SessionLocal()

    try:
        # Find or create tenant
        tenant = db.query(Tenant).filter(Tenant.slug == "demo").first()
        if not tenant:
            tenant = db.query(Tenant).filter(Tenant.slug == "default").first()
        if not tenant:
            tenant = db.query(Tenant).first()

        if not tenant:
            print("Error: No tenants found. Please run the application first to create a tenant.")
            return

        print(f"\nUsing tenant: {tenant.name} ({tenant.id})")

        # Find or use a user
        user = db.query(User).filter(User.tenant_id == tenant.id).first()
        if not user:
            print("Error: No users found for tenant.")
            return

        print(f"Using user: {user.email}")

        # Ensure connector exists
        connector_id = ensure_connector(db, tenant.id, user.id)
        print(f"Using connector: {connector_id}")

        # Ensure validation rules exist
        print("\nEnsuring validation rules...")
        validation_rules = ensure_validation_rules(db, tenant.id, user.id)
        print(f"  Found/created {len(validation_rules)} validation rules")

        # Ensure reports exist
        print("\nEnsuring reports...")
        reports = ensure_reports(db, tenant.id, user.id, connector_id)
        print(f"  Found/created {len(reports)} reports")

        # Ensure schedules exist
        print("\nEnsuring schedules...")
        schedules = ensure_schedules(db, tenant.id, reports)
        print(f"  Found/created {len(schedules)} schedules")

        # Generate job runs and data for the past 90 days
        print("\nGenerating job runs and quality data (90 days)...")
        generate_job_runs_and_data(
            db,
            tenant.id,
            reports,
            validation_rules,
            days=90
        )

        print("\n" + "=" * 60)
        print("Data quality trend seeding complete!")
        print("=" * 60)
        print("\nYou can now view trends on the Data Quality page.")

    except Exception as e:
        print(f"Error during seeding: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
