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

# CRM domain (Phase 6)
CUSTOMER_CREATE = "customer:create"
CUSTOMER_READ = "customer:read"
CUSTOMER_UPDATE = "customer:update"
CUSTOMER_DELETE = "customer:delete"
CUSTOMER_REQUEST_CREATE = "customer_request:create"
CUSTOMER_REQUEST_READ = "customer_request:read"
CUSTOMER_REQUEST_UPDATE = "customer_request:update"
FAVORITE_MANAGE = "favorite:manage"
SAVED_SEARCH_MANAGE = "saved_search:manage"

# Visits & Notifications (Phase 7-8)
VISIT_CREATE = "visit:create"
VISIT_READ = "visit:read"
VISIT_UPDATE = "visit:update"
VISIT_DELETE = "visit:delete"
NOTIFICATION_READ = "notification:read"
NOTIFICATION_MANAGE = "notification:manage"

# Deals & Commission (Phase 9)
DEAL_CREATE = "deal:create"
DEAL_READ = "deal:read"
DEAL_UPDATE = "deal:update"
DEAL_DELETE = "deal:delete"
COMMISSION_READ = "commission:read"
COMMISSION_MANAGE = "commission:manage"

# AI / Automation (Phase 14)
AI_SEARCH = "ai:search"
AI_MATCH = "ai:match"
AI_SUGGEST = "ai:suggest"
AI_MANAGE = "ai:manage"

# Integrations / Advanced Platform (Phase 15)
INTEGRATION_TELEGRAM = "integration:telegram"
INTEGRATION_SMS = "integration:sms"
INTEGRATION_LISTINGS = "integration:listings"
INTEGRATION_PAYMENT = "integration:payment"
INTEGRATION_MAPS = "integration:maps"
INTEGRATION_LOGS = "integration:logs"
INTEGRATION_MANAGE = "integration:manage"

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
    CUSTOMER_CREATE,
    CUSTOMER_READ,
    CUSTOMER_UPDATE,
    CUSTOMER_DELETE,
    CUSTOMER_REQUEST_CREATE,
    CUSTOMER_REQUEST_READ,
    CUSTOMER_REQUEST_UPDATE,
    FAVORITE_MANAGE,
    SAVED_SEARCH_MANAGE,
    VISIT_CREATE,
    VISIT_READ,
    VISIT_UPDATE,
    VISIT_DELETE,
    NOTIFICATION_READ,
    NOTIFICATION_MANAGE,
    DEAL_CREATE,
    DEAL_READ,
    DEAL_UPDATE,
    DEAL_DELETE,
    COMMISSION_READ,
    COMMISSION_MANAGE,
    AI_SEARCH,
    AI_MATCH,
    AI_SUGGEST,
    AI_MANAGE,
    INTEGRATION_TELEGRAM,
    INTEGRATION_SMS,
    INTEGRATION_LISTINGS,
    INTEGRATION_PAYMENT,
    INTEGRATION_MAPS,
    INTEGRATION_LOGS,
    INTEGRATION_MANAGE,
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
        CUSTOMER_CREATE,
        CUSTOMER_READ,
        CUSTOMER_UPDATE,
        CUSTOMER_DELETE,
        CUSTOMER_REQUEST_CREATE,
        CUSTOMER_REQUEST_READ,
        CUSTOMER_REQUEST_UPDATE,
        FAVORITE_MANAGE,
        SAVED_SEARCH_MANAGE,
        VISIT_CREATE,
        VISIT_READ,
        VISIT_UPDATE,
        VISIT_DELETE,
        NOTIFICATION_READ,
        NOTIFICATION_MANAGE,
        DEAL_CREATE,
        DEAL_READ,
        DEAL_UPDATE,
        DEAL_DELETE,
        COMMISSION_READ,
        COMMISSION_MANAGE,
        AI_SEARCH,
        AI_MATCH,
        AI_SUGGEST,
        INTEGRATION_TELEGRAM,
        INTEGRATION_SMS,
        INTEGRATION_LISTINGS,
        INTEGRATION_MAPS,
        INTEGRATION_LOGS,
    ),
    AGENT: (
        ORG_READ,
        BRANCH_READ,
        PROPERTY_CREATE,
        PROPERTY_READ,
        PROPERTY_UPDATE,
        CUSTOMER_CREATE,
        CUSTOMER_READ,
        CUSTOMER_UPDATE,
        CUSTOMER_REQUEST_CREATE,
        CUSTOMER_REQUEST_READ,
        FAVORITE_MANAGE,
        SAVED_SEARCH_MANAGE,
        VISIT_CREATE,
        VISIT_READ,
        VISIT_UPDATE,
        NOTIFICATION_READ,
        DEAL_CREATE,
        DEAL_READ,
        DEAL_UPDATE,
        AI_SEARCH,
        AI_MATCH,
        AI_SUGGEST,
        INTEGRATION_TELEGRAM,
        INTEGRATION_MAPS,
    ),
}
