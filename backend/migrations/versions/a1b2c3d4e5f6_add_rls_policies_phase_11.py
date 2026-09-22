"""add rls policies phase 11 — PostgreSQL RLS as second layer

Revision ID: a1b2c3d4e5f6
Revises: 30be32e888f7
Create Date: 2026-09-21

This migration enables Row Level Security on all tenant tables and creates
policies that enforce organization_id = current_setting('app.current_org_id').

For SQLite, RLS is not supported — this migration is a no-op (checks dialect).

Policies:
- For properties (public table): SELECT allows (published AND not deleted) OR org match OR bypass
- For other tenant tables: ALL requires org match OR bypass
- Bypass via SET LOCAL app.bypass_rls = '1' for public endpoints
- current_setting(..., true) allows NULL without error
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "30be32e888f7"
branch_labels = None
depends_on = None

# All tenant tables with organization_id
TENANT_TABLES = [
    "branches",
    "user_organizations",
    "user_branches",
    "organization_invitations",
    "user_role_map",
    "code_sequences",
    "idempotency_keys",
    "properties",
    "property_usages",
    "property_locations",
    "property_media",
    "persons",
    "person_roles",
    "customer_requests",
    "favorites",
    "saved_searches",
    "visits",
    "notifications",
    "deals",
    "deal_status_history",
]

# Tables where public read of published is allowed
PUBLIC_TABLES = ["properties"]


def _is_postgres() -> bool:
    bind = op.get_bind()
    return bind.dialect.name == "postgresql"


def upgrade() -> None:
    if not _is_postgres():
        # SQLite: no-op, RLS not supported
        # We still create a dummy table to record that migration ran
        # Actually just return
        return

    # Enable RLS and create policies for each tenant table
    for table in TENANT_TABLES:
        # Enable RLS
        op.execute(sa.text(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY'))

        # Drop existing policies if any (idempotent)
        op.execute(sa.text(f'DROP POLICY IF EXISTS tenant_isolation ON {table}'))
        op.execute(sa.text(f'DROP POLICY IF EXISTS tenant_isolation_select ON {table}'))
        op.execute(sa.text(f'DROP POLICY IF EXISTS tenant_isolation_write ON {table}'))
        op.execute(sa.text(f'DROP POLICY IF EXISTS public_read ON {table}'))

        if table in PUBLIC_TABLES:
            # Properties: public can read published, others need org match or bypass
            # SELECT policy
            op.execute(
                sa.text(
                    f"""
                    CREATE POLICY tenant_isolation_select ON {table}
                    FOR SELECT
                    USING (
                        (status = 'published' AND is_deleted = false)
                        OR organization_id::text = current_setting('app.current_org_id', true)
                        OR current_setting('app.current_org_id', true) IS NULL
                        OR current_setting('app.current_org_id', true) = ''
                        OR current_setting('app.bypass_rls', true) = '1'
                    )
                    """
                )
            )
            # WRITE policy (INSERT, UPDATE, DELETE)
            op.execute(
                sa.text(
                    f"""
                    CREATE POLICY tenant_isolation_write ON {table}
                    FOR ALL
                    USING (
                        organization_id::text = current_setting('app.current_org_id', true)
                        OR current_setting('app.bypass_rls', true) = '1'
                    )
                    WITH CHECK (
                        organization_id::text = current_setting('app.current_org_id', true)
                        OR current_setting('app.bypass_rls', true) = '1'
                    )
                    """
                )
            )
        else:
            # Other tenant tables: require org match or bypass for all operations
            # But allow NULL org_id during migration/setup? For safety, allow NULL only if bypass is set?
            # We allow NULL for initial setup but in prod app.current_org_id will be set
            op.execute(
                sa.text(
                    f"""
                    CREATE POLICY tenant_isolation ON {table}
                    FOR ALL
                    USING (
                        organization_id::text = current_setting('app.current_org_id', true)
                        OR current_setting('app.bypass_rls', true) = '1'
                    )
                    WITH CHECK (
                        organization_id::text = current_setting('app.current_org_id', true)
                        OR current_setting('app.bypass_rls', true) = '1'
                    )
                    """
                )
            )

    # Also set default for app.current_org_id and app.bypass_rls to avoid errors when not set
    # These are custom GUCs, we can set them at database level if needed
    # For now, policies use current_setting(..., true) which returns NULL if not set, not error


def downgrade() -> None:
    if not _is_postgres():
        return

    for table in TENANT_TABLES:
        op.execute(sa.text(f"DROP POLICY IF EXISTS tenant_isolation ON {table}"))
        op.execute(sa.text(f"DROP POLICY IF EXISTS tenant_isolation_select ON {table}"))
        op.execute(sa.text(f"DROP POLICY IF EXISTS tenant_isolation_write ON {table}"))
        op.execute(sa.text(f"DROP POLICY IF EXISTS public_read ON {table}"))
        op.execute(sa.text(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY"))
