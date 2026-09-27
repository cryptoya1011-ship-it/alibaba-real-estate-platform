"""sprint 0: property review (approved_by/at, review_note) + invitation expiry

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-27

Additive only — existing rows keep working (all new columns nullable).
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None

BigInt = sa.BigInteger().with_variant(sa.Integer(), "sqlite")


def upgrade() -> None:
    with op.batch_alter_table("properties") as batch:
        batch.add_column(sa.Column("approved_by", BigInt, nullable=True))
        batch.add_column(sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("review_note", sa.Text(), nullable=True))
    with op.batch_alter_table("organization_invitations") as batch:
        batch.add_column(sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("organization_invitations") as batch:
        batch.drop_column("expires_at")
    with op.batch_alter_table("properties") as batch:
        batch.drop_column("review_note")
        batch.drop_column("approved_at")
        batch.drop_column("approved_by")
