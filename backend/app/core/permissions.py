"""Permission catalogue. Permissions are independent of roles; roles map to them."""
from __future__ import annotations

# Organization / tenant administration
ORG_READ = "organization:read"
ORG_UPDATE = "organization:update"
ORG_MEMBER_INVITE = "organization:member:invite"
ORG_MEMBER_READ = "organization:member:read"
BRANCH_READ = "branch:read"
BRANCH_MANAGE = "branch:manage"
ROLE_MANAGE = "role:manage"

# Property domain (declared now, enforced when the property sprint lands)
PROPERTY_CREATE = "property:create"
PROPERTY_READ = "property:read"
PROPERTY_UPDATE = "property:update"
PROPERTY_DELETE = "property:delete"
PROPERTY_ADDRESS_READ = "property:address:read"   # exact address, never public
PROPERTY_OWNER_READ = "property:owner:read"       # owner identity/contact

ALL_PERMISSIONS: tuple[str, ...] = (
    ORG_READ,
    ORG_UPDATE,
    ORG_MEMBER_INVITE,
    ORG_MEMBER_READ,
    BRANCH_READ,
    BRANCH_MANAGE,
    ROLE_MANAGE,
    PROPERTY_CREATE,
    PROPERTY_READ,
    PROPERTY_UPDATE,
    PROPERTY_DELETE,
    PROPERTY_ADDRESS_READ,
    PROPERTY_OWNER_READ,
)

# System role codes
SUPER_ADMIN = "super_admin"
SYSTEM_ADMIN = "system_admin"
ORG_ADMIN = "organization_admin"
BRANCH_ADMIN = "branch_admin"
AGENT = "agent"

SYSTEM_ROLE_PERMISSIONS: dict[str, tuple[str, ...]] = {
    ORG_ADMIN: ALL_PERMISSIONS,
    BRANCH_ADMIN: (
        ORG_READ,
        ORG_MEMBER_READ,
        BRANCH_READ,
        PROPERTY_CREATE,
        PROPERTY_READ,
        PROPERTY_UPDATE,
        PROPERTY_ADDRESS_READ,
        PROPERTY_OWNER_READ,
    ),
    AGENT: (
        ORG_READ,
        BRANCH_READ,
        PROPERTY_CREATE,
        PROPERTY_READ,
        PROPERTY_UPDATE,
    ),
}
