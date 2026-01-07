"""
External Regulatory API Integration Service

This package provides functionality for synchronizing reports, validation rules,
schedules, and reference data from external paid regulatory APIs.

Components:
- client.py: Async HTTP client for API communication
- schema_mapper.py: Maps external API formats to OpenReg models
- sync_service.py: Orchestrates the sync process with fork/merge model
- conflict_resolver.py: Handles conflict detection and resolution
"""

from .client import ExternalRegulatoryAPIClient
from .schema_mapper import SchemaMapper
from .sync_service import ExternalAPISyncService
from .conflict_resolver import ConflictResolver

__all__ = [
    'ExternalRegulatoryAPIClient',
    'SchemaMapper',
    'ExternalAPISyncService',
    'ConflictResolver',
]
