"""add integrations phase 15

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-21

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'integration_logs',
        sa.Column('provider', sa.String(length=64), nullable=False),
        sa.Column('action', sa.String(length=64), nullable=False),
        sa.Column('entity_type', sa.String(length=64), nullable=True),
        sa.Column('entity_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
        sa.Column('request_payload', sa.Text(), nullable=True),
        sa.Column('response_payload', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=16), server_default='success', nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('external_id', sa.String(length=200), nullable=True),
        sa.Column('external_url', sa.String(length=500), nullable=True),
        sa.Column('organization_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
        sa.Column('branch_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
        sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('created_by', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
        sa.Column('updated_by', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('integration_logs', schema=None) as batch_op:
        batch_op.create_index('ix_integration_logs_org_provider', ['organization_id', 'provider'], unique=False)
        batch_op.create_index('ix_integration_logs_org_created', ['organization_id', 'created_at'], unique=False)
        batch_op.create_index('ix_integration_logs_provider_status', ['provider', 'status'], unique=False)
        batch_op.create_index(batch_op.f('ix_integration_logs_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_integration_logs_is_deleted'), ['is_deleted'], unique=False)
        batch_op.create_index(batch_op.f('ix_integration_logs_branch_id'), ['branch_id'], unique=False)

    # RLS for integration_logs — second layer isolation
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY")
        op.execute("DROP POLICY IF EXISTS tenant_isolation ON integration_logs")
        op.execute(
            """
            CREATE POLICY tenant_isolation ON integration_logs
            FOR ALL
            USING (
                (current_setting('app.bypass_rls', true) = '1')
                OR (organization_id::text = current_setting('app.current_org_id', true))
            )
            WITH CHECK (
                (current_setting('app.bypass_rls', true) = '1')
                OR (organization_id::text = current_setting('app.current_org_id', true))
            )
            """
        )


def downgrade() -> None:
    with op.batch_alter_table('integration_logs', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_integration_logs_branch_id'))
        batch_op.drop_index(batch_op.f('ix_integration_logs_is_deleted'))
        batch_op.drop_index(batch_op.f('ix_integration_logs_organization_id'))
        batch_op.drop_index('ix_integration_logs_provider_status')
        batch_op.drop_index('ix_integration_logs_org_created')
        batch_op.drop_index('ix_integration_logs_org_provider')

    op.drop_table('integration_logs')
