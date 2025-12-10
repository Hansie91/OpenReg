"""
Validation Engine Service

Executes validation rules against report data, segregates passing/failing records,
and manages exception workflow for correctable failures.
"""

import logging
import time
from typing import List, Dict, Any, Tuple, Set
from dataclasses import dataclass, field
from uuid import UUID

import pandas as pd
from sqlalchemy.orm import Session

from services.database import DatabaseService
from services.execution_models import ExecutionContext
import models

logger = logging.getLogger(__name__)


# ==================== Data Structures ====================

@dataclass
class ValidationRuleResult:
    """Result of executing a single validation rule"""
    rule_id: UUID
    rule_name: str
    passed: bool
    severity: models.ValidationSeverity
    failed_rows: List[int] = field(default_factory=list)  # Row indices that failed
    error_messages: Dict[int, str] = field(default_factory=dict)  # Row -> error message
    execution_time_ms: float = 0.0


@dataclass  
class ValidationExecutionResult:
    """Result of executing all validations for a phase"""
    all_passed: bool
    blocking_failures: List[ValidationRuleResult]
    correctable_failures: List[ValidationRuleResult]
    warnings: List[ValidationRuleResult]
    passed_data: pd.DataFrame
    failed_row_indices: Set[int]
    execution_time_ms: float
    total_rows: int
    passed_rows: int
    failed_rows: int


# ==================== Validation Engine ====================

class ValidationEngine:
    """Service for executing validation rules against data"""
    
    @staticmethod
    def execute_validations(
        data: pd.DataFrame,
        rules: List[models.ValidationRule],
        phase: models.ExecutionPhase,
        context: ExecutionContext,
        db: Session
    ) -> ValidationExecutionResult:
        """
        Execute all validation rules for given phase.
        
        Args:
            data: DataFrame to validate
            rules: List of validation rules to execute
            phase: Execution phase (pre_generation or pre_delivery)
            context: Execution context with database access
            db: Database session for saving results
            
        Returns:
            ValidationExecutionResult with segregated data and exceptions
        """
        start_time = time.time()
        
        if data is None or data.empty:
            logger.warning("No data to validate")
            return ValidationExecutionResult(
                all_passed=True,
                blocking_failures=[],
                correctable_failures=[],
                warnings=[],
                passed_data=data if data is not None else pd.DataFrame(),
                failed_row_indices=set(),
                execution_time_ms=0.0,
                total_rows=0,
                passed_rows=0,
                failed_rows=0
            )
        
        total_rows = len(data)
        rule_results = []
        
        # Execute each validation rule
        for rule in rules:
            if not rule.is_active:
                continue
                
            logger.info(f"Executing validation rule: {rule.name}")
            
            try:
                if rule.rule_type == models.ValidationRuleType.SQL:
                    result = ValidationEngine._execute_sql_validation(
                        rule, data, context
                    )
                elif rule.rule_type == models.ValidationRuleType.PYTHON_EXPR:
                    result = ValidationEngine._execute_python_validation(
                        rule, data
                    )
                else:
                    logger.error(f"Unknown validation rule type: {rule.rule_type}")
                    continue
                
                rule_results.append(result)
                
            except Exception as e:
                logger.error(f"Error executing validation rule {rule.name}: {e}")
                # Treat execution errors as blocking failures
                rule_results.append(ValidationRuleResult(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    passed=False,
                    severity=models.ValidationSeverity.BLOCKING,
                    error_messages={0: f"Validation execution error: {str(e)}"}
                ))
        
        # Categorize results by severity
        blocking_failures = [r for r in rule_results if not r.passed and r.severity == models.ValidationSeverity.BLOCKING]
        correctable_failures = [r for r in rule_results if not r.passed and r.severity == models.ValidationSeverity.CORRECTABLE]
        warnings = [r for r in rule_results if not r.passed and r.severity == models.ValidationSeverity.WARNING]
        
        # Collect all failed row indices (for correctable failures only)
        failed_row_indices = set()
        for result in correctable_failures:
            failed_row_indices.update(result.failed_rows)
        
        # Segregate data
        if failed_row_indices:
            # Keep only rows that passed all correctable validations
            passed_mask = ~data.index.isin(failed_row_indices)
            passed_data = data[passed_mask].copy()
        else:
            passed_data = data.copy()
        
        all_passed = len(blocking_failures) == 0 and len(correctable_failures) == 0
        
        execution_time = (time.time() - start_time) * 1000
        
        return ValidationExecutionResult(
            all_passed=all_passed,
            blocking_failures=blocking_failures,
            correctable_failures=correctable_failures,
            warnings=warnings,
            passed_data=passed_data,
            failed_row_indices=failed_row_indices,
            execution_time_ms=execution_time,
            total_rows=total_rows,
            passed_rows=len(passed_data),
            failed_rows=len(failed_row_indices)
        )
    
    @staticmethod
    def _execute_sql_validation(
        rule: models.ValidationRule,
        data: pd.DataFrame,
        context: ExecutionContext
    ) -> ValidationRuleResult:
        """
        Execute SQL-based validation.
        
        SQL query should return rows that FAIL validation with columns:
        - row_number: Integer index of failed row
        - error (optional): Custom error message
        """
        start_time = time.time()
        
        try:
            # Execute SQL query
            results = DatabaseService.execute_query(
                db_type=context.connector_type,
                config=context.connector_config,
                credentials=context.connector_credentials,
                query=rule.expression,
                timeout=60
            )
            
            failed_rows = []
            error_messages = {}
            
            if results:
                for row in results:
                    row_num = row.get('row_number', row.get('row_num', 0))
                    error_msg = row.get('error', rule.error_message)
                    
                    failed_rows.append(row_num)
                    error_messages[row_num] = error_msg
            
            execution_time = (time.time() - start_time) * 1000
            
            return ValidationRuleResult(
                rule_id=rule.id,
                rule_name=rule.name,
                passed=len(failed_rows) == 0,
                severity=rule.severity,
                failed_rows=failed_rows,
                error_messages=error_messages,
                execution_time_ms=execution_time
            )
            
        except Exception as e:
            logger.error(f"SQL validation failed for rule {rule.name}: {e}")
            raise
    
    @staticmethod
    def _execute_python_validation(
        rule: models.ValidationRule,
        data: pd.DataFrame
    ) -> ValidationRuleResult:
        """
        Execute Python expression validation.
        
        Expression should return:
        - Boolean Series (True = pass, False = fail)
        - Or list of failed row indices
        """
        start_time = time.time()
        
        try:
            # Create evaluation namespace
            namespace = {
                'df': data,
                'pd': pd,
                'len': len
            }
            
            # Evaluate expression
            result = eval(rule.expression, {"__builtins__": {}}, namespace)
            
            failed_rows = []
            error_messages = {}
            
            if isinstance(result, pd.Series):
                # Boolean mask - False means failed
                if result.dtype == bool:
                    failed_indices = data.index[~result].tolist()
                    failed_rows = failed_indices
                    for idx in failed_indices:
                        error_messages[idx] = rule.error_message
            
            elif isinstance(result, (list, set)):
                # List of failed indices
                failed_rows = list(result)
                for idx in failed_rows:
                    error_messages[idx] = rule.error_message
            
            elif isinstance(result, bool):
                # Single boolean - applies to all rows
                if not result:
                    failed_rows = data.index.tolist()
                    for idx in failed_rows:
                        error_messages[idx] = rule.error_message
            
            execution_time = (time.time() - start_time) * 1000
            
            return ValidationRuleResult(
                rule_id=rule.id,
                rule_name=rule.name,
                passed=len(failed_rows) == 0,
                severity=rule.severity,
                failed_rows=failed_rows,
                error_messages=error_messages,
                execution_time_ms=execution_time
            )
            
        except Exception as e:
            logger.error(f"Python validation failed for rule {rule.name}: {e}")
            raise
    
    @staticmethod
    def store_validation_results(
        job_run_id: UUID,
        phase: models.ExecutionPhase,
        validation_result: ValidationExecutionResult,
        db: Session
    ):
        """Store validation results in database"""
        
        all_results = (
            validation_result.blocking_failures +
            validation_result.correctable_failures +
            validation_result.warnings
        )
        
        for result in all_results:
            vr = models.ValidationResult(
                job_run_id=job_run_id,
                validation_rule_id=result.rule_id,
                execution_phase=phase,
                passed=result.passed,
                failed_count=len(result.failed_rows),
                warning_count=1 if result.severity == models.ValidationSeverity.WARNING and not result.passed else 0,
                exception_count=len(result.failed_rows) if result.severity == models.ValidationSeverity.CORRECTABLE else 0,
                execution_time_ms=int(result.execution_time_ms)
            )
            db.add(vr)
    
    @staticmethod
    def store_validation_exceptions(
        job_run_id: UUID,
        data: pd.DataFrame,
        validation_result: ValidationExecutionResult,
        db: Session
    ):
        """Store failed rows as exceptions for manual review"""
        
        for result in validation_result.correctable_failures:
            for row_idx in result.failed_rows:
                if row_idx < len(data):
                    row_data = data.iloc[row_idx].to_dict()
                    
                    exception = models.ValidationException(
                        job_run_id=job_run_id,
                        validation_rule_id=result.rule_id,
                        row_number=row_idx,
                        original_data=row_data,
                        error_message=result.error_messages.get(row_idx, result.rule_name),
                        status=models.ExceptionStatus.PENDING
                    )
                    db.add(exception)
