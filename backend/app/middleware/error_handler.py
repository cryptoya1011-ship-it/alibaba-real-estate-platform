"""Converts every failure into the standard error envelope. No raw DB errors leak."""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.errors import AppError
from app.core.logging import logger
from app.core.responses import json_fail


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError):
        return json_fail(exc.status_code, exc.code, exc.message, exc.details, _request_id(request))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError):
        details = [
            {"field": ".".join(str(p) for p in err.get("loc", [])[1:]), "message": err.get("msg")}
            for err in exc.errors()
        ]
        return json_fail(422, "VALIDATION_ERROR", "ورودی نامعتبر است", details, _request_id(request))

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException):
        code = {401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(
            exc.status_code, "HTTP_ERROR"
        )
        message = exc.detail if isinstance(exc.detail, str) else "خطا در پردازش درخواست"
        return json_fail(exc.status_code, code, message, None, _request_id(request))

    @app.exception_handler(IntegrityError)
    async def _integrity_error(request: Request, exc: IntegrityError):
        logger.warning("integrity_error", extra={"request_id": _request_id(request)}, exc_info=exc)
        return json_fail(409, "CONFLICT", "تضاد در داده‌ها؛ احتمالاً رکورد تکراری است", None, _request_id(request))

    @app.exception_handler(SQLAlchemyError)
    async def _db_error(request: Request, exc: SQLAlchemyError):
        logger.error("database_error", extra={"request_id": _request_id(request)}, exc_info=exc)
        return json_fail(500, "DATABASE_ERROR", "خطای پایگاه داده", None, _request_id(request))

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        logger.error("unhandled_error", extra={"request_id": _request_id(request)}, exc_info=exc)
        return json_fail(500, "INTERNAL_ERROR", "خطای داخلی سرور", None, _request_id(request))
