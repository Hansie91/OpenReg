"""
Workflow Executor.

Executes workflow steps with retry logic, timeout handling,
and state persistence.
"""

import asyncio
import logging
import time
from datetime import datetime
from typing import Optional, Dict, Any, Callable, Awaitable
from functools import wraps
from sqlalchemy.orm import Session

from .state_machine import WorkflowState, WorkflowStateMachine, InvalidTransitionError
from .definitions import (
    WorkflowStep,
    WorkflowDefinition,
    StepResult,
    StepStatus,
    WorkflowExecutionContext,
    REPORT_WORKFLOW,
)

logger = logging.getLogger(__name__)


class StepTimeoutError(Exception):
    """Raised when a step exceeds its timeout."""
    pass


class StepExecutionError(Exception):
    """Raised when a step fails execution."""
    def __init__(self, message: str, error_code: Optional[str] = None):
        super().__init__(message)
        self.error_code = error_code


# Type for step handler functions
StepHandler = Callable[[WorkflowExecutionContext, Session], Awaitable[StepResult]]


class StepExecutor:
    """
    Executes individual workflow steps with retry and timeout handling.
    """

    def __init__(self, handlers: Dict[str, StepHandler] = None):
        """
        Initialize step executor.

        Args:
            handlers: Map of handler names to handler functions
        """
        self._handlers = handlers or {}

    def register_handler(self, name: str, handler: StepHandler):
        """Register a step handler function."""
        self._handlers[name] = handler

    def get_handler(self, name: str) -> Optional[StepHandler]:
        """Get a registered handler by name."""
        return self._handlers.get(name)

    async def execute_step(
        self,
        step: WorkflowStep,
        context: WorkflowExecutionContext,
        db: Session,
    ) -> StepResult:
        """
        Execute a single workflow step.

        Handles:
        - Skip conditions
        - Timeout
        - Retries with backoff
        - Error capture

        Args:
            step: The step definition to execute
            context: Workflow execution context
            db: Database session

        Returns:
            StepResult with status and output
        """
        # Check skip condition
        if step.skip_condition and context.evaluate_condition(step.skip_condition):
            logger.info(f"Skipping step {step.name}: condition '{step.skip_condition}' is true")
            return StepResult.skipped(
                reason=f"Skip condition met: {step.skip_condition}"
            )

        # Get handler
        handler = self.get_handler(step.handler)
        if not handler:
            logger.error(f"No handler registered for step {step.name}: {step.handler}")
            return StepResult.failure(
                error_message=f"Handler not found: {step.handler}",
                error_code="HANDLER_NOT_FOUND"
            )

        # Execute with retries
        attempt = 0
        last_result = None

        while attempt <= step.max_retries:
            try:
                start_time = time.time()
                context.current_step = step.name

                # Execute with timeout
                result = await asyncio.wait_for(
                    handler(context, db),
                    timeout=step.timeout_seconds
                )

                duration_ms = int((time.time() - start_time) * 1000)
                result.duration_ms = duration_ms
                result.retry_count = attempt

                if result.is_success:
                    logger.info(
                        f"Step {step.name} completed successfully in {duration_ms}ms"
                    )
                    return result

                # Step returned failure
                last_result = result

                if step.should_retry(attempt, result):
                    attempt += 1
                    if attempt <= step.max_retries:
                        delay = step.get_retry_delay(attempt)
                        logger.warning(
                            f"Step {step.name} failed (attempt {attempt}/{step.max_retries}), "
                            f"retrying in {delay}s: {result.error_message}"
                        )
                        await asyncio.sleep(delay)
                        continue

                # No retry - return failure
                return result

            except asyncio.TimeoutError:
                duration_ms = int((time.time() - start_time) * 1000)
                last_result = StepResult.failure(
                    error_message=f"Step timed out after {step.timeout_seconds}s",
                    error_code="TIMEOUT",
                    duration_ms=duration_ms,
                    retry_count=attempt
                )

                # Timeout is retryable
                if step.should_retry(attempt, last_result):
                    attempt += 1
                    if attempt <= step.max_retries:
                        delay = step.get_retry_delay(attempt)
                        logger.warning(
                            f"Step {step.name} timed out (attempt {attempt}/{step.max_retries}), "
                            f"retrying in {delay}s"
                        )
                        await asyncio.sleep(delay)
                        continue

                return last_result

            except Exception as e:
                duration_ms = int((time.time() - start_time) * 1000)
                error_code = getattr(e, 'error_code', 'EXECUTION_ERROR')

                last_result = StepResult.failure(
                    error_message=str(e),
                    error_code=error_code,
                    duration_ms=duration_ms,
                    retry_count=attempt
                )

                # Check if error is retryable
                if step.should_retry(attempt, last_result):
                    attempt += 1
                    if attempt <= step.max_retries:
                        delay = step.get_retry_delay(attempt)
                        logger.warning(
                            f"Step {step.name} failed with {error_code} "
                            f"(attempt {attempt}/{step.max_retries}), "
                            f"retrying in {delay}s: {e}"
                        )
                        await asyncio.sleep(delay)
                        continue

                logger.error(f"Step {step.name} failed: {e}", exc_info=True)
                return last_result

        return last_result or StepResult.failure(
            error_message="Max retries exceeded",
            error_code="MAX_RETRIES_EXCEEDED"
        )


class WorkflowExecutor:
    """
    Executes complete workflows, managing state transitions and step execution.
    """

    def __init__(
        self,
        workflow: WorkflowDefinition = None,
        step_executor: StepExecutor = None,
        on_state_change: Optional[Callable[[WorkflowState, WorkflowState, Dict], Awaitable[None]]] = None,
        on_step_complete: Optional[Callable[[str, StepResult], Awaitable[None]]] = None,
    ):
        """
        Initialize workflow executor.

        Args:
            workflow: Workflow definition to execute
            step_executor: Executor for individual steps
            on_state_change: Callback for state transitions
            on_step_complete: Callback when a step completes
        """
        self.workflow = workflow or REPORT_WORKFLOW
        self.step_executor = step_executor or StepExecutor()
        self._on_state_change = on_state_change
        self._on_step_complete = on_step_complete
        self._state_machine: Optional[WorkflowStateMachine] = None

    @property
    def current_state(self) -> Optional[WorkflowState]:
        """Get current workflow state."""
        return self._state_machine.state if self._state_machine else None

    @property
    def is_complete(self) -> bool:
        """Check if workflow has completed (success or failure)."""
        return self._state_machine and self._state_machine.is_terminal

    @property
    def progress_percentage(self) -> int:
        """Get current progress percentage."""
        if not self._state_machine:
            return 0
        return self.workflow.get_progress_percentage(self._state_machine.state)

    async def _notify_state_change(
        self,
        from_state: Optional[WorkflowState],
        to_state: WorkflowState,
        metadata: Dict = None
    ):
        """Notify state change callback if registered."""
        if self._on_state_change:
            try:
                await self._on_state_change(from_state, to_state, metadata or {})
            except Exception as e:
                logger.error(f"Error in state change callback: {e}")

    async def _notify_step_complete(self, step_name: str, result: StepResult):
        """Notify step complete callback if registered."""
        if self._on_step_complete:
            try:
                await self._on_step_complete(step_name, result)
            except Exception as e:
                logger.error(f"Error in step complete callback: {e}")

    async def _transition(
        self,
        to_state: WorkflowState,
        reason: str = None,
        error_message: str = None,
        metadata: Dict = None
    ):
        """Perform state transition with notification."""
        from_state = self._state_machine.state
        self._state_machine.transition(
            to_state,
            reason=reason,
            error_message=error_message,
            metadata=metadata
        )
        await self._notify_state_change(from_state, to_state, metadata)

    async def execute(
        self,
        context: WorkflowExecutionContext,
        db: Session,
        resume_from: Optional[WorkflowState] = None
    ) -> StepResult:
        """
        Execute the workflow.

        Args:
            context: Execution context with parameters and runtime data
            db: Database session
            resume_from: Optional state to resume from (for recovery)

        Returns:
            Final StepResult indicating success or failure
        """
        # Initialize state machine
        if resume_from:
            self._state_machine = WorkflowStateMachine(initial_state=resume_from)
        else:
            self._state_machine = WorkflowStateMachine()
            context.started_at = datetime.utcnow()

        logger.info(
            f"Starting workflow execution {context.workflow_execution_id} "
            f"from state {self._state_machine.state.value}"
        )

        # Track overall start time for max duration check
        workflow_start = time.time()

        try:
            # Transition from PENDING to first step
            if self._state_machine.state == WorkflowState.PENDING:
                await self._transition(
                    WorkflowState.INITIALIZING,
                    reason="Starting workflow execution"
                )

            # Execute steps in sequence
            for step in self.workflow.steps:
                # Check if we should execute this step based on current state
                if self._state_machine.state != step.state:
                    # Skip steps until we reach current state
                    if self.workflow.get_step_index(step.state) < \
                       self.workflow.get_step_index(self._state_machine.state):
                        continue

                    # Transition to step state
                    try:
                        await self._transition(
                            step.state,
                            reason=f"Starting step: {step.name}"
                        )
                    except InvalidTransitionError:
                        # Can't transition to this step - workflow may have failed/cancelled
                        break

                # Check max duration
                elapsed = time.time() - workflow_start
                if elapsed > self.workflow.max_total_duration_seconds:
                    await self._transition(
                        WorkflowState.FAILED,
                        reason="Workflow timeout",
                        error_message=f"Workflow exceeded max duration of "
                                     f"{self.workflow.max_total_duration_seconds}s"
                    )
                    return StepResult.failure(
                        error_message="Workflow timeout exceeded",
                        error_code="WORKFLOW_TIMEOUT"
                    )

                # Execute step
                logger.info(f"Executing step: {step.name}")
                result = await self.step_executor.execute_step(step, context, db)
                context.set_step_result(step.name, result)
                await self._notify_step_complete(step.name, result)

                if result.status == StepStatus.SKIPPED:
                    logger.info(f"Step {step.name} skipped")
                    continue

                if result.is_failure:
                    # Check if step is optional
                    if step.optional:
                        logger.warning(
                            f"Optional step {step.name} failed, continuing: "
                            f"{result.error_message}"
                        )
                        continue

                    # Non-optional step failed - fail workflow
                    await self._transition(
                        WorkflowState.FAILED,
                        reason=f"Step {step.name} failed",
                        error_message=result.error_message
                    )
                    return StepResult.failure(
                        error_message=f"Step {step.name} failed: {result.error_message}",
                        error_code=result.error_code,
                        metadata={"failed_step": step.name}
                    )

            # All steps completed successfully
            await self._transition(
                WorkflowState.COMPLETED,
                reason="Workflow completed successfully"
            )

            total_duration = int((time.time() - workflow_start) * 1000)
            return StepResult.success(
                output={
                    "artifacts": context.artifacts,
                    "validation_results": context.validation_results,
                },
                duration_ms=total_duration,
                metadata=context.to_dict()
            )

        except Exception as e:
            logger.error(f"Workflow execution failed: {e}", exc_info=True)
            try:
                await self._transition(
                    WorkflowState.FAILED,
                    reason="Unhandled exception",
                    error_message=str(e)
                )
            except Exception:
                pass  # Already in terminal state

            return StepResult.failure(
                error_message=str(e),
                error_code="WORKFLOW_ERROR"
            )

    async def cancel(self, reason: str = "Cancelled by user"):
        """Cancel the workflow."""
        if self._state_machine and not self._state_machine.is_terminal:
            self._state_machine.cancel(reason)
            await self._notify_state_change(
                self._state_machine.history[-2].from_state,
                WorkflowState.CANCELLED,
                {"reason": reason}
            )

    def get_status(self) -> Dict[str, Any]:
        """Get current workflow status."""
        if not self._state_machine:
            return {
                "state": None,
                "progress": 0,
                "is_complete": False,
                "history": []
            }

        return {
            "state": self._state_machine.state.value,
            "progress": self.progress_percentage,
            "is_complete": self._state_machine.is_terminal,
            "is_active": self._state_machine.is_active,
            "duration_seconds": self._state_machine.get_duration(),
            "history": [
                {
                    "from_state": t.from_state.value if t.from_state else None,
                    "to_state": t.to_state.value,
                    "timestamp": t.timestamp.isoformat(),
                    "reason": t.reason,
                    "error_message": t.error_message,
                }
                for t in self._state_machine.history
            ]
        }
