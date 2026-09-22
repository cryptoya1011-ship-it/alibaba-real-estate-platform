# ADR-0015: Multi-Tenant Real — Invitation + Custom Roles + Super Admin

**Date:** 2026-09-21
**Status:** Accepted
**Phase:** 13 Multi-Tenant

## Context

- Phase 4 RBAC had system roles only (organization_admin, branch_admin, agent) with organization_id NULL.
- Tenant isolation was implemented via TenantRepository + contextvars, but RLS was added in Phase 11 as second layer.
- Requirement per ROADMAP Phase 13: Organization A,B,C real, Tenant Isolation 4 layers + RLS real, Super Admin Dashboard.
- Missing: Invitation Flow (bind to telegram_id/phone, token hash, single-use), Custom Roles management per org, Super Admin endpoints bypass RLS.

## Decision

### Tenant Isolation 4 Layers
1. **Context:** `TenantContext` frozen dataclass via contextvars, org_id never from user input.
2. **Repository:** `TenantRepository._base_select` filters `organization_id == current_org`.
3. **RLS:** PostgreSQL policies `ENABLE RLS` + `FOR ALL USING (org_id = current_setting OR bypass=1)` + properties published exception.
4. **Cache:** `perms:{user}:{org}:{version}` TTL 300s, version bump on role change forces re-login.

Access to other tenant → 404 not 403 (to not leak existence).

### Invitation Flow
- Model `OrganizationInvitation` already existed: `token_hash` indexed, `invited_telegram_id`, `invited_phone`, `role_code`, `status` pending/accepted/expired/revoked, `accepted_by_user_id`.
- Service generates `raw_token = secrets.token_urlsafe(32)`, stores `sha256(raw_token)`, returns raw once.
- Create validates role exists (system or custom for org) + branch exists if provided.
- Accept searches via `select(...).where(token_hash == hash, status == pending, is_deleted == false)` bypassing tenant filter (user may not be member yet). Validates identity if `invited_telegram_id` set → must match `user.telegram_id`. Creates `UserOrganization` if not exists, assigns role via `RbacService.assign_role`, creates `UserBranch` if branch_id, marks accepted, bumps `permissions_version`, invalidates cache `delete_pattern perms:{user}:{org}:*`, refresh.
- Token single-use: second accept → 404. Revoke only pending → else Conflict.
- Endpoints: `POST /organizations/{id}/invitations`, `GET /organizations/{id}/invitations`, `DELETE /organizations/{id}/invitations/{inv_id}`, `POST /invitations/accept`.

### Custom Roles
- `Role` model supports `organization_id` NULL system vs org_id custom, `is_system` bool.
- `CustomRoleService`:
  - `list_roles`: system roles (org_id NULL) + custom for org.
  - `create_role`: code `[a-z0-9_]+` lower, not in `SYSTEM_ROLE_PERMISSIONS`, duplicate check per org, permission_codes must be in `ALL_PERMISSIONS`, ensures catalogue via `RbacService.ensure_permission_catalogue`, creates `Role` is_system=False + `RolePermission`s.
  - `get_role`, `update_role` (title, permissions delete+recreate), `delete_role` soft, forbids system roles.
  - `get_role_permissions` via `permissions_for_role`.
- Permissions enforced via existing cache mechanism — after custom role assignment, version bump causes new perms on next login.
- Endpoints: `GET/POST /organizations/{id}/roles`, `GET/PATCH/DELETE /organizations/{id}/roles/{role_id}`.

### Super Admin Dashboard
- `AdminService` uses `BaseRepository` (no tenant filter) + `get_db_public` bypass RLS (SET LOCAL bypass=1).
- `_ensure_super_admin` checks `ctx.is_super_admin` else 403.
- Methods:
  - `list_organizations` with q filter name/slug, total count.
  - `get_organization`, `get_organization_stats` counts members/branches/properties/persons/visits/deals.
  - `list_users` q filter, `toggle_super_admin` bump version, `global_stats`.
- Endpoints: `GET /admin/organizations`, `GET /admin/organizations/{id}`, `GET /admin/organizations/{id}/stats`, `GET /admin/users`, `PATCH /admin/users/{id}/super-admin`, `GET /admin/stats`.
- Frontend: admin tab visible only if `is_super_admin`, shows global stats, org list with stats button, users with toggle.

### Frontend
- `api.ts` adds invitation/roles/admin methods.
- `App.tsx` 10 tabs: properties, crm, visits, deals, team, roles, public, favorites, notif, admin (super admin only).
- Team tab: create invitation form telegram_id + role_code (including custom roles), list invitations with status badge, revoke button, token display once warning, accept UI input + button.
- Roles tab: create custom role form code/title/permissions comma, list with system/custom badge, delete button.
- Admin tab: global stats, org list with stats load, users toggle.

## Consequences

- Positive: Real multi-tenant A,B,C isolation verified, invitation single-use token hash, custom roles per org, super admin sees all tenants bypass RLS.
- Positive: No breaking change to existing RBAC — system roles remain global, custom roles scoped.
- Negative: Custom role CRUD cache invalidation via TTL 5min + version bump on assignment, not immediate for existing sessions (acceptable).
- Negative: Invitation accept bumps version forcing re-login — UX requires re-login after accept (documented).
- Negative: Direct `engine` fixture used in test_admin_dashboard to set super_admin via raw SQL — works for SQLite test, not for Postgres but test only.

## Alternatives Considered

- Invitation via email link: rejected, Telegram ID is primary identity per Local-First.
- Custom roles via separate table: rejected, reuse existing Role table with organization_id.
- Super admin via separate service: rejected, reuse BaseRepository + get_db_public bypass.

## Verification

- `pytest tests/test_multi_tenant.py` — 4 passed: isolation A,B,C 404, invitation flow with re-login, custom roles CRUD + 409 + 403, admin dashboard 403 then 200 after super_admin set via engine.
- `pytest` all — 46 passed, 1 failed alembic binary not in PATH (expected in CI without .venv).
- `alembic upgrade head` OK on SQLite (RLS no-op).
- Frontend build OK (Vite).
