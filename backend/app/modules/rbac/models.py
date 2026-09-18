"""RBAC: permissions are global, roles are system-wide or organization-defined."""
from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import BaseEntity
from app.db.types import BigInt


class Permission(Base, BaseEntity):
    __tablename__ = "permissions"
    __table_args__ = (UniqueConstraint("code", name="uq_permissions_code"),)

    code: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)


class Role(Base, BaseEntity):
    """organization_id NULL => system role shared by all tenants."""

    __tablename__ = "roles"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_roles_organization_id_code"),
    )

    organization_id: Mapped[int | None] = mapped_column(
        BigInt, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")


class RolePermission(Base, BaseEntity):
    __tablename__ = "role_permission_map"
    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_role_permission_map_role_id_permission_id"),
    )

    role_id: Mapped[int] = mapped_column(BigInt, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_id: Mapped[int] = mapped_column(
        BigInt, ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False, index=True
    )


class UserRole(Base, BaseEntity):
    """Role assignment is always scoped to an organization (and optionally a branch)."""

    __tablename__ = "user_role_map"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "organization_id", "role_id", "branch_id",
            name="uq_user_role_map_user_id_organization_id_role_id_branch_id",
        ),
    )

    user_id: Mapped[int] = mapped_column(BigInt, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id: Mapped[int] = mapped_column(
        BigInt, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role_id: Mapped[int] = mapped_column(BigInt, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id: Mapped[int | None] = mapped_column(BigInt, ForeignKey("branches.id", ondelete="SET NULL"), nullable=True)
