"""
Database models for OpenRegReport Portal

This module defines all SQLAlchemy ORM models for the application.
Models are organized logically by domain.
"""

from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, Text, Enum, BigInteger, Date, JSON, LargeBinary
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from backend.database import Base


# === Enums ===

class ConnectorType(str, enum.Enum):
    POSTGRESQL = "postgresql"
    SQLSERVER = "sqlserver"
    ORACLE = "oracle"
    MYSQL = "mysql"
    ODBC = "odbc"


class ReportVersionStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class ValidationSeverity(str, enum.Enum):
    WARNING = "warning"
    BLOCKING = "blocking"
    CORRECTABLE = "correctable"  # Segregate failures, allow partial submission


class ValidationRuleType(str, enum.Enum):
    SQL = "sql"
    PYTHON_EXPR = "python_expr"


class ExecutionPhase(str, enum.Enum):
    PRE_GENERATION = "pre_generation"
    PRE_DELIVERY = "pre_delivery"


class ScheduleType(str, enum.Enum):
    CRON = "cron"
    CALENDAR = "calendar"
    MANUAL = "manual"


class TriggerType(str, enum.Enum):
    API = "api"
    EVENT = "event"
    FILE_ARRIVAL = "file_arrival"
    DB_WATERMARK = "db_watermark"


class JobRunStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"


class TriggeredBy(str, enum.Enum):
    SCHEDULE = "schedule"
    MANUAL = "manual"
    API = "api"
    EVENT = "event"


class DeliveryProtocol(str, enum.Enum):
    SFTP = "sftp"
    FTP = "ftp"


class DeliveryStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"


class ExceptionStatus(str, enum.Enum):
    PENDING = "pending"
    AMENDED = "amended"
    RESUBMITTED = "resubmitted"
    RESOLVED = "resolved"
    REJECTED = "rejected"


class AuditAction(str, enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    EXECUTE = "execute"


# === Base Mixin ===

class TimestampMixin:
    """Mixin for created_at and updated_at timestamps"""
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


# === Identity & Tenancy ===

class Tenant(Base, TimestampMixin):
    __tablename__ = "tenants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    settings = Column(JSONB, default={})
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="tenant", cascade="all, delete-orphan")
    connectors = relationship("Connector", back_populates="tenant", cascade="all, delete-orphan")


class User(Base, TimestampMixin):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")


class Role(Base, TimestampMixin):
    __tablename__ = "roles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    permissions = Column(JSONB, default=[])  # List of permission strings
    
    # Relationships
    users = relationship("UserRole", back_populates="role", cascade="all, delete-orphan")


class UserRole(Base):
    __tablename__ = "user_roles"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), primary_key=True)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="roles")
    role = relationship("Role", back_populates="users")


# === Connectors ===

class Connector(Base, TimestampMixin):
    __tablename__ = "connectors"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(Enum(ConnectorType), nullable=False)
    config = Column(JSONB, default={})  # {host, port, database, etc.}
    encrypted_credentials = Column(LargeBinary, nullable=True)  # Fernet-encrypted JSON
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="connectors")
    report_versions = relationship("ReportVersion", back_populates="connector")


# === Reports ===

class Report(Base, TimestampMixin):
    __tablename__ = "reports"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    current_version_id = Column(UUID(as_uuid=True), nullable=True)  # FK added after ReportVersion
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="reports")
    versions = relationship("ReportVersion", back_populates="report", foreign_keys="ReportVersion.report_id", cascade="all, delete-orphan")
    schedules = relationship("Schedule", back_populates="report", cascade="all, delete-orphan")
    triggers = relationship("Trigger", back_populates="report", cascade="all, delete-orphan")
    destinations = relationship("ReportDestination", back_populates="report", cascade="all, delete-orphan")


class ReportVersion(Base, TimestampMixin):
    __tablename__ = "report_versions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(UUID(as_uuid=True), ForeignKey("reports.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    python_code = Column(Text, nullable=False)  # User-authored transformation logic
    connector_id = Column(UUID(as_uuid=True), ForeignKey("connectors.id"), nullable=True)
    config = Column(JSONB, default={})  # {output_format: "xml", schemas, etc.}
    status = Column(Enum(ReportVersionStatus), default=ReportVersionStatus.DRAFT, nullable=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    report = relationship("Report", back_populates="versions", foreign_keys=[report_id])
    connector = relationship("Connector", back_populates="report_versions")
    validations = relationship("ReportValidation", back_populates="report_version", cascade="all, delete-orphan")
    job_runs = relationship("JobRun", back_populates="report_version")


class ReportValidation(Base):
    __tablename__ = "report_validations"
    
    report_version_id = Column(UUID(as_uuid=True), ForeignKey("report_versions.id"), primary_key=True)
    validation_rule_id = Column(UUID(as_uuid=True), ForeignKey("validation_rules.id"), primary_key=True)
    execution_phase = Column(Enum(ExecutionPhase), nullable=False)
    
    # Relationships
    report_version = relationship("ReportVersion", back_populates="validations")
    validation_rule = relationship("ValidationRule", back_populates="reports")


# === Cross-Reference / Mappings ===

class MappingSet(Base, TimestampMixin):
    __tablename__ = "mapping_sets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Relationships
    entries = relationship("CrossReferenceEntry", back_populates="mapping_set", cascade="all, delete-orphan")


class CrossReferenceEntry(Base, TimestampMixin):
    __tablename__ = "cross_reference_entries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mapping_set_id = Column(UUID(as_uuid=True), ForeignKey("mapping_sets.id"), nullable=False, index=True)
    source_value = Column(String(500), nullable=False, index=True)
    target_value = Column(String(500), nullable=False)
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)
    extra_data = Column(JSONB, default={})
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    mapping_set = relationship("MappingSet", back_populates="entries")


# === Validations ===

class ValidationRule(Base, TimestampMixin):
    __tablename__ = "validation_rules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    rule_type = Column(Enum(ValidationRuleType), nullable=False)
    expression = Column(Text, nullable=False)  # SQL or Python expression
    severity = Column(Enum(ValidationSeverity), nullable=False)
    error_message = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    reports = relationship("ReportValidation", back_populates="validation_rule", cascade="all, delete-orphan")
    validation_results = relationship("ValidationResult", back_populates="validation_rule", cascade="all, delete-orphan")
    exceptions = relationship("ValidationException", back_populates="validation_rule", cascade="all, delete-orphan")


class ValidationResult(Base, TimestampMixin):
    __tablename__ = "validation_results"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_run_id = Column(UUID(as_uuid=True), ForeignKey("job_runs.id"), nullable=False, index=True)
    validation_rule_id = Column(UUID(as_uuid=True), ForeignKey("validation_rules.id"), nullable=False, index=True)
    execution_phase = Column(Enum(ExecutionPhase), nullable=False)
    passed = Column(Boolean, nullable=False)
    failed_count = Column(Integer, default=0, nullable=False)
    warning_count = Column(Integer, default=0, nullable=False)
    exception_count = Column(Integer, default=0, nullable=False)  # Correctable failures
    execution_time_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Relationships
    validation_rule = relationship("ValidationRule", back_populates="validation_results")


class ValidationException(Base, TimestampMixin):
    __tablename__ = "validation_exceptions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_run_id = Column(UUID(as_uuid=True), ForeignKey("job_runs.id"), nullable=False, index=True)
    validation_rule_id = Column(UUID(as_uuid=True), ForeignKey("validation_rules.id"), nullable=False, index=True)
    row_number = Column(Integer, nullable=False)  # Which row in dataset failed
    original_data = Column(JSONB, nullable=False)  # Failed transaction data
    amended_data = Column(JSONB, nullable=True)  # User corrections
    error_message = Column(Text, nullable=False)
    status = Column(Enum(ExceptionStatus), default=ExceptionStatus.PENDING, nullable=False, index=True)
    
    # Amendment tracking
    amended_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    amended_at = Column(DateTime(timezone=True), nullable=True)
    resubmitted_at = Column(DateTime(timezone=True), nullable=True)
    resubmitted_job_run_id = Column(UUID(as_uuid=True), ForeignKey("job_runs.id"), nullable=True)
    
    validation_rule = relationship("ValidationRule", back_populates="exceptions")


class ReportValidation(Base, TimestampMixin):
    __tablename__ = "report_validations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_version_id = Column(UUID(as_uuid=True), ForeignKey("report_versions.id"), nullable=False, index=True)
    validation_rule_id = Column(UUID(as_uuid=True), ForeignKey("validation_rules.id"), nullable=False, index=True)
    execution_phase = Column(Enum(ExecutionPhase), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    report_version = relationship("ReportVersion")
    validation_rule = relationship("ValidationRule", back_populates="reports")


# === Scheduling ===

class Schedule(Base, TimestampMixin):
    __tablename__ = "schedules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    report_id = Column(UUID(as_uuid=True), ForeignKey("reports.id"), nullable=False, index=True)
    name = Column(String(255), nullable=True)
    schedule_type = Column(Enum(ScheduleType), nullable=False)
    cron_expression = Column(String(100), nullable=True)
    calendar_config = Column(JSONB, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    next_run_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    report = relationship("Report", back_populates="schedules")


class Trigger(Base, TimestampMixin):
    __tablename__ = "triggers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    report_id = Column(UUID(as_uuid=True), ForeignKey("reports.id"), nullable=False, index=True)
    name = Column(String(255), nullable=True)
    trigger_type = Column(Enum(TriggerType), nullable=False)
    config = Column(JSONB, default={})
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    report = relationship("Report", back_populates="triggers")


# === Job Execution ===

class JobRun(Base):
    __tablename__ = "job_runs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    report_version_id = Column(UUID(as_uuid=True), ForeignKey("report_versions.id"), nullable=False, index=True)
    triggered_by = Column(Enum(TriggeredBy), nullable=False)
    trigger_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status = Column(Enum(JobRunStatus), default=JobRunStatus.PENDING, nullable=False, index=True)
    parameters = Column(JSONB, default={})
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    logs_uri = Column(String(500), nullable=True)  # Pointer to MinIO/S3 object
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    report_version = relationship("ReportVersion", back_populates="job_runs")
    artifacts = relationship("Artifact", back_populates="job_run", cascade="all, delete-orphan")


class Artifact(Base):
    __tablename__ = "artifacts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_run_id = Column(UUID(as_uuid=True), ForeignKey("job_runs.id"), nullable=False, index=True)
    filename = Column(String(500), nullable=False)
    storage_uri = Column(String(1000), nullable=False)  # s3://bucket/path
    mime_type = Column(String(100), nullable=True)
    size_bytes = Column(BigInteger, nullable=False)
    checksum_sha256 = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    job_run = relationship("JobRun", back_populates="artifacts")
    delivery_attempts = relationship("DeliveryAttempt", back_populates="artifact", cascade="all, delete-orphan")


# === Delivery ===

class Destination(Base, TimestampMixin):
    __tablename__ = "destinations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    protocol = Column(Enum(DeliveryProtocol), nullable=False)
    config = Column(JSONB, default={})  # {host, port, path, etc.}
    encrypted_credentials = Column(LargeBinary, nullable=True)
    retry_policy = Column(JSONB, default={"max_attempts": 3, "backoff": "exponential"})
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    reports = relationship("ReportDestination", back_populates="destination", cascade="all, delete-orphan")
    delivery_attempts = relationship("DeliveryAttempt", back_populates="destination")


class ReportDestination(Base):
    __tablename__ = "report_destinations"
    
    report_id = Column(UUID(as_uuid=True), ForeignKey("reports.id"), primary_key=True)
    destination_id = Column(UUID(as_uuid=True), ForeignKey("destinations.id"), primary_key=True)
    routing_rules = Column(JSONB, default={})
    
    # Relationships
    report = relationship("Report", back_populates="destinations")
    destination = relationship("Destination", back_populates="reports")


class DeliveryAttempt(Base):
    __tablename__ = "delivery_attempts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    artifact_id = Column(UUID(as_uuid=True), ForeignKey("artifacts.id"), nullable=False, index=True)
    destination_id = Column(UUID(as_uuid=True), ForeignKey("destinations.id"), nullable=False, index=True)
    attempt_number = Column(Integer, nullable=False)
    status = Column(Enum(DeliveryStatus), default=DeliveryStatus.PENDING, nullable=False)
    error_message = Column(Text, nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    artifact = relationship("Artifact", back_populates="delivery_attempts")
    destination = relationship("Destination", back_populates="delivery_attempts")


# === Audit ===

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    entity_type = Column(String(100), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    action = Column(Enum(AuditAction), nullable=False)
    changes = Column(JSONB, nullable=True)  # Before/after for updates
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")
