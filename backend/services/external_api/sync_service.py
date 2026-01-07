"""
External API Sync Service

Orchestrates synchronization between external regulatory APIs and OpenReg.
Implements fork/merge model for handling local modifications.
"""

import logging
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass, field
from uuid import UUID

from sqlalchemy.orm import Session

import models
from models import (
    ExternalSyncStatus, ExternalSyncSource, SyncModeType, SyncTriggerType,
    Report, ReportVersion, ValidationRule, Schedule, MappingSet, CrossReferenceEntry,
    ExternalAPIConfig, ExternalAPISyncLog,
    ValidationRuleType, ValidationSeverity, ScheduleType
)
from .client import ExternalRegulatoryAPIClient, ExternalAPIResponse
from .schema_mapper import (
    SchemaMapper, ReportImportData, ValidationRuleImportData,
    MappingSetImportData, ScheduleImportData
)
from .conflict_resolver import ConflictResolver, ResolutionStrategy, SyncConflict

logger = logging.getLogger(__name__)


@dataclass
class SyncResult:
    """Result of a sync operation"""
    success: bool
    items_fetched: int = 0
    reports_created: int = 0
    reports_updated: int = 0
    reports_skipped: int = 0
    validations_created: int = 0
    validations_updated: int = 0
    validations_skipped: int = 0
    reference_data_created: int = 0
    reference_data_updated: int = 0
    reference_data_skipped: int = 0
    schedules_created: int = 0
    schedules_updated: int = 0
    schedules_skipped: int = 0
    conflicts_detected: int = 0
    conflicts_auto_resolved: int = 0
    errors: List[str] = field(default_factory=list)
    api_response_time_ms: int = 0
    api_data_version: Optional[str] = None


class ExternalAPISyncService:
    """
    Orchestrates synchronization with external regulatory APIs.

    Implements the fork/merge model:
    - New items are created with sync_status=SYNCED
    - Synced items can be edited locally (becomes LOCAL_MODIFIED)
    - If upstream changes while local is modified, becomes CONFLICT
    - Conflicts require manual resolution
    """

    def __init__(self, db: Session, api_config: ExternalAPIConfig):
        """
        Initialize sync service.

        Args:
            db: Database session
            api_config: External API configuration
        """
        self.db = db
        self.api_config = api_config
        self.tenant_id = api_config.tenant_id

        # Initialize client with config
        self.client = ExternalRegulatoryAPIClient(
            api_base_url=api_config.api_base_url,
            auth_type=api_config.auth_type,
            encrypted_credentials=api_config.encrypted_credentials,
            api_version=api_config.api_version,
            rate_limit_per_minute=api_config.rate_limit_per_minute,
            retry_config=api_config.retry_config or {},
            cache_ttl_seconds=api_config.cache_ttl_seconds,
            schema_mapping=api_config.schema_mapping or {}
        )

        # Initialize mapper with config
        self.mapper = SchemaMapper(api_config.schema_mapping or {})

    async def sync_all(
        self,
        mode: SyncModeType = SyncModeType.DIFFERENTIAL,
        triggered_by: SyncTriggerType = SyncTriggerType.MANUAL,
        trigger_user_id: Optional[UUID] = None
    ) -> SyncResult:
        """
        Run full sync operation.

        Args:
            mode: FULL or DIFFERENTIAL sync
            triggered_by: How the sync was triggered
            trigger_user_id: User who triggered the sync (if manual)

        Returns:
            SyncResult with detailed sync statistics
        """
        result = SyncResult(success=False)

        # Create sync log entry
        sync_log = ExternalAPISyncLog(
            api_config_id=self.api_config.id,
            tenant_id=self.tenant_id,
            sync_type=mode,
            triggered_by=triggered_by,
            trigger_user_id=trigger_user_id,
            started_at=datetime.utcnow(),
            status="running"
        )
        self.db.add(sync_log)
        self.db.commit()

        try:
            # Determine 'since' for differential sync
            since = None
            if mode == SyncModeType.DIFFERENTIAL and self.api_config.last_sync_at:
                since = self.api_config.last_sync_at

            # Fetch data from external API
            logger.info(f"Fetching data from {self.api_config.api_base_url} (since={since})")
            start_time = datetime.utcnow()

            api_response = await self.client.fetch_all(since=since, use_cache=False)

            result.api_response_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            result.api_data_version = api_response.metadata.get('data_version') or api_response.metadata.get('version')

            result.items_fetched = (
                len(api_response.reports) +
                len(api_response.validation_rules) +
                len(api_response.reference_data) +
                len(api_response.schedules)
            )

            logger.info(f"Fetched {result.items_fetched} items in {result.api_response_time_ms}ms")

            # Map external data to internal format
            mapped = self.mapper.map_all(
                reports=api_response.reports,
                validations=api_response.validation_rules,
                reference_data=api_response.reference_data,
                schedules=api_response.schedules
            )

            # Sync each entity type
            # Note: Sync validation rules first as reports may reference them
            val_result = await self._sync_validations(mapped['validations'])
            result.validations_created = val_result['created']
            result.validations_updated = val_result['updated']
            result.validations_skipped = val_result['skipped']
            result.conflicts_detected += val_result['conflicts']
            result.errors.extend(val_result['errors'])

            # Sync reference data
            ref_result = await self._sync_reference_data(mapped['reference_data'])
            result.reference_data_created = ref_result['created']
            result.reference_data_updated = ref_result['updated']
            result.reference_data_skipped = ref_result['skipped']
            result.conflicts_detected += ref_result['conflicts']
            result.errors.extend(ref_result['errors'])

            # Sync reports
            report_result = await self._sync_reports(mapped['reports'])
            result.reports_created = report_result['created']
            result.reports_updated = report_result['updated']
            result.reports_skipped = report_result['skipped']
            result.conflicts_detected += report_result['conflicts']
            result.errors.extend(report_result['errors'])

            # Sync schedules (after reports, as they reference reports)
            schedule_result = await self._sync_schedules(mapped['schedules'])
            result.schedules_created = schedule_result['created']
            result.schedules_updated = schedule_result['updated']
            result.schedules_skipped = schedule_result['skipped']
            result.conflicts_detected += schedule_result['conflicts']
            result.errors.extend(schedule_result['errors'])

            # Update API config with last sync info
            self.api_config.last_sync_at = datetime.utcnow()
            self.api_config.last_sync_status = "success" if not result.errors else "partial"
            self.api_config.last_sync_message = f"Synced {result.items_fetched} items"

            result.success = True

            # Update sync log
            sync_log.status = "success" if not result.errors else "partial"
            sync_log.completed_at = datetime.utcnow()
            sync_log.duration_ms = int((sync_log.completed_at - sync_log.started_at).total_seconds() * 1000)
            sync_log.items_fetched = result.items_fetched
            sync_log.reports_created = result.reports_created
            sync_log.reports_updated = result.reports_updated
            sync_log.reports_skipped = result.reports_skipped
            sync_log.validations_created = result.validations_created
            sync_log.validations_updated = result.validations_updated
            sync_log.validations_skipped = result.validations_skipped
            sync_log.reference_data_created = result.reference_data_created
            sync_log.reference_data_updated = result.reference_data_updated
            sync_log.reference_data_skipped = result.reference_data_skipped
            sync_log.schedules_created = result.schedules_created
            sync_log.schedules_updated = result.schedules_updated
            sync_log.schedules_skipped = result.schedules_skipped
            sync_log.conflicts_detected = result.conflicts_detected
            sync_log.conflicts_auto_resolved = result.conflicts_auto_resolved
            sync_log.api_response_time_ms = result.api_response_time_ms
            sync_log.api_data_version = result.api_data_version

            if result.errors:
                sync_log.error_message = "; ".join(result.errors[:5])  # First 5 errors
                sync_log.error_details = {"errors": result.errors}

            self.db.commit()

            logger.info(f"Sync completed: {result}")
            return result

        except Exception as e:
            logger.error(f"Sync failed: {e}", exc_info=True)
            result.success = False
            result.errors.append(str(e))

            # Update API config
            self.api_config.last_sync_status = "failed"
            self.api_config.last_sync_message = str(e)[:500]

            # Update sync log
            sync_log.status = "failed"
            sync_log.completed_at = datetime.utcnow()
            sync_log.duration_ms = int((sync_log.completed_at - sync_log.started_at).total_seconds() * 1000)
            sync_log.error_message = str(e)[:1000]
            sync_log.error_details = {"exception": str(e)}

            self.db.commit()
            return result

    async def _sync_reports(self, reports: List[ReportImportData]) -> Dict[str, Any]:
        """Sync reports from external API"""
        result = {'created': 0, 'updated': 0, 'skipped': 0, 'conflicts': 0, 'errors': []}

        for report_data in reports:
            try:
                # Find existing report by external_id
                existing = self.db.query(Report).filter(
                    Report.tenant_id == self.tenant_id,
                    Report.external_id == report_data.external_id
                ).first()

                if existing:
                    # Check for conflicts
                    upstream_hash = ConflictResolver.calculate_content_hash(report_data.raw_data)

                    if existing.sync_status == ExternalSyncStatus.LOCAL_MODIFIED:
                        if existing.upstream_hash != upstream_hash:
                            # Conflict detected
                            existing.sync_status = ExternalSyncStatus.CONFLICT
                            result['conflicts'] += 1
                            result['skipped'] += 1
                            continue

                        # No upstream changes, skip
                        result['skipped'] += 1
                        continue

                    elif existing.sync_status == ExternalSyncStatus.CONFLICT:
                        # Already in conflict, skip
                        result['skipped'] += 1
                        continue

                    # Update existing report
                    existing.name = report_data.name
                    existing.description = report_data.description
                    existing.upstream_version = report_data.version
                    existing.upstream_hash = upstream_hash
                    existing.local_hash = upstream_hash
                    existing.sync_status = ExternalSyncStatus.SYNCED
                    existing.last_synced_at = datetime.utcnow()

                    # Update or create version with config and code
                    if report_data.config or report_data.python_code:
                        current_version = self.db.query(ReportVersion).filter(
                            ReportVersion.id == existing.current_version_id
                        ).first() if existing.current_version_id else None

                        if current_version:
                            if report_data.config:
                                current_version.config = report_data.config
                            if report_data.python_code:
                                current_version.python_code = report_data.python_code

                    result['updated'] += 1

                else:
                    # Create new report
                    upstream_hash = ConflictResolver.calculate_content_hash(report_data.raw_data)

                    new_report = Report(
                        tenant_id=self.tenant_id,
                        name=report_data.name,
                        description=report_data.description,
                        is_active=True,
                        external_source=ExternalSyncSource.REGULATORY_API,
                        external_api_config_id=self.api_config.id,
                        external_id=report_data.external_id,
                        upstream_version=report_data.version,
                        upstream_hash=upstream_hash,
                        local_hash=upstream_hash,
                        sync_status=ExternalSyncStatus.SYNCED,
                        last_synced_at=datetime.utcnow()
                    )
                    self.db.add(new_report)
                    self.db.flush()

                    # Create initial version
                    new_version = ReportVersion(
                        report_id=new_report.id,
                        major_version=1,
                        minor_version=0,
                        version_number=1000,
                        python_code=report_data.python_code or "# Report transformation code\ndef transform(data):\n    return data",
                        config=report_data.config or {}
                    )
                    self.db.add(new_version)
                    self.db.flush()

                    new_report.current_version_id = new_version.id
                    result['created'] += 1

            except Exception as e:
                logger.error(f"Failed to sync report {report_data.external_id}: {e}")
                result['errors'].append(f"Report {report_data.external_id}: {str(e)}")

        self.db.commit()
        return result

    async def _sync_validations(self, validations: List[ValidationRuleImportData]) -> Dict[str, Any]:
        """Sync validation rules from external API"""
        result = {'created': 0, 'updated': 0, 'skipped': 0, 'conflicts': 0, 'errors': []}

        for val_data in validations:
            try:
                existing = self.db.query(ValidationRule).filter(
                    ValidationRule.tenant_id == self.tenant_id,
                    ValidationRule.external_id == val_data.external_id
                ).first()

                if existing:
                    upstream_hash = ConflictResolver.calculate_content_hash(val_data.raw_data)

                    if existing.sync_status == ExternalSyncStatus.LOCAL_MODIFIED:
                        if existing.upstream_hash != upstream_hash:
                            existing.sync_status = ExternalSyncStatus.CONFLICT
                            result['conflicts'] += 1
                            result['skipped'] += 1
                            continue
                        result['skipped'] += 1
                        continue

                    elif existing.sync_status == ExternalSyncStatus.CONFLICT:
                        result['skipped'] += 1
                        continue

                    # Update existing
                    existing.name = val_data.name
                    existing.description = val_data.description
                    existing.rule_type = ValidationRuleType(val_data.rule_type)
                    existing.expression = val_data.expression
                    existing.severity = ValidationSeverity(val_data.severity)
                    existing.error_message = val_data.error_message
                    existing.upstream_version = val_data.version
                    existing.upstream_hash = upstream_hash
                    existing.local_hash = upstream_hash
                    existing.sync_status = ExternalSyncStatus.SYNCED
                    existing.last_synced_at = datetime.utcnow()
                    result['updated'] += 1

                else:
                    # Create new
                    upstream_hash = ConflictResolver.calculate_content_hash(val_data.raw_data)

                    new_validation = ValidationRule(
                        tenant_id=self.tenant_id,
                        name=val_data.name,
                        description=val_data.description,
                        rule_type=ValidationRuleType(val_data.rule_type),
                        expression=val_data.expression,
                        severity=ValidationSeverity(val_data.severity),
                        error_message=val_data.error_message,
                        is_active=True,
                        external_source=ExternalSyncSource.REGULATORY_API,
                        external_api_config_id=self.api_config.id,
                        external_id=val_data.external_id,
                        upstream_version=val_data.version,
                        upstream_hash=upstream_hash,
                        local_hash=upstream_hash,
                        sync_status=ExternalSyncStatus.SYNCED,
                        last_synced_at=datetime.utcnow()
                    )
                    self.db.add(new_validation)
                    result['created'] += 1

            except Exception as e:
                logger.error(f"Failed to sync validation {val_data.external_id}: {e}")
                result['errors'].append(f"Validation {val_data.external_id}: {str(e)}")

        self.db.commit()
        return result

    async def _sync_reference_data(self, reference_data: List[MappingSetImportData]) -> Dict[str, Any]:
        """Sync reference data (mapping sets) from external API"""
        result = {'created': 0, 'updated': 0, 'skipped': 0, 'conflicts': 0, 'errors': []}

        for ref_data in reference_data:
            try:
                existing = self.db.query(MappingSet).filter(
                    MappingSet.tenant_id == self.tenant_id,
                    MappingSet.external_id == ref_data.external_id
                ).first()

                if existing:
                    upstream_hash = ConflictResolver.calculate_content_hash(ref_data.raw_data)

                    if existing.sync_status == ExternalSyncStatus.LOCAL_MODIFIED:
                        if existing.upstream_hash != upstream_hash:
                            existing.sync_status = ExternalSyncStatus.CONFLICT
                            result['conflicts'] += 1
                            result['skipped'] += 1
                            continue
                        result['skipped'] += 1
                        continue

                    elif existing.sync_status == ExternalSyncStatus.CONFLICT:
                        result['skipped'] += 1
                        continue

                    # Update existing
                    existing.name = ref_data.name
                    existing.description = ref_data.description
                    existing.upstream_version = ref_data.version
                    existing.upstream_hash = upstream_hash
                    existing.local_hash = upstream_hash
                    existing.sync_status = ExternalSyncStatus.SYNCED
                    existing.last_synced_at = datetime.utcnow()

                    # Update entries - delete existing and re-create
                    self.db.query(CrossReferenceEntry).filter(
                        CrossReferenceEntry.mapping_set_id == existing.id
                    ).delete()

                    for entry in ref_data.entries:
                        new_entry = CrossReferenceEntry(
                            mapping_set_id=existing.id,
                            source_value=str(entry.get('source_value', '')),
                            target_value=str(entry.get('target_value', '')),
                            effective_from=entry.get('effective_from') or datetime.utcnow().date(),
                            effective_to=entry.get('effective_to'),
                            extra_data=entry.get('extra_data') or {}
                        )
                        self.db.add(new_entry)

                    result['updated'] += 1

                else:
                    # Create new
                    upstream_hash = ConflictResolver.calculate_content_hash(ref_data.raw_data)

                    new_mapping_set = MappingSet(
                        tenant_id=self.tenant_id,
                        name=ref_data.name,
                        description=ref_data.description,
                        external_source=ExternalSyncSource.REGULATORY_API,
                        external_api_config_id=self.api_config.id,
                        external_id=ref_data.external_id,
                        upstream_version=ref_data.version,
                        upstream_hash=upstream_hash,
                        local_hash=upstream_hash,
                        sync_status=ExternalSyncStatus.SYNCED,
                        last_synced_at=datetime.utcnow()
                    )
                    self.db.add(new_mapping_set)
                    self.db.flush()

                    for entry in ref_data.entries:
                        new_entry = CrossReferenceEntry(
                            mapping_set_id=new_mapping_set.id,
                            source_value=str(entry.get('source_value', '')),
                            target_value=str(entry.get('target_value', '')),
                            effective_from=entry.get('effective_from') or datetime.utcnow().date(),
                            effective_to=entry.get('effective_to'),
                            extra_data=entry.get('extra_data') or {}
                        )
                        self.db.add(new_entry)

                    result['created'] += 1

            except Exception as e:
                logger.error(f"Failed to sync reference data {ref_data.external_id}: {e}")
                result['errors'].append(f"Reference data {ref_data.external_id}: {str(e)}")

        self.db.commit()
        return result

    async def _sync_schedules(self, schedules: List[ScheduleImportData]) -> Dict[str, Any]:
        """Sync schedules from external API"""
        result = {'created': 0, 'updated': 0, 'skipped': 0, 'conflicts': 0, 'errors': []}

        for schedule_data in schedules:
            try:
                # Find linked report
                report = self.db.query(Report).filter(
                    Report.tenant_id == self.tenant_id,
                    Report.external_id == schedule_data.report_external_id
                ).first()

                if not report:
                    logger.warning(f"Report {schedule_data.report_external_id} not found for schedule {schedule_data.external_id}")
                    result['errors'].append(f"Schedule {schedule_data.external_id}: Report {schedule_data.report_external_id} not found")
                    result['skipped'] += 1
                    continue

                existing = self.db.query(Schedule).filter(
                    Schedule.tenant_id == self.tenant_id,
                    Schedule.external_id == schedule_data.external_id
                ).first()

                if existing:
                    upstream_hash = ConflictResolver.calculate_content_hash(schedule_data.raw_data)

                    if existing.sync_status == ExternalSyncStatus.LOCAL_MODIFIED:
                        if existing.upstream_hash != upstream_hash:
                            existing.sync_status = ExternalSyncStatus.CONFLICT
                            result['conflicts'] += 1
                            result['skipped'] += 1
                            continue
                        result['skipped'] += 1
                        continue

                    elif existing.sync_status == ExternalSyncStatus.CONFLICT:
                        result['skipped'] += 1
                        continue

                    # Update existing
                    existing.name = schedule_data.name
                    existing.report_id = report.id
                    existing.schedule_type = ScheduleType(schedule_data.schedule_type)
                    existing.cron_expression = schedule_data.cron_expression
                    existing.calendar_config = schedule_data.calendar_config
                    existing.parameters = schedule_data.parameters
                    existing.upstream_version = None
                    existing.upstream_hash = upstream_hash
                    existing.local_hash = upstream_hash
                    existing.sync_status = ExternalSyncStatus.SYNCED
                    existing.last_synced_at = datetime.utcnow()
                    result['updated'] += 1

                else:
                    # Create new
                    upstream_hash = ConflictResolver.calculate_content_hash(schedule_data.raw_data)

                    new_schedule = Schedule(
                        tenant_id=self.tenant_id,
                        report_id=report.id,
                        name=schedule_data.name,
                        schedule_type=ScheduleType(schedule_data.schedule_type),
                        cron_expression=schedule_data.cron_expression,
                        calendar_config=schedule_data.calendar_config,
                        parameters=schedule_data.parameters,
                        is_active=True,
                        external_source=ExternalSyncSource.REGULATORY_API,
                        external_api_config_id=self.api_config.id,
                        external_id=schedule_data.external_id,
                        upstream_hash=upstream_hash,
                        local_hash=upstream_hash,
                        sync_status=ExternalSyncStatus.SYNCED,
                        last_synced_at=datetime.utcnow()
                    )
                    self.db.add(new_schedule)
                    result['created'] += 1

            except Exception as e:
                logger.error(f"Failed to sync schedule {schedule_data.external_id}: {e}")
                result['errors'].append(f"Schedule {schedule_data.external_id}: {str(e)}")

        self.db.commit()
        return result

    def get_conflicts(self) -> List[Dict[str, Any]]:
        """Get all items with conflict status"""
        conflicts = []

        # Reports
        report_conflicts = self.db.query(Report).filter(
            Report.tenant_id == self.tenant_id,
            Report.external_api_config_id == self.api_config.id,
            Report.sync_status == ExternalSyncStatus.CONFLICT
        ).all()
        for r in report_conflicts:
            conflicts.append({
                'entity_type': 'report',
                'id': str(r.id),
                'external_id': r.external_id,
                'name': r.name,
                'upstream_version': r.upstream_version,
                'forked_at': r.forked_at.isoformat() if r.forked_at else None,
            })

        # Validation rules
        validation_conflicts = self.db.query(ValidationRule).filter(
            ValidationRule.tenant_id == self.tenant_id,
            ValidationRule.external_api_config_id == self.api_config.id,
            ValidationRule.sync_status == ExternalSyncStatus.CONFLICT
        ).all()
        for v in validation_conflicts:
            conflicts.append({
                'entity_type': 'validation_rule',
                'id': str(v.id),
                'external_id': v.external_id,
                'name': v.name,
                'upstream_version': v.upstream_version,
                'forked_at': v.forked_at.isoformat() if v.forked_at else None,
            })

        # Schedules
        schedule_conflicts = self.db.query(Schedule).filter(
            Schedule.tenant_id == self.tenant_id,
            Schedule.external_api_config_id == self.api_config.id,
            Schedule.sync_status == ExternalSyncStatus.CONFLICT
        ).all()
        for s in schedule_conflicts:
            conflicts.append({
                'entity_type': 'schedule',
                'id': str(s.id),
                'external_id': s.external_id,
                'name': s.name,
                'upstream_version': s.upstream_version,
                'forked_at': s.forked_at.isoformat() if s.forked_at else None,
            })

        # Mapping sets
        mapping_conflicts = self.db.query(MappingSet).filter(
            MappingSet.tenant_id == self.tenant_id,
            MappingSet.external_api_config_id == self.api_config.id,
            MappingSet.sync_status == ExternalSyncStatus.CONFLICT
        ).all()
        for m in mapping_conflicts:
            conflicts.append({
                'entity_type': 'mapping_set',
                'id': str(m.id),
                'external_id': m.external_id,
                'name': m.name,
                'upstream_version': m.upstream_version,
                'forked_at': m.forked_at.isoformat() if m.forked_at else None,
            })

        return conflicts

    def resolve_conflict(
        self,
        entity_type: str,
        entity_id: str,
        strategy: ResolutionStrategy
    ) -> bool:
        """
        Resolve a conflict using the specified strategy.

        Args:
            entity_type: Type of entity (report, validation_rule, schedule, mapping_set)
            entity_id: ID of the entity
            strategy: Resolution strategy to apply

        Returns:
            True if resolved successfully
        """
        try:
            if entity_type == 'report':
                entity = self.db.query(Report).filter(Report.id == entity_id).first()
            elif entity_type == 'validation_rule':
                entity = self.db.query(ValidationRule).filter(ValidationRule.id == entity_id).first()
            elif entity_type == 'schedule':
                entity = self.db.query(Schedule).filter(Schedule.id == entity_id).first()
            elif entity_type == 'mapping_set':
                entity = self.db.query(MappingSet).filter(MappingSet.id == entity_id).first()
            else:
                raise ValueError(f"Unknown entity type: {entity_type}")

            if not entity:
                raise ValueError(f"Entity not found: {entity_type}/{entity_id}")

            if strategy == ResolutionStrategy.KEEP_LOCAL:
                # Keep local changes, mark as locally modified
                entity.sync_status = ExternalSyncStatus.LOCAL_MODIFIED
                entity.forked_at = entity.forked_at or datetime.utcnow()
                entity.forked_from_version = entity.upstream_version

            elif strategy == ResolutionStrategy.TAKE_UPSTREAM:
                # Would need to re-fetch from API - mark for re-sync
                entity.sync_status = ExternalSyncStatus.UPSTREAM_CHANGED
                entity.local_hash = None  # Force update on next sync

            self.db.commit()
            return True

        except Exception as e:
            logger.error(f"Failed to resolve conflict: {e}")
            self.db.rollback()
            return False
