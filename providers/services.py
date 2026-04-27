# ============================================================
# 📂 providers/services.py
# 🧠 Primey Care | Providers Services
# ------------------------------------------------------------
# ✅ خدمات مساعدة رسمية لموديول الجهات المقدمة للخدمة
# ✅ Parsing / Validation / Serialization
# ✅ Filtering / Pagination
# ✅ Create / Update helpers
# ============================================================

from __future__ import annotations

import json
from typing import Any

from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.db.models import Q, QuerySet

from providers.models import Provider, ProviderStatus, ProviderType


# ============================================================
# 🔹 JSON Helpers
# ============================================================

def parse_json_body(request) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        return json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValidationError(f"Invalid JSON body: {exc}")


# ============================================================
# 🔹 Primitive Parsers
# ============================================================

def normalize_text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def parse_bool(value: Any, default: bool | None = None) -> bool | None:
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return bool(value)

    value_str = str(value).strip().lower()

    if value_str in {"1", "true", "yes", "on"}:
        return True

    if value_str in {"0", "false", "no", "off"}:
        return False

    return default


def parse_int(value: Any, default: int | None = None) -> int | None:
    if value in (None, ""):
        return default

    try:
        return int(value)
    except (TypeError, ValueError):
        return default


# ============================================================
# 🔹 Query Helpers
# ============================================================

def paginate_queryset(queryset: QuerySet, page: int = 1, page_size: int = 20) -> dict[str, Any]:
    safe_page = max(page or 1, 1)
    safe_page_size = min(max(page_size or 20, 1), 100)

    paginator = Paginator(queryset, safe_page_size)
    current_page = paginator.get_page(safe_page)

    return {
        "items": list(current_page.object_list),
        "pagination": {
            "page": current_page.number,
            "page_size": safe_page_size,
            "total_pages": paginator.num_pages,
            "total_items": paginator.count,
            "has_next": current_page.has_next(),
            "has_previous": current_page.has_previous(),
        },
    }


def apply_provider_filters(queryset: QuerySet[Provider], params) -> QuerySet[Provider]:
    q = normalize_text(params.get("q"))
    provider_type = normalize_text(params.get("provider_type"))
    status = normalize_text(params.get("status"))
    city = normalize_text(params.get("city"))
    area = normalize_text(params.get("area"))
    is_featured = parse_bool(params.get("is_featured"))

    if q:
        queryset = queryset.filter(
            Q(name__icontains=q)
            | Q(code__icontains=q)
            | Q(contact_person__icontains=q)
            | Q(phone__icontains=q)
            | Q(mobile__icontains=q)
            | Q(email__icontains=q)
            | Q(city__icontains=q)
            | Q(area__icontains=q)
            | Q(address__icontains=q)
            | Q(notes__icontains=q)
        )

    if provider_type:
        queryset = queryset.filter(provider_type=provider_type)

    if status:
        queryset = queryset.filter(status=status)

    if city:
        queryset = queryset.filter(city__icontains=city)

    if area:
        queryset = queryset.filter(area__icontains=area)

    if is_featured is not None:
        queryset = queryset.filter(is_featured=is_featured)

    return queryset


# ============================================================
# 🔹 Validation Helpers
# ============================================================

def _validate_provider_type(value: str) -> str:
    allowed = {choice for choice, _ in ProviderType.choices}
    if value not in allowed:
        raise ValidationError(f"Invalid provider_type. Allowed values: {sorted(allowed)}")
    return value


def _validate_provider_status(value: str) -> str:
    allowed = {choice for choice, _ in ProviderStatus.choices}
    if value not in allowed:
        raise ValidationError(f"Invalid status. Allowed values: {sorted(allowed)}")
    return value


def _validate_unique_name(name: str, *, exclude_id: int | None = None) -> None:
    queryset = Provider.objects.filter(name__iexact=name)
    if exclude_id:
        queryset = queryset.exclude(pk=exclude_id)

    if queryset.exists():
        raise ValidationError("A provider with this name already exists.")


def _validate_unique_code(code: str, *, exclude_id: int | None = None) -> None:
    queryset = Provider.objects.filter(code__iexact=code)
    if exclude_id:
        queryset = queryset.exclude(pk=exclude_id)

    if queryset.exists():
        raise ValidationError("A provider with this code already exists.")


# ============================================================
# 🔹 Serialization
# ============================================================

def serialize_provider(obj: Provider) -> dict[str, Any]:
    return {
        "id": obj.id,
        "name": obj.name,
        "code": obj.code,
        "provider_type": obj.provider_type,
        "status": obj.status,
        "contact_person": obj.contact_person,
        "phone": obj.phone,
        "mobile": obj.mobile,
        "email": obj.email,
        "website": obj.website,
        "city": obj.city,
        "area": obj.area,
        "address": obj.address,
        "google_maps_link": obj.google_maps_link,
        "notes": obj.notes,
        "is_featured": obj.is_featured,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }


# ============================================================
# 🔹 Create Provider
# ============================================================

def create_provider(*, payload: dict[str, Any]) -> Provider:
    name = normalize_text(payload.get("name"))
    code = normalize_text(payload.get("code")).upper()
    provider_type = normalize_text(payload.get("provider_type")) or ProviderType.OTHER
    status = normalize_text(payload.get("status")) or ProviderStatus.ACTIVE

    if not name:
        raise ValidationError("Provider name is required.")

    if not code:
        raise ValidationError("Provider code is required.")

    provider_type = _validate_provider_type(provider_type)
    status = _validate_provider_status(status)

    _validate_unique_name(name)
    _validate_unique_code(code)

    provider = Provider(
        name=name,
        code=code,
        provider_type=provider_type,
        status=status,
        contact_person=normalize_text(payload.get("contact_person")),
        phone=normalize_text(payload.get("phone")),
        mobile=normalize_text(payload.get("mobile")),
        email=normalize_text(payload.get("email")),
        website=normalize_text(payload.get("website")),
        city=normalize_text(payload.get("city")),
        area=normalize_text(payload.get("area")),
        address=normalize_text(payload.get("address")),
        google_maps_link=normalize_text(payload.get("google_maps_link")),
        notes=normalize_text(payload.get("notes")),
        is_featured=parse_bool(payload.get("is_featured"), False) or False,
    )

    provider.full_clean()
    provider.save()
    return provider


# ============================================================
# 🔹 Update Provider
# ============================================================

def update_provider(*, instance: Provider, payload: dict[str, Any]) -> Provider:
    if "name" in payload:
        instance.name = normalize_text(payload.get("name"))

    if "code" in payload:
        instance.code = normalize_text(payload.get("code")).upper()

    if "provider_type" in payload:
        instance.provider_type = normalize_text(payload.get("provider_type"))

    if "status" in payload:
        instance.status = normalize_text(payload.get("status"))

    if "contact_person" in payload:
        instance.contact_person = normalize_text(payload.get("contact_person"))

    if "phone" in payload:
        instance.phone = normalize_text(payload.get("phone"))

    if "mobile" in payload:
        instance.mobile = normalize_text(payload.get("mobile"))

    if "email" in payload:
        instance.email = normalize_text(payload.get("email"))

    if "website" in payload:
        instance.website = normalize_text(payload.get("website"))

    if "city" in payload:
        instance.city = normalize_text(payload.get("city"))

    if "area" in payload:
        instance.area = normalize_text(payload.get("area"))

    if "address" in payload:
        instance.address = normalize_text(payload.get("address"))

    if "google_maps_link" in payload:
        instance.google_maps_link = normalize_text(payload.get("google_maps_link"))

    if "notes" in payload:
        instance.notes = normalize_text(payload.get("notes"))

    if "is_featured" in payload:
        instance.is_featured = parse_bool(payload.get("is_featured"), instance.is_featured)

    if not instance.name:
        raise ValidationError("Provider name is required.")

    if not instance.code:
        raise ValidationError("Provider code is required.")

    instance.provider_type = _validate_provider_type(instance.provider_type)
    instance.status = _validate_provider_status(instance.status)

    _validate_unique_name(instance.name, exclude_id=instance.id)
    _validate_unique_code(instance.code, exclude_id=instance.id)

    instance.full_clean()
    instance.save()
    return instance