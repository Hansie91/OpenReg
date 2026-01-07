"""Add workflow execution tables

Revision ID: 002_add_workflow_tables
Revises: 001_add_api_keys
Create Date: 2026-01-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '002_add_workflow_tables'
down_revision: Union[str, None] = '001_add_api_keys'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create workflow_state enum
    workflow_state = postgresql.ENUM(
        'pending', 'initializing', 'fetching_data', 'pre_validation',
        'transforming', 'post_validation', 'generating_artifacts',
        'delivering', 'completed', 'failed', 'cancelled', 'waiting_retry', 'paused',
        name='workflowstate'
    )
    workflow_state.create(op.get_bind())

    # Create step_status enum
    step_status = postgresql.ENUM(
        'pending', 'running', 'completed', 'failed', 'skipped', 'retrying',
        name='stepstatus'
    )
    step_status.create(op.get_bind())

    # Create workflow_executions table
    op.create_table(
        'workflow_executions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('job_run_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workflow_name', sa.String(length=100), nullable=False),
        sa.Column('workflow_version', sa.String(length=20), nullable=False),

        # Current state
        sa.Column('current_state', postgresql.ENUM(
            'pending', 'initializing', 'fetching_data', 'pre_validation',
            'transforming', 'post_validation', 'generating_artifacts',
            'delivering', 'completed', 'failed', 'cancelled', 'waiting_retry', 'paused',
            name='workflowstate', create_type=False
        ), nullable=False, default='pending'),
        sa.Column('progress_percentage', sa.Integer(), nullable=False, default=0),

        # Timing
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),

        # Error info
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('error_code', sa.String(length=50), nullable=True),
        sa.Column('failed_step', sa.String(length=100), nullable=True),

        # Context snapshot
        sa.Column('context_snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=True),

        # State history (denormalized for quick access)
        sa.Column('state_history', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default=[]),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),

        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['job_run_id'], ['job_runs.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for workflow_executions
    op.create_index('ix_workflow_executions_tenant_id', 'workflow_executions', ['tenant_id'])
    op.create_index('ix_workflow_executions_job_run_id', 'workflow_executions', ['job_run_id'], unique=True)
    op.create_index('ix_workflow_executions_current_state', 'workflow_executions', ['current_state'])
    op.create_index('ix_workflow_executions_created_at', 'workflow_executions', ['created_at'])

    # Create workflow_steps table
    op.create_table(
        'workflow_steps',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workflow_execution_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('step_name', sa.String(length=100), nullable=False),
        sa.Column('step_order', sa.Integer(), nullable=False),

        # Status
        sa.Column('status', postgresql.ENUM(
            'pending', 'running', 'completed', 'failed', 'skipped', 'retrying',
            name='stepstatus', create_type=False
        ), nullable=False, default='pending'),

        # Timing
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),

        # Retry info
        sa.Column('attempt_count', sa.Integer(), nullable=False, default=0),
        sa.Column('max_attempts', sa.Integer(), nullable=False, default=3),
        sa.Column('next_retry_at', sa.DateTime(timezone=True), nullable=True),

        # Error info
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('error_code', sa.String(length=50), nullable=True),

        # Output/metadata
        sa.Column('output', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),

        sa.ForeignKeyConstraint(['workflow_execution_id'], ['workflow_executions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for workflow_steps
    op.create_index('ix_workflow_steps_execution_id', 'workflow_steps', ['workflow_execution_id'])
    op.create_index('ix_workflow_steps_status', 'workflow_steps', ['status'])
    op.create_index(
        'ix_workflow_steps_execution_order',
        'workflow_steps',
        ['workflow_execution_id', 'step_order']
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_workflow_steps_execution_order', table_name='workflow_steps')
    op.drop_index('ix_workflow_steps_status', table_name='workflow_steps')
    op.drop_index('ix_workflow_steps_execution_id', table_name='workflow_steps')

    op.drop_index('ix_workflow_executions_created_at', table_name='workflow_executions')
    op.drop_index('ix_workflow_executions_current_state', table_name='workflow_executions')
    op.drop_index('ix_workflow_executions_job_run_id', table_name='workflow_executions')
    op.drop_index('ix_workflow_executions_tenant_id', table_name='workflow_executions')

    # Drop tables
    op.drop_table('workflow_steps')
    op.drop_table('workflow_executions')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS stepstatus')
    op.execute('DROP TYPE IF EXISTS workflowstate')
