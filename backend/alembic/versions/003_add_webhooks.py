"""Add webhooks and tenant environment

Revision ID: 003_add_webhooks
Revises: 002_add_workflow_tables
Create Date: 2025-01-07

This migration adds:
- environment column to tenants table for sandbox/production mode
- webhooks table for webhook configurations
- webhook_deliveries table for delivery tracking
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers
revision = '003_add_webhooks'
down_revision = '002_add_workflow_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create tenant environment enum
    tenant_environment_enum = sa.Enum(
        'production', 'sandbox',
        name='tenantenvironment'
    )
    tenant_environment_enum.create(op.get_bind(), checkfirst=True)

    # Add environment column to tenants
    op.add_column(
        'tenants',
        sa.Column(
            'environment',
            tenant_environment_enum,
            nullable=False,
            server_default='sandbox'
        )
    )
    op.create_index('ix_tenants_environment', 'tenants', ['environment'])

    # Create webhook event type enum
    webhook_event_enum = sa.Enum(
        'job.started', 'job.completed', 'job.failed',
        'artifact.created', 'delivery.completed', 'delivery.failed',
        'validation.failed', 'workflow.state_changed',
        name='webhookeventtype'
    )
    webhook_event_enum.create(op.get_bind(), checkfirst=True)

    # Create webhook delivery status enum
    webhook_delivery_status_enum = sa.Enum(
        'pending', 'success', 'failed', 'retrying',
        name='webhookdeliverystatus'
    )
    webhook_delivery_status_enum.create(op.get_bind(), checkfirst=True)

    # Create webhooks table
    op.create_table(
        'webhooks',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),

        # Configuration
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('url', sa.String(2048), nullable=False),

        # Security
        sa.Column('secret_encrypted', sa.LargeBinary, nullable=False),
        sa.Column('allowed_ips', JSONB, server_default='[]'),

        # Event subscriptions
        sa.Column('events', JSONB, nullable=False, server_default='[]'),

        # Optional filtering
        sa.Column('report_ids', JSONB, server_default='[]'),

        # Request configuration
        sa.Column('headers', JSONB, server_default='{}'),
        sa.Column('timeout_seconds', sa.Integer, nullable=False, server_default='30'),

        # Retry policy
        sa.Column('retry_policy', JSONB, server_default='{"max_attempts": 5, "backoff": "exponential", "base_delay": 5, "max_delay": 300}'),

        # Status
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),

        # Statistics
        sa.Column('total_deliveries', sa.Integer, nullable=False, server_default='0'),
        sa.Column('successful_deliveries', sa.Integer, nullable=False, server_default='0'),
        sa.Column('failed_deliveries', sa.Integer, nullable=False, server_default='0'),
        sa.Column('last_triggered_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_success_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_failure_at', sa.DateTime(timezone=True), nullable=True),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_index('ix_webhooks_tenant_id', 'webhooks', ['tenant_id'])
    op.create_index('ix_webhooks_is_active', 'webhooks', ['is_active'])

    # Create webhook_deliveries table
    op.create_table(
        'webhook_deliveries',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('webhook_id', UUID(as_uuid=True), sa.ForeignKey('webhooks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id'), nullable=False),

        # Event details
        sa.Column('event_type', webhook_event_enum, nullable=False),
        sa.Column('event_id', sa.String(64), nullable=False, unique=True),
        sa.Column('payload', JSONB, nullable=False),

        # Related entities
        sa.Column('job_run_id', UUID(as_uuid=True), sa.ForeignKey('job_runs.id'), nullable=True),
        sa.Column('artifact_id', UUID(as_uuid=True), sa.ForeignKey('artifacts.id'), nullable=True),

        # Delivery status
        sa.Column('status', webhook_delivery_status_enum, nullable=False, server_default='pending'),
        sa.Column('attempt_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('max_attempts', sa.Integer, nullable=False, server_default='5'),

        # Request details
        sa.Column('request_url', sa.String(2048), nullable=False),
        sa.Column('request_headers', JSONB, server_default='{}'),
        sa.Column('request_timestamp', sa.DateTime(timezone=True), nullable=True),

        # Response details
        sa.Column('response_status_code', sa.Integer, nullable=True),
        sa.Column('response_headers', JSONB, server_default='{}'),
        sa.Column('response_body', sa.Text, nullable=True),
        sa.Column('response_timestamp', sa.DateTime(timezone=True), nullable=True),
        sa.Column('response_time_ms', sa.Integer, nullable=True),

        # Error tracking
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('next_retry_at', sa.DateTime(timezone=True), nullable=True),

        # Completion
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_index('ix_webhook_deliveries_webhook_id', 'webhook_deliveries', ['webhook_id'])
    op.create_index('ix_webhook_deliveries_tenant_id', 'webhook_deliveries', ['tenant_id'])
    op.create_index('ix_webhook_deliveries_event_type', 'webhook_deliveries', ['event_type'])
    op.create_index('ix_webhook_deliveries_event_id', 'webhook_deliveries', ['event_id'])
    op.create_index('ix_webhook_deliveries_status', 'webhook_deliveries', ['status'])
    op.create_index('ix_webhook_deliveries_job_run_id', 'webhook_deliveries', ['job_run_id'])


def downgrade() -> None:
    # Drop webhook_deliveries table
    op.drop_index('ix_webhook_deliveries_job_run_id', 'webhook_deliveries')
    op.drop_index('ix_webhook_deliveries_status', 'webhook_deliveries')
    op.drop_index('ix_webhook_deliveries_event_id', 'webhook_deliveries')
    op.drop_index('ix_webhook_deliveries_event_type', 'webhook_deliveries')
    op.drop_index('ix_webhook_deliveries_tenant_id', 'webhook_deliveries')
    op.drop_index('ix_webhook_deliveries_webhook_id', 'webhook_deliveries')
    op.drop_table('webhook_deliveries')

    # Drop webhooks table
    op.drop_index('ix_webhooks_is_active', 'webhooks')
    op.drop_index('ix_webhooks_tenant_id', 'webhooks')
    op.drop_table('webhooks')

    # Drop environment column and enum
    op.drop_index('ix_tenants_environment', 'tenants')
    op.drop_column('tenants', 'environment')

    # Drop enums
    sa.Enum(name='webhookdeliverystatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='webhookeventtype').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='tenantenvironment').drop(op.get_bind(), checkfirst=True)
