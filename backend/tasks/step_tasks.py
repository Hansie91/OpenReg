"""
Individual step handlers for workflow execution.

Each handler implements a specific step in the report execution workflow.
Handlers are registered with the StepExecutor and called during workflow execution.
"""

import logging
import os
import tempfile
from datetime import datetime
from typing import Dict, Any
from uuid import UUID
import pandas as pd

from sqlalchemy.orm import Session

from services.workflow.definitions import StepResult, WorkflowExecutionContext
from services.workflow.executor import StepExecutor, StepExecutionError
import models

logger = logging.getLogger(__name__)


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

        # Load report version
        report_version = db.query(models.ReportVersion).filter(
            models.ReportVersion.id == context.report_version_id
        ).first()

        if not report_version:
            return StepResult.failure(
                error_message=f"Report version not found: {context.report_version_id}",
                error_code="REPORT_VERSION_NOT_FOUND"
            )

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

        logger.info(f"Initialization complete for report version {report_version.id}")

        return StepResult.success(
            output={
                "report_version_id": str(report_version.id),
                "connector_configured": context.connector_config is not None,
                "output_format": context.report_config.get("output_format", "csv"),
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
    """
    try:
        logger.info("Fetching source data...")

        # Check if connector is configured
        if not context.connector_config:
            logger.info("No connector configured, skipping data fetch")
            return StepResult.success(
                output={"rows_fetched": 0, "skipped": True},
                metadata={"skip_reason": "No connector configured"}
            )

        # Get query SQL from config
        query_sql = context.report_config.get("query_sql")
        if not query_sql:
            logger.info("No query SQL configured, skipping data fetch")
            return StepResult.success(
                output={"rows_fetched": 0, "skipped": True},
                metadata={"skip_reason": "No query SQL configured"}
            )

        # Create connector instance
        from services.connectors.factory import ConnectorFactory

        connector_instance = ConnectorFactory.create_connector(
            db_type=context.connector_config["type"],
            config=context.connector_config["config"],
            encrypted_credentials=context.connector_config["encrypted_credentials"]
        )

        try:
            # Execute query
            results = connector_instance.execute_query(
                query=query_sql,
                timeout=300  # 5 minute timeout
            )
            context.source_data = pd.DataFrame(results)
            row_count = len(context.source_data)

            logger.info(f"Fetched {row_count} rows from source")

            return StepResult.success(
                output={"rows_fetched": row_count}
            )

        finally:
            connector_instance.disconnect()

    except Exception as e:
        logger.error(f"Data fetch failed: {e}", exc_info=True)

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

        if context.source_data is None or (
            isinstance(context.source_data, pd.DataFrame) and context.source_data.empty
        ):
            logger.info("No source data to validate")
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
            return StepResult.success(
                output={"validations_run": 0, "passed": True}
            )

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

        from services.executor import CodeExecutor
        from services.execution_models import ExecutionContext, ResourceLimits
        from config import settings

        # Create execution context
        exec_context = ExecutionContext(
            connector_type=context.connector_config.get("type") if context.connector_config else "postgresql",
            connector_config=context.connector_config.get("config", {}) if context.connector_config else {},
            connector_credentials={},
            mappings={},
            parameters=context.parameters,
            report_version_id=UUID(context.report_version_id),
            job_run_id=UUID(context.job_run_id),
            tenant_id=UUID(context.tenant_id),
            query_sql=context.report_config.get("query_sql"),
        )

        # Create resource limits
        limits = ResourceLimits(
            max_memory_mb=settings.CODE_MAX_MEMORY_MB,
            max_execution_seconds=settings.CODE_MAX_EXECUTION_SECONDS,
            max_output_size_mb=settings.CODE_MAX_OUTPUT_SIZE_MB,
            max_code_lines=settings.CODE_MAX_LINES
        )

        # Execute Python code
        result = CodeExecutor.execute(
            code=context.python_code,
            context=exec_context,
            limits=limits
        )

        # Persist execution logs
        if result.logs:
            for i, log_msg in enumerate(result.logs):
                log_entry = models.JobRunLog(
                    job_run_id=UUID(context.job_run_id),
                    line_number=i + 1,
                    level=models.LogLevel.INFO,
                    message=log_msg
                )
                db.add(log_entry)
            db.commit()

        if not result.success:
            return StepResult.failure(
                error_message=f"{result.error_type}: {result.error}",
                error_code="CODE_EXECUTION_ERROR"
            )

        # Store transformed data
        context.transformed_data = result.output_data

        logger.info(f"Transformation complete in {result.execution_time_seconds:.2f}s")

        return StepResult.success(
            output={
                "execution_time_seconds": result.execution_time_seconds,
                "log_count": len(result.logs) if result.logs else 0,
            }
        )

    except Exception as e:
        logger.error(f"Transformation failed: {e}", exc_info=True)
        return StepResult.failure(
            error_message=str(e),
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

        if context.transformed_data is None:
            logger.info("No transformed data to validate")
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
            return StepResult.success(
                output={"validations_run": 0, "passed": True}
            )

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

        if context.transformed_data is None:
            logger.info("No transformed data for artifact generation")
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

        artifacts_created = []

        with tempfile.TemporaryDirectory() as temp_dir:
            # Handle raw XML content
            if raw_xml_content:
                filename = f"report_{context.job_run_id}.xml"
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

            # Handle DataFrame output
            elif isinstance(output_data, pd.DataFrame):
                for output_format in output_formats:
                    try:
                        filename = f"report_{context.job_run_id}.{output_format}"
                        filepath = os.path.join(temp_dir, filename)

                        # Generate artifact
                        if output_format == "csv":
                            metadata = ArtifactGenerator.generate_csv(output_data, filepath)
                        elif output_format == "json":
                            metadata = ArtifactGenerator.generate_json(output_data, filepath)
                        elif output_format == "xml":
                            field_mappings = context.report_config.get("field_mappings", [])
                            namespace = context.report_config.get("namespace")
                            output_config = context.report_config.get("output_config", {})
                            xml_options = output_config.get("xml", {})

                            if raw_output_data is not None:
                                metadata = ArtifactGenerator.generate_xml_from_dicts(
                                    data=raw_output_data,
                                    filepath=filepath,
                                    root_name=xml_options.get("root_element", "Document"),
                                    row_name=xml_options.get("row_element", "Tx"),
                                    pretty_print=xml_options.get("pretty_print", True),
                                    include_declaration=xml_options.get("include_declaration", True),
                                    namespace=namespace,
                                )
                            else:
                                metadata = ArtifactGenerator.generate_xml(
                                    data=output_data,
                                    filepath=filepath,
                                    root_name=xml_options.get("root_element", "Document"),
                                    field_mappings=field_mappings,
                                    namespace=namespace,
                                )
                        elif output_format == "txt":
                            metadata = ArtifactGenerator.generate_txt(output_data, filepath)
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
                            metadata={"job_run_id": context.job_run_id, "output_format": output_format}
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
                            "size_bytes": metadata["size_bytes"]
                        })
                        context.artifacts.append({
                            "id": str(artifact.id),
                            "filename": filename,
                            "storage_uri": storage_uri,
                        })

                    except Exception as e:
                        logger.error(f"Failed to generate {output_format} artifact: {e}")

                db.commit()

        logger.info(f"Generated {len(artifacts_created)} artifact(s)")

        return StepResult.success(
            output={
                "artifacts_generated": len(artifacts_created),
                "artifacts": artifacts_created
            }
        )

    except Exception as e:
        logger.error(f"Artifact generation failed: {e}", exc_info=True)
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

        if not context.artifacts:
            logger.info("No artifacts to deliver")
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
            return StepResult.success(
                output={"deliveries_queued": 0, "reason": "No destinations configured"}
            )

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
                    deliver_artifact_task.delay(artifact_id, str(dest.id))
                    deliveries_queued += 1

        logger.info(f"Queued {deliveries_queued} deliveries")

        return StepResult.success(
            output={
                "deliveries_queued": deliveries_queued,
                "destinations": len(report_destinations),
                "artifacts": len(context.artifacts)
            }
        )

    except Exception as e:
        logger.error(f"Delivery queueing failed: {e}", exc_info=True)
        return StepResult.failure(
            error_message=str(e),
            error_code="DELIVERY_ERROR"
        )
