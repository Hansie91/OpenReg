"""
Workflow Definitions.

Defines the structure of workflows and their steps.
The ReportWorkflow defines the standard execution flow for report generation.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Callable, Type
from enum import Enum
from datetime import datetime

from .state_machine import WorkflowState


class StepStatus(str, Enum):
    """Status of an individual workflow step."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    RETRYING = "retrying"


@dataclass
class StepResult:
    """
    Result of executing a workflow step.

    Contains status, output data, and error information.
    """
    status: StepStatus
    output: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    error_code: Optional[str] = None
    duration_ms: Optional[int] = None
    retry_count: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_success(self) -> bool:
        return self.status == StepStatus.COMPLETED

    @property
    def is_failure(self) -> bool:
        return self.status == StepStatus.FAILED

    @property
    def should_retry(self) -> bool:
        """Check if step should be retried based on error type."""
        # Retryable error codes
        retryable_codes = {
            "CONNECTION_ERROR",
            "TIMEOUT",
            "TEMPORARY_FAILURE",
            "RATE_LIMITED",
            "SERVICE_UNAVAILABLE",
        }
        return self.error_code in retryable_codes

    @classmethod
    def success(
        cls,
        output: Optional[Dict[str, Any]] = None,
        duration_ms: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> "StepResult":
        """Create a successful step result."""
        return cls(
            status=StepStatus.COMPLETED,
            output=output or {},
            duration_ms=duration_ms,
            metadata=metadata or {}
        )

    @classmethod
    def failure(
        cls,
        error_message: str,
        error_code: Optional[str] = None,
        duration_ms: Optional[int] = None,
        retry_count: int = 0,
        metadata: Optional[Dict[str, Any]] = None
    ) -> "StepResult":
        """Create a failed step result."""
        return cls(
            status=StepStatus.FAILED,
            error_message=error_message,
            error_code=error_code,
            duration_ms=duration_ms,
            retry_count=retry_count,
            metadata=metadata or {}
        )

    @classmethod
    def skipped(
        cls,
        reason: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> "StepResult":
        """Create a skipped step result."""
        return cls(
            status=StepStatus.SKIPPED,
            metadata={"skip_reason": reason, **(metadata or {})}
        )


@dataclass
class WorkflowStep:
    """
    Definition of a single workflow step.

    Each step has:
    - A unique name
    - Associated workflow state
    - Retry configuration
    - Optional skip condition
    """
    name: str
    state: WorkflowState
    description: str

    # Retry configuration
    max_retries: int = 3
    retry_delay_seconds: int = 30
    retry_backoff_multiplier: float = 2.0
    retry_max_delay_seconds: int = 300

    # Timeout
    timeout_seconds: int = 600  # 10 minutes default

    # Skip condition - step is skipped if this returns True
    skip_condition: Optional[str] = None  # Expression evaluated at runtime

    # Whether this step is optional
    optional: bool = False

    # Next state on success (if not following default flow)
    next_state_on_success: Optional[WorkflowState] = None

    # Handler function name (resolved at runtime)
    handler: Optional[str] = None

    def get_retry_delay(self, attempt: int) -> int:
        """
        Calculate retry delay for given attempt number.

        Uses exponential backoff with configurable multiplier.
        """
        delay = self.retry_delay_seconds * (self.retry_backoff_multiplier ** attempt)
        return min(int(delay), self.retry_max_delay_seconds)

    def should_retry(self, attempt: int, result: StepResult) -> bool:
        """Check if step should be retried."""
        if attempt >= self.max_retries:
            return False
        return result.should_retry


@dataclass
class WorkflowDefinition:
    """
    Definition of a complete workflow.

    Contains ordered steps and metadata about the workflow.
    """
    name: str
    description: str
    steps: List[WorkflowStep]
    version: str = "1.0"

    # Global settings
    max_total_duration_seconds: int = 3600  # 1 hour
    allow_parallel_steps: bool = False

    def get_step(self, state: WorkflowState) -> Optional[WorkflowStep]:
        """Get step for a given workflow state."""
        for step in self.steps:
            if step.state == state:
                return step
        return None

    def get_step_by_name(self, name: str) -> Optional[WorkflowStep]:
        """Get step by name."""
        for step in self.steps:
            if step.name == name:
                return step
        return None

    def get_next_step(self, current_state: WorkflowState) -> Optional[WorkflowStep]:
        """Get the next step after the current state."""
        found_current = False
        for step in self.steps:
            if found_current:
                return step
            if step.state == current_state:
                found_current = True
        return None

    def get_step_index(self, state: WorkflowState) -> int:
        """Get the index of a step (for progress calculation)."""
        for i, step in enumerate(self.steps):
            if step.state == state:
                return i
        return -1

    def get_progress_percentage(self, current_state: WorkflowState) -> int:
        """Calculate progress percentage based on current state."""
        if current_state == WorkflowState.COMPLETED:
            return 100
        if current_state in (WorkflowState.FAILED, WorkflowState.CANCELLED):
            return 100  # Terminal but not success

        index = self.get_step_index(current_state)
        if index < 0:
            return 0

        # Calculate percentage based on step position
        total_steps = len(self.steps)
        if total_steps == 0:
            return 0

        return int((index / total_steps) * 100)


# === Standard Report Workflow Definition ===

REPORT_WORKFLOW = WorkflowDefinition(
    name="report_execution",
    description="Standard workflow for executing a report and delivering artifacts",
    version="1.0",
    steps=[
        WorkflowStep(
            name="initialize",
            state=WorkflowState.INITIALIZING,
            description="Initialize execution context, load report configuration",
            handler="initialize_execution",
            max_retries=1,
            timeout_seconds=60,
        ),
        WorkflowStep(
            name="fetch_data",
            state=WorkflowState.FETCHING_DATA,
            description="Execute source query and fetch data from connector",
            handler="fetch_source_data",
            max_retries=3,
            retry_delay_seconds=30,
            timeout_seconds=900,  # 15 minutes for large queries
        ),
        WorkflowStep(
            name="pre_validation",
            state=WorkflowState.PRE_VALIDATION,
            description="Run pre-generation validation rules",
            handler="run_pre_validations",
            max_retries=1,
            timeout_seconds=300,
            optional=True,
            skip_condition="not has_pre_validations",
        ),
        WorkflowStep(
            name="transform",
            state=WorkflowState.TRANSFORMING,
            description="Execute Python transformation code",
            handler="execute_transformation",
            max_retries=1,  # Code errors shouldn't retry
            timeout_seconds=600,
        ),
        WorkflowStep(
            name="post_validation",
            state=WorkflowState.POST_VALIDATION,
            description="Run post-generation validation rules",
            handler="run_post_validations",
            max_retries=1,
            timeout_seconds=300,
            optional=True,
            skip_condition="not has_post_validations",
        ),
        WorkflowStep(
            name="generate_artifacts",
            state=WorkflowState.GENERATING_ARTIFACTS,
            description="Generate output files (XML, CSV, etc.) and upload to storage",
            handler="generate_artifacts",
            max_retries=2,
            retry_delay_seconds=10,
            timeout_seconds=600,
        ),
        WorkflowStep(
            name="deliver",
            state=WorkflowState.DELIVERING,
            description="Deliver artifacts to configured destinations",
            handler="deliver_artifacts",
            max_retries=3,
            retry_delay_seconds=60,
            retry_backoff_multiplier=2.0,
            timeout_seconds=600,
            optional=True,
            skip_condition="not has_destinations",
        ),
    ],
    max_total_duration_seconds=7200,  # 2 hours max
)


@dataclass
class WorkflowExecutionContext:
    """
    Runtime context for a workflow execution.

    Carries data between steps and tracks execution state.
    """
    # Identifiers
    workflow_execution_id: str
    job_run_id: str
    tenant_id: str
    report_version_id: str

    # Configuration
    parameters: Dict[str, Any] = field(default_factory=dict)

    # Runtime data (passed between steps)
    source_data: Optional[Any] = None
    transformed_data: Optional[Any] = None
    artifacts: List[Dict[str, Any]] = field(default_factory=list)
    validation_results: List[Dict[str, Any]] = field(default_factory=list)

    # Feature flags (for skip conditions)
    has_pre_validations: bool = False
    has_post_validations: bool = False
    has_destinations: bool = False

    # Execution metadata
    started_at: Optional[datetime] = None
    current_step: Optional[str] = None
    step_results: Dict[str, StepResult] = field(default_factory=dict)

    # Connector info (loaded during initialization)
    connector_config: Optional[Dict[str, Any]] = None
    report_config: Optional[Dict[str, Any]] = None
    python_code: Optional[str] = None

    def set_step_result(self, step_name: str, result: StepResult):
        """Record result for a step."""
        self.step_results[step_name] = result

    def get_step_result(self, step_name: str) -> Optional[StepResult]:
        """Get result for a step."""
        return self.step_results.get(step_name)

    def evaluate_condition(self, condition: str) -> bool:
        """
        Evaluate a skip condition expression.

        Supports simple attribute checks like "not has_pre_validations".
        """
        if not condition:
            return False

        # Simple evaluation - expand as needed
        condition = condition.strip()

        # Handle "not X"
        if condition.startswith("not "):
            attr_name = condition[4:].strip()
            return not getattr(self, attr_name, False)

        # Handle simple attribute
        return bool(getattr(self, condition, False))

    def to_dict(self) -> Dict[str, Any]:
        """Serialize context to dictionary (for storage/logging)."""
        return {
            "workflow_execution_id": self.workflow_execution_id,
            "job_run_id": self.job_run_id,
            "tenant_id": self.tenant_id,
            "report_version_id": self.report_version_id,
            "parameters": self.parameters,
            "has_pre_validations": self.has_pre_validations,
            "has_post_validations": self.has_post_validations,
            "has_destinations": self.has_destinations,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "current_step": self.current_step,
            "artifact_count": len(self.artifacts),
            "validation_count": len(self.validation_results),
        }
