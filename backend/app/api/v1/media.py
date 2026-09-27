"""Property photos API + public file serving.

    POST   /properties/{id}/media              upload one image (multipart field "file")
    GET    /properties/{id}/media              list images (ordered)
    PUT    /properties/{id}/media/order        reorder: {"media_ids": [...]}
    POST   /properties/{id}/media/{mid}/primary  make this the cover image
    DELETE /properties/{id}/media/{mid}        delete image (files removed from disk)
    GET    /media/{key}[?size=thumb]           public, cacheable image bytes
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.core import permissions as perm
from app.core.errors import NotFoundError
from app.core.responses import ok
from app.core.tenant import TenantContext
from app.db.session import get_db
from app.modules.properties.media_service import PropertyMediaService, file_for_key, media_to_dict

router = APIRouter(tags=["media"])


class MediaOrder(BaseModel):
    media_ids: list[int] = Field(min_length=1, max_length=100)


@router.post("/properties/{property_id}/media", status_code=201)
async def upload_media(
    property_id: int,
    file: UploadFile = File(...),
    ctx: TenantContext = Depends(require_permission(perm.PROPERTY_UPDATE)),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """آپلود یک تصویر ملک — پردازش، حذف متادیتا (از جمله GPS) و ساخت تصویر کوچک"""
    raw = await file.read()
    media = await PropertyMediaService(session).upload(property_id, file.filename, raw)
    return ok(media_to_dict(media))


@router.get("/properties/{property_id}/media")
async def list_media(
    property_id: int,
    ctx: TenantContext = Depends(require_permission(perm.PROPERTY_READ)),
    session: AsyncSession = Depends(get_db),
) -> dict:
    items = await PropertyMediaService(session).list(property_id)
    return ok([media_to_dict(m) for m in items])


@router.put("/properties/{property_id}/media/order")
async def reorder_media(
    property_id: int,
    payload: MediaOrder,
    ctx: TenantContext = Depends(require_permission(perm.PROPERTY_UPDATE)),
    session: AsyncSession = Depends(get_db),
) -> dict:
    items = await PropertyMediaService(session).reorder(property_id, payload.media_ids)
    return ok([media_to_dict(m) for m in items])


@router.post("/properties/{property_id}/media/{media_id}/primary")
async def set_primary_media(
    property_id: int,
    media_id: int,
    ctx: TenantContext = Depends(require_permission(perm.PROPERTY_UPDATE)),
    session: AsyncSession = Depends(get_db),
) -> dict:
    items = await PropertyMediaService(session).set_primary(property_id, media_id)
    return ok([media_to_dict(m) for m in items])


@router.delete("/properties/{property_id}/media/{media_id}")
async def delete_media(
    property_id: int,
    media_id: int,
    ctx: TenantContext = Depends(require_permission(perm.PROPERTY_UPDATE)),
    session: AsyncSession = Depends(get_db),
) -> dict:
    items = await PropertyMediaService(session).delete(property_id, media_id)
    return ok([media_to_dict(m) for m in items])


@router.get("/media/{key:path}", include_in_schema=True)
async def serve_media(key: str, size: str | None = Query(default=None, pattern="^(thumb|full)$")) -> FileResponse:
    """فایل تصویر — عمومی و قابل کش (نام فایل‌ها تصادفی و تغییرناپذیر است)"""
    path = file_for_key(key, thumb=size == "thumb")
    if path is None or not path.is_file():
        raise NotFoundError("تصویر یافت نشد")
    return FileResponse(
        path,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
