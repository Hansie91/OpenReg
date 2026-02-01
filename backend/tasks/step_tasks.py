"""
Individual step handlers for workflow execution.

Each handler implements a specific step in the report execution workflow.
Handlers are registered with the StepExecutor and called during workflow execution.
"""

import logging
import os
import tempfile
from datetime import datetime
from typing import Dict, Any, Optional
from uuid import UUID
import pandas as pd

from sqlalchemy.orm import Session

from services.workflow.definitions import StepResult, WorkflowExecutionContext
from services.workflow.executor import StepExecutor, StepExecutionError
import models

logger = logging.getLogger(__name__)

# Track line numbers per job run for logging
_log_line_counters: Dict[str, int] = {}


def add_job_log(
    db: Session,
    job_run_id: str,
    message: str,
    level: models.LogLevel = models.LogLevel.INFO,
    context: Optional[Dict[str, Any]] = None
):
    """Add a log entry to the job run logs table."""
    global _log_line_counters

    # Get next line number for this job
    if job_run_id not in _log_line_counters:
        _log_line_counters[job_run_id] = 0
    _log_line_counters[job_run_id] += 1
    line_number = _log_line_counters[job_run_id]

    log_entry = models.JobRunLog(
        job_run_id=UUID(job_run_id),
        line_number=line_number,
        level=level,
        message=message,
        context=context
    )
    db.add(log_entry)
    db.commit()

    # Also log to standard logger
    logger.info(f"[Job {job_run_id[:8]}] {message}")


def register_step_handlers(executor: StepExecutor):
    """Register all step handlers with the executor."""
    executor.register_handler("initialize_execution", initialize_execution)
    executor.register_handler("fetch_source_data", fetch_source_data)
    executor.register_handler("run_pre_validations", run_pre_validations)
    executor.register_handler("execute_transformation", execute_transformation)
    executor.register_handler("run_post_validations", run_post_validations)
    executor.register_handler("generate_artifacts", generate_artifacts)
    executor.register_handler("deliver_artifacts", deliver_artifacts)


async def initialize_execution(
    context: WorkflowExecutionContext,
    db: Session
) -> StepResult:
    """
    Initialize execution context.

    Loads report version configuration, connector details,
    and sets up the execution environment.
    """
    try:
        logger.info(f"Initializing execution for job run {context.job_run_id}")
        add_job_log(db, context.job_run_id, "Starting report execution")

        # Load report version
        report_version = db.query(models.ReportVersion).filter(
            models.ReportVersion.id == context.report_version_id
        ).first()

        if not report_version:
            add_job_log(db, context.job_run_id, f"Report version not found: {context.report_version_id}", models.LogLevel.ERROR)
            return StepResult.failure(
                error_message=f"Report version not found: {context.report_version_id}",
                error_code="REPORT_VERSION_NOT_FOUND"
            )

        # Get report name for logging
        report = db.query(models.Report).filter(models.Report.id == report_version.report_id).first()
        report_name = report.name if report else "Unknown"
        add_job_log(db, context.job_run_id, f"Loading report: {report_name} (v{report_version.major_version}.{report_version.minor_version})")

        # Store config and code
        context.python_code = report_version.python_code
        context.report_config = report_version.config or {}

        # Load connector if specified
        if report_version.connector_id:
            connector = db.query(models.Connector).filter(
                models.Connector.id == report_version.connector_id
            ).first()

            if connector:
                context.connector_config = {
                    "id": str(connector.id),
                    "type": connector.type.value,
                    "config": connector.config,
                    "encrypted_credentials": connector.encrypted_credentials,
                }
                add_job_log(db, context.job_run_id, f"Using data connector: {connector.name} ({connector.type.value})")
            else:
                add_job_log(db, context.job_run_id, "Warning: Connector not found", models.LogLevel.WARNING)
        else:
            add_job_log(db, context.job_run_id, "No data connector configured - will use embedded data or skip fetch")

        output_format = context.report_config.get("output_format", "csv")
        add_job_log(db, context.job_run_id, f"Output format: {output_format.upper()}")

        logger.info(f"Initialization complete for report version {report_version.id}")

        return StepResult.success(
            output={
                "report_version_id": str(report_version.id),
                "connector_configured": context.connector_config is not None,
                "output_format": output_format,
            }
        )

    except Exception as e:
        logger.error(f"Initialization failed: {e}", exc_info=True)
        return StepResult.failure(
            error_message=str(e),
            error_code="INITIALIZATION_ERROR"
        )


async def fetch_source_data(
    context: WorkflowExecutionContext,
    db: Session
) -> StepResult:
    """
    Fetch data from the source connector.

    Executes the configured query and stores results in context.
    For supplemental runs, fetches amended data from exceptions instead.
    """
    try:
        logger.info("Fetching source data...")
        add_job_log(db, context.job_run_id, "Fetching source data from connector")

        # Check for supplemental exceptions (resubmission flow)
        supplemental_ids = context.parameters.get('supplemental_exceptions', [])
        if supplemental_ids:
            add_job_log(db, context.job_run_id, f"Supplemental run: loading {len(supplemental_ids)} amended exception(s)")

            # Fetch amended data from exceptions
            exceptions = db.query(models.ValidationException).filter(
                models.ValidationException.id.in_([UUID(exc_id) for exc_id in supplemental_ids])
            ).all()

            if not exceptions:
                add_job_log(db, context.job_run_id, "No exceptions found for supplemental IDs", models.LogLevel.ERROR)
                return StepResult.failure(
                    error_message="No exceptions found for provided supplemental IDs",
                    error_code="SUPPLEMENTAL_EXCEPTIONS_NOT_FOUND"
                )

            # Use amended_data if available, otherwise fall back to original_data
            records = []
            for exc in exceptions:
                record = exc.amended_data if exc.amended_data else exc.original_data
                records.append(record)

            context.source_data = pd.DataFrame(records)
            row_count = len(context.source_data)

            logger.info(f"Loaded {row_count} records from supplemental exceptions")
            add_job_log(db, context.job_run_id, f"Loaded {row_count} amended records from exceptions")

            return StepResult.success(
                output={"rows_fetched": row_count, "source": "supplemental_exceptions"}
            )

        # Get query SQL from config
        query_sql = context.report_config.get("query_sql")
        if not query_sql:
            logger.info("No query SQL configured, skipping data fetch")
            add_job_log(db, context.job_run_id, "No query SQL configured - skipping data fetch", models.LogLevel.WARNING)
            return StepResult.success(
                output={"rows_fetched": 0, "skipped": True},
                metadata={"skip_reason": "No query SQL configured"}
            )

        # Substitute parameters into query (e.g., {report_date}, {period_start}, {period_end})
        # Parameters come from the job run request
        if context.parameters:
            for param_name, param_value in context.parameters.items():
                placeholder = "{" + param_name + "}"
                if placeholder in query_sql:
                    # Format dates properly for SQL
                    if hasattr(param_value, 'isoformat'):
                        param_value = param_value.isoformat()
                    elif hasattr(param_value, 'strftime'):
                        param_value = param_value.strftime('%Y-%m-%d')
                    query_sql = query_sql.replace(placeholder, str(param_value))
                    add_job_log(db, context.job_run_id, f"Parameter substitution: {param_name} = {param_value}")

        # Determine data source: external connector or internal CDM
        if context.connector_config:
            # Use external connector for custom data sources
            add_job_log(db, context.job_run_id, "Connecting to external data source...")

            from services.connectors.factory import ConnectorFactory

            connector_instance = ConnectorFactory.create_connector(
                db_type=context.connector_config["type"],
                config=context.connector_config["config"],
                encrypted_credentials=context.connector_config["encrypted_credentials"]
            )

            try:
                add_job_log(db, context.job_run_id, f"Executing source query: {query_sql[:200]}...")
                results = connector_instance.execute_query(
                    query=query_sql,
                    timeout=300  # 5 minute timeout
                )
                context.source_data = pd.DataFrame(results)
                row_count = len(context.source_data)

                logger.info(f"Fetched {row_count} rows from external source")
                add_job_log(db, context.job_run_id, f"Fetched {row_count} rows from external data source")

            finally:
                connector_instance.disconnect()
        else:
            # No external connector - query internal database (CDM tables)
            # This is the standard path for packaged reports that use the Common Data Model
            add_job_log(db, context.job_run_id, "Querying CDM (Common Data Model)...")

            from sqlalchemy import text

            try:
                add_job_log(db, context.job_run_id, f"Executing CDM query: {query_sql[:200]}...")
                result = db.execute(text(query_sql))

                # Convert to list of dicts for DataFrame
                columns = result.keys()
                rows = [dict(zip(columns, row)) for row in result.fetchall()]
                context.source_data = pd.DataFrame(rows)
                row_count = len(context.source_data)

                logger.info(f"Fetched {row_count} rows from CDM")
                add_job_log(db, context.job_run_id, f"Fetched {row_count} rows from CDM")

            except Exception as e:
                logger.error(f"CDM query failed: {e}")
                add_job_log(db, context.job_run_id, f"CDM query failed: {str(e)}", models.LogLevel.ERROR)
                raise

        row_count = len(context.source_data) if context.source_data is not None else 0

        # Log column info
        if row_count > 0:
            col_count = len(context.source_data.columns)
            add_job_log(db, context.job_run_id, f"Data has {col_count} columns")

        return StepResult.success(
            output={"rows_fetched": row_count, "source": "connector" if context.connector_config else "cdm"}
        )

    except Exception as e:
        logger.error(f"Data fetch failed: {e}", exc_info=True)
        add_job_log(db, context.job_run_id, f"Data fetch failed: {str(e)}", models.LogLevel.ERROR)

        # Determine if retryable
        error_code = "DATA_FETCH_ERROR"
        if "connection" in str(e).lower() or "timeout" in str(e).lower():
            error_code = "CONNECTION_ERROR"

        return StepResult.failure(
            error_message=str(e),
            error_code=error_code
        )


async def run_pre_validations(
    context: WorkflowExecutionContext,
    db: Session
) -> StepResult:
    """
    Run pre-generation validation rules.

    Validates source data before transformation.
    """
    try:
        logger.info("Running pre-generation validations...")
        add_job_log(db, context.job_run_id, "Running pre-generation validations")

        if context.source_data is None or (
            isinstance(context.source_data, pd.DataFrame) and context.source_data.empty
        ):
            logger.info("No source data to validate")
            add_job_log(db, context.job_run_id, "No source data to validate - skipping pre-validation")
            return StepResult.success(
                output={"validations_run": 0, "passed": True}
            )

        from services.validation_engine import ValidationEngine
        from services.execution_models import ExecutionContext

        # Get pre-generation validation rules
        pre_gen_validations = db.query(models.ReportValidation).filter(
            models.ReportValidation.report_version_id == context.report_version_id,
            models.ReportValidation.execution_phase == models.ExecutionPhase.PRE_GENERATION
        ).all()

        pre_gen_rules = [
            v.validation_rule for v in pre_gen_validations
            if v.validation_rule.is_active
        ]

        if not pre_gen_rules:
            logger.info("No pre-generation validations configured")
            add_job_log(db, context.job_run_id, "No pre-generation validation rules configured")
            return StepResult.success(
                output={"validations_run": 0, "passed": True}
            )

        add_job_log(db, context.job_run_id, f"Running {len(pre_gen_rules)} pre-generation validation rule(s)")

        # Create execution context for validation engine
        exec_context = ExecutionContext(
            connector_type=context.connector_config.get("type") if context.connector_config else "postgresql",
            connector_config=context.connector_config.get("config", {}) if context.connector_config else {},
            connector_credentials={},
            mappings={},
            parameters=context.parameters,
            report_version_id=UUID(context.report_version_id),
            job_run_id=UUID(context.job_run_id),
            tenant_id=UUID(context.tenant_id),
        )

        # Run validations
        pre_val_result = ValidationEngine.execute_validations(
            data=context.source_data,
            rules=pre_gen_rules,
            phase=models.ExecutionPhase.PRE_GENERATION,
            context=exec_context,
            db=db
        )

        # Store validation results
        ValidationEngine.store_validation_results(
            job_run_id=UUID(context.job_run_id),
            phase=models.ExecutionPhase.PRE_GENERATION,
            validation_result=pre_val_result,
            db=db
        )

        context.validation_results.append({
            "phase": "pre_generation",
            "rules_run": len(pre_gen_rules),
            "passed_rows": pre_val_result.passed_rows,
            "failed_rows": pre_val_result.failed_rows,
        })

        # Check for blocking failures
        if pre_val_result.blocking_failures:
            add_job_log(db, context.job_run_id, f"Pre-validation blocked: {pre_val_result.blocking_failures[0].rule_name}", models.LogLevel.ERROR)
            return StepResult.failure(
                error_message=f"Blocking validation failed: {pre_val_result.blocking_failures[0].rule_name}",
                error_code="VALIDATION_BLOCKED"
            )

        # Store exceptions for correctable failures
        if pre_val_result.correctable_failures:
            ValidationEngine.store_validation_exceptions(
                job_run_id=UUID(context.job_run_id),
                data=context.source_data,
                validation_result=pre_val_result,
                db=db
            )

        # Use only passed data for transformation
        context.source_data = pre_val_result.passed_data

        logger.info(
            f"Pre-validation complete: {pre_val_result.passed_rows} passed, "
            f"{pre_val_result.failed_rows} failed"
        )
        add_job_log(db, context.job_run_id, f"Pre-validation complete: {pre_val_result.passed_rows} passed, {pre_val_result.failed_rows} failed")

        return StepResult.success(
            output={
                "validations_run": len(pre_gen_rules),
                "passed_rows": pre_val_result.passed_rows,
                "failed_rows": pre_val_result.failed_rows,
                "passed": pre_val_result.failed_rows == 0
            }
        )

    except Exception as e:
        logger.error(f"Pre-validation failed: {e}", exc_info=True)
        add_job_log(db, context.job_run_id, f"Pre-validation error: {str(e)}", models.LogLevel.ERROR)
        return StepResult.failure(
            error_message=str(e),
            error_code="VALIDATION_ERROR"
        )


async def execute_transformation(
    context: WorkflowExecutionContext,
    db: Session
) -> StepResult:
    """
    Execute Python transformation code.

    Runs the user-provided Python code to transform data.
    """
    try:
        logger.info("Executing Python transformation...")
        add_job_log(db, context.job_run_id, "Starting data transformation")

        from services.executor import CodeExecutor
        from services.execution_models import ExecutionContext, ResourceLimits
        from services.auth import decrypt_credentials
        from config import settings

        # Decrypt connector credentials if available
        connector_credentials = {}
        if context.connector_config and context.connector_config.get("encrypted_credentials"):
            try:
                connector_credentials = decrypt_credentials(
                    context.connector_config["encrypted_credentials"]
                )
            except Exception as e:
                logger.warning(f"Failed to decrypt credentials: {e}")

        # Create execution context
        exec_context = ExecutionContext(
            connector_type=context.connector_config.get("type") if context.connector_config else "postgresql",
            connector_config=context.connector_config.get("config", {}) if context.connector_config else {},
            connector_credentials=connector_credentials,
            mappings={},
            parameters=context.parameters,
            report_version_id=UUID(context.report_version_id),
            job_run_id=UUID(context.job_run_id),
            tenant_id=UUID(context.tenant_id),
            query_sql=context.report_config.get("query_sql"),
            source_data=context.source_data,  # Pass pre-fetched source data
        )

        # Create resource limits
        limits = ResourceLimits(
            max_memory_mb=settings.CODE_MAX_MEMORY_MB,
            max_execution_seconds=settings.CODE_MAX_EXECUTION_SECONDS,
            max_output_size_mb=settings.CODE_MAX_OUTPUT_SIZE_MB,
            max_code_lines=settings.CODE_MAX_LINES
        )

        # Log source data info
        if context.source_data is not None and isinstance(context.source_data, pd.DataFrame):
            add_job_log(db, context.job_run_id, f"Transforming {len(context.source_data)} source rows")

        add_job_log(db, context.job_run_id, "Executing transformation code in sandbox...")
        add_job_log(db, context.job_run_id, f"Code length: {len(context.python_code) if context.python_code else 0} chars")

        # Execute Python code
        result = CodeExecutor.execute(
            code=context.python_code,
            context=exec_context,
            limits=limits
        )

        # Persist execution logs from the code executor
        if result.logs:
            for log_msg in result.logs:
                add_job_log(db, context.job_run_id, f"[Code] {log_msg}")

        if not result.success:
            add_job_log(db, context.job_run_id, f"Transformation failed: {result.error_type}: {result.error}", models.LogLevel.ERROR)
            return StepResult.failure(
                error_message=f"{result.error_type}: {result.error}",
                error_code="CODE_EXECUTION_ERROR"
            )

        # Store transformed data
        context.transformed_data = result.output_data

        # Log output info
        output_row_count = 0
        if context.transformed_data is not None:
            if isinstance(context.transformed_data, pd.DataFrame):
                output_row_count = len(context.transformed_data)
            elif isinstance(context.transformed_data, list):
                output_row_count = len(context.transformed_data)

        logger.info(f"Transformation complete in {result.execution_time_seconds:.2f}s")
        add_job_log(db, context.job_run_id, f"Transformation complete: {output_row_count} output rows in {result.execution_time_seconds:.2f}s")

        return StepResult.success(
            output={
                "execution_time_seconds": result.execution_time_seconds,
                "log_count": len(result.logs) if result.logs else 0,
            }
        )

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Transformation failed: {e}", exc_info=True)
        add_job_log(db, context.job_run_id, f"Transformation error: {type(e).__name__}: {str(e) or 'No message'}", models.LogLevel.ERROR)
        add_job_log(db, context.job_run_id, f"Traceback: {error_details[:500]}", models.LogLevel.ERROR)
        return StepResult.failure(
            error_message=f"{type(e).__name__}: {str(e) or 'No message'}",
            error_code="TRANSFORMATION_ERROR"
        )


async def run_post_validations(
    context: WorkflowExecutionContext,
    db: Session
) -> StepResult:
    """
    Run post-generation (pre-delivery) validation rules.

    Validates transformed data before artifact generation.
    """
    try:
        logger.info("Running post-generation validations...")
        add_job_log(db, context.job_run_id, "Running post-generation validations")

        if context.transformed_data is None:
            logger.info("No transformed data to validate")
            add_job_log(db, context.job_run_id, "No transformed data to validate - skipping post-validation")
            return StepResult.success(
                output={"validations_run": 0, "passed": True}
            )

        from services.validation_engine import ValidationEngine
        from services.execution_models import ExecutionContext

        # Get post-generation validation rules
        post_gen_validations = db.query(models.ReportValidation).filter(
            models.ReportValidation.report_version_id == context.report_version_id,
            models.ReportValidation.execution_phase == models.ExecutionPhase.PRE_DELIVERY
        ).all()

        post_gen_rules = [
            v.validation_rule for v in post_gen_validations
            if v.validation_rule.is_active
        ]

        if not post_gen_rules:
            logger.info("No post-generation validations configured")
            add_job_log(db, context.job_run_id, "No post-generation validation rules configured")
            return StepResult.success(
                output={"validations_run": 0, "passed": True}
            )

        add_job_log(db, context.job_run_id, f"Running {len(post_gen_rules)} post-generation validation rule(s)")

        # Convert transformed data to DataFrame if needed
        output_data = context.transformed_data
        if isinstance(output_data, list) and len(output_data) > 0:
            output_data = pd.DataFrame(output_data)
        elif isinstance(output_data, dict):
            if "__xml_content__" not in output_data:
                output_data = pd.DataFrame([output_data])

        if not isinstance(output_data, pd.DataFrame):
            logger.info("Output data not suitable for validation")
            return StepResult.success(
                output={"validations_run": 0, "passed": True, "skipped": True}
            )

        # Create execution context
        exec_context = ExecutionContext(
            connector_type="postgresql",
            connector_config={},
            connector_credentials={},
            mappings={},
            parameters=context.parameters,
            report_version_id=UUID(context.report_version_id),
            job_run_id=UUID(context.job_run_id),
            tenant_id=UUID(context.tenant_id),
        )

        # Run validations
        post_val_result = ValidationEngine.execute_validations(
            data=output_data,
            rules=post_gen_rules,
            phase=models.ExecutionPhase.PRE_DELIVERY,
            context=exec_context,
            db=db
        )

        # Store validation results
        ValidationEngine.store_validation_results(
            job_run_id=UUID(context.job_run_id),
            phase=models.ExecutionPhase.PRE_DELIVERY,
            validation_result=post_val_result,
            db=db
        )

        context.validation_results.append({
            "phase": "post_generation",
            "rules_run": len(post_gen_rules),
            "passed_rows": post_val_result.passed_rows,
            "failed_rows": post_val_result.failed_rows,
        })

        # Check for blocking failures
        if post_val_result.blocking_failures:
            add_job_log(db, context.job_run_id, f"Post-validation blocked: {post_val_result.blocking_failures[0].rule_name}", models.LogLevel.ERROR)
            return StepResult.failure(
                error_message=f"Output validation failed: {post_val_result.blocking_failures[0].rule_name}",
                error_code="VALIDATION_BLOCKED"
            )

        # Store exceptions
        if post_val_result.correctable_failures:
            ValidationEngine.store_validation_exceptions(
                job_run_id=UUID(context.job_run_id),
                data=output_data,
                validation_result=post_val_result,
                db=db
            )

        # Use only passed data for artifacts
        context.transformed_data = post_val_result.passed_data

        logger.info(
            f"Post-validation complete: {post_val_result.passed_rows} passed, "
            f"{post_val_result.failed_rows} failed"
        )
        add_job_log(db, context.job_run_id, f"Post-validation complete: {post_val_result.passed_rows} passed, {post_val_result.failed_rows} failed")

        return StepResult.success(
            output={
                "validations_run": len(post_gen_rules),
                "passed_rows": post_val_result.passed_rows,
                "failed_rows": post_val_result.failed_rows,
                "passed": post_val_result.failed_rows == 0
            }
        )

    except Exception as e:
        logger.error(f"Post-validation failed: {e}", exc_info=True)
        add_job_log(db, context.job_run_id, f"Post-validation error: {str(e)}", models.LogLevel.ERROR)
        return StepResult.failure(
            error_message=str(e),
            error_code="VALIDATION_ERROR"
        )


async def generate_artifacts(
    context: WorkflowExecutionContext,
    db: Session
) -> StepResult:
    """
    Generate output artifacts (CSV, XML, JSON, etc.).

    Creates files from transformed data and uploads to storage.
    """
    try:
        logger.info("Generating artifacts...")
        add_job_log(db, context.job_run_id, "Starting artifact generation")

        if context.transformed_data is None:
            logger.info("No transformed data for artifact generation")
            add_job_log(db, context.job_run_id, "No transformed data available - skipping artifact generation", models.LogLevel.WARNING)
            return StepResult.success(
                output={"artifacts_generated": 0}
            )

        from services.storage import StorageService
        from services.artifacts.generator import ArtifactGenerator
        from config import settings
        import hashlib

        storage = StorageService()
        output_data = context.transformed_data

        # Check for raw XML content
        raw_xml_content = None
        if isinstance(output_data, dict) and "__xml_content__" in output_data:
            raw_xml_content = output_data["__xml_content__"]

        # Preserve raw nested data for hierarchical XML
        raw_output_data = None
        if isinstance(output_data, list) and len(output_data) > 0:
            first_elem = output_data[0]
            if isinstance(first_elem, dict):
                has_nested = any(isinstance(v, dict) for v in first_elem.values())
                if has_nested:
                    raw_output_data = output_data

        # Convert to DataFrame if needed
        if not raw_xml_content and not isinstance(output_data, pd.DataFrame):
            if isinstance(output_data, list) and len(output_data) > 0:
                output_data = pd.DataFrame(output_data)
            elif isinstance(output_data, dict):
                output_data = pd.DataFrame([output_data])

        # Get output formats
        output_formats_config = context.report_config.get("output_format") or \
                               context.report_config.get("output_formats", "csv")
        if isinstance(output_formats_config, str):
            output_formats = [output_formats_config]
        else:
            output_formats = output_formats_config

        add_job_log(db, context.job_run_id, f"Generating artifacts in format(s): {', '.join(output_formats).upper()}")

        artifacts_created = []

        with tempfile.TemporaryDirectory() as temp_dir:
            # Get report name for filename template
            report_version = db.query(models.ReportVersion).filter(
                models.ReportVersion.id == context.report_version_id
            ).first()
            report_name = ""
            if report_version:
                report = db.query(models.Report).filter(
                    models.Report.id == report_version.report_id
                ).first()
                report_name = report.name if report else ""

            # Get output config options
            filename_template = context.report_config.get("output_filename_template", "report_{job_run_id}")
            max_records_per_file = context.report_config.get("max_records_per_file")

            # Output config contains format-specific options (csv, xml, json, txt)
            # Support multiple config structures for backward compatibility:
            # 1. output_config.csv (Reports.tsx new structure)
            # 2. csv directly on config (ReportDetail.tsx structure)
            # 3. csv_options (legacy structure)
            output_config = context.report_config.get("output_config", {})
            csv_options = (
                output_config.get("csv", {}) or
                context.report_config.get("csv", {}) or
                context.report_config.get("csv_options", {})
            )
            xml_options = (
                output_config.get("xml", {}) or
                context.report_config.get("xml", {})
            )
            json_options = (
                output_config.get("json", {}) or
                context.report_config.get("json", {})
            )
            txt_options = (
                output_config.get("txt", {}) or
                context.report_config.get("txt", {}) or
                context.report_config.get("txt_options", {})
            )

            # Get field mappings for deriving column headers
            field_mappings = context.report_config.get("field_mappings", [])

            # Derive column headers from field_mappings for CSV if not explicitly set
            # Use the target field name (last part of targetXPath or sourceColumn)
            csv_column_headers = csv_options.get("column_headers")
            if not csv_column_headers and field_mappings:
                derived_headers = []
                for mapping in field_mappings:
                    target_xpath = mapping.get("targetXPath", "")
                    source_col = mapping.get("sourceColumn", "")
                    # Extract field name from targetXPath (last segment) or use sourceColumn
                    if target_xpath:
                        field_name = target_xpath.split("/")[-1].replace("@", "")
                    else:
                        field_name = source_col
                    if field_name:
                        derived_headers.append(field_name)
                # Only use derived headers if we have any
                if derived_headers:
                    csv_column_headers = derived_headers

            add_job_log(db, context.job_run_id, f"Using filename template: {filename_template}")

            # Handle raw XML content
            if raw_xml_content:
                filename = ArtifactGenerator.resolve_filename_template(
                    template=filename_template,
                    job_run_id=context.job_run_id,
                    report_name=report_name,
                    parameters=context.parameters,
                    sequence=1,
                    output_format="xml"
                )
                filepath = os.path.join(temp_dir, filename)

                xml_with_declaration = f'<?xml version="1.0" encoding="UTF-8"?>\n{raw_xml_content}'
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(xml_with_declaration)

                with open(filepath, "rb") as f:
                    content = f.read()
                    sha256_checksum = hashlib.sha256(content).hexdigest()

                storage_uri = storage.upload_artifact(
                    bucket=settings.ARTIFACT_BUCKET,
                    filename=filename,
                    data=content,
                    metadata={"job_run_id": context.job_run_id, "output_format": "xml"}
                )

                artifact = models.Artifact(
                    job_run_id=UUID(context.job_run_id),
                    filename=filename,
                    storage_uri=storage_uri,
                    mime_type="application/xml",
                    size_bytes=len(content),
                    checksum_sha256=sha256_checksum
                )
                db.add(artifact)
                db.commit()

                artifacts_created.append({"filename": filename, "size_bytes": len(content)})
                context.artifacts.append({
                    "id": str(artifact.id),
                    "filename": filename,
                    "storage_uri": storage_uri,
                })
                add_job_log(db, context.job_run_id, f"Generated XML artifact: {filename} ({len(content) / 1024:.1f} KB)")

            # Handle DataFrame output
            elif isinstance(output_data, pd.DataFrame):
                for output_format in output_formats:
                    try:
                        # Split into batches if configured
                        batches = ArtifactGenerator.split_into_batches(output_data, max_records_per_file)
                        total_batches = len(batches)

                        if total_batches > 1:
                            add_job_log(db, context.job_run_id, f"Splitting {len(output_data)} rows into {total_batches} batch files")

                        for batch_seq, batch_data in enumerate(batches, 1):
                            # Resolve filename with sequence number
                            filename = ArtifactGenerator.resolve_filename_template(
                                template=filename_template,
                                job_run_id=context.job_run_id,
                                report_name=report_name,
                                parameters=context.parameters,
                                sequence=batch_seq,
                                output_format=output_format
                            )
                            filepath = os.path.join(temp_dir, filename)

                            # Generate artifact based on format
                            if output_format == "csv":
                                metadata = ArtifactGenerator.generate_csv(
                                    data=batch_data,
                                    filepath=filepath,
                                    delimiter=csv_options.get("delimiter", ","),
                                    quote_char=csv_options.get("quote_char", '"'),
                                    escape_char=csv_options.get("escape_char", "\\"),
                                    include_header=csv_options.get("include_header", True),
                                    line_ending=csv_options.get("line_ending", "lf"),
                                    column_headers=csv_column_headers,
                                    file_header=csv_options.get("file_header"),
                                    file_trailer=csv_options.get("trailer_text") if csv_options.get("include_trailer") else None,
                                )
                            elif output_format == "json":
                                metadata = ArtifactGenerator.generate_json(
                                    data=batch_data,
                                    filepath=filepath,
                                    indent=2 if json_options.get("pretty_print", True) else None,
                                    wrapper_template=json_options.get("wrapper_template"),
                                )
                            elif output_format == "xml":
                                field_mappings = context.report_config.get("field_mappings", [])
                                namespace = context.report_config.get("namespace")

                                # For batch splits, use corresponding slice of raw_output_data
                                if raw_output_data is not None:
                                    start_idx = (batch_seq - 1) * (max_records_per_file or len(raw_output_data))
                                    end_idx = start_idx + len(batch_data)
                                    batch_raw_data = raw_output_data[start_idx:end_idx]
                                    metadata = ArtifactGenerator.generate_xml_from_dicts(
                                        data=batch_raw_data,
                                        filepath=filepath,
                                        root_name=xml_options.get("root_element"),  # None = derive from XPath
                                        row_name=xml_options.get("row_element", "Tx"),
                                        pretty_print=xml_options.get("pretty_print", True),
                                        include_declaration=xml_options.get("include_declaration", True),
                                        namespace=namespace,
                                    )
                                else:
                                    # Get header config for MiFIR/regulatory reports
                                    # Merge structured header config with custom_header
                                    header_config = xml_options.get("header", {}).copy() if xml_options.get("header") else {}
                                    if xml_options.get("custom_header"):
                                        header_config["custom_header"] = xml_options.get("custom_header")
                                    metadata = ArtifactGenerator.generate_xml(
                                        data=batch_data,
                                        filepath=filepath,
                                        root_name=xml_options.get("root_element"),  # None = derive from XPath
                                        field_mappings=field_mappings,
                                        namespace=namespace,
                                        pretty_print=xml_options.get("pretty_print", True),
                                        include_declaration=xml_options.get("include_declaration", True),
                                        header_config=header_config if header_config else None,
                                    )
                            elif output_format == "txt":
                                metadata = ArtifactGenerator.generate_txt(
                                    data=batch_data,
                                    filepath=filepath,
                                    delimiter=txt_options.get("delimiter", "\t"),
                                    include_header=txt_options.get("include_header", True),
                                    line_ending=txt_options.get("line_ending", "lf"),
                                    columns=txt_options.get("columns"),
                                    record_length=txt_options.get("record_length"),
                                    column_headers=txt_options.get("column_headers"),
                                )
                            else:
                                logger.warning(f"Unknown output format: {output_format}")
                                continue

                            # Upload to storage
                            with open(filepath, "rb") as f:
                                artifact_data = f.read()

                            storage_uri = storage.upload_artifact(
                                bucket=settings.ARTIFACT_BUCKET,
                                filename=filename,
                                data=artifact_data,
                                metadata={"job_run_id": context.job_run_id, "output_format": output_format, "batch": batch_seq}
                            )

                            # Create artifact record
                            artifact = models.Artifact(
                                job_run_id=UUID(context.job_run_id),
                                filename=filename,
                                storage_uri=storage_uri,
                                mime_type=metadata["mime_type"],
                                size_bytes=metadata["size_bytes"],
                                checksum_sha256=metadata["sha256_checksum"]
                            )
                            db.add(artifact)
                            db.flush()

                            artifacts_created.append({
                                "filename": filename,
                                "size_bytes": metadata["size_bytes"],
                                "batch": batch_seq,
                                "row_count": metadata.get("row_count", len(batch_data))
                            })
                            context.artifacts.append({
                                "id": str(artifact.id),
                                "filename": filename,
                                "storage_uri": storage_uri,
                            })

                            batch_info = f" (batch {batch_seq}/{total_batches})" if total_batches > 1 else ""
                            add_job_log(db, context.job_run_id, f"Generated {output_format.upper()} artifact: {filename}{batch_info} ({metadata['size_bytes'] / 1024:.1f} KB)")

                    except Exception as e:
                        import traceback
                        logger.error(f"Failed to generate {output_format} artifact: {e}\n{traceback.format_exc()}")
                        add_job_log(db, context.job_run_id, f"Failed to generate {output_format.upper()} artifact: {str(e)}", models.LogLevel.ERROR)

                db.commit()

        logger.info(f"Generated {len(artifacts_created)} artifact(s)")
        add_job_log(db, context.job_run_id, f"Artifact generation complete: {len(artifacts_created)} file(s) created")

        return StepResult.success(
            output={
                "artifacts_generated": len(artifacts_created),
                "artifacts": artifacts_created
            }
        )

    except Exception as e:
        logger.error(f"Artifact generation failed: {e}", exc_info=True)
        add_job_log(db, context.job_run_id, f"Artifact generation failed: {str(e)}", models.LogLevel.ERROR)
        return StepResult.failure(
            error_message=str(e),
            error_code="ARTIFACT_GENERATION_ERROR"
        )


async def deliver_artifacts(
    context: WorkflowExecutionContext,
    db: Session
) -> StepResult:
    """
    Deliver artifacts to configured destinations.

    Queues delivery tasks for each artifact/destination combination.
    """
    try:
        logger.info("Delivering artifacts to destinations...")
        add_job_log(db, context.job_run_id, "Starting artifact delivery")

        if not context.artifacts:
            logger.info("No artifacts to deliver")
            add_job_log(db, context.job_run_id, "No artifacts to deliver - skipping delivery step")
            return StepResult.success(
                output={"deliveries_queued": 0}
            )

        # Get report to find linked destinations
        report_version = db.query(models.ReportVersion).filter(
            models.ReportVersion.id == context.report_version_id
        ).first()

        if not report_version:
            return StepResult.success(
                output={"deliveries_queued": 0, "reason": "Report version not found"}
            )

        report = db.query(models.Report).filter(
            models.Report.id == report_version.report_id
        ).first()

        if not report:
            return StepResult.success(
                output={"deliveries_queued": 0, "reason": "Report not found"}
            )

        # Get linked destinations
        report_destinations = db.query(models.ReportDestination).filter(
            models.ReportDestination.report_id == report.id
        ).all()

        if not report_destinations:
            logger.info("No destinations linked to report")
            add_job_log(db, context.job_run_id, "No delivery destinations configured for this report")
            return StepResult.success(
                output={"deliveries_queued": 0, "reason": "No destinations configured"}
            )

        add_job_log(db, context.job_run_id, f"Found {len(report_destinations)} configured destination(s)")

        # Queue deliveries
        from worker import deliver_artifact_task

        deliveries_queued = 0
        for artifact_info in context.artifacts:
            artifact_id = artifact_info["id"]

            for rd in report_destinations:
                # Check if destination is active
                dest = db.query(models.Destination).filter(
                    models.Destination.id == rd.destination_id,
                    models.Destination.is_active == True
                ).first()

                if dest:
                    logger.info(f"Queueing delivery: {artifact_info['filename']} -> {dest.name}")
                    add_job_log(db, context.job_run_id, f"Queueing delivery: {artifact_info['filename']} → {dest.name}")
                    deliver_artifact_task.delay(artifact_id, str(dest.id))
                    deliveries_queued += 1

        logger.info(f"Queued {deliveries_queued} deliveries")
        add_job_log(db, context.job_run_id, f"Delivery complete: {deliveries_queued} delivery job(s) queued")

        return StepResult.success(
            output={
                "deliveries_queued": deliveries_queued,
                "destinations": len(report_destinations),
                "artifacts": len(context.artifacts)
            }
        )

    except Exception as e:
        logger.error(f"Delivery queueing failed: {e}", exc_info=True)
        add_job_log(db, context.job_run_id, f"Delivery failed: {str(e)}", models.LogLevel.ERROR)
        return StepResult.failure(
            error_message=str(e),
            error_code="DELIVERY_ERROR"
        )
