"""
Unit tests for External API Sync Service.

Tests sync operations for validation rules, reference data, reports, and schedules
with mocked external API responses.
"""

import pytest
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock, AsyncMock
from uuid import uuid4

import models
from services.external_api.sync_service import (
    ExternalAPISyncService,
    SyncResult,
)
from services.external_api.client import ExternalAPIResponse, AuthType
from services.external_api.schema_mapper import (
    SchemaMapper,
    ReportImportData,
    ValidationRuleImportData,
    MappingSetImportData,
    ScheduleImportData,
)


class TestSyncResult:
    """Tests for SyncResult dataclass."""

    def test_sync_result_defaults(self):
        """SyncResult should initialize with correct defaults."""
        result = SyncResult(success=False)

        assert result.success is False
        assert result.items_fetched == 0
        assert result.reports_created == 0
        assert result.errors == []
        assert result.conflicts_detected == 0

    def test_sync_result_with_values(self):
        """SyncResult should store provided values."""
        result = SyncResult(
            success=True,
            items_fetched=10,
            reports_created=5,
            validations_updated=3,
            errors=["error1"],
            conflicts_detected=1
        )

        assert result.success is True
        assert result.items_fetched == 10
        assert result.reports_created == 5
        assert result.validations_updated == 3
        assert len(result.errors) == 1


class TestSchemaMapper:
    """Tests for SchemaMapper functionality."""

    def test_map_report_basic(self):
        """Should map basic report data correctly."""
        mapper = SchemaMapper()

        external_data = {
            "external_id": "REP-001",
            "name": "MiFIR Transaction Report",
            "description": "Daily transaction reporting",
            "version": "2.0",
            "config": {"output_format": "xml"},
            "python_code": "def transform(data): return data"
        }

        result = mapper.map_report(external_data)

        assert result.external_id == "REP-001"
        assert result.name == "MiFIR Transaction Report"
        assert result.version == "2.0"
        assert result.config["output_format"] == "xml"
        assert "transform" in result.python_code

    def test_map_report_fallback_id(self):
        """Should use fallback ID fields when external_id is missing."""
        mapper = SchemaMapper()

        external_data = {
            "id": "FALLBACK-001",
            "name": "Test Report"
        }

        result = mapper.map_report(external_data)

        assert result.external_id == "FALLBACK-001"

    def test_map_validation_rule(self):
        """Should map validation rule data correctly."""
        mapper = SchemaMapper()

        external_data = {
            "external_id": "VAL-001",
            "name": "Amount Check",
            "rule_type": "python_expr",
            "expression": "df['amount'] > 0",
            "severity": "blocking",
            "error_message": "Amount must be positive"
        }

        result = mapper.map_validation_rule(external_data)

        assert result.external_id == "VAL-001"
        assert result.name == "Amount Check"
        assert result.rule_type == "python_expr"
        assert result.severity == "blocking"

    def test_map_validation_rule_normalizes_severity(self):
        """Should normalize severity values."""
        mapper = SchemaMapper()

        # Test "error" -> "blocking"
        data1 = {"id": "1", "name": "Test", "severity": "error"}
        assert mapper.map_validation_rule(data1).severity == "blocking"

        # Test "exception" -> "correctable"
        data2 = {"id": "2", "name": "Test", "severity": "exception"}
        assert mapper.map_validation_rule(data2).severity == "correctable"

        # Test unknown -> "warning"
        data3 = {"id": "3", "name": "Test", "severity": "info"}
        assert mapper.map_validation_rule(data3).severity == "warning"

    def test_map_reference_data(self):
        """Should map reference data with entries."""
        mapper = SchemaMapper()

        external_data = {
            "external_id": "REF-001",
            "name": "Country Codes",
            "entries": [
                {"source": "US", "target": "United States"},
                {"source": "GB", "target": "United Kingdom"}
            ]
        }

        result = mapper.map_reference_data(external_data)

        assert result.external_id == "REF-001"
        assert result.name == "Country Codes"
        assert len(result.entries) == 2
        assert result.entries[0]["source_value"] == "US"
        assert result.entries[0]["target_value"] == "United States"

    def test_map_schedule(self):
        """Should map schedule data correctly."""
        mapper = SchemaMapper()

        external_data = {
            "external_id": "SCH-001",
            "name": "Daily Report",
            "report_id": "REP-001",
            "cron": "0 2 * * *",
            "timezone": "Europe/London"
        }

        result = mapper.map_schedule(external_data)

        assert result.external_id == "SCH-001"
        assert result.report_external_id == "REP-001"
        assert result.cron_expression == "0 2 * * *"
        assert result.timezone == "Europe/London"
        assert result.schedule_type == "cron"

    def test_map_all(self):
        """Should map all data types at once."""
        mapper = SchemaMapper()

        reports = [{"id": "REP-001", "name": "Report 1"}]
        validations = [{"id": "VAL-001", "name": "Rule 1"}]
        reference_data = [{"id": "REF-001", "name": "Mapping 1", "entries": []}]
        schedules = [{"id": "SCH-001", "name": "Schedule 1", "report_id": "REP-001"}]

        result = mapper.map_all(reports, validations, reference_data, schedules)

        assert len(result["reports"]) == 1
        assert len(result["validations"]) == 1
        assert len(result["reference_data"]) == 1
        assert len(result["schedules"]) == 1


class TestExternalAPISyncServiceInit:
    """Tests for ExternalAPISyncService initialization."""

    @patch('services.external_api.sync_service.ExternalRegulatoryAPIClient')
    @patch('services.external_api.sync_service.SchemaMapper')
    def test_service_initialization(self, mock_mapper_class, mock_client_class):
        """Service should initialize client and mapper correctly."""
        mock_db = Mock()
        mock_api_config = Mock()
        mock_api_config.tenant_id = uuid4()
        mock_api_config.api_base_url = "https://api.example.com"
        mock_api_config.auth_type = AuthType.API_KEY
        mock_api_config.encrypted_credentials = b"encrypted"
        mock_api_config.api_version = "v1"
        mock_api_config.rate_limit_per_minute = 60
        mock_api_config.retry_config = {}
        mock_api_config.cache_ttl_seconds = 3600
        mock_api_config.schema_mapping = {}

        service = ExternalAPISyncService(mock_db, mock_api_config)

        assert service.db == mock_db
        assert service.tenant_id == mock_api_config.tenant_id
        mock_client_class.assert_called_once()
        mock_mapper_class.assert_called_once()


class TestSyncValidations:
    """Tests for validation rule sync operations."""

    @pytest.fixture
    def mock_sync_service(self):
        """Create a mock sync service for testing."""
        with patch('services.external_api.sync_service.ExternalRegulatoryAPIClient'):
            mock_db = Mock()
            mock_api_config = Mock()
            mock_api_config.tenant_id = uuid4()
            mock_api_config.api_base_url = "https://api.example.com"
            mock_api_config.auth_type = "api_key"
            mock_api_config.encrypted_credentials = b""
            mock_api_config.api_version = "v1"
            mock_api_config.rate_limit_per_minute = 60
            mock_api_config.retry_config = {}
            mock_api_config.cache_ttl_seconds = 3600
            mock_api_config.schema_mapping = {}
            mock_api_config.id = uuid4()
            mock_api_config.last_sync_at = None

            service = ExternalAPISyncService(mock_db, mock_api_config)
            return service

    @pytest.mark.asyncio
    async def test_sync_validations_creates_new_rules(self, mock_sync_service):
        """Should create new validation rules when they don't exist."""
        # Setup - no existing rule
        mock_sync_service.db.query.return_value.filter.return_value.first.return_value = None
        mock_sync_service.db.add = Mock()
        mock_sync_service.db.commit = Mock()

        validations = [
            ValidationRuleImportData(
                external_id="VAL-001",
                name="Amount Check",
                description="Validates amount is positive",
                version="1.0",
                rule_type="python_expr",
                expression="df['amount'] > 0",
                severity="blocking",
                error_message="Amount must be positive",
                raw_data={"external_id": "VAL-001"}
            )
        ]

        result = await mock_sync_service._sync_validations(validations)

        assert result["created"] == 1
        assert result["updated"] == 0
        assert result["conflicts"] == 0
        mock_sync_service.db.add.assert_called()

    @pytest.mark.asyncio
    async def test_sync_validations_updates_existing_synced(self, mock_sync_service):
        """Should update existing SYNCED validation rules."""
        # Setup existing synced rule
        existing_rule = Mock()
        existing_rule.sync_status = models.ExternalSyncStatus.SYNCED
        existing_rule.upstream_hash = "old_hash"
        mock_sync_service.db.query.return_value.filter.return_value.first.return_value = existing_rule
        mock_sync_service.db.commit = Mock()

        with patch('services.external_api.sync_service.ConflictResolver') as mock_resolver:
            mock_resolver.calculate_content_hash.return_value = "new_hash"

            validations = [
                ValidationRuleImportData(
                    external_id="VAL-001",
                    name="Updated Amount Check",
                    rule_type="python_expr",
                    expression="df['amount'] >= 0",
                    severity="blocking",
                    error_message="Amount must be non-negative",
                    raw_data={"external_id": "VAL-001"}
                )
            ]

            result = await mock_sync_service._sync_validations(validations)

            assert result["updated"] == 1
            assert result["created"] == 0

    @pytest.mark.asyncio
    async def test_sync_validations_detects_conflict(self, mock_sync_service):
        """Should detect conflict when local modified and upstream changed."""
        existing_rule = Mock()
        existing_rule.sync_status = models.ExternalSyncStatus.LOCAL_MODIFIED
        existing_rule.upstream_hash = "old_hash"
        mock_sync_service.db.query.return_value.filter.return_value.first.return_value = existing_rule
        mock_sync_service.db.commit = Mock()

        with patch('services.external_api.sync_service.ConflictResolver') as mock_resolver:
            mock_resolver.calculate_content_hash.return_value = "new_hash"  # Different hash

            validations = [
                ValidationRuleImportData(
                    external_id="VAL-001",
                    name="Amount Check",
                    rule_type="python_expr",
                    expression="df['amount'] > 0",
                    severity="blocking",
                    error_message="Error",
                    raw_data={"external_id": "VAL-001"}
                )
            ]

            result = await mock_sync_service._sync_validations(validations)

            assert result["conflicts"] == 1
            assert result["skipped"] == 1
            assert existing_rule.sync_status == models.ExternalSyncStatus.CONFLICT

    @pytest.mark.asyncio
    async def test_sync_validations_skips_already_conflicted(self, mock_sync_service):
        """Should skip rules already in conflict status."""
        existing_rule = Mock()
        existing_rule.sync_status = models.ExternalSyncStatus.CONFLICT
        mock_sync_service.db.query.return_value.filter.return_value.first.return_value = existing_rule
        mock_sync_service.db.commit = Mock()

        validations = [
            ValidationRuleImportData(
                external_id="VAL-001",
                name="Amount Check",
                rule_type="python_expr",
                expression="df['amount'] > 0",
                severity="blocking",
                error_message="Error",
                raw_data={}
            )
        ]

        result = await mock_sync_service._sync_validations(validations)

        assert result["skipped"] == 1
        assert result["updated"] == 0


class TestSyncReferenceData:
    """Tests for reference data sync operations."""

    @pytest.fixture
    def mock_sync_service(self):
        """Create a mock sync service for testing."""
        with patch('services.external_api.sync_service.ExternalRegulatoryAPIClient'):
            mock_db = Mock()
            mock_api_config = Mock()
            mock_api_config.tenant_id = uuid4()
            mock_api_config.api_base_url = "https://api.example.com"
            mock_api_config.auth_type = "api_key"
            mock_api_config.encrypted_credentials = b""
            mock_api_config.api_version = "v1"
            mock_api_config.rate_limit_per_minute = 60
            mock_api_config.retry_config = {}
            mock_api_config.cache_ttl_seconds = 3600
            mock_api_config.schema_mapping = {}
            mock_api_config.id = uuid4()

            service = ExternalAPISyncService(mock_db, mock_api_config)
            return service

    @pytest.mark.asyncio
    async def test_sync_reference_data_creates_new_mappings(self, mock_sync_service):
        """Should create new mapping sets when they don't exist."""
        mock_sync_service.db.query.return_value.filter.return_value.first.return_value = None
        mock_sync_service.db.add = Mock()
        mock_sync_service.db.flush = Mock()
        mock_sync_service.db.commit = Mock()

        reference_data = [
            MappingSetImportData(
                external_id="REF-001",
                name="Country Codes",
                description="ISO country code mappings",
                version="1.0",
                entries=[
                    {"source_value": "US", "target_value": "United States"},
                    {"source_value": "GB", "target_value": "United Kingdom"}
                ],
                raw_data={"external_id": "REF-001"}
            )
        ]

        result = await mock_sync_service._sync_reference_data(reference_data)

        assert result["created"] == 1
        assert mock_sync_service.db.add.call_count >= 1

    @pytest.mark.asyncio
    async def test_sync_reference_data_updates_entries(self, mock_sync_service):
        """Should update entries for existing SYNCED mapping sets."""
        existing_mapping = Mock()
        existing_mapping.id = uuid4()
        existing_mapping.sync_status = models.ExternalSyncStatus.SYNCED
        existing_mapping.upstream_hash = "old_hash"

        mock_sync_service.db.query.return_value.filter.return_value.first.return_value = existing_mapping
        mock_sync_service.db.query.return_value.filter.return_value.delete = Mock()
        mock_sync_service.db.add = Mock()
        mock_sync_service.db.commit = Mock()

        with patch('services.external_api.sync_service.ConflictResolver') as mock_resolver:
            mock_resolver.calculate_content_hash.return_value = "new_hash"

            reference_data = [
                MappingSetImportData(
                    external_id="REF-001",
                    name="Updated Country Codes",
                    entries=[{"source_value": "DE", "target_value": "Germany"}],
                    raw_data={}
                )
            ]

            result = await mock_sync_service._sync_reference_data(reference_data)

            assert result["updated"] == 1


class TestSyncReports:
    """Tests for report sync operations."""

    @pytest.fixture
    def mock_sync_service(self):
        """Create a mock sync service for testing."""
        with patch('services.external_api.sync_service.ExternalRegulatoryAPIClient'):
            mock_db = Mock()
            mock_api_config = Mock()
            mock_api_config.tenant_id = uuid4()
            mock_api_config.api_base_url = "https://api.example.com"
            mock_api_config.auth_type = "api_key"
            mock_api_config.encrypted_credentials = b""
            mock_api_config.api_version = "v1"
            mock_api_config.rate_limit_per_minute = 60
            mock_api_config.retry_config = {}
            mock_api_config.cache_ttl_seconds = 3600
            mock_api_config.schema_mapping = {}
            mock_api_config.id = uuid4()

            service = ExternalAPISyncService(mock_db, mock_api_config)
            return service

    @pytest.mark.asyncio
    async def test_sync_reports_creates_new_report(self, mock_sync_service):
        """Should create new report when it doesn't exist."""
        mock_sync_service.db.query.return_value.filter.return_value.first.return_value = None
        mock_sync_service.db.add = Mock()
        mock_sync_service.db.flush = Mock()
        mock_sync_service.db.commit = Mock()

        reports = [
            ReportImportData(
                external_id="REP-001",
                name="MiFIR Report",
                description="Transaction reporting",
                version="1.0",
                config={"output_format": "xml"},
                python_code="def transform(data): return data",
                raw_data={"external_id": "REP-001"}
            )
        ]

        result = await mock_sync_service._sync_reports(reports)

        assert result["created"] == 1
        # Should add report and version
        assert mock_sync_service.db.add.call_count >= 2


class TestSyncSchedules:
    """Tests for schedule sync operations."""

    @pytest.fixture
    def mock_sync_service(self):
        """Create a mock sync service for testing."""
        with patch('services.external_api.sync_service.ExternalRegulatoryAPIClient'):
            mock_db = Mock()
            mock_api_config = Mock()
            mock_api_config.tenant_id = uuid4()
            mock_api_config.api_base_url = "https://api.example.com"
            mock_api_config.auth_type = "api_key"
            mock_api_config.encrypted_credentials = b""
            mock_api_config.api_version = "v1"
            mock_api_config.rate_limit_per_minute = 60
            mock_api_config.retry_config = {}
            mock_api_config.cache_ttl_seconds = 3600
            mock_api_config.schema_mapping = {}
            mock_api_config.id = uuid4()

            service = ExternalAPISyncService(mock_db, mock_api_config)
            return service

    @pytest.mark.asyncio
    async def test_sync_schedules_creates_new_schedule(self, mock_sync_service):
        """Should create new schedule linked to existing report."""
        # Mock existing report
        mock_report = Mock()
        mock_report.id = uuid4()

        # Track query calls to return different results
        call_count = [0]

        def query_side_effect(model_class):
            query_mock = Mock()

            def filter_func(*args, **kwargs):
                filter_mock = Mock()
                call_count[0] += 1
                # First filter call is for Report, second is for Schedule
                if call_count[0] == 1:
                    filter_mock.first.return_value = mock_report  # Report found
                else:
                    filter_mock.first.return_value = None  # Schedule not found
                return filter_mock

            query_mock.filter.side_effect = filter_func
            return query_mock

        mock_sync_service.db.query.side_effect = query_side_effect
        mock_sync_service.db.add = Mock()
        mock_sync_service.db.commit = Mock()

        schedules = [
            ScheduleImportData(
                external_id="SCH-001",
                name="Daily Report",
                report_external_id="REP-001",
                schedule_type="cron",
                cron_expression="0 2 * * *",
                timezone="UTC",
                raw_data={}
            )
        ]

        result = await mock_sync_service._sync_schedules(schedules)

        assert result["created"] == 1

    @pytest.mark.asyncio
    async def test_sync_schedules_skips_when_report_not_found(self, mock_sync_service):
        """Should skip schedule when linked report doesn't exist."""
        mock_sync_service.db.query.return_value.filter.return_value.first.return_value = None
        mock_sync_service.db.commit = Mock()

        schedules = [
            ScheduleImportData(
                external_id="SCH-001",
                name="Daily Report",
                report_external_id="NONEXISTENT-REP",
                schedule_type="cron",
                cron_expression="0 2 * * *",
                timezone="UTC",
                raw_data={}
            )
        ]

        result = await mock_sync_service._sync_schedules(schedules)

        assert result["skipped"] == 1
        assert len(result["errors"]) == 1
        assert "not found" in result["errors"][0].lower()


class TestSyncAllIntegration:
    """Integration tests for full sync operation."""

    @pytest.fixture
    def mock_sync_service(self):
        """Create a mock sync service for testing."""
        with patch('services.external_api.sync_service.ExternalRegulatoryAPIClient') as mock_client_class:
            mock_db = Mock()
            mock_api_config = Mock()
            mock_api_config.tenant_id = uuid4()
            mock_api_config.api_base_url = "https://api.example.com"
            mock_api_config.auth_type = "api_key"
            mock_api_config.encrypted_credentials = b""
            mock_api_config.api_version = "v1"
            mock_api_config.rate_limit_per_minute = 60
            mock_api_config.retry_config = {}
            mock_api_config.cache_ttl_seconds = 3600
            mock_api_config.schema_mapping = {}
            mock_api_config.id = uuid4()
            mock_api_config.last_sync_at = None

            service = ExternalAPISyncService(mock_db, mock_api_config)
            service.client = AsyncMock()
            return service

    @pytest.mark.asyncio
    async def test_sync_all_success(self, mock_sync_service):
        """Should successfully sync all data types."""
        # Mock API response
        mock_api_response = ExternalAPIResponse(
            reports=[{"id": "REP-001", "name": "Test Report"}],
            validation_rules=[{"id": "VAL-001", "name": "Test Rule"}],
            reference_data=[{"id": "REF-001", "name": "Test Mapping", "entries": []}],
            schedules=[],
            metadata={"data_version": "1.0"},
            raw_response={}
        )
        mock_sync_service.client.fetch_all = AsyncMock(return_value=mock_api_response)

        # Mock DB operations (nothing exists)
        mock_sync_service.db.query.return_value.filter.return_value.first.return_value = None
        mock_sync_service.db.add = Mock()
        mock_sync_service.db.flush = Mock()
        mock_sync_service.db.commit = Mock()

        result = await mock_sync_service.sync_all()

        assert result.success is True
        assert result.items_fetched == 3
        assert result.api_data_version == "1.0"

    @pytest.mark.asyncio
    async def test_sync_all_handles_api_error(self, mock_sync_service):
        """Should handle API errors gracefully."""
        mock_sync_service.client.fetch_all = AsyncMock(
            side_effect=Exception("API connection failed")
        )
        mock_sync_service.db.add = Mock()
        mock_sync_service.db.commit = Mock()

        result = await mock_sync_service.sync_all()

        assert result.success is False
        assert "API connection failed" in result.errors[0]


class TestConflictResolution:
    """Tests for conflict detection and resolution."""

    @pytest.fixture
    def mock_sync_service(self):
        """Create a mock sync service for testing."""
        with patch('services.external_api.sync_service.ExternalRegulatoryAPIClient'):
            mock_db = Mock()
            mock_api_config = Mock()
            mock_api_config.tenant_id = uuid4()
            mock_api_config.api_base_url = "https://api.example.com"
            mock_api_config.auth_type = "api_key"
            mock_api_config.encrypted_credentials = b""
            mock_api_config.api_version = "v1"
            mock_api_config.rate_limit_per_minute = 60
            mock_api_config.retry_config = {}
            mock_api_config.cache_ttl_seconds = 3600
            mock_api_config.schema_mapping = {}
            mock_api_config.id = uuid4()

            service = ExternalAPISyncService(mock_db, mock_api_config)
            return service

    def test_get_conflicts(self, mock_sync_service):
        """Should list all items with conflict status."""
        # Mock conflicted report
        mock_report = Mock()
        mock_report.id = uuid4()
        mock_report.external_id = "REP-001"
        mock_report.name = "Conflicted Report"
        mock_report.upstream_version = "2.0"
        mock_report.forked_at = datetime.utcnow()

        mock_sync_service.db.query.return_value.filter.return_value.all.return_value = [mock_report]

        conflicts = mock_sync_service.get_conflicts()

        assert len(conflicts) >= 1
        assert conflicts[0]["entity_type"] == "report"
        assert conflicts[0]["external_id"] == "REP-001"

    def test_resolve_conflict_keep_local(self, mock_sync_service):
        """Should resolve conflict by keeping local changes."""
        from services.external_api.conflict_resolver import ResolutionStrategy

        # Use a simple object that allows attribute assignment
        class MockEntity:
            def __init__(self):
                self.sync_status = models.ExternalSyncStatus.CONFLICT
                self.forked_at = None
                self.forked_from_version = None
                self.upstream_version = "1.0"

        mock_entity = MockEntity()
        mock_sync_service.db.query.return_value.filter.return_value.first.return_value = mock_entity
        mock_sync_service.db.commit = Mock()

        result = mock_sync_service.resolve_conflict(
            entity_type="report",
            entity_id=str(uuid4()),
            strategy=ResolutionStrategy.KEEP_LOCAL
        )

        assert result is True
        assert mock_entity.sync_status == models.ExternalSyncStatus.LOCAL_MODIFIED

    def test_resolve_conflict_take_upstream(self, mock_sync_service):
        """Should resolve conflict by taking upstream changes."""
        from services.external_api.conflict_resolver import ResolutionStrategy

        # Use a simple object that allows attribute assignment
        class MockEntity:
            def __init__(self):
                self.sync_status = models.ExternalSyncStatus.CONFLICT
                self.local_hash = "some_hash"

        mock_entity = MockEntity()
        mock_sync_service.db.query.return_value.filter.return_value.first.return_value = mock_entity
        mock_sync_service.db.commit = Mock()

        result = mock_sync_service.resolve_conflict(
            entity_type="validation_rule",
            entity_id=str(uuid4()),
            strategy=ResolutionStrategy.TAKE_UPSTREAM
        )

        assert result is True
        assert mock_entity.sync_status == models.ExternalSyncStatus.UPSTREAM_CHANGED
        assert mock_entity.local_hash is None
