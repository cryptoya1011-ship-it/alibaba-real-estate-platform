"""Property photos: upload, processing, ordering, primary selection, deletion.

Storage layout (filesystem backend, under settings.MEDIA_ROOT):

    {organization_id}/{property_id}/{hex}.jpg     full image (max MEDIA_MAX_DIMENSION)
    {organization_id}/{property_id}/{hex}_t.jpg   thumbnail  (max MEDIA_THUMB_DIMENSION)

``PropertyMedia.file_path`` stores the extension-less key ``{org}/{property}/{hex}``.
Public URLs are ``{API_V1_PREFIX}/media/{file_path}`` (full) and ``...?size=thumb``.
URLs intentionally have no file extension: the production nginx config serves
every ``*.jpg`` path from the static SPA root, which would shadow the API.

Every upload is decoded and re-encoded with Pillow. That validates the file is a
real image, applies EXIF orientation, and strips all metadata (including GPS
coordinates, which would otherwise leak the exact property location).
"""
from __future__ import annotations

import asyncio
import io
import re
import uuid
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import NotFoundError, ValidationError
from app.core.tenant import current_context
from app.modules.properties.models import Property, PropertyMedia
from app.modules.properties.service import PropertyService

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "GIF", "MPO"}
# Guard against decompression bombs (a tiny file that expands to gigapixels).
Image.MAX_IMAGE_PIXELS = 60_000_000

_KEY_RE = re.compile(r"^\d+/\d+/[0-9a-f]{32}$")


def media_root() -> Path:
    return Path(settings.MEDIA_ROOT).resolve()


def file_for_key(key: str, *, thumb: bool = False) -> Path | None:
    """Map a stored media key to its file on disk, rejecting anything unexpected."""
    if not _KEY_RE.match(key):
        return None
    path = (media_root() / f"{key}{'_t' if thumb else ''}.jpg").resolve()
    if media_root() not in path.parents:
        return None
    return path


@dataclass
class _Processed:
    full: bytes
    thumb: bytes
    width: int
    height: int


def _process(raw: bytes) -> _Processed:
    try:
        with Image.open(io.BytesIO(raw)) as probe:
            fmt = probe.format
            probe.verify()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValidationError("فایل تصویر معتبر نیست") from exc
    if fmt not in ALLOWED_FORMATS:
        raise ValidationError("فقط تصاویر JPG، PNG یا WEBP پذیرفته می‌شوند")

    with Image.open(io.BytesIO(raw)) as img:
        img.seek(0)
        img = ImageOps.exif_transpose(img)
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1])
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")

        full = img.copy()
        full.thumbnail((settings.MEDIA_MAX_DIMENSION, settings.MEDIA_MAX_DIMENSION), Image.Resampling.LANCZOS)
        full_buf = io.BytesIO()
        full.save(full_buf, "JPEG", quality=85, optimize=True, progressive=True)

        thumb = img.copy()
        thumb.thumbnail((settings.MEDIA_THUMB_DIMENSION, settings.MEDIA_THUMB_DIMENSION), Image.Resampling.LANCZOS)
        thumb_buf = io.BytesIO()
        thumb.save(thumb_buf, "JPEG", quality=80, optimize=True, progressive=True)

        return _Processed(full_buf.getvalue(), thumb_buf.getvalue(), full.width, full.height)


def _safe_name(name: str | None) -> str:
    base = Path(name or "photo").name.strip() or "photo"
    return base[:200]


class PropertyMediaService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.properties = PropertyService(session)

    async def _property(self, property_id: int) -> Property:
        # Tenant-scoped lookup: raises NotFound for other organizations' properties.
        return await self.properties.get_by_id(property_id)

    async def _media(self, prop: Property, media_id: int) -> PropertyMedia:
        for m in prop.media:
            if m.id == media_id:
                return m
        raise NotFoundError("تصویر یافت نشد")

    async def upload(self, property_id: int, filename: str | None, raw: bytes) -> PropertyMedia:
        prop = await self._property(property_id)
        max_bytes = settings.MEDIA_MAX_UPLOAD_MB * 1024 * 1024
        if not raw:
            raise ValidationError("فایل خالی است")
        if len(raw) > max_bytes:
            raise ValidationError(f"حجم هر تصویر حداکثر {settings.MEDIA_MAX_UPLOAD_MB} مگابایت است")
        images = [m for m in prop.media if m.file_type == "image"]
        if len(images) >= settings.MEDIA_MAX_PER_PROPERTY:
            raise ValidationError(f"حداکثر {settings.MEDIA_MAX_PER_PROPERTY} تصویر برای هر ملک مجاز است")

        processed = await asyncio.to_thread(_process, raw)

        key = f"{prop.organization_id}/{prop.id}/{uuid.uuid4().hex}"
        full_path = file_for_key(key)
        thumb_path = file_for_key(key, thumb=True)
        assert full_path is not None and thumb_path is not None
        full_path.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(full_path.write_bytes, processed.full)
        await asyncio.to_thread(thumb_path.write_bytes, processed.thumb)

        next_order = (
            await self.session.execute(
                select(func.coalesce(func.max(PropertyMedia.sort_order), -1)).where(
                    PropertyMedia.property_id == prop.id
                )
            )
        ).scalar_one() + 1

        ctx = current_context()
        media = PropertyMedia(
            organization_id=prop.organization_id,
            branch_id=prop.branch_id,
            property_id=prop.id,
            file_path=key,
            file_name=_safe_name(filename),
            file_type="image",
            mime_type="image/jpeg",
            size_bytes=len(processed.full),
            is_primary=not any(m.is_primary for m in images),
            sort_order=int(next_order),
            storage_backend="filesystem",
            created_by=ctx.user_id,
        )
        self.session.add(media)
        try:
            await self.session.flush()
        except Exception:
            full_path.unlink(missing_ok=True)
            thumb_path.unlink(missing_ok=True)
            raise
        await self.session.refresh(prop, attribute_names=["media"])
        return media

    async def list(self, property_id: int) -> list[PropertyMedia]:
        prop = await self._property(property_id)
        return list(prop.media)

    async def set_primary(self, property_id: int, media_id: int) -> list[PropertyMedia]:
        prop = await self._property(property_id)
        target = await self._media(prop, media_id)
        # Convention: the cover is always the first photo. Move it to the front.
        ordered = [target] + [m for m in prop.media if m.id != target.id]
        for index, m in enumerate(ordered):
            m.is_primary = m.id == target.id
            m.sort_order = index
        await self.session.flush()
        await self.session.refresh(prop, attribute_names=["media"])
        return list(prop.media)

    async def reorder(self, property_id: int, media_ids: list[int]) -> list[PropertyMedia]:
        prop = await self._property(property_id)
        current = {m.id: m for m in prop.media}
        if sorted(media_ids) != sorted(current):
            raise ValidationError("فهرست تصاویر با تصاویر ملک مطابقت ندارد")
        for index, mid in enumerate(media_ids):
            current[mid].sort_order = index
            # Convention: the first photo is the cover.
            current[mid].is_primary = index == 0
        await self.session.flush()
        await self.session.refresh(prop, attribute_names=["media"])
        return list(prop.media)

    async def delete(self, property_id: int, media_id: int) -> list[PropertyMedia]:
        prop = await self._property(property_id)
        target = await self._media(prop, media_id)
        was_primary = target.is_primary
        key = target.file_path
        await self.session.delete(target)
        await self.session.flush()
        await self.session.refresh(prop, attribute_names=["media"])
        if was_primary and prop.media:
            prop.media[0].is_primary = True
            await self.session.flush()
        for thumb in (False, True):
            path = file_for_key(key, thumb=thumb)
            if path is not None:
                path.unlink(missing_ok=True)
        return list(prop.media)


def media_to_dict(m: PropertyMedia) -> dict:
    return {
        "id": m.id,
        "file_path": m.file_path,
        "file_name": m.file_name,
        "file_type": m.file_type,
        "mime_type": m.mime_type,
        "is_primary": m.is_primary,
        "sort_order": m.sort_order,
    }
