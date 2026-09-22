from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import admin, ai, auth, crm, deals, health, integrations, invitations, me, notifications, organizations, properties, public, roles, visits

api_router = APIRouter()
api_router.include_router(public.router)
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(me.router)
api_router.include_router(admin.router)
api_router.include_router(organizations.router)
api_router.include_router(invitations.router)
api_router.include_router(roles.router)
api_router.include_router(properties.router)
api_router.include_router(crm.router)
api_router.include_router(visits.router)
api_router.include_router(notifications.router)
api_router.include_router(deals.router)
api_router.include_router(ai.router)
api_router.include_router(integrations.router)
