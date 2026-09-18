"""Domain error hierarchy. API layer converts these into the error envelope."""
from __future__ import annotations

from typing import Any


class AppError(Exception):
    code = "INTERNAL_ERROR"
    status_code = 500
    message = "خطای داخلی سرور"

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        details: Any = None,
    ) -> None:
        self.message = message or self.message
        if code:
            self.code = code
        self.details = details if details is not None else []
        super().__init__(self.message)


class ValidationError(AppError):
    code = "VALIDATION_ERROR"
    status_code = 422
    message = "ورودی نامعتبر است"


class UnauthorizedError(AppError):
    code = "UNAUTHORIZED"
    status_code = 401
    message = "احراز هویت انجام نشده است"


class ForbiddenError(AppError):
    code = "FORBIDDEN"
    status_code = 403
    message = "دسترسی لازم را ندارید"


class NotFoundError(AppError):
    """Also returned for cross-tenant access, to avoid resource disclosure."""

    code = "NOT_FOUND"
    status_code = 404
    message = "منبع مورد نظر یافت نشد"


class ConflictError(AppError):
    code = "CONFLICT"
    status_code = 409
    message = "تضاد در داده‌ها"


class VersionConflictError(ConflictError):
    code = "VERSION_CONFLICT"
    message = "این رکورد توسط شخص دیگری تغییر کرده است. دوباره تلاش کنید"


class TenantContextError(AppError):
    code = "TENANT_CONTEXT_REQUIRED"
    status_code = 400
    message = "سازمان فعال انتخاب نشده است"
