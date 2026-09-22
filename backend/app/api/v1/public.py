"""Public API — no auth, for www + SEO + Deep Links (Phase 12)

- Public DTO only (no owner, no exact_address)
- Only status = published
- Endpoints: /public/properties, /public/properties/by-code/{code}, /public/properties/{id}
- Also /public/health for public check
- Open Graph HTML for /p/{code} via /public/og/{code} (returns HTML with meta tags)
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.responses import ok, page_meta
from app.db.session import get_db, get_db_public
from app.modules.properties.models import Property, PropertyLocation, PropertyMedia

router = APIRouter(prefix="/public", tags=["public"])


def _public_property_to_dict(prop) -> dict[str, Any]:
    """Public DTO — only allowed fields (بند 61)"""
    city = None
    district = None
    city_code = None
    district_code = None
    public_lat = None
    public_lng = None
    neighborhood = None
    if prop.location:
        city = prop.location.city
        district = prop.location.district
        city_code = prop.location.city_code
        district_code = prop.location.district_code
        public_lat = prop.location.public_lat
        public_lng = prop.location.public_lng
        neighborhood = prop.location.neighborhood

    usages = [{"usage_type": u.usage_type, "is_primary": u.is_primary} for u in (prop.usages or [])]

    primary_image = None
    images = []
    if prop.media:
        for m in prop.media:
            if m.file_type == "image":
                images.append(m.file_path)
                if m.is_primary and not primary_image:
                    primary_image = m.file_path
        if not primary_image and images:
            primary_image = images[0]

    return {
        "id": prop.id,
        "code": prop.code,
        "title": prop.title,
        "description": prop.description,
        "property_type": prop.property_type,
        "transaction_type": prop.transaction_type,
        "status": prop.status,
        "price": prop.price,
        "rent_price": prop.rent_price,
        "deposit": prop.deposit,
        "land_area": prop.land_area,
        "built_area": prop.built_area,
        "useful_area": prop.useful_area,
        "rooms": prop.rooms,
        "bedrooms": prop.bedrooms,
        "bathrooms": prop.bathrooms,
        "floor_number": prop.floor_number,
        "total_floors": prop.total_floors,
        "has_parking": prop.has_parking,
        "has_elevator": prop.has_elevator,
        "has_warehouse": prop.has_warehouse,
        "has_balcony": prop.has_balcony,
        "city": city,
        "district": district,
        "city_code": city_code,
        "district_code": district_code,
        "neighborhood": neighborhood,
        "public_lat": public_lat,
        "public_lng": public_lng,
        "usages": usages,
        "primary_image": primary_image,
        "images": images[:10],
        "created_at": prop.created_at,
        "updated_at": prop.updated_at,
    }


def _public_property_to_list_item(prop) -> dict[str, Any]:
    """Lightweight list item for public search"""
    city = None
    district = None
    city_code = None
    district_code = None
    if prop.location:
        city = prop.location.city
        district = prop.location.district
        city_code = prop.location.city_code
        district_code = prop.location.district_code

    primary_image = None
    if prop.media:
        for m in prop.media:
            if m.is_primary and m.file_type == "image":
                primary_image = m.file_path
                break
        if not primary_image:
            for m in prop.media:
                if m.file_type == "image":
                    primary_image = m.file_path
                    break

    return {
        "id": prop.id,
        "code": prop.code,
        "title": prop.title,
        "property_type": prop.property_type,
        "transaction_type": prop.transaction_type,
        "price": prop.price,
        "rent_price": prop.rent_price,
        "land_area": prop.land_area,
        "built_area": prop.built_area,
        "rooms": prop.rooms,
        "has_parking": prop.has_parking,
        "has_elevator": prop.has_elevator,
        "city": city,
        "district": district,
        "city_code": city_code,
        "district_code": district_code,
        "primary_image": primary_image,
        "created_at": prop.created_at,
    }


async def _base_public_query(session: AsyncSession):
    """Base query for public properties — status published, not deleted"""
    # We use direct select without tenant filter
    from sqlalchemy.orm import selectinload

    stmt = (
        select(Property)
        .where(Property.is_deleted == False)  # noqa: E712
        .where(Property.status == "published")
        .options(
            selectinload(Property.location),
            selectinload(Property.usages),
            selectinload(Property.media),
        )
    )
    return stmt


@router.get("/properties")
async def public_list_properties(
    session: AsyncSession = Depends(get_db_public),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    property_type: str | None = Query(default=None),
    transaction_type: str | None = Query(default=None),
    city_code: str | None = Query(default=None),
    district_code: str | None = Query(default=None),
    min_price: int | None = Query(default=None, ge=0),
    max_price: int | None = Query(default=None, ge=0),
    min_area: float | None = Query(default=None, ge=0),
    max_area: float | None = Query(default=None, ge=0),
    has_parking: bool | None = Query(default=None),
    has_elevator: bool | None = Query(default=None),
    rooms: int | None = Query(default=None, ge=0),
    q: str | None = Query(default=None, description="Search in title, description, code"),
) -> dict:
    """لیست املاک عمومی — بدون احراز هویت، فقط منتشر شده‌ها"""
    stmt = await _base_public_query(session)

    if property_type:
        stmt = stmt.where(Property.property_type == property_type)
    if transaction_type:
        stmt = stmt.where(Property.transaction_type == transaction_type)
    if min_price is not None:
        stmt = stmt.where(Property.price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Property.price <= max_price)
    if min_area is not None:
        stmt = stmt.where((Property.built_area >= min_area) | (Property.land_area >= min_area))
    if max_area is not None:
        stmt = stmt.where((Property.built_area <= max_area) | (Property.land_area <= max_area))
    if has_parking is not None:
        stmt = stmt.where(Property.has_parking == has_parking)
    if has_elevator is not None:
        stmt = stmt.where(Property.has_elevator == has_elevator)
    if rooms is not None:
        stmt = stmt.where(Property.rooms == rooms)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (Property.title.ilike(like))
            | (Property.description.ilike(like))
            | (Property.code.ilike(like))
        )

    if city_code or district_code:
        stmt = stmt.join(PropertyLocation, PropertyLocation.property_id == Property.id, isouter=True)
        if city_code:
            stmt = stmt.where(PropertyLocation.city_code == city_code)
        if district_code:
            stmt = stmt.where(PropertyLocation.district_code == district_code)

    # Count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await session.execute(count_stmt)).scalar_one()

    stmt = stmt.order_by(Property.id.desc()).limit(limit).offset(offset)
    rows = (await session.execute(stmt)).scalars().all()

    data = [_public_property_to_list_item(p) for p in rows]
    return ok(data, page_meta(total=total, limit=limit, offset=offset))


@router.get("/properties/by-code/{code}")
async def public_get_by_code(
    code: str,
    session: AsyncSession = Depends(get_db_public),
) -> dict:
    """دریافت ملک عمومی با کد یکتا — برای Deep Link /p/{code} (بند 62) — بدون احراز هویت"""
    stmt = await _base_public_query(session)
    stmt = stmt.where(Property.code == code)
    prop = (await session.execute(stmt)).scalar_one_or_none()
    if not prop:
        # Also try to find even if not published? For SEO we return 404 if not published
        from app.core.errors import NotFoundError

        raise NotFoundError("ملک یافت نشد یا منتشر نشده است")
    return ok(_public_property_to_dict(prop))


@router.get("/properties/{property_id}")
async def public_get_by_id(
    property_id: int,
    session: AsyncSession = Depends(get_db_public),
) -> dict:
    """دریافت ملک عمومی با ID"""
    stmt = await _base_public_query(session)
    stmt = stmt.where(Property.id == property_id)
    prop = (await session.execute(stmt)).scalar_one_or_none()
    if not prop:
        from app.core.errors import NotFoundError

        raise NotFoundError("ملک یافت نشد یا منتشر نشده است")
    return ok(_public_property_to_dict(prop))


@router.get("/og/{code}", response_class=HTMLResponse)
async def public_og_page(
    code: str,
    session: AsyncSession = Depends(get_db_public),
) -> HTMLResponse:
    """صفحه HTML با Open Graph برای SEO — برای /p/{code} (بند 62)

    این endpoint یک HTML ساده با OG tags برمی‌گرداند تا crawlerها (Telegram, WhatsApp, Google) بتوانند preview بگیرند.
    Frontend می‌تواند همین را fetch کند یا مستقیم به /p/{code} ریدایرکت شود.
    """
    stmt = await _base_public_query(session)
    stmt = stmt.where(Property.code == code)
    prop = (await session.execute(stmt)).scalar_one_or_none()

    if not prop:
        html_404 = """
        <!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>یافت نشد</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:40px"><h1>ملک یافت نشد</h1><p>این ملک وجود ندارد یا منتشر نشده است.</p></body></html>
        """
        return HTMLResponse(content=html_404, status_code=404)

    public_data = _public_property_to_dict(prop)
    title = public_data["title"]
    desc = (public_data["description"] or "")[:160] or f"{public_data['property_type']} {public_data['transaction_type']} در {public_data['city'] or ''} {public_data['district'] or ''}"
    image = public_data["primary_image"] or "/icons/icon-512.png"
    # If image is relative, make absolute for OG (crawler needs absolute, but we keep relative for now)
    # Frontend will handle absolute via window.location.origin
    price_text = f"{public_data['price']:,}" if public_data["price"] else ""
    city = public_data["city"] or ""
    district = public_data["district"] or ""

    # Structured Data JSON-LD for Real Estate
    json_ld = f"""{{
      "@context": "https://schema.org",
      "@type": "RealEstateListing",
      "name": "{title}",
      "description": "{desc}",
      "url": "/p/{code}",
      "image": "{image}",
      "offers": {{
        "@type": "Offer",
        "price": "{public_data['price'] or 0}",
        "priceCurrency": "IRR"
      }},
      "address": {{
        "@type": "PostalAddress",
        "addressLocality": "{city}",
        "addressRegion": "{district}"
      }}
    }}"""

    html = f"""<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} — املاک علی‌بابا</title>
<meta name="description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="املاک علی‌بابا">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc} — {price_text} تومان — {city} {district}">
<meta property="og:image" content="{image}">
<meta property="og:url" content="/p/{code}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{image}">
<script type="application/ld+json">{json_ld}</script>
<style>body{{font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:16px;background:#F5F5F5;color:#212121}} .card{{background:white;border-radius:12px;padding:16px;border:1px solid #E0E0E0}} a{{color:#1B3A5C;text-decoration:none;font-weight:bold}} img{{max-width:100%;border-radius:8px}}</style>
</head>
<body>
<div class="card">
<h1 style="color:#1B3A5C;margin:0 0 8px 0">{title}</h1>
<p style="color:#757575;font-size:13px;margin:0 0 12px 0">{code} — {city} {district} — {price_text} تومان</p>
{f'<img src="{image}" alt="{title}">' if image else ''}
<p style="margin:12px 0">{desc}</p>
<p><a href="/p/{code}">مشاهده در اپلیکیشن →</a></p>
<p style="font-size:12px;color:#9E9E9E">املاک علی‌بابا — پلتفرم مدیریت املاک — PWA</p>
</div>
<script>
// Redirect to SPA if JS enabled and not a crawler
if (!navigator.userAgent.match(/bot|crawler|spider|facebook|telegram|whatsapp/i)) {{
  // Keep path for SPA router
  window.location.href = "/p/{code}";
}}
</script>
</body>
</html>
"""
    return HTMLResponse(content=html)
