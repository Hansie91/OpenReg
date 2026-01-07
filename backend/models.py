"""
Database models for OpenRegReport Portal

This module defines all SQLAlchemy ORM models for the application.
Models are organized logically by domain.
"""

from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, Text, Enum, BigInteger, Date, JSON, LargeBinary, Table
from sqlalchemy.dialects.postgresql import UUID, JSONB 
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, date as date_type
import uuid
import enum
from database import Base


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


class FileSubmissionStatus(str, enum.Enum):
    """Status of a file submitted to regulator"""
    PENDING = "pending"           # Not yet submitted
    SUBMITTED = "submitted"       # Sent to regulator, awaiting response
    ACCEPTED = "accepted"         # Regulator accepted the file
    REJECTED = "rejected"         # Regulator rejected the file
    PARTIAL = "partial"           # Some records accepted, some rejected


class RecordStatus(str, enum.Enum):
    """Status of individual records in the submission lifecycle"""
    PENDING_DATA = "pending_data"               # Waiting for data
    PRE_VALIDATION_PENDING = "pre_validation_pending"
    PRE_VALIDATION_FAILED = "pre_validation_failed"
    PRE_VALIDATION_PASSED = "pre_validation_passed"
    SUBMITTED = "submitted"                     # Included in a submission file
    ACCEPTED = "accepted"                       # Regulator accepted
    FILE_REJECTED = "file_rejected"             # File-level rejection
    RECORD_REJECTED = "record_rejected"         # Record-level rejection
    AMENDED = "amended"                         # User amended after rejection
    RESUBMITTED = "resubmitted"                 # Included in supplemental file


class ExceptionSource(str, enum.Enum):
    """Source of the exception/rejection"""
    PRE_VALIDATION = "pre_validation"           # Failed internal pre-validation
    REGULATOR_FILE = "regulator_file"           # Regulator rejected entire file
    REGULATOR_RECORD = "regulator_record"       # Regulator rejected specific record


class LogLevel(str, enum.Enum):
    """Log level for job run logs"""
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class AuditAction(str, enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    EXECUTE = "execute"


class SchemaType(str, enum.Enum):
    """Type of schema definition file"""
    XSD = "xsd"                   # XML Schema Definition
    JSON_SCHEMA = "json_schema"   # JSON Schema
    XBRL = "xbrl"                 # XBRL Taxonomy


class OutputFormat(str, enum.Enum):
    """Output format for generated reports"""
    XML = "xml"
    JSON = "json"
    CSV = "csv"
    TXT = "txt"  # Fixed-width text


class WebhookEventType(str, enum.Enum):
    """Types of events that can trigger webhooks"""
    JOB_STARTED = "job.started"
    JOB_COMPLETED = "job.completed"
    JOB_FAILED = "job.failed"
    ARTIFACT_CREATED = "artifact.created"
    DELIVERY_COMPLETED = "delivery.completed"
    DELIVERY_FAILED = "delivery.failed"
    VALIDATION_FAILED = "validation.failed"
    WORKFLOW_STATE_CHANGED = "workflow.state_changed"


class WebhookDeliveryStatus(str, enum.Enum):
    """Status of webhook delivery attempts"""
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    RETRYING = "retrying"


class TenantEnvironment(str, enum.Enum):
    """Tenant environment mode"""
    PRODUCTION = "production"
    SANDBOX = "sandbox"


class ExternalSyncStatus(str, enum.Enum):
    """Sync status for items from external regulatory API"""
    SYNCED = "synced"                      # In sync with upstream
    LOCAL_MODIFIED = "local_modified"      # Local edits exist (forked)
    UPSTREAM_CHANGED = "upstream_changed"  # New upstream version available
    CONFLICT = "conflict"                  # Both changed - needs resolution
    LOCAL_ONLY = "local_only"              # Created locally, never synced


class ExternalSyncSource(str, enum.Enum):
    """Source types for external regulatory data"""
    REGULATORY_API = "regulatory_api"      # Paid regulatory API
    MANUAL_IMPORT = "manual_import"        # Manual JSON upload


class ExternalAPIAuthType(str, enum.Enum):
    """Authentication types for external APIs"""
    API_KEY = "api_key"
    OAUTH2 = "oauth2"
    BASIC = "basic"


class SyncTriggerType(str, enum.Enum):
    """How the sync was triggered"""
    SCHEDULED = "scheduled"
    MANUAL = "manual"
    API = "api"


class SyncModeType(str, enum.Enum):
    """Type of sync operation"""
    FULL = "full"
    DIFFERENTIAL = "differential"


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

    # Environment mode - sandbox vs production
    environment = Column(
        Enum(TenantEnvironment),
        default=TenantEnvironment.SANDBOX,
        nullable=False,
        index=True
    )

    # Relationships
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="tenant", cascade="all, delete-orphan")
    connectors = relationship("Connector", back_populates="tenant", cascade="all, delete-orphan")
    webhooks = relationship("Webhook", back_populates="tenant", cascade="all, delete-orphan")


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

    # === External Sync Tracking ===
    external_source = Column(Enum(ExternalSyncSource), nullable=True, index=True)
    external_api_config_id = Column(UUID(as_uuid=True), ForeignKey("external_api_configs.id"), nullable=True, index=True)
    external_id = Column(String(255), nullable=True, index=True)  # ID from external API
    upstream_version = Column(String(100), nullable=True)
    upstream_hash = Column(String(64), nullable=True)  # SHA-256 of upstream content
    local_hash = Column(String(64), nullable=True)  # SHA-256 of current content
    sync_status = Column(Enum(ExternalSyncStatus), default=ExternalSyncStatus.LOCAL_ONLY, nullable=True, index=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    forked_at = Column(DateTime(timezone=True), nullable=True)
    forked_from_version = Column(String(100), nullable=True)

    # Streaming configuration for real-time transactions
    # Schema: {
    #   "enabled": bool,
    #   "topic_id": UUID,
    #   "trigger_mode": "time_window" | "threshold" | "combined" | "manual",
    #   "window_minutes": int (default 15),
    #   "threshold_count": int (default 10000)
    # }
    streaming_config = Column(JSONB, nullable=True)
    
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
    
    # Semantic versioning: major.minor (e.g., 1.0, 1.1, 2.0)
    major_version = Column(Integer, nullable=False, default=1)
    minor_version = Column(Integer, nullable=False, default=0)
    version_number = Column(Integer, nullable=False)  # Computed: major*1000 + minor for ordering
    
    python_code = Column(Text, nullable=False)  # User-authored transformation logic
    connector_id = Column(UUID(as_uuid=True), ForeignKey("connectors.id"), nullable=True)
    
    # Extended config JSONB schema:
    # {
    #   "mode": "simple" | "advanced",
    #   "input_schema_type": "xsd" | "json_schema" | "xbrl",
    #   "schema_id": "uuid",
    #   "xbrl_taxonomy_id": "uuid",
    #   "output_format": "xml" | "json" | "csv" | "txt",
    #   "output_filename_template": "{report_name}_{business_date}",
    #   "max_records_per_file": 10000,
    #   "max_file_size_bytes": 104857600,
    #   "csv_options": {
    #     "delimiter": ",",
    #     "quote_char": "\"",
    #     "escape_char": "\\",
    #     "include_header": true,
    #     "line_ending": "crlf"
    #   },
    #   "txt_options": {
    #     "columns": [{"field": "name", "start_position": 1, "length": 20, "padding": "right", "padding_char": " "}],
    #     "record_length": 200,
    #     "line_ending": "crlf"
    #   },
    #   "field_mappings": [...]
    # }
    config = Column(JSONB, default={})  
    
    status = Column(Enum(ReportVersionStatus), default=ReportVersionStatus.DRAFT, nullable=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    report = relationship("Report", back_populates="versions", foreign_keys=[report_id])
    connector = relationship("Connector", back_populates="report_versions")
    validations = relationship("ReportValidation", back_populates="report_version", cascade="all, delete-orphan")
    job_runs = relationship("JobRun", back_populates="report_version")
    
    @property
    def version_string(self) -> str:
        """Return semantic version string (e.g., 'v1.2')"""
        return f"v{self.major_version}.{self.minor_version}"


class ReportValidation(Base):
    __tablename__ = "report_validations"
    
    report_version_id = Column(UUID(as_uuid=True), ForeignKey("report_versions.id"), primary_key=True)
    validation_rule_id = Column(UUID(as_uuid=True), ForeignKey("validation_rules.id"), primary_key=True)
    execution_phase = Column(Enum(ExecutionPhase), nullable=False)
    
    # Relationships
    report_version = relationship("ReportVersion", back_populates="validations")
    validation_rule = relationship("ValidationRule", back_populates="reports")


class ReportMode(str, enum.Enum):
    """Report creation mode"""
    SIMPLE = "simple"      # Declarative mapping (no code)
    ADVANCED = "advanced"  # Python code transformation


class ReportSchema(Base, TimestampMixin):
    """
    Stores uploaded XSD schemas for declarative report generation.
    Schemas are parsed and cached for efficient mapping UI.
    """
    __tablename__ = "report_schemas"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)  # e.g., "MiFIR RTS25 v1.2"
    description = Column(Text, nullable=True)
    version = Column(String(50), nullable=True)  # Schema version identifier
    xsd_content = Column(Text, nullable=False)   # Raw XSD XML content
    parsed_elements = Column(JSONB, nullable=True)  # Cached parsed structure
    root_element = Column(String(255), nullable=True)  # Main root element name
    namespace = Column(String(500), nullable=True)  # Target namespace
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    tenant = relationship("Tenant")


class XBRLTaxonomy(Base, TimestampMixin):
    """
    Stores XBRL taxonomy with full linkbase support.
    
    XBRL taxonomies define concepts (elements), their relationships,
    dimensions for multi-dimensional reporting, and human-readable labels.
    """
    __tablename__ = "xbrl_taxonomies"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)  # e.g., "ESEF 2023"
    description = Column(Text, nullable=True)
    version = Column(String(50), nullable=True)  # Taxonomy version
    
    # Entry point and namespace
    entry_point_uri = Column(String(500), nullable=True)  # Main XSD entry point
    namespace = Column(String(500), nullable=False)       # Target namespace
    
    # Core taxonomy structure (parsed and cached)
    concepts = Column(JSONB, default=[])  # List of concept definitions
    # [{
    #   "name": "Assets",
    #   "id": "ifrs-full_Assets",
    #   "type": "monetaryItemType",
    #   "period_type": "instant",  # instant | duration
    #   "balance": "debit",       # debit | credit | null
    #   "abstract": false,
    #   "nillable": true,
    #   "substitution_group": "xbrli:item"
    # }]
    
    # Dimension definitions for multi-dimensional facts
    dimensions = Column(JSONB, default=[])
    # [{
    #   "name": "CurrencyDimension",
    #   "id": "ifrs-full_CurrencyDimension",
    #   "type": "explicit",  # explicit | typed
    #   "domain": "CurrencyDomain",
    #   "members": ["EUR", "USD", "GBP", ...]
    # }]
    
    # Linkbases - relationships between concepts
    presentation_linkbase = Column(JSONB, default={})
    # Hierarchical structure for presentation
    # {"role": {"parent": ["child1", "child2"], ...}}
    
    calculation_linkbase = Column(JSONB, default={})
    # Calculation relationships (summations)
    # {"role": {"total": [{"concept": "part1", "weight": 1.0}, ...]}}
    
    definition_linkbase = Column(JSONB, default={})
    # Dimensional relationships (hypercubes, dimension-domain)
    # {"role": {"hypercube": {"dimensions": [...], "members": [...]}}}
    
    label_linkbase = Column(JSONB, default={})
    # Human-readable labels in multiple languages
    # {"concept_id": {"en": "Assets", "de": "Vermögenswerte", ...}}
    
    reference_linkbase = Column(JSONB, default={})
    # References to authoritative literature
    # {"concept_id": [{"standard": "IAS 1", "paragraph": "55"}]}
    
    # Original raw files for reference
    raw_files = Column(JSONB, default={})  # {filename: content or reference}
    
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    tenant = relationship("Tenant")


# === Cross-Reference / Mappings ===

# Association table for many-to-many relationship between entries and reports
mapping_entry_reports = Table(
    'mapping_entry_reports',
    Base.metadata,
    Column('entry_id', UUID(as_uuid=True), ForeignKey('cross_reference_entries.id'), primary_key=True),
    Column('report_id', UUID(as_uuid=True), ForeignKey('reports.id'), primary_key=True),
    Column('created_at', DateTime, default=datetime.utcnow)
)


class MappingSet(Base, TimestampMixin):
    __tablename__ = "mapping_sets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # === External Sync Tracking ===
    external_source = Column(Enum(ExternalSyncSource), nullable=True, index=True)
    external_api_config_id = Column(UUID(as_uuid=True), ForeignKey("external_api_configs.id"), nullable=True, index=True)
    external_id = Column(String(255), nullable=True, index=True)
    upstream_version = Column(String(100), nullable=True)
    upstream_hash = Column(String(64), nullable=True)
    local_hash = Column(String(64), nullable=True)
    sync_status = Column(Enum(ExternalSyncStatus), default=ExternalSyncStatus.LOCAL_ONLY, nullable=True, index=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    forked_at = Column(DateTime(timezone=True), nullable=True)
    forked_from_version = Column(String(100), nullable=True)

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
    reports = relationship("Report", secondary=mapping_entry_reports, backref="mapping_entries")


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

    # === External Sync Tracking ===
    external_source = Column(Enum(ExternalSyncSource), nullable=True, index=True)
    external_api_config_id = Column(UUID(as_uuid=True), ForeignKey("external_api_configs.id"), nullable=True, index=True)
    external_id = Column(String(255), nullable=True, index=True)
    upstream_version = Column(String(100), nullable=True)
    upstream_hash = Column(String(64), nullable=True)
    local_hash = Column(String(64), nullable=True)
    sync_status = Column(Enum(ExternalSyncStatus), default=ExternalSyncStatus.LOCAL_ONLY, nullable=True, index=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    forked_at = Column(DateTime(timezone=True), nullable=True)
    forked_from_version = Column(String(100), nullable=True)

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


# === Scheduling ===


class Schedule(Base, TimestampMixin):
    __tablename__ = "schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    report_id = Column(UUID(as_uuid=True), ForeignKey("reports.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    schedule_type = Column(Enum(ScheduleType), nullable=False)
    cron_expression = Column(String(100), nullable=True)
    calendar_config = Column(JSONB, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    next_run_at = Column(DateTime(timezone=True), nullable=True)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    last_run_status = Column(String(50), nullable=True)
    parameters = Column(JSONB, default={}, nullable=True)

    # === External Sync Tracking ===
    external_source = Column(Enum(ExternalSyncSource), nullable=True, index=True)
    external_api_config_id = Column(UUID(as_uuid=True), ForeignKey("external_api_configs.id"), nullable=True, index=True)
    external_id = Column(String(255), nullable=True, index=True)
    upstream_version = Column(String(100), nullable=True)
    upstream_hash = Column(String(64), nullable=True)
    local_hash = Column(String(64), nullable=True)
    sync_status = Column(Enum(ExternalSyncStatus), default=ExternalSyncStatus.LOCAL_ONLY, nullable=True, index=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    forked_at = Column(DateTime(timezone=True), nullable=True)
    forked_from_version = Column(String(100), nullable=True)

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


# === File & Record Submissions ===

class FileSubmission(Base, TimestampMixin):
    """Tracks files submitted to regulators"""
    __tablename__ = "file_submissions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    job_run_id = Column(UUID(as_uuid=True), ForeignKey("job_runs.id"), nullable=False, index=True)
    business_date = Column(Date, nullable=False, index=True)
    submission_sequence = Column(Integer, default=1)  # 1=original, 2+=supplemental
    file_name = Column(String(255), nullable=False)
    file_checksum = Column(String(64), nullable=True)  # SHA-256
    destination_id = Column(UUID(as_uuid=True), ForeignKey("destinations.id"), nullable=True)
    status = Column(Enum(FileSubmissionStatus), default=FileSubmissionStatus.PENDING, nullable=False, index=True)
    
    # Submission tracking
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    record_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    
    # Regulator response
    response_received_at = Column(DateTime(timezone=True), nullable=True)
    response_code = Column(String(50), nullable=True)
    response_message = Column(Text, nullable=True)
    
    # Parent for supplemental submissions
    parent_submission_id = Column(UUID(as_uuid=True), ForeignKey("file_submissions.id"), nullable=True)
    
    # Relationships
    records = relationship("RecordSubmission", back_populates="file_submission", cascade="all, delete-orphan")


class RecordSubmission(Base, TimestampMixin):
    """Tracks individual records through the submission lifecycle"""
    __tablename__ = "record_submissions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    file_submission_id = Column(UUID(as_uuid=True), ForeignKey("file_submissions.id"), nullable=True, index=True)
    job_run_id = Column(UUID(as_uuid=True), ForeignKey("job_runs.id"), nullable=False, index=True)
    business_date = Column(Date, nullable=False, index=True)
    
    # Record identification
    record_ref = Column(String(100), nullable=False, index=True)  # Transaction ID / UTI
    row_number = Column(Integer, nullable=True)
    
    # Data
    original_data = Column(JSONB, nullable=False)
    amended_data = Column(JSONB, nullable=True)
    
    # Status
    status = Column(Enum(RecordStatus), default=RecordStatus.PENDING_DATA, nullable=False, index=True)
    submission_sequence = Column(Integer, default=1)  # Which submission this was included in
    
    # Rejection details (from regulator or pre-validation)
    rejection_source = Column(Enum(ExceptionSource), nullable=True)
    rejection_code = Column(String(100), nullable=True)  # Regulator error code
    rejection_message = Column(Text, nullable=True)
    
    # Amendment tracking
    amended_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    amended_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    file_submission = relationship("FileSubmission", back_populates="records")
    status_history = relationship("RecordStatusHistory", back_populates="record", cascade="all, delete-orphan")


class RecordStatusHistory(Base):
    """Audit trail for record status changes"""
    __tablename__ = "record_status_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_id = Column(UUID(as_uuid=True), ForeignKey("record_submissions.id"), nullable=False, index=True)
    from_status = Column(Enum(RecordStatus), nullable=True)
    to_status = Column(Enum(RecordStatus), nullable=False)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    change_reason = Column(Text, nullable=True)  # Amendment reason, rejection code, etc.
    changed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Optional: snapshot of data at this point
    data_snapshot = Column(JSONB, nullable=True)
    
    # Relationships
    record = relationship("RecordSubmission", back_populates="status_history")


# === Log Streaming ===

class JobRunLog(Base):
    """
    Log entries for job runs - enables real-time log streaming.
    Logs are stored here for recent runs and archived to MinIO for older runs.
    """
    __tablename__ = "job_run_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_run_id = Column(UUID(as_uuid=True), ForeignKey("job_runs.id"), nullable=False, index=True)
    line_number = Column(Integer, nullable=False)  # Sequential line number
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    level = Column(Enum(LogLevel), default=LogLevel.INFO, nullable=False)
    message = Column(Text, nullable=False)
    context = Column(JSONB, nullable=True)  # Additional structured data (row count, validation name, etc.)
    
    # Composite index for efficient streaming queries
    __table_args__ = (
        # Index for fetching logs after a given line
        # CREATE INDEX ix_job_run_logs_stream ON job_run_logs (job_run_id, line_number);
    )


# === Regulator Response ===

class RegulatorResponse(Base, TimestampMixin):
    """
    Stores uploaded regulator response files and parsing results.
    
    Regulator responses are typically:
    1. Uploaded manually by user (file upload)
    2. Received via webhook (FTP callback, API)
    3. Pulled via regulator API (scheduled check)
    """
    __tablename__ = "regulator_responses"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    file_submission_id = Column(UUID(as_uuid=True), ForeignKey("file_submissions.id"), nullable=False, index=True)
    
    # Response file
    response_file_name = Column(String(255), nullable=True)
    response_storage_uri = Column(String(1000), nullable=True)  # MinIO path
    
    # Parsed result
    overall_status = Column(Enum(FileSubmissionStatus), nullable=False)
    total_records = Column(Integer, nullable=True)
    accepted_records = Column(Integer, nullable=True)
    rejected_records = Column(Integer, nullable=True)
    
    # Raw response data
    raw_response = Column(JSONB, nullable=True)
    parsed_rejections = Column(JSONB, nullable=True)  # [{record_ref, code, message}]
    
    # Ingestion method
    ingestion_method = Column(String(50), nullable=False)  # 'file_upload', 'webhook', 'api_poll'
    ingested_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    ingested_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# === Streaming Enums ===

class StreamingAuthType(str, enum.Enum):
    """Authentication type for Kafka/AMQ Streams"""
    SASL_SCRAM = "sasl_scram"
    SASL_PLAIN = "sasl_plain"
    MTLS = "mtls"
    NONE = "none"


class StreamingSchemaFormat(str, enum.Enum):
    """Schema format for message serialization"""
    JSON = "json"
    PROTOBUF = "protobuf"
    AVRO = "avro"
    RAW = "raw"


class StreamingTriggerMode(str, enum.Enum):
    """Trigger mode for micro-batch processing"""
    TIME_WINDOW = "time_window"
    THRESHOLD = "threshold"
    COMBINED = "combined"
    MANUAL = "manual"


# === Streaming Models ===

class StreamingTopic(Base, TimestampMixin):
    """
    Kafka/AMQ Streams topic configuration.
    
    Stores connection settings, authentication credentials,
    and schema configuration for consuming streaming transactions.
    """
    __tablename__ = "streaming_topics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Basic info
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Broker configuration
    bootstrap_servers = Column(String(1000), nullable=False)  # comma-separated
    topic_name = Column(String(255), nullable=False)
    consumer_group = Column(String(255), nullable=False)
    
    # Authentication
    auth_type = Column(Enum(StreamingAuthType), default=StreamingAuthType.SASL_SCRAM, nullable=False)
    
    # SASL credentials (encrypted)
    sasl_username = Column(LargeBinary, nullable=True)
    sasl_password = Column(LargeBinary, nullable=True)
    sasl_mechanism = Column(String(50), default="SCRAM-SHA-512", nullable=True)
    
    # mTLS certificates (encrypted, stored as PEM)
    ssl_ca_cert = Column(LargeBinary, nullable=True)
    ssl_client_cert = Column(LargeBinary, nullable=True)
    ssl_client_key = Column(LargeBinary, nullable=True)
    ssl_key_password = Column(LargeBinary, nullable=True)
    
    # Schema configuration
    schema_format = Column(Enum(StreamingSchemaFormat), default=StreamingSchemaFormat.JSON, nullable=False)
    schema_registry_url = Column(String(1000), nullable=True)
    schema_definition = Column(JSONB, nullable=True)  # For JSON Schema or Protobuf descriptor
    
    # Consumer settings
    auto_offset_reset = Column(String(20), default="earliest", nullable=False)
    max_poll_records = Column(Integer, default=500, nullable=False)
    session_timeout_ms = Column(Integer, default=30000, nullable=False)
    
    # Relationships
    tenant = relationship("Tenant")
    buffers = relationship("StreamingBuffer", back_populates="topic", cascade="all, delete-orphan")
    consumer_states = relationship("StreamingConsumerState", back_populates="topic", cascade="all, delete-orphan")


class StreamingBuffer(Base, TimestampMixin):
    """
    Buffered transactions from streaming topics awaiting batch processing.
    
    Transactions are held here until a trigger condition is met
    (time window or threshold), then processed as a micro-batch.
    """
    __tablename__ = "streaming_buffer"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    topic_id = Column(UUID(as_uuid=True), ForeignKey("streaming_topics.id"), nullable=False, index=True)
    
    # Kafka offset tracking
    partition = Column(Integer, nullable=False)
    offset = Column(BigInteger, nullable=False)
    message_key = Column(String(500), nullable=True)
    
    # Message content
    payload = Column(JSONB, nullable=False)
    headers = Column(JSONB, nullable=True)
    
    # Processing state
    received_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    processed = Column(Boolean, default=False, nullable=False, index=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    batch_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # Links to job run
    
    # Validation
    is_valid = Column(Boolean, nullable=True)  # None = not validated yet
    validation_errors = Column(JSONB, nullable=True)
    
    # Relationships
    topic = relationship("StreamingTopic", back_populates="buffers")
    
    # Unique constraint on topic + partition + offset
    __table_args__ = (
        # Prevent duplicate consumption
        # (handled at application level with upsert)
    )


class StreamingConsumerState(Base, TimestampMixin):
    """
    Tracks consumer group state per partition.
    
    Used for monitoring consumer lag and enabling
    manual offset management for replay scenarios.
    """
    __tablename__ = "streaming_consumer_states"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    topic_id = Column(UUID(as_uuid=True), ForeignKey("streaming_topics.id"), nullable=False, index=True)
    
    # Partition tracking
    partition = Column(Integer, nullable=False)
    current_offset = Column(BigInteger, nullable=False)
    lag = Column(BigInteger, nullable=True)  # high_watermark - current_offset
    
    # Consumer status
    last_poll_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    error_message = Column(Text, nullable=True)
    
    # Relationships
    topic = relationship("StreamingTopic", back_populates="consumer_states")


# === Data Lineage (v2 Enterprise) ===

class LineageNodeType(str, enum.Enum):
    """Type of node in the data lineage graph"""
    CONNECTOR = "connector"         # Database source
    REPORT = "report"               # Report output
    MAPPING_SET = "mapping_set"     # Cross-reference mapping
    VALIDATION = "validation"       # Validation rule (future)
    DESTINATION = "destination"     # Delivery destination (future)


class LineageRelationshipType(str, enum.Enum):
    """Type of relationship between lineage nodes"""
    PROVIDES_DATA = "provides_data"     # Connector → Report
    USES_MAPPING = "uses_mapping"       # MappingSet → Report
    DELIVERS_TO = "delivers_to"         # Report → Destination (future)
    VALIDATES = "validates"             # ValidationRule → Report (future)


class LineageNode(Base, TimestampMixin):
    """
    Represents a node in the data lineage graph.
    
    Nodes are created/updated automatically when reports are saved.
    Each node corresponds to a real entity (connector, report, mapping set).
    """
    __tablename__ = "lineage_nodes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    node_type = Column(Enum(LineageNodeType), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # FK to actual entity
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Visual positioning (for graph layout persistence)
    position_x = Column(Integer, nullable=True)
    position_y = Column(Integer, nullable=True)
    
    # Extended metadata
    node_metadata = Column(JSONB, default={})
    # For connectors: {db_type, host, database}
    # For reports: {version, output_format}
    # For mappings: {entry_count}
    
    # Relationships
    outgoing_edges = relationship("LineageEdge", foreign_keys="LineageEdge.source_node_id", 
                                   back_populates="source_node", cascade="all, delete-orphan")
    incoming_edges = relationship("LineageEdge", foreign_keys="LineageEdge.target_node_id",
                                   back_populates="target_node", cascade="all, delete-orphan")


class LineageEdge(Base, TimestampMixin):
    """
    Represents a data flow relationship between two lineage nodes.

    Edges capture how data flows from sources through transformations to outputs.
    """
    __tablename__ = "lineage_edges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    source_node_id = Column(UUID(as_uuid=True), ForeignKey("lineage_nodes.id"), nullable=False, index=True)
    target_node_id = Column(UUID(as_uuid=True), ForeignKey("lineage_nodes.id"), nullable=False, index=True)
    relationship_type = Column(Enum(LineageRelationshipType), nullable=False)

    # Optional label for display
    label = Column(String(100), nullable=True)

    # Phase 2: Field-level lineage placeholders
    source_fields = Column(JSONB, nullable=True)  # ["column1", "column2"]
    target_fields = Column(JSONB, nullable=True)  # ["field1", "field2"]
    transformation = Column(Text, nullable=True)  # Description of transformation

    # Extended metadata
    edge_metadata = Column(JSONB, default={})

    # Relationships
    source_node = relationship("LineageNode", foreign_keys=[source_node_id], back_populates="outgoing_edges")
    target_node = relationship("LineageNode", foreign_keys=[target_node_id], back_populates="incoming_edges")


# === API Keys for Partner Authentication ===

class WorkflowStateEnum(str, enum.Enum):
    """States in the workflow execution."""
    PENDING = "pending"
    INITIALIZING = "initializing"
    FETCHING_DATA = "fetching_data"
    PRE_VALIDATION = "pre_validation"
    TRANSFORMING = "transforming"
    POST_VALIDATION = "post_validation"
    GENERATING_ARTIFACTS = "generating_artifacts"
    DELIVERING = "delivering"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    WAITING_RETRY = "waiting_retry"
    PAUSED = "paused"


class StepStatusEnum(str, enum.Enum):
    """Status of a workflow step."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    RETRYING = "retrying"


class WorkflowExecution(Base, TimestampMixin):
    """
    Tracks the execution of a workflow for a job run.

    Provides granular progress tracking and state history
    for real-time monitoring of report execution.
    """
    __tablename__ = "workflow_executions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    job_run_id = Column(UUID(as_uuid=True), ForeignKey("job_runs.id"), nullable=False, unique=True, index=True)
    workflow_name = Column(String(100), nullable=False)
    workflow_version = Column(String(20), nullable=False)

    # Current state
    current_state = Column(Enum(WorkflowStateEnum), default=WorkflowStateEnum.PENDING, nullable=False, index=True)
    progress_percentage = Column(Integer, default=0, nullable=False)

    # Timing
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_ms = Column(Integer, nullable=True)

    # Error info
    error_message = Column(Text, nullable=True)
    error_code = Column(String(50), nullable=True)
    failed_step = Column(String(100), nullable=True)

    # Context snapshot (for debugging/audit)
    context_snapshot = Column(JSONB, nullable=True)

    # State history (denormalized for quick access)
    state_history = Column(JSONB, default=[])

    # Relationships
    job_run = relationship("JobRun", backref="workflow_execution", uselist=False)
    steps = relationship("WorkflowStep", back_populates="workflow_execution", cascade="all, delete-orphan")


class WorkflowStep(Base, TimestampMixin):
    """
    Tracks individual step execution within a workflow.

    Each step has its own status, timing, and retry information.
    """
    __tablename__ = "workflow_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_execution_id = Column(UUID(as_uuid=True), ForeignKey("workflow_executions.id", ondelete="CASCADE"), nullable=False, index=True)
    step_name = Column(String(100), nullable=False)
    step_order = Column(Integer, nullable=False)

    # Status
    status = Column(Enum(StepStatusEnum), default=StepStatusEnum.PENDING, nullable=False, index=True)

    # Timing
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_ms = Column(Integer, nullable=True)

    # Retry info
    attempt_count = Column(Integer, default=0, nullable=False)
    max_attempts = Column(Integer, default=3, nullable=False)
    next_retry_at = Column(DateTime(timezone=True), nullable=True)

    # Error info
    error_message = Column(Text, nullable=True)
    error_code = Column(String(50), nullable=True)

    # Output/metadata
    output = Column(JSONB, nullable=True)
    step_metadata = Column(JSONB, nullable=True)

    # Relationships
    workflow_execution = relationship("WorkflowExecution", back_populates="steps")

    __table_args__ = (
        # Ensure step_order is unique within a workflow execution
        # Index for efficient ordering queries
    )


class APIKey(Base, TimestampMixin):
    """
    API key for programmatic/partner authentication.

    API keys provide an alternative to JWT tokens for M2M integrations.
    Keys are permission-scoped, rate-limited, and support IP whitelisting.

    Security notes:
    - Only the SHA-256 hash of the key is stored
    - The plain key is shown only once at creation
    - Keys can be revoked immediately via is_active flag
    """
    __tablename__ = "api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Key identification
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    key_hash = Column(String(64), nullable=False, unique=True, index=True)  # SHA-256
    key_prefix = Column(String(16), nullable=False)  # First chars for identification

    # Access control
    permissions = Column(JSONB, default=[])  # List of permission strings
    allowed_ips = Column(JSONB, default=[])  # IP whitelist (empty = all allowed)

    # Rate limiting
    rate_limit_per_minute = Column(Integer, default=60, nullable=False)

    # Lifecycle
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # Usage tracking
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    use_count = Column(Integer, default=0, nullable=False)

    # Revocation tracking
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revoked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    tenant = relationship("Tenant")
    creator = relationship("User", foreign_keys=[created_by])
    revoker = relationship("User", foreign_keys=[revoked_by])


# === Webhooks ===

class Webhook(Base, TimestampMixin):
    """
    Webhook configuration for event notifications.

    Partners can register webhooks to receive real-time notifications
    about job completions, failures, artifact creation, etc.

    Security:
    - All payloads are signed with HMAC-SHA256
    - Secret is encrypted at rest
    - Supports IP whitelisting
    """
    __tablename__ = "webhooks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Configuration
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    url = Column(String(2048), nullable=False)  # Webhook endpoint URL

    # Security
    secret_encrypted = Column(LargeBinary, nullable=False)  # HMAC signing secret
    allowed_ips = Column(JSONB, default=[])  # IP whitelist (empty = all)

    # Event subscriptions - list of WebhookEventType values
    events = Column(JSONB, nullable=False, default=[])

    # Optional filtering
    report_ids = Column(JSONB, default=[])  # Filter to specific reports (empty = all)

    # Request configuration
    headers = Column(JSONB, default={})  # Custom headers to include
    timeout_seconds = Column(Integer, default=30, nullable=False)

    # Retry policy
    retry_policy = Column(JSONB, default={
        "max_attempts": 5,
        "backoff": "exponential",
        "base_delay": 5,
        "max_delay": 300
    })

    # Status
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    # Statistics
    total_deliveries = Column(Integer, default=0, nullable=False)
    successful_deliveries = Column(Integer, default=0, nullable=False)
    failed_deliveries = Column(Integer, default=0, nullable=False)
    last_triggered_at = Column(DateTime(timezone=True), nullable=True)
    last_success_at = Column(DateTime(timezone=True), nullable=True)
    last_failure_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="webhooks")
    creator = relationship("User")
    deliveries = relationship("WebhookDelivery", back_populates="webhook", cascade="all, delete-orphan")


class WebhookDelivery(Base, TimestampMixin):
    """
    Record of a webhook delivery attempt.

    Tracks each delivery attempt including request/response details
    for debugging and audit purposes.
    """
    __tablename__ = "webhook_deliveries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    webhook_id = Column(UUID(as_uuid=True), ForeignKey("webhooks.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)

    # Event details
    event_type = Column(Enum(WebhookEventType), nullable=False, index=True)
    event_id = Column(String(64), nullable=False, unique=True, index=True)  # Idempotency key
    payload = Column(JSONB, nullable=False)  # The webhook payload

    # Related entities (for filtering/queries)
    job_run_id = Column(UUID(as_uuid=True), ForeignKey("job_runs.id"), nullable=True, index=True)
    artifact_id = Column(UUID(as_uuid=True), ForeignKey("artifacts.id"), nullable=True)

    # Delivery status
    status = Column(Enum(WebhookDeliveryStatus), default=WebhookDeliveryStatus.PENDING, nullable=False, index=True)
    attempt_count = Column(Integer, default=0, nullable=False)
    max_attempts = Column(Integer, default=5, nullable=False)

    # Request details
    request_url = Column(String(2048), nullable=False)
    request_headers = Column(JSONB, default={})
    request_timestamp = Column(DateTime(timezone=True), nullable=True)

    # Response details
    response_status_code = Column(Integer, nullable=True)
    response_headers = Column(JSONB, default={})
    response_body = Column(Text, nullable=True)  # Truncated to 10KB
    response_timestamp = Column(DateTime(timezone=True), nullable=True)
    response_time_ms = Column(Integer, nullable=True)

    # Error tracking
    error_message = Column(Text, nullable=True)
    next_retry_at = Column(DateTime(timezone=True), nullable=True)

    # Completion
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    webhook = relationship("Webhook", back_populates="deliveries")
    job_run = relationship("JobRun")
    artifact = relationship("Artifact")


# === External API Sync ===

class ExternalAPIConfig(Base, TimestampMixin):
    """
    Configuration for external regulatory API connections.

    Stores connection settings, authentication credentials (encrypted),
    sync schedule, and schema mapping configuration per tenant.
    """
    __tablename__ = "external_api_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # API Configuration
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    api_base_url = Column(String(1000), nullable=False)
    api_version = Column(String(50), nullable=True)

    # Authentication
    auth_type = Column(Enum(ExternalAPIAuthType), nullable=False, default=ExternalAPIAuthType.API_KEY)
    encrypted_credentials = Column(LargeBinary, nullable=True)  # Fernet-encrypted JSON

    # Rate Limiting & Retry Config
    rate_limit_per_minute = Column(Integer, default=60, nullable=False)
    retry_config = Column(JSONB, default={
        "max_retries": 3,
        "backoff": "exponential",
        "base_delay": 2,
        "max_delay": 60
    })

    # Caching
    cache_ttl_seconds = Column(Integer, default=3600, nullable=False)  # 1 hour default

    # Sync Configuration
    sync_schedule = Column(String(100), nullable=True)  # Cron expression (e.g., "0 2 * * *" for daily 2 AM)
    auto_sync_enabled = Column(Boolean, default=True, nullable=False)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    last_sync_status = Column(String(50), nullable=True)  # success, failed, partial
    last_sync_message = Column(Text, nullable=True)

    # Schema mapping for flexible API formats
    # Maps external API response structure to OpenReg models
    schema_mapping = Column(JSONB, default={
        "reports_path": "reports",
        "validations_path": "validation_rules",
        "reference_data_path": "reference_data",
        "schedules_path": "schedules",
        "external_id_field": "external_id",
        "version_field": "version",
        "metadata_path": "metadata"
    })

    # Status
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    # Relationships
    tenant = relationship("Tenant")
    creator = relationship("User")
    sync_logs = relationship("ExternalAPISyncLog", back_populates="api_config", cascade="all, delete-orphan")


class ExternalAPISyncLog(Base, TimestampMixin):
    """
    Log of API sync operations for auditing and debugging.

    Records each sync attempt with detailed results including
    items synced, conflicts detected, and any errors encountered.
    """
    __tablename__ = "external_api_sync_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    api_config_id = Column(UUID(as_uuid=True), ForeignKey("external_api_configs.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)

    # Sync details
    sync_type = Column(Enum(SyncModeType), nullable=False, default=SyncModeType.DIFFERENTIAL)
    triggered_by = Column(Enum(SyncTriggerType), nullable=False)
    trigger_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Timing
    started_at = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_ms = Column(Integer, nullable=True)

    # Results - overall
    status = Column(String(50), nullable=False, default="running")  # running, success, failed, partial
    items_fetched = Column(Integer, default=0, nullable=False)

    # Results - by entity type
    reports_created = Column(Integer, default=0, nullable=False)
    reports_updated = Column(Integer, default=0, nullable=False)
    reports_skipped = Column(Integer, default=0, nullable=False)
    validations_created = Column(Integer, default=0, nullable=False)
    validations_updated = Column(Integer, default=0, nullable=False)
    validations_skipped = Column(Integer, default=0, nullable=False)
    reference_data_created = Column(Integer, default=0, nullable=False)
    reference_data_updated = Column(Integer, default=0, nullable=False)
    reference_data_skipped = Column(Integer, default=0, nullable=False)
    schedules_created = Column(Integer, default=0, nullable=False)
    schedules_updated = Column(Integer, default=0, nullable=False)
    schedules_skipped = Column(Integer, default=0, nullable=False)

    # Conflicts
    conflicts_detected = Column(Integer, default=0, nullable=False)
    conflicts_auto_resolved = Column(Integer, default=0, nullable=False)

    # Error tracking
    error_message = Column(Text, nullable=True)
    error_details = Column(JSONB, nullable=True)  # Stack trace, API response, etc.

    # Checkpoint for differential sync
    # Stores the last sync position for resuming
    sync_checkpoint = Column(JSONB, nullable=True)
    # {"last_modified": "2024-01-15T00:00:00Z", "page_cursor": "abc123", "api_version": "2024.1"}

    # API response metadata
    api_response_time_ms = Column(Integer, nullable=True)
    api_data_version = Column(String(100), nullable=True)

    # Relationships
    api_config = relationship("ExternalAPIConfig", back_populates="sync_logs")
    trigger_user = relationship("User")


