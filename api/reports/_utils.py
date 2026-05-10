# ============================================================
# 📂 api/reports/_utils.py
# 🧠 Primey Care | Reports API Utilities V2
# ------------------------------------------------------------
# ✅ أدوات آمنة للتقارير بدون الاعتماد القاسي على أسماء الحقول
# ✅ متوافق مع تطور الموديلات بدون كسر API
# ✅ Unified response: ok / success / data
# ✅ فلاتر موحدة للتقارير المركزية
# ✅ Helpers آمنة للعدّ والتجميع والمبالغ
# ============================================================

from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

from django.apps import apps
from django.db.models import Count, QuerySet, Sum
from django.http import JsonResponse
from django.utils import timezone


# ============================================================
# JSON Responses
# ============================================================

def _decimal_to_json(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

    if isinstance(value, dict):
        return {str(key): _decimal_to_json(val) for key, val in value.items()}

    if isinstance(value, list):
        return [_decimal_to_json(item) for item in value]

    if isinstance(value, tuple):
        return tuple(_decimal_to_json(item) for item in value)

    return value


def json_success(
    data: dict[str, Any],
    status: int = 200,
    message: str = "تم تنفيذ العملية بنجاح.",
) -> JsonResponse:
    return JsonResponse(
        {
            "ok": True,
            "success": True,
            "message": message,
            "data": _decimal_to_json(data),
        },
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def json_error(
    message: str,
    status: int = 400,
    errors: Any = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": False,
        "success": False,
        "message": message,
        "data": None,
    }

    if errors is not None:
        payload["errors"] = _decimal_to_json(errors)

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


# ============================================================
# Model / Field Helpers
# ============================================================

def get_model_safe(app_label: str, model_name: str):
    try:
        return apps.get_model(app_label, model_name)
    except LookupError:
        return None


def model_fields(model) -> set[str]:
    if not model:
        return set()

    try:
        return {field.name for field in model._meta.get_fields()}
    except Exception:
        return set()


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

    try:
        return manager.all()
    except Exception:
        return None


# ============================================================
# Parse / Normalize Helpers
# ============================================================

def clean_str(value: Any, default: str = "") -> str:
    if value is None:
        return default

    cleaned = str(value).strip()
    return cleaned if cleaned else default


def parse_bool(value: Any, default: bool | None = None) -> bool | None:
    if value in (None, ""):
        return default

    if isinstance(value, bool):
        return value

    normalized = str(value).strip().lower()

    if normalized in {"1", "true", "yes", "y", "on"}:
        return True

    if normalized in {"0", "false", "no", "n", "off"}:
        return False

    return default


def parse_date(value: str | None):
    if not value:
        return None

    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def to_decimal(value: Any) -> Decimal:
    if value is None:
        value = "0.00"

    try:
        return Decimal(str(value)).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0.00")


def decimal_to_float(value: Any) -> float:
    try:
        return float(to_decimal(value))
    except Exception:
        return 0.0


def normalize_money(value: Any) -> float:
    return round(decimal_to_float(value), 2)


def normalize_money_string(value: Any) -> str:
    return str(to_decimal(value))


# ============================================================
# Query Filters
# ============================================================

def apply_date_filters(
    queryset: QuerySet,
    model,
    date_from: str | None = None,
    date_to: str | None = None,
) -> QuerySet:
    if queryset is None:
        return queryset

    date_field = first_existing_field(
        model,
        [
            "created_at",
            "created",
            "issued_at",
            "issue_date",
            "paid_at",
            "confirmed_at",
            "date",
            "transaction_date",
            "entry_date",
            "posting_date",
            "updated_at",
        ],
    )

    if not date_field:
        return queryset

    start_date = parse_date(date_from)
    end_date = parse_date(date_to)

    if start_date:
        if date_field in {"issue_date", "date", "transaction_date", "entry_date", "posting_date"}:
            queryset = queryset.filter(**{f"{date_field}__gte": start_date})
        else:
            queryset = queryset.filter(**{f"{date_field}__date__gte": start_date})

    if end_date:
        if date_field in {"issue_date", "date", "transaction_date", "entry_date", "posting_date"}:
            queryset = queryset.filter(**{f"{date_field}__lte": end_date})
        else:
            queryset = queryset.filter(**{f"{date_field}__date__lte": end_date})

    return queryset


def apply_exact_filter(
    queryset: QuerySet,
    model,
    field_name: str,
    value: str | None,
) -> QuerySet:
    if queryset is None:
        return queryset

    if not value or not has_field(model, field_name):
        return queryset

    return queryset.filter(**{field_name: value})


def apply_bool_filter(
    queryset: QuerySet,
    model,
    field_name: str,
    value: Any,
) -> QuerySet:
    if queryset is None:
        return queryset

    parsed = parse_bool(value, None)

    if parsed is None or not has_field(model, field_name):
        return queryset

    return queryset.filter(**{field_name: parsed})


def apply_id_filter(
    queryset: QuerySet,
    model,
    relation_field: str,
    value: Any,
) -> QuerySet:
    if queryset is None:
        return queryset

    if value in (None, ""):
        return queryset

    if not has_field(model, relation_field):
        return queryset

    return queryset.filter(**{f"{relation_field}_id": value})


# ============================================================
# Safe Aggregations
# ============================================================

def safe_count(queryset: QuerySet | None) -> int:
    if queryset is None:
        return 0

    try:
        return int(queryset.count() or 0)
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
        return to_decimal(value)
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
                "field": group_field,
                "count": row.get("count") or 0,
            }
            for row in rows
        ]
    except Exception:
        return []


def safe_group_sum(
    queryset: QuerySet | None,
    field_candidates: list[str],
    amount_candidates: list[str],
    limit: int = 20,
) -> list[dict[str, Any]]:
    if queryset is None:
        return []

    model = queryset.model
    group_field = first_existing_field(model, field_candidates)
    amount_field = first_existing_field(model, amount_candidates)

    if not group_field or not amount_field:
        return []

    try:
        rows = (
            queryset.values(group_field)
            .annotate(
                count=Count("id"),
                amount=Sum(amount_field),
            )
            .order_by("-amount")[:limit]
        )

        return [
            {
                "key": row.get(group_field) or "unknown",
                "field": group_field,
                "count": row.get("count") or 0,
                "amount": normalize_money(row.get("amount")),
            }
            for row in rows
        ]
    except Exception:
        return []


# ============================================================
# Common Filters
# ============================================================

def common_filters_from_request(request) -> dict[str, str | None]:
    return {
        # Date filters
        "date_from": request.GET.get("date_from"),
        "date_to": request.GET.get("date_to"),
        "created_from": request.GET.get("created_from"),
        "created_to": request.GET.get("created_to"),
        "paid_from": request.GET.get("paid_from"),
        "paid_to": request.GET.get("paid_to"),

        # Generic status filters
        "status": request.GET.get("status"),
        "entry_status": request.GET.get("entry_status"),
        "invoice_type": request.GET.get("invoice_type"),
        "payment_status": request.GET.get("payment_status"),
        "fulfillment_status": request.GET.get("fulfillment_status"),
        "source": request.GET.get("source"),
        "source_type": request.GET.get("source_type"),
        "source_id": request.GET.get("source_id"),

        # Payment filters
        "payment_method": request.GET.get("payment_method") or request.GET.get("method"),
        "provider": request.GET.get("provider"),
        "is_treasury_posted": request.GET.get("is_treasury_posted"),
        "is_accounting_posted": request.GET.get("is_accounting_posted"),

        # Accounting filters
        "account_id": request.GET.get("account_id"),
        "cost_center_id": request.GET.get("cost_center_id"),
        "period_id": request.GET.get("period_id"),
        "fiscal_year_id": request.GET.get("fiscal_year_id"),
        "tax_rate_id": request.GET.get("tax_rate_id"),
        "direction": request.GET.get("direction"),
        "party_type": request.GET.get("party_type"),
        "party_id": request.GET.get("party_id"),
        "currency": request.GET.get("currency"),

        # Entity filters
        "customer": request.GET.get("customer"),
        "customer_id": request.GET.get("customer_id"),
        "agent": request.GET.get("agent"),
        "agent_id": request.GET.get("agent_id"),
        "product": request.GET.get("product"),
        "product_id": request.GET.get("product_id"),
        "provider_id": request.GET.get("provider_id"),
        "order_id": request.GET.get("order_id"),
        "invoice_id": request.GET.get("invoice_id"),
        "contract_id": request.GET.get("contract_id"),

        # Search
        "q": request.GET.get("q") or request.GET.get("search"),
        "search": request.GET.get("search") or request.GET.get("q"),
    }


# ============================================================
# Report Meta
# ============================================================

def report_meta(report_key: str, title_ar: str, title_en: str) -> dict[str, Any]:
    return {
        "key": report_key,
        "title_ar": title_ar,
        "title_en": title_en,
        "generated_at": timezone.now().isoformat(),
        "currency": "SAR",
    }