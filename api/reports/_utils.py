# ============================================================
# 📂 api/reports/_utils.py
# 🧠 Primey Care | Reports API Utilities
# ------------------------------------------------------------
# ✅ أدوات آمنة للتقارير بدون الاعتماد القاسي على أسماء الحقول
# ✅ متوافق مع تطور الموديلات بدون كسر API
# ============================================================

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from django.apps import apps
from django.db.models import Sum, Count, QuerySet
from django.http import JsonResponse
from django.utils import timezone


def json_success(data: dict[str, Any], status: int = 200) -> JsonResponse:
    return JsonResponse(
        {
            "success": True,
            "data": data,
        },
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def json_error(message: str, status: int = 400) -> JsonResponse:
    return JsonResponse(
        {
            "success": False,
            "message": message,
            "data": None,
        },
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def get_model_safe(app_label: str, model_name: str):
    try:
        return apps.get_model(app_label, model_name)
    except LookupError:
        return None


def model_fields(model) -> set[str]:
    if not model:
        return set()

    return {field.name for field in model._meta.get_fields()}


def has_field(model, field_name: str) -> bool:
    return field_name in model_fields(model)


def first_existing_field(model, candidates: list[str]) -> str | None:
    fields = model_fields(model)

    for candidate in candidates:
        if candidate in fields:
            return candidate

    return None


def get_base_queryset(app_label: str, model_name: str) -> QuerySet | None:
    model = get_model_safe(app_label, model_name)

    if not model:
        return None

    manager = getattr(model, "objects", None)

    if not manager:
        return None

    return manager.all()


def parse_date(value: str | None):
    if not value:
        return None

    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def apply_date_filters(
    queryset: QuerySet,
    model,
    date_from: str | None = None,
    date_to: str | None = None,
) -> QuerySet:
    date_field = first_existing_field(
        model,
        [
            "created_at",
            "created",
            "issued_at",
            "paid_at",
            "confirmed_at",
            "date",
            "transaction_date",
            "entry_date",
        ],
    )

    if not date_field:
        return queryset

    start_date = parse_date(date_from)
    end_date = parse_date(date_to)

    if start_date:
        queryset = queryset.filter(**{f"{date_field}__date__gte": start_date})

    if end_date:
        queryset = queryset.filter(**{f"{date_field}__date__lte": end_date})

    return queryset


def apply_exact_filter(
    queryset: QuerySet,
    model,
    field_name: str,
    value: str | None,
) -> QuerySet:
    if not value or not has_field(model, field_name):
        return queryset

    return queryset.filter(**{field_name: value})


def safe_count(queryset: QuerySet | None) -> int:
    if queryset is None:
        return 0

    try:
        return queryset.count()
    except Exception:
        return 0


def safe_sum(queryset: QuerySet | None, candidates: list[str]) -> Decimal:
    if queryset is None:
        return Decimal("0.00")

    model = queryset.model
    amount_field = first_existing_field(model, candidates)

    if not amount_field:
        return Decimal("0.00")

    try:
        value = queryset.aggregate(total=Sum(amount_field)).get("total")
        return value or Decimal("0.00")
    except Exception:
        return Decimal("0.00")


def safe_group_count(
    queryset: QuerySet | None,
    field_candidates: list[str],
    limit: int = 20,
) -> list[dict[str, Any]]:
    if queryset is None:
        return []

    model = queryset.model
    group_field = first_existing_field(model, field_candidates)

    if not group_field:
        return []

    try:
        rows = (
            queryset.values(group_field)
            .annotate(count=Count("id"))
            .order_by("-count")[:limit]
        )

        return [
            {
                "key": row.get(group_field) or "unknown",
                "count": row.get("count") or 0,
            }
            for row in rows
        ]
    except Exception:
        return []


def decimal_to_float(value: Any) -> float:
    if isinstance(value, Decimal):
        return float(value)

    try:
        return float(value or 0)
    except Exception:
        return 0.0


def normalize_money(value: Any) -> float:
    return round(decimal_to_float(value), 2)


def common_filters_from_request(request) -> dict[str, str | None]:
    return {
        "date_from": request.GET.get("date_from"),
        "date_to": request.GET.get("date_to"),
        "status": request.GET.get("status"),
        "payment_method": request.GET.get("payment_method"),
        "provider": request.GET.get("provider"),
        "customer": request.GET.get("customer"),
        "agent": request.GET.get("agent"),
        "product": request.GET.get("product"),
    }


def report_meta(report_key: str, title_ar: str, title_en: str) -> dict[str, Any]:
    return {
        "key": report_key,
        "title_ar": title_ar,
        "title_en": title_en,
        "generated_at": timezone.now().isoformat(),
        "currency": "SAR",
    }