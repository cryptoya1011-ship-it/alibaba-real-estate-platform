"""Import every model once so Base.metadata is complete (Alembic + create_all)."""
from app.db.base import Base  # noqa: F401
from app.db.system_models import CodeSequence, IdempotencyKey  # noqa: F401
from app.modules.organizations.models import (  # noqa: F401
    Branch,
    Organization,
    OrganizationInvitation,
    UserBranch,
    UserOrganization,
)
from app.modules.rbac.models import Permission, Role, RolePermission, UserRole  # noqa: F401
from app.modules.users.models import User  # noqa: F401

__all__ = ["Base"]
