"""Organization / Branch / Membership: the tenancy backbone."""
from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import BaseEntity
from app.db.types import BigInt


class Organization(Base, BaseEntity):
    __tablename__ = "organizations"
    __table_args__ = (UniqueConstraint("slug", name="uq_organizations_slug"),)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(64), nullable=False)
    city_code: Mapped[str | None] = mapped_column(String(8), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")


class Branch(Base, BaseEntity):
    __tablename__ = "branches"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_branches_organization_id_code"),
    )

    organization_id: Mapped[int] = mapped_column(
        BigInt, ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_main: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")


class UserOrganization(Base, BaseEntity):
    """Membership. A user may belong to several organizations."""

    __tablename__ = "user_organizations"
    __table_args__ = (
        UniqueConstraint("user_id", "organization_id", name="uq_user_organizations_user_id_organization_id"),
        Index("ix_user_organizations_organization_id_is_active", "organization_id", "is_active"),
    )

    user_id: Mapped[int] = mapped_column(
        BigInt, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    organization_id: Mapped[int] = mapped_column(
        BigInt, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    is_owner: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")


class UserBranch(Base, BaseEntity):
    """A member can operate in several branches of the same organization."""

    __tablename__ = "user_branches"
    __table_args__ = (
        UniqueConstraint("user_id", "branch_id", name="uq_user_branches_user_id_branch_id"),
    )

    user_id: Mapped[int] = mapped_column(BigInt, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id: Mapped[int] = mapped_column(
        BigInt, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    branch_id: Mapped[int] = mapped_column(BigInt, ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")


class OrganizationInvitation(Base, BaseEntity):
    """Bound to one identity (telegram id or phone) — not a public reusable code."""

    __tablename__ = "organization_invitations"
    __table_args__ = (
        Index("ix_organization_invitations_organization_id_status", "organization_id", "status"),
    )

    organization_id: Mapped[int] = mapped_column(
        BigInt, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    branch_id: Mapped[int | None] = mapped_column(BigInt, ForeignKey("branches.id", ondelete="SET NULL"), nullable=True)
    invited_telegram_id: Mapped[int | None] = mapped_column(BigInt, nullable=True, index=True)
    invited_phone: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    role_code: Mapped[str] = mapped_column(String(64), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending", server_default="pending")
    accepted_by_user_id: Mapped[int | None] = mapped_column(BigInt, nullable=True)
