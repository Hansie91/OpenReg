"""Add external API sync tables and columns

Revision ID: 004_external_api_sync
Revises: 003_add_webhooks
Create Date: 2024-01-15

This migration adds:
1. external_api_configs table - API connection settings
2. external_api_sync_logs table - Sync operation audit trail
3. Sync tracking columns on reports, validation_rules, schedules, mapping_sets
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004_external_api_sync'
down_revision = '003_add_webhooks'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum types
    op.execute("""
        CREATE TYPE externalsyncstatus AS ENUM (
            'synced', 'local_modified', 'upstream_changed', 'conflict', 'local_only'
        )
    """)
    op.execute("""
        CREATE TYPE externalsyncsource AS ENUM (
            'regulatory_api', 'manual_import'
        )
    """)
    op.execute("""
        CREATE TYPE externalapiauthortype AS ENUM (
            'api_key', 'oauth2', 'basic'
        )
    """)
    op.execute("""
        CREATE TYPE synctriggertype AS ENUM (
            'scheduled', 'manual', 'api'
        )
    """)
    op.execute("""
        CREATE TYPE syncmodetype AS ENUM (
            'full', 'differential'
        )
    """)

    # Create external_api_configs table
    op.create_table(
        'external_api_configs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id'), nullable=False, index=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),

        # API Configuration
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('api_base_url', sa.String(1000), nullable=False),
        sa.Column('api_version', sa.String(50), nullable=True),

        # Authentication
        sa.Column('auth_type', sa.Enum('api_key', 'oauth2', 'basic', name='externalapiauthortype'), nullable=False, server_default='api_key'),
        sa.Column('encrypted_credentials', sa.LargeBinary, nullable=True),

        # Rate Limiting & Retry Config
        sa.Column('rate_limit_per_minute', sa.Integer, nullable=False, server_default='60'),
        sa.Column('retry_config', postgresql.JSONB, nullable=False, server_default='{"max_retries": 3, "backoff": "exponential", "base_delay": 2, "max_delay": 60}'),

        # Caching
        sa.Column('cache_ttl_seconds', sa.Integer, nullable=False, server_default='3600'),

        # Sync Configuration
        sa.Column('sync_schedule', sa.String(100), nullable=True),
        sa.Column('auto_sync_enabled', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('last_sync_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_sync_status', sa.String(50), nullable=True),
        sa.Column('last_sync_message', sa.Text, nullable=True),

        # Schema mapping
        sa.Column('schema_mapping', postgresql.JSONB, nullable=False, server_default='{"reports_path": "reports", "validations_path": "validation_rules", "reference_data_path": "reference_data", "schedules_path": "schedules", "external_id_field": "external_id", "version_field": "version", "metadata_path": "metadata"}'),

        # Status
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true', index=True),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # Create external_api_sync_logs table
    op.create_table(
        'external_api_sync_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('api_config_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('external_api_configs.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id'), nullable=False, index=True),

        # Sync details
        sa.Column('sync_type', sa.Enum('full', 'differential', name='syncmodetype'), nullable=False, server_default='differential'),
        sa.Column('triggered_by', sa.Enum('scheduled', 'manual', 'api', name='synctriggertype'), nullable=False),
        sa.Column('trigger_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),

        # Timing
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_ms', sa.Integer, nullable=True),

        # Results - overall
        sa.Column('status', sa.String(50), nullable=False, server_default='running'),
        sa.Column('items_fetched', sa.Integer, nullable=False, server_default='0'),

        # Results - by entity type
        sa.Column('reports_created', sa.Integer, nullable=False, server_default='0'),
        sa.Column('reports_updated', sa.Integer, nullable=False, server_default='0'),
        sa.Column('reports_skipped', sa.Integer, nullable=False, server_default='0'),
        sa.Column('validations_created', sa.Integer, nullable=False, server_default='0'),
        sa.Column('validations_updated', sa.Integer, nullable=False, server_default='0'),
        sa.Column('validations_skipped', sa.Integer, nullable=False, server_default='0'),
        sa.Column('reference_data_created', sa.Integer, nullable=False, server_default='0'),
        sa.Column('reference_data_updated', sa.Integer, nullable=False, server_default='0'),
        sa.Column('reference_data_skipped', sa.Integer, nullable=False, server_default='0'),
        sa.Column('schedules_created', sa.Integer, nullable=False, server_default='0'),
        sa.Column('schedules_updated', sa.Integer, nullable=False, server_default='0'),
        sa.Column('schedules_skipped', sa.Integer, nullable=False, server_default='0'),

        # Conflicts
        sa.Column('conflicts_detected', sa.Integer, nullable=False, server_default='0'),
        sa.Column('conflicts_auto_resolved', sa.Integer, nullable=False, server_default='0'),

        # Error tracking
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('error_details', postgresql.JSONB, nullable=True),

        # Checkpoint
        sa.Column('sync_checkpoint', postgresql.JSONB, nullable=True),

        # API response metadata
        sa.Column('api_response_time_ms', sa.Integer, nullable=True),
        sa.Column('api_data_version', sa.String(100), nullable=True),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # Add sync tracking columns to reports table
    op.add_column('reports', sa.Column('external_source', sa.Enum('regulatory_api', 'manual_import', name='externalsyncsource'), nullable=True))
    op.add_column('reports', sa.Column('external_api_config_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('reports', sa.Column('external_id', sa.String(255), nullable=True))
    op.add_column('reports', sa.Column('upstream_version', sa.String(100), nullable=True))
    op.add_column('reports', sa.Column('upstream_hash', sa.String(64), nullable=True))
    op.add_column('reports', sa.Column('local_hash', sa.String(64), nullable=True))
    op.add_column('reports', sa.Column('sync_status', sa.Enum('synced', 'local_modified', 'upstream_changed', 'conflict', 'local_only', name='externalsyncstatus'), nullable=True, server_default='local_only'))
    op.add_column('reports', sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('reports', sa.Column('forked_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('reports', sa.Column('forked_from_version', sa.String(100), nullable=True))

    op.create_index('ix_reports_external_source', 'reports', ['external_source'])
    op.create_index('ix_reports_external_api_config_id', 'reports', ['external_api_config_id'])
    op.create_index('ix_reports_external_id', 'reports', ['external_id'])
    op.create_index('ix_reports_sync_status', 'reports', ['sync_status'])
    op.create_foreign_key('fk_reports_external_api_config', 'reports', 'external_api_configs', ['external_api_config_id'], ['id'])

    # Add sync tracking columns to validation_rules table
    op.add_column('validation_rules', sa.Column('external_source', sa.Enum('regulatory_api', 'manual_import', name='externalsyncsource'), nullable=True))
    op.add_column('validation_rules', sa.Column('external_api_config_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('validation_rules', sa.Column('external_id', sa.String(255), nullable=True))
    op.add_column('validation_rules', sa.Column('upstream_version', sa.String(100), nullable=True))
    op.add_column('validation_rules', sa.Column('upstream_hash', sa.String(64), nullable=True))
    op.add_column('validation_rules', sa.Column('local_hash', sa.String(64), nullable=True))
    op.add_column('validation_rules', sa.Column('sync_status', sa.Enum('synced', 'local_modified', 'upstream_changed', 'conflict', 'local_only', name='externalsyncstatus'), nullable=True, server_default='local_only'))
    op.add_column('validation_rules', sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('validation_rules', sa.Column('forked_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('validation_rules', sa.Column('forked_from_version', sa.String(100), nullable=True))

    op.create_index('ix_validation_rules_external_source', 'validation_rules', ['external_source'])
    op.create_index('ix_validation_rules_external_api_config_id', 'validation_rules', ['external_api_config_id'])
    op.create_index('ix_validation_rules_external_id', 'validation_rules', ['external_id'])
    op.create_index('ix_validation_rules_sync_status', 'validation_rules', ['sync_status'])
    op.create_foreign_key('fk_validation_rules_external_api_config', 'validation_rules', 'external_api_configs', ['external_api_config_id'], ['id'])

    # Add sync tracking columns to schedules table
    op.add_column('schedules', sa.Column('external_source', sa.Enum('regulatory_api', 'manual_import', name='externalsyncsource'), nullable=True))
    op.add_column('schedules', sa.Column('external_api_config_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('schedules', sa.Column('external_id', sa.String(255), nullable=True))
    op.add_column('schedules', sa.Column('upstream_version', sa.String(100), nullable=True))
    op.add_column('schedules', sa.Column('upstream_hash', sa.String(64), nullable=True))
    op.add_column('schedules', sa.Column('local_hash', sa.String(64), nullable=True))
    op.add_column('schedules', sa.Column('sync_status', sa.Enum('synced', 'local_modified', 'upstream_changed', 'conflict', 'local_only', name='externalsyncstatus'), nullable=True, server_default='local_only'))
    op.add_column('schedules', sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('schedules', sa.Column('forked_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('schedules', sa.Column('forked_from_version', sa.String(100), nullable=True))

    op.create_index('ix_schedules_external_source', 'schedules', ['external_source'])
    op.create_index('ix_schedules_external_api_config_id', 'schedules', ['external_api_config_id'])
    op.create_index('ix_schedules_external_id', 'schedules', ['external_id'])
    op.create_index('ix_schedules_sync_status', 'schedules', ['sync_status'])
    op.create_foreign_key('fk_schedules_external_api_config', 'schedules', 'external_api_configs', ['external_api_config_id'], ['id'])

    # Add sync tracking columns to mapping_sets table
    op.add_column('mapping_sets', sa.Column('external_source', sa.Enum('regulatory_api', 'manual_import', name='externalsyncsource'), nullable=True))
    op.add_column('mapping_sets', sa.Column('external_api_config_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('mapping_sets', sa.Column('external_id', sa.String(255), nullable=True))
    op.add_column('mapping_sets', sa.Column('upstream_version', sa.String(100), nullable=True))
    op.add_column('mapping_sets', sa.Column('upstream_hash', sa.String(64), nullable=True))
    op.add_column('mapping_sets', sa.Column('local_hash', sa.String(64), nullable=True))
    op.add_column('mapping_sets', sa.Column('sync_status', sa.Enum('synced', 'local_modified', 'upstream_changed', 'conflict', 'local_only', name='externalsyncstatus'), nullable=True, server_default='local_only'))
    op.add_column('mapping_sets', sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('mapping_sets', sa.Column('forked_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('mapping_sets', sa.Column('forked_from_version', sa.String(100), nullable=True))

    op.create_index('ix_mapping_sets_external_source', 'mapping_sets', ['external_source'])
    op.create_index('ix_mapping_sets_external_api_config_id', 'mapping_sets', ['external_api_config_id'])
    op.create_index('ix_mapping_sets_external_id', 'mapping_sets', ['external_id'])
    op.create_index('ix_mapping_sets_sync_status', 'mapping_sets', ['sync_status'])
    op.create_foreign_key('fk_mapping_sets_external_api_config', 'mapping_sets', 'external_api_configs', ['external_api_config_id'], ['id'])


def downgrade() -> None:
    # Drop foreign keys and indexes from mapping_sets
    op.drop_constraint('fk_mapping_sets_external_api_config', 'mapping_sets', type_='foreignkey')
    op.drop_index('ix_mapping_sets_sync_status', 'mapping_sets')
    op.drop_index('ix_mapping_sets_external_id', 'mapping_sets')
    op.drop_index('ix_mapping_sets_external_api_config_id', 'mapping_sets')
    op.drop_index('ix_mapping_sets_external_source', 'mapping_sets')
    op.drop_column('mapping_sets', 'forked_from_version')
    op.drop_column('mapping_sets', 'forked_at')
    op.drop_column('mapping_sets', 'last_synced_at')
    op.drop_column('mapping_sets', 'sync_status')
    op.drop_column('mapping_sets', 'local_hash')
    op.drop_column('mapping_sets', 'upstream_hash')
    op.drop_column('mapping_sets', 'upstream_version')
    op.drop_column('mapping_sets', 'external_id')
    op.drop_column('mapping_sets', 'external_api_config_id')
    op.drop_column('mapping_sets', 'external_source')

    # Drop foreign keys and indexes from schedules
    op.drop_constraint('fk_schedules_external_api_config', 'schedules', type_='foreignkey')
    op.drop_index('ix_schedules_sync_status', 'schedules')
    op.drop_index('ix_schedules_external_id', 'schedules')
    op.drop_index('ix_schedules_external_api_config_id', 'schedules')
    op.drop_index('ix_schedules_external_source', 'schedules')
    op.drop_column('schedules', 'forked_from_version')
    op.drop_column('schedules', 'forked_at')
    op.drop_column('schedules', 'last_synced_at')
    op.drop_column('schedules', 'sync_status')
    op.drop_column('schedules', 'local_hash')
    op.drop_column('schedules', 'upstream_hash')
    op.drop_column('schedules', 'upstream_version')
    op.drop_column('schedules', 'external_id')
    op.drop_column('schedules', 'external_api_config_id')
    op.drop_column('schedules', 'external_source')

    # Drop foreign keys and indexes from validation_rules
    op.drop_constraint('fk_validation_rules_external_api_config', 'validation_rules', type_='foreignkey')
    op.drop_index('ix_validation_rules_sync_status', 'validation_rules')
    op.drop_index('ix_validation_rules_external_id', 'validation_rules')
    op.drop_index('ix_validation_rules_external_api_config_id', 'validation_rules')
    op.drop_index('ix_validation_rules_external_source', 'validation_rules')
    op.drop_column('validation_rules', 'forked_from_version')
    op.drop_column('validation_rules', 'forked_at')
    op.drop_column('validation_rules', 'last_synced_at')
    op.drop_column('validation_rules', 'sync_status')
    op.drop_column('validation_rules', 'local_hash')
    op.drop_column('validation_rules', 'upstream_hash')
    op.drop_column('validation_rules', 'upstream_version')
    op.drop_column('validation_rules', 'external_id')
    op.drop_column('validation_rules', 'external_api_config_id')
    op.drop_column('validation_rules', 'external_source')

    # Drop foreign keys and indexes from reports
    op.drop_constraint('fk_reports_external_api_config', 'reports', type_='foreignkey')
    op.drop_index('ix_reports_sync_status', 'reports')
    op.drop_index('ix_reports_external_id', 'reports')
    op.drop_index('ix_reports_external_api_config_id', 'reports')
    op.drop_index('ix_reports_external_source', 'reports')
    op.drop_column('reports', 'forked_from_version')
    op.drop_column('reports', 'forked_at')
    op.drop_column('reports', 'last_synced_at')
    op.drop_column('reports', 'sync_status')
    op.drop_column('reports', 'local_hash')
    op.drop_column('reports', 'upstream_hash')
    op.drop_column('reports', 'upstream_version')
    op.drop_column('reports', 'external_id')
    op.drop_column('reports', 'external_api_config_id')
    op.drop_column('reports', 'external_source')

    # Drop tables
    op.drop_table('external_api_sync_logs')
    op.drop_table('external_api_configs')

    # Drop enum types
    op.execute('DROP TYPE syncmodetype')
    op.execute('DROP TYPE synctriggertype')
    op.execute('DROP TYPE externalapiauthortype')
    op.execute('DROP TYPE externalsyncsource')
    op.execute('DROP TYPE externalsyncstatus')
