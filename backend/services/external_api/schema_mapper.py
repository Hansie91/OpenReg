"""
Schema Mapper for External API Responses

Maps external regulatory API response formats to OpenReg internal models.
Supports configurable field mappings via JSONPath-like expressions.
"""

import logging
from datetime import datetime, date
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ReportImportData:
    """Mapped report data ready for import"""
    external_id: str
    name: str
    description: Optional[str] = None
    version: Optional[str] = None
    config: Dict[str, Any] = field(default_factory=dict)
    python_code: Optional[str] = None
    validation_ids: List[str] = field(default_factory=list)
    schedule: Optional[Dict[str, Any]] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationRuleImportData:
    """Mapped validation rule data ready for import"""
    external_id: str
    name: str
    description: Optional[str] = None
    version: Optional[str] = None
    rule_type: str = "sql"  # sql or python_expr
    expression: str = ""
    severity: str = "warning"  # warning, blocking, correctable
    error_message: str = ""
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MappingSetImportData:
    """Mapped reference data (mapping set) ready for import"""
    external_id: str
    name: str
    description: Optional[str] = None
    version: Optional[str] = None
    entries: List[Dict[str, Any]] = field(default_factory=list)
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ScheduleImportData:
    """Mapped schedule data ready for import"""
    external_id: str
    name: str
    report_external_id: str  # Links to report
    schedule_type: str = "cron"  # cron or calendar
    cron_expression: Optional[str] = None
    calendar_config: Optional[Dict[str, Any]] = None
    timezone: str = "UTC"
    parameters: Dict[str, Any] = field(default_factory=dict)
    raw_data: Dict[str, Any] = field(default_factory=dict)


class SchemaMapper:
    """
    Maps external API response formats to OpenReg internal models.

    Uses configurable field mappings to support various API response structures.
    """

    # Default field mappings for common response formats
    DEFAULT_MAPPING = {
        # Paths to extract from response
        "reports_path": "reports",
        "validations_path": "validation_rules",
        "reference_data_path": "reference_data",
        "schedules_path": "schedules",
        "metadata_path": "metadata",

        # Common field names
        "external_id_field": "external_id",
        "version_field": "version",
        "name_field": "name",
        "description_field": "description",

        # Report-specific mappings
        "report_config_field": "config",
        "report_code_field": "python_code",
        "report_validations_field": "validations",
        "report_schedule_field": "schedule",

        # Validation-specific mappings
        "validation_rule_type_field": "rule_type",
        "validation_expression_field": "expression",
        "validation_severity_field": "severity",
        "validation_error_msg_field": "error_message",

        # Reference data mappings
        "reference_entries_field": "entries",
        "entry_source_field": "source",
        "entry_target_field": "target",
        "entry_effective_from_field": "effective_from",
        "entry_effective_to_field": "effective_to",

        # Schedule mappings
        "schedule_cron_field": "cron",
        "schedule_calendar_field": "calendar_config",
        "schedule_timezone_field": "timezone",
        "schedule_report_id_field": "report_id",
    }

    def __init__(self, mapping_config: Optional[Dict[str, str]] = None):
        """
        Initialize mapper with custom field mappings.

        Args:
            mapping_config: Custom field mappings to override defaults
        """
        self.mapping = {**self.DEFAULT_MAPPING}
        if mapping_config:
            self.mapping.update(mapping_config)

    def _get_field(self, data: Dict[str, Any], field_key: str, default: Any = None) -> Any:
        """
        Get field value using configured field name.

        Supports dot notation for nested fields (e.g., "config.output_format")
        """
        field_name = self.mapping.get(field_key, field_key)
        if not field_name:
            return default

        # Handle dot notation for nested fields
        parts = field_name.split('.')
        result = data
        for part in parts:
            if isinstance(result, dict):
                result = result.get(part)
            else:
                return default
            if result is None:
                return default

        return result if result is not None else default

    def _parse_date(self, value: Any) -> Optional[date]:
        """Parse date from various formats"""
        if value is None:
            return None
        if isinstance(value, date):
            return value
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, str):
            try:
                # Try ISO format first
                return datetime.fromisoformat(value.replace('Z', '+00:00')).date()
            except ValueError:
                pass
            try:
                # Try common date format
                return datetime.strptime(value, "%Y-%m-%d").date()
            except ValueError:
                pass
        return None

    def map_report(self, external_data: Dict[str, Any]) -> ReportImportData:
        """
        Map external report data to ReportImportData.

        Args:
            external_data: Raw report data from external API

        Returns:
            ReportImportData ready for import
        """
        external_id = self._get_field(external_data, "external_id_field")
        if not external_id:
            # Try common alternatives
            external_id = external_data.get("id") or external_data.get("report_id")

        name = self._get_field(external_data, "name_field") or external_data.get("name", "Unnamed Report")
        description = self._get_field(external_data, "description_field")
        version = self._get_field(external_data, "version_field")

        # Map configuration
        config = self._get_field(external_data, "report_config_field") or {}
        if not isinstance(config, dict):
            config = {"raw_config": config}

        # Get Python code
        python_code = self._get_field(external_data, "report_code_field")

        # Get linked validation IDs
        validations = self._get_field(external_data, "report_validations_field") or []
        if isinstance(validations, list):
            validation_ids = [
                v.get("rule_id") or v.get("validation_id") or v.get("external_id") or str(v)
                for v in validations
                if v
            ]
        else:
            validation_ids = []

        # Get schedule configuration
        schedule = self._get_field(external_data, "report_schedule_field")

        return ReportImportData(
            external_id=str(external_id),
            name=name,
            description=description,
            version=str(version) if version else None,
            config=config,
            python_code=python_code,
            validation_ids=validation_ids,
            schedule=schedule,
            raw_data=external_data
        )

    def map_validation_rule(self, external_data: Dict[str, Any]) -> ValidationRuleImportData:
        """
        Map external validation rule data to ValidationRuleImportData.

        Args:
            external_data: Raw validation rule data from external API

        Returns:
            ValidationRuleImportData ready for import
        """
        external_id = self._get_field(external_data, "external_id_field")
        if not external_id:
            external_id = external_data.get("id") or external_data.get("rule_id")

        name = self._get_field(external_data, "name_field") or external_data.get("name", "Unnamed Rule")
        description = self._get_field(external_data, "description_field")
        version = self._get_field(external_data, "version_field")

        # Map rule type (normalize to sql or python_expr)
        rule_type = self._get_field(external_data, "validation_rule_type_field") or "sql"
        rule_type = rule_type.lower()
        if rule_type in ("sql", "sql_query"):
            rule_type = "sql"
        elif rule_type in ("python", "python_expr", "python_expression", "expr"):
            rule_type = "python_expr"
        else:
            rule_type = "sql"  # Default to SQL

        # Map expression
        expression = self._get_field(external_data, "validation_expression_field") or ""

        # Map severity (normalize to warning, blocking, correctable)
        severity = self._get_field(external_data, "validation_severity_field") or "warning"
        severity = severity.lower()
        if severity in ("error", "blocking", "block", "fatal"):
            severity = "blocking"
        elif severity in ("correctable", "exception", "amendable"):
            severity = "correctable"
        else:
            severity = "warning"

        error_message = self._get_field(external_data, "validation_error_msg_field") or ""

        return ValidationRuleImportData(
            external_id=str(external_id),
            name=name,
            description=description,
            version=str(version) if version else None,
            rule_type=rule_type,
            expression=expression,
            severity=severity,
            error_message=error_message,
            raw_data=external_data
        )

    def map_reference_data(self, external_data: Dict[str, Any]) -> MappingSetImportData:
        """
        Map external reference data to MappingSetImportData.

        Args:
            external_data: Raw reference data from external API

        Returns:
            MappingSetImportData ready for import
        """
        external_id = self._get_field(external_data, "external_id_field")
        if not external_id:
            external_id = external_data.get("id") or external_data.get("mapping_set_id")

        name = self._get_field(external_data, "name_field") or external_data.get("name", "Unnamed Mapping Set")
        description = self._get_field(external_data, "description_field")
        version = self._get_field(external_data, "version_field")

        # Map entries
        raw_entries = self._get_field(external_data, "reference_entries_field") or []
        entries = []

        source_field = self.mapping.get("entry_source_field", "source")
        target_field = self.mapping.get("entry_target_field", "target")
        effective_from_field = self.mapping.get("entry_effective_from_field", "effective_from")
        effective_to_field = self.mapping.get("entry_effective_to_field", "effective_to")

        for entry in raw_entries:
            if isinstance(entry, dict):
                mapped_entry = {
                    "source_value": entry.get(source_field) or entry.get("source") or entry.get("key"),
                    "target_value": entry.get(target_field) or entry.get("target") or entry.get("value"),
                    "effective_from": self._parse_date(entry.get(effective_from_field)),
                    "effective_to": self._parse_date(entry.get(effective_to_field)),
                    "extra_data": {k: v for k, v in entry.items()
                                   if k not in (source_field, target_field, effective_from_field, effective_to_field)}
                }
                entries.append(mapped_entry)

        return MappingSetImportData(
            external_id=str(external_id),
            name=name,
            description=description,
            version=str(version) if version else None,
            entries=entries,
            raw_data=external_data
        )

    def map_schedule(self, external_data: Dict[str, Any]) -> ScheduleImportData:
        """
        Map external schedule data to ScheduleImportData.

        Args:
            external_data: Raw schedule data from external API

        Returns:
            ScheduleImportData ready for import
        """
        external_id = self._get_field(external_data, "external_id_field")
        if not external_id:
            external_id = external_data.get("id") or external_data.get("schedule_id")

        name = self._get_field(external_data, "name_field") or external_data.get("name", "Unnamed Schedule")

        # Get linked report ID
        report_external_id = self._get_field(external_data, "schedule_report_id_field")
        if not report_external_id:
            report_external_id = external_data.get("report_id") or external_data.get("report_external_id")

        # Determine schedule type and configuration
        cron_expression = self._get_field(external_data, "schedule_cron_field")
        calendar_config = self._get_field(external_data, "schedule_calendar_field")

        if cron_expression:
            schedule_type = "cron"
        elif calendar_config:
            schedule_type = "calendar"
        else:
            schedule_type = "cron"
            cron_expression = external_data.get("expression") or "0 2 * * *"  # Default daily 2 AM

        timezone = self._get_field(external_data, "schedule_timezone_field") or "UTC"
        parameters = external_data.get("parameters") or {}

        return ScheduleImportData(
            external_id=str(external_id),
            name=name,
            report_external_id=str(report_external_id) if report_external_id else "",
            schedule_type=schedule_type,
            cron_expression=cron_expression,
            calendar_config=calendar_config,
            timezone=timezone,
            parameters=parameters,
            raw_data=external_data
        )

    def map_all(
        self,
        reports: List[Dict],
        validations: List[Dict],
        reference_data: List[Dict],
        schedules: List[Dict]
    ) -> Dict[str, List]:
        """
        Map all data types from external API response.

        Args:
            reports: List of raw report data
            validations: List of raw validation rules
            reference_data: List of raw reference data
            schedules: List of raw schedules

        Returns:
            Dict with mapped data for each type
        """
        return {
            "reports": [self.map_report(r) for r in (reports or [])],
            "validations": [self.map_validation_rule(v) for v in (validations or [])],
            "reference_data": [self.map_reference_data(rd) for rd in (reference_data or [])],
            "schedules": [self.map_schedule(s) for s in (schedules or [])],
        }
