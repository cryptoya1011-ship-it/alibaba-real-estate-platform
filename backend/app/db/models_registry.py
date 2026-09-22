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
from app.modules.properties.models import (  # noqa: F401
    Property,
    PropertyLocation,
    PropertyMedia,
    PropertyUsage,
)
from app.modules.crm.models import (  # noqa: F401
    CustomerRequest,
    Favorite,
    Person,
    PersonRole,
    SavedSearch,
)
from app.modules.visits.models import Visit  # noqa: F401
from app.modules.notifications.models import Notification  # noqa: F401
from app.modules.deals.models import Deal, DealStatusHistory  # noqa: F401
from app.modules.rbac.models import Permission, Role, RolePermission, UserRole  # noqa: F401
from app.modules.users.models import User  # noqa: F401
from app.modules.integrations.models import IntegrationLog  # noqa: F401

__all__ = ["Base"]
