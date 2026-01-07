"""
Workflow State Machine.

Defines the states and valid transitions for report execution workflows.
Ensures that workflows can only progress through valid state sequences.
"""

from enum import Enum
from typing import Set, Dict, Optional, List
from dataclasses import dataclass
from datetime import datetime


class WorkflowState(str, Enum):
    """
    States in the report execution workflow.

    Flow:
    PENDING → INITIALIZING → FETCHING_DATA → PRE_VALIDATION → TRANSFORMING
           → POST_VALIDATION → GENERATING_ARTIFACTS → DELIVERING → COMPLETED

    Any state can transition to FAILED or CANCELLED.
    """
    # Initial state
    PENDING = "pending"

    # Execution states
    INITIALIZING = "initializing"      # Setting up execution context
    FETCHING_DATA = "fetching_data"    # Querying source database
    PRE_VALIDATION = "pre_validation"  # Running pre-generation validations
    TRANSFORMING = "transforming"      # Executing Python transformation code
    POST_VALIDATION = "post_validation"  # Running post-generation validations
    GENERATING_ARTIFACTS = "generating_artifacts"  # Creating output files
    DELIVERING = "delivering"          # Sending to destinations

    # Terminal states
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

    # Special states
    WAITING_RETRY = "waiting_retry"    # Waiting before retry attempt
    PAUSED = "paused"                  # Manually paused by user


class InvalidTransitionError(Exception):
    """Raised when an invalid state transition is attempted."""
    def __init__(self, from_state: WorkflowState, to_state: WorkflowState):
        self.from_state = from_state
        self.to_state = to_state
        super().__init__(
            f"Invalid transition from {from_state.value} to {to_state.value}"
        )


@dataclass
class WorkflowTransition:
    """Record of a state transition."""
    from_state: Optional[WorkflowState]
    to_state: WorkflowState
    timestamp: datetime
    reason: Optional[str] = None
    error_message: Optional[str] = None
    metadata: Optional[Dict] = None


class WorkflowStateMachine:
    """
    State machine for workflow execution.

    Validates transitions and maintains transition history.
    """

    # Define valid transitions: from_state -> set of valid to_states
    VALID_TRANSITIONS: Dict[WorkflowState, Set[WorkflowState]] = {
        WorkflowState.PENDING: {
            WorkflowState.INITIALIZING,
            WorkflowState.CANCELLED,
            WorkflowState.FAILED,
        },
        WorkflowState.INITIALIZING: {
            WorkflowState.FETCHING_DATA,
            WorkflowState.FAILED,
            WorkflowState.CANCELLED,
        },
        WorkflowState.FETCHING_DATA: {
            WorkflowState.PRE_VALIDATION,
            WorkflowState.TRANSFORMING,  # Skip validation if none configured
            WorkflowState.WAITING_RETRY,
            WorkflowState.FAILED,
            WorkflowState.CANCELLED,
        },
        WorkflowState.PRE_VALIDATION: {
            WorkflowState.TRANSFORMING,
            WorkflowState.WAITING_RETRY,
            WorkflowState.FAILED,
            WorkflowState.CANCELLED,
        },
        WorkflowState.TRANSFORMING: {
            WorkflowState.POST_VALIDATION,
            WorkflowState.GENERATING_ARTIFACTS,  # Skip if no post-validation
            WorkflowState.WAITING_RETRY,
            WorkflowState.FAILED,
            WorkflowState.CANCELLED,
        },
        WorkflowState.POST_VALIDATION: {
            WorkflowState.GENERATING_ARTIFACTS,
            WorkflowState.WAITING_RETRY,
            WorkflowState.FAILED,
            WorkflowState.CANCELLED,
        },
        WorkflowState.GENERATING_ARTIFACTS: {
            WorkflowState.DELIVERING,
            WorkflowState.COMPLETED,  # Skip delivery if no destinations
            WorkflowState.WAITING_RETRY,
            WorkflowState.FAILED,
            WorkflowState.CANCELLED,
        },
        WorkflowState.DELIVERING: {
            WorkflowState.COMPLETED,
            WorkflowState.WAITING_RETRY,
            WorkflowState.FAILED,
            WorkflowState.CANCELLED,
        },
        WorkflowState.WAITING_RETRY: {
            # Can retry any execution state
            WorkflowState.INITIALIZING,
            WorkflowState.FETCHING_DATA,
            WorkflowState.PRE_VALIDATION,
            WorkflowState.TRANSFORMING,
            WorkflowState.POST_VALIDATION,
            WorkflowState.GENERATING_ARTIFACTS,
            WorkflowState.DELIVERING,
            WorkflowState.FAILED,
            WorkflowState.CANCELLED,
        },
        WorkflowState.PAUSED: {
            # Can resume to any execution state or be cancelled
            WorkflowState.INITIALIZING,
            WorkflowState.FETCHING_DATA,
            WorkflowState.PRE_VALIDATION,
            WorkflowState.TRANSFORMING,
            WorkflowState.POST_VALIDATION,
            WorkflowState.GENERATING_ARTIFACTS,
            WorkflowState.DELIVERING,
            WorkflowState.CANCELLED,
        },
        # Terminal states have no valid transitions
        WorkflowState.COMPLETED: set(),
        WorkflowState.FAILED: set(),
        WorkflowState.CANCELLED: set(),
    }

    # States that can be paused
    PAUSABLE_STATES: Set[WorkflowState] = {
        WorkflowState.PENDING,
        WorkflowState.WAITING_RETRY,
    }

    # Terminal states
    TERMINAL_STATES: Set[WorkflowState] = {
        WorkflowState.COMPLETED,
        WorkflowState.FAILED,
        WorkflowState.CANCELLED,
    }

    # States that indicate active execution
    ACTIVE_STATES: Set[WorkflowState] = {
        WorkflowState.INITIALIZING,
        WorkflowState.FETCHING_DATA,
        WorkflowState.PRE_VALIDATION,
        WorkflowState.TRANSFORMING,
        WorkflowState.POST_VALIDATION,
        WorkflowState.GENERATING_ARTIFACTS,
        WorkflowState.DELIVERING,
    }

    def __init__(self, initial_state: WorkflowState = WorkflowState.PENDING):
        self._state = initial_state
        self._history: List[WorkflowTransition] = []

        # Record initial state
        self._history.append(WorkflowTransition(
            from_state=None,
            to_state=initial_state,
            timestamp=datetime.utcnow(),
            reason="Workflow created"
        ))

    @property
    def state(self) -> WorkflowState:
        """Get current state."""
        return self._state

    @property
    def history(self) -> List[WorkflowTransition]:
        """Get transition history."""
        return self._history.copy()

    @property
    def is_terminal(self) -> bool:
        """Check if workflow is in a terminal state."""
        return self._state in self.TERMINAL_STATES

    @property
    def is_active(self) -> bool:
        """Check if workflow is actively executing."""
        return self._state in self.ACTIVE_STATES

    @property
    def can_pause(self) -> bool:
        """Check if workflow can be paused."""
        return self._state in self.PAUSABLE_STATES

    def can_transition_to(self, to_state: WorkflowState) -> bool:
        """Check if transition to given state is valid."""
        valid_states = self.VALID_TRANSITIONS.get(self._state, set())
        return to_state in valid_states

    def get_valid_transitions(self) -> Set[WorkflowState]:
        """Get all valid states we can transition to from current state."""
        return self.VALID_TRANSITIONS.get(self._state, set()).copy()

    def transition(
        self,
        to_state: WorkflowState,
        reason: Optional[str] = None,
        error_message: Optional[str] = None,
        metadata: Optional[Dict] = None,
        force: bool = False
    ) -> WorkflowTransition:
        """
        Transition to a new state.

        Args:
            to_state: The state to transition to
            reason: Human-readable reason for transition
            error_message: Error message if transitioning to FAILED
            metadata: Additional metadata to store with transition
            force: If True, skip validation (use with caution)

        Returns:
            WorkflowTransition record

        Raises:
            InvalidTransitionError: If transition is not valid
        """
        if not force and not self.can_transition_to(to_state):
            raise InvalidTransitionError(self._state, to_state)

        transition = WorkflowTransition(
            from_state=self._state,
            to_state=to_state,
            timestamp=datetime.utcnow(),
            reason=reason,
            error_message=error_message,
            metadata=metadata
        )

        self._state = to_state
        self._history.append(transition)

        return transition

    def fail(
        self,
        error_message: str,
        metadata: Optional[Dict] = None
    ) -> WorkflowTransition:
        """
        Transition to FAILED state.

        Can be called from any non-terminal state.
        """
        return self.transition(
            WorkflowState.FAILED,
            reason="Workflow failed",
            error_message=error_message,
            metadata=metadata,
            force=True  # Can fail from any state
        )

    def cancel(
        self,
        reason: str = "Cancelled by user",
        metadata: Optional[Dict] = None
    ) -> WorkflowTransition:
        """
        Transition to CANCELLED state.

        Can be called from any non-terminal state.
        """
        if self.is_terminal:
            raise InvalidTransitionError(self._state, WorkflowState.CANCELLED)

        return self.transition(
            WorkflowState.CANCELLED,
            reason=reason,
            metadata=metadata,
            force=True
        )

    def get_progress_percentage(self) -> int:
        """
        Get workflow progress as a percentage.

        Returns estimated progress based on current state.
        """
        progress_map = {
            WorkflowState.PENDING: 0,
            WorkflowState.INITIALIZING: 5,
            WorkflowState.FETCHING_DATA: 15,
            WorkflowState.PRE_VALIDATION: 30,
            WorkflowState.TRANSFORMING: 50,
            WorkflowState.POST_VALIDATION: 70,
            WorkflowState.GENERATING_ARTIFACTS: 85,
            WorkflowState.DELIVERING: 95,
            WorkflowState.COMPLETED: 100,
            WorkflowState.FAILED: 100,
            WorkflowState.CANCELLED: 100,
            WorkflowState.WAITING_RETRY: None,  # Use last active state
            WorkflowState.PAUSED: None,  # Use last active state
        }

        progress = progress_map.get(self._state)

        if progress is None:
            # For WAITING_RETRY or PAUSED, find last active state
            for transition in reversed(self._history):
                if transition.from_state in self.ACTIVE_STATES:
                    progress = progress_map.get(transition.from_state, 0)
                    break
            if progress is None:
                progress = 0

        return progress

    def get_duration(self) -> Optional[float]:
        """
        Get total workflow duration in seconds.

        Returns None if workflow hasn't started or is still running.
        """
        if len(self._history) < 2:
            return None

        start_time = self._history[0].timestamp

        if self.is_terminal:
            end_time = self._history[-1].timestamp
        else:
            end_time = datetime.utcnow()

        return (end_time - start_time).total_seconds()

    @classmethod
    def from_history(cls, history: List[WorkflowTransition]) -> "WorkflowStateMachine":
        """
        Reconstruct state machine from transition history.

        Useful for resuming workflows from database.
        """
        if not history:
            return cls()

        # Get the final state from history
        final_state = history[-1].to_state

        machine = cls(initial_state=final_state)
        machine._history = history

        return machine
