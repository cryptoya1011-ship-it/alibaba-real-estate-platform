"""Uniform response envelope: {success, data, meta, error}."""
from __future__ import annotations

from typing import Any

from fastapi.responses import JSONResponse


def ok(data: Any = None, meta: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"success": True, "data": data, "meta": meta, "error": None}


def fail(
    code: str, message: str, details: Any = None, meta: dict[str, Any] | None = None
) -> dict[str, Any]:
    return {
        "success": False,
        "data": None,
        "meta": meta,
        "error": {"code": code, "message": message, "details": details or []},
    }


def json_fail(
    status_code: int,
    code: str,
    message: str,
    details: Any = None,
    request_id: str | None = None,
) -> JSONResponse:
    meta = {"request_id": request_id} if request_id else None
    return JSONResponse(
        status_code=status_code, content=fail(code, message, details, meta)
    )


def page_meta(total: int, limit: int, offset: int, next_cursor: str | None = None) -> dict[str, Any]:
    """Pagination meta shaped so cursor pagination can be added without breaking clients."""
    return {
        "pagination": {
            "total": total,
            "limit": limit,
            "offset": offset,
            "next_cursor": next_cursor,
        }
    }
