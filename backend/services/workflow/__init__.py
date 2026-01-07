"""
Workflow Engine for OpenReg.

Provides an explicit state machine for report execution with:
- Granular progress tracking
- Per-step retry logic
- Real-time status updates
- Audit trail of step durations
"""

from .state_machine import (
    WorkflowState,
    WorkflowTransition,
    WorkflowStateMachine,
    InvalidTransitionError,
)
from .definitions import (
    WorkflowStep,
    WorkflowDefinition,
    StepResult,
    REPORT_WORKFLOW,
)
from .executor import (
    WorkflowExecutor,
    StepExecutor,
)

__all__ = [
    # State Machine
    "WorkflowState",
    "WorkflowTransition",
    "WorkflowStateMachine",
    "InvalidTransitionError",
    # Definitions
    "WorkflowStep",
    "WorkflowDefinition",
    "StepResult",
    "REPORT_WORKFLOW",
    # Executor
    "WorkflowExecutor",
    "StepExecutor",
]
