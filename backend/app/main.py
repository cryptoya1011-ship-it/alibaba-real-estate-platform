from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.cache import get_cache
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.core.responses import ok
from app.db import models_registry  # noqa: F401  (ensures metadata is loaded)
from app.middleware.error_handler import register_exception_handlers
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.request_context import RequestContextMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info("startup", extra={"path": settings.API_V1_PREFIX})
    # Init cache (Redis or memory)
    try:
        await get_cache()
    except Exception as e:
        logger.warning(f"cache init failed: {e}")
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version="0.1.0",
        description="Alibaba Real Estate Platform API — modular monolith, multi-tenant. Phase 11: PostgreSQL RLS + Redis + Rate Limit",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
    )
    app.add_middleware(RateLimitMiddleware, enabled=True)
    app.add_middleware(RequestContextMiddleware)
    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @app.get("/")
    async def root() -> dict:
        return ok({"app": settings.APP_CODE, "docs": "/docs", "api": settings.API_V1_PREFIX, "phase": "11-server-redis-rls"})

    return app


app = create_app()
