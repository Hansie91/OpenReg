"""
Conflict Detection and Resolution for External API Sync

Handles conflict detection between local and upstream changes,
and provides resolution strategies (keep local, take upstream, merge).
"""

import hashlib
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class ResolutionStrategy(str, Enum):
    """Conflict resolution strategies"""
    KEEP_LOCAL = "keep_local"        # Preserve local changes
    TAKE_UPSTREAM = "take_upstream"  # Overwrite with upstream
    MERGE_FIELDS = "merge_fields"    # Merge specific fields


@dataclass
class FieldDiff:
    """Represents a difference in a single field"""
    field_name: str
    local_value: Any
    upstream_value: Any
    has_changed: bool = True


@dataclass
class ItemDiff:
    """Detailed diff between local and upstream versions"""
    entity_type: str  # report, validation_rule, schedule, mapping_set
    entity_id: str
    external_id: str
    local_version: Optional[str]
    upstream_version: Optional[str]
    field_diffs: List[FieldDiff] = field(default_factory=list)
    summary: str = ""


@dataclass
class SyncConflict:
    """Represents a sync conflict"""
    entity_type: str
    entity_id: str
    external_id: str
    local_hash: str
    upstream_hash: str
    local_modified_at: Optional[datetime]
    upstream_version: str
    diff: Optional[ItemDiff] = None


@dataclass
class ResolvedItem:
    """Result of conflict resolution"""
    entity_type: str
    entity_id: str
    external_id: str
    strategy_used: ResolutionStrategy
    merged_data: Dict[str, Any]
    resolution_notes: str = ""


class ConflictResolver:
    """
    Handles conflict detection and resolution between local and upstream changes.

    Uses content hashing to detect changes and provides multiple resolution strategies.
    """

    # Fields to exclude from hash calculation (metadata, timestamps)
    HASH_EXCLUDE_FIELDS = {
        'id', 'tenant_id', 'created_at', 'updated_at', 'created_by',
        'external_api_config_id', 'sync_status', 'last_synced_at',
        'forked_at', 'forked_from_version', 'upstream_hash', 'local_hash',
        'external_source'
    }

    # Fields that can be merged (non-critical)
    MERGEABLE_FIELDS = {
        'description', 'parameters', 'extra_data', 'config',
    }

    # Fields that require manual resolution if different
    CRITICAL_FIELDS = {
        'report': {'python_code', 'connector_id'},
        'validation_rule': {'expression', 'rule_type', 'severity'},
        'schedule': {'cron_expression', 'calendar_config'},
        'mapping_set': {'entries'},
    }

    @staticmethod
    def calculate_content_hash(data: Dict[str, Any], exclude_fields: Optional[set] = None) -> str:
        """
        Calculate SHA-256 hash of content for comparison.

        Normalizes the data by sorting keys and excluding metadata fields.

        Args:
            data: Dictionary to hash
            exclude_fields: Additional fields to exclude from hash

        Returns:
            SHA-256 hash string
        """
        exclude = ConflictResolver.HASH_EXCLUDE_FIELDS.copy()
        if exclude_fields:
            exclude.update(exclude_fields)

        def normalize(obj):
            """Recursively normalize object for consistent hashing"""
            if isinstance(obj, dict):
                return {k: normalize(v) for k, v in sorted(obj.items())
                        if k not in exclude and v is not None}
            elif isinstance(obj, (list, tuple)):
                return [normalize(item) for item in obj]
            elif isinstance(obj, datetime):
                return obj.isoformat()
            else:
                return obj

        normalized = normalize(data)
        content = json.dumps(normalized, sort_keys=True, default=str)
        return hashlib.sha256(content.encode()).hexdigest()

    @classmethod
    def detect_conflict(
        cls,
        local_item: Dict[str, Any],
        upstream_item: Dict[str, Any],
        stored_upstream_hash: Optional[str] = None
    ) -> Optional[SyncConflict]:
        """
        Detect if there's a conflict between local and upstream versions.

        Conflict exists when:
        1. Local has been modified (local_hash != upstream_hash at last sync)
        2. AND upstream has also changed (current upstream != stored upstream)

        Args:
            local_item: Current local item data
            upstream_item: New data from upstream
            stored_upstream_hash: Hash of upstream at last sync

        Returns:
            SyncConflict if conflict detected, None otherwise
        """
        local_hash = local_item.get('local_hash') or cls.calculate_content_hash(local_item)
        stored_hash = stored_upstream_hash or local_item.get('upstream_hash')
        upstream_hash = cls.calculate_content_hash(upstream_item)

        # Check if local was modified since last sync
        local_modified = local_hash != stored_hash if stored_hash else False

        # Check if upstream changed
        upstream_changed = upstream_hash != stored_hash if stored_hash else True

        if local_modified and upstream_changed:
            return SyncConflict(
                entity_type=local_item.get('__entity_type', 'unknown'),
                entity_id=str(local_item.get('id', '')),
                external_id=str(local_item.get('external_id', '')),
                local_hash=local_hash,
                upstream_hash=upstream_hash,
                local_modified_at=local_item.get('updated_at'),
                upstream_version=str(upstream_item.get('version', '')),
            )

        return None

    @classmethod
    def generate_diff(
        cls,
        local_item: Dict[str, Any],
        upstream_item: Dict[str, Any],
        entity_type: str
    ) -> ItemDiff:
        """
        Generate detailed diff between local and upstream versions.

        Args:
            local_item: Current local item data
            upstream_item: New data from upstream
            entity_type: Type of entity (report, validation_rule, etc.)

        Returns:
            ItemDiff with field-level differences
        """
        field_diffs = []
        all_keys = set(local_item.keys()) | set(upstream_item.keys())

        for key in all_keys:
            if key in cls.HASH_EXCLUDE_FIELDS:
                continue

            local_value = local_item.get(key)
            upstream_value = upstream_item.get(key)

            # Normalize for comparison
            if isinstance(local_value, dict):
                local_value = json.dumps(local_value, sort_keys=True)
            if isinstance(upstream_value, dict):
                upstream_value = json.dumps(upstream_value, sort_keys=True)

            if local_value != upstream_value:
                field_diffs.append(FieldDiff(
                    field_name=key,
                    local_value=local_item.get(key),
                    upstream_value=upstream_item.get(key),
                    has_changed=True
                ))

        # Generate summary
        changed_count = len(field_diffs)
        critical_fields = cls.CRITICAL_FIELDS.get(entity_type, set())
        critical_changed = [d.field_name for d in field_diffs if d.field_name in critical_fields]

        if critical_changed:
            summary = f"{changed_count} fields changed including critical: {', '.join(critical_changed)}"
        else:
            summary = f"{changed_count} fields changed (no critical fields)"

        return ItemDiff(
            entity_type=entity_type,
            entity_id=str(local_item.get('id', '')),
            external_id=str(local_item.get('external_id', '')),
            local_version=local_item.get('upstream_version'),
            upstream_version=upstream_item.get('version'),
            field_diffs=field_diffs,
            summary=summary
        )

    @classmethod
    def auto_resolve(
        cls,
        conflict: SyncConflict,
        local_item: Dict[str, Any],
        upstream_item: Dict[str, Any],
        strategy: ResolutionStrategy = ResolutionStrategy.KEEP_LOCAL
    ) -> ResolvedItem:
        """
        Automatically resolve a conflict using the specified strategy.

        Args:
            conflict: The detected conflict
            local_item: Current local item data
            upstream_item: New data from upstream
            strategy: Resolution strategy to use

        Returns:
            ResolvedItem with merged data
        """
        if strategy == ResolutionStrategy.KEEP_LOCAL:
            # Keep local, just update upstream tracking info
            merged = local_item.copy()
            merged['upstream_version'] = upstream_item.get('version')
            merged['upstream_hash'] = conflict.upstream_hash
            # Keep sync_status as LOCAL_MODIFIED

            return ResolvedItem(
                entity_type=conflict.entity_type,
                entity_id=conflict.entity_id,
                external_id=conflict.external_id,
                strategy_used=strategy,
                merged_data=merged,
                resolution_notes="Kept local changes, acknowledged upstream version"
            )

        elif strategy == ResolutionStrategy.TAKE_UPSTREAM:
            # Take upstream, discard local changes
            merged = upstream_item.copy()
            merged['id'] = local_item.get('id')
            merged['tenant_id'] = local_item.get('tenant_id')
            merged['created_at'] = local_item.get('created_at')
            merged['created_by'] = local_item.get('created_by')
            merged['external_api_config_id'] = local_item.get('external_api_config_id')
            merged['external_source'] = local_item.get('external_source')
            merged['external_id'] = conflict.external_id
            merged['upstream_version'] = upstream_item.get('version')
            merged['upstream_hash'] = conflict.upstream_hash
            merged['local_hash'] = conflict.upstream_hash  # Now in sync
            merged['sync_status'] = 'synced'
            merged['last_synced_at'] = datetime.utcnow()
            merged['forked_at'] = None
            merged['forked_from_version'] = None

            return ResolvedItem(
                entity_type=conflict.entity_type,
                entity_id=conflict.entity_id,
                external_id=conflict.external_id,
                strategy_used=strategy,
                merged_data=merged,
                resolution_notes="Replaced local with upstream version"
            )

        elif strategy == ResolutionStrategy.MERGE_FIELDS:
            # Intelligent merge: keep critical local fields, take upstream for others
            merged = local_item.copy()
            critical_fields = cls.CRITICAL_FIELDS.get(conflict.entity_type, set())

            for key, value in upstream_item.items():
                if key in cls.HASH_EXCLUDE_FIELDS:
                    continue
                if key in critical_fields:
                    # Keep local critical fields
                    continue
                if key in cls.MERGEABLE_FIELDS:
                    # Take upstream for mergeable fields
                    merged[key] = value

            # Update tracking
            merged['upstream_version'] = upstream_item.get('version')
            merged['upstream_hash'] = conflict.upstream_hash
            merged['local_hash'] = cls.calculate_content_hash(merged)
            merged['sync_status'] = 'local_modified'  # Still locally modified

            return ResolvedItem(
                entity_type=conflict.entity_type,
                entity_id=conflict.entity_id,
                external_id=conflict.external_id,
                strategy_used=strategy,
                merged_data=merged,
                resolution_notes=f"Merged: kept local critical fields, took upstream for: {', '.join(cls.MERGEABLE_FIELDS)}"
            )

        else:
            raise ValueError(f"Unknown resolution strategy: {strategy}")

    @classmethod
    def check_needs_update(
        cls,
        local_item: Dict[str, Any],
        upstream_item: Dict[str, Any]
    ) -> Tuple[bool, str]:
        """
        Check if local item needs updating from upstream.

        Returns:
            Tuple of (needs_update: bool, reason: str)
        """
        local_hash = local_item.get('local_hash') or cls.calculate_content_hash(local_item)
        stored_upstream_hash = local_item.get('upstream_hash')
        upstream_hash = cls.calculate_content_hash(upstream_item)

        sync_status = local_item.get('sync_status', 'local_only')

        # If local was modified, don't auto-update
        if sync_status == 'local_modified':
            if upstream_hash != stored_upstream_hash:
                return False, "conflict"  # Conflict detected
            return False, "local_modified"  # No upstream changes

        # If conflict status, don't auto-update
        if sync_status == 'conflict':
            return False, "conflict_pending"

        # If synced, check if upstream changed
        if sync_status == 'synced':
            if upstream_hash != stored_upstream_hash:
                return True, "upstream_changed"
            return False, "up_to_date"

        # New item (local_only with external_id means first sync)
        if sync_status == 'local_only' and local_item.get('external_id'):
            return True, "initial_sync"

        return False, "unknown"
