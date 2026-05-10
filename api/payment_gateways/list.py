# ============================================================
# 📂 api/payment_gateways/list.py
# 🧠 Primey Care | Payment Gateways List APIs V2
# ------------------------------------------------------------
# ✅ Gateway configs list
# ✅ Gateway transactions list
# ✅ Filters: provider/status/reference/customer/date
# ✅ Pagination
# ✅ Summary totals
# ✅ Unified response: ok / success / data / results
# ✅ Compatible with Payments / Accounting / Treasury flow
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.core.paginator import Paginator
from django.db.models import Count, Q, Sum
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from payment_gateways.models import (
    PaymentGatewayConfig,
    PaymentGatewayTransaction,
)


logger = logging.getLogger(__name__)


# ============================================================
# JSON Helpers
# ============================================================

def _decimal_to_string(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

    if isinstance(value, dict):
        return {key: _decimal_to_string(val) for key, val in value.items()}

    if isinstance(value, list):
        return [_decimal_to_string(item) for item in value]

    if isinstance(value, tuple):
        return tuple(_decimal_to_string(item) for item in value)

    return value


def _json_error(
    message: str,
    *,
    status: int = 400,
    errors: Any = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": False,
        "success": False,
        "status": "error",
        "message": message,
    }

    if errors is not None:
        payload["errors"] = _decimal_to_string(errors)

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _json_success(
    data: dict[str, Any],
    *,
    message: str = "تم تنفيذ العملية بنجاح.",
    status: int = 200,
    extra: dict[str, Any] | None = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": True,
        "success": True,
        "status": "ok",
        "message": message,
        "data": _decimal_to_string(data),
    }

    if extra:
        payload.update(_decimal_to_string(extra))

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


# ============================================================
# Safe Helpers
# ============================================================

def _clean_str(value: Any, default: str = "") -> str:
    if value is None:
        return default

    cleaned = str(value).strip()
    return cleaned if cleaned else default


def _to_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _to_bool(value: Any, default: bool | None = None) -> bool | None:
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


def _money(value: Any) -> Decimal:
    if value is None:
        value = "0.00"

    try:
        return Decimal(str(value)).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
    except Exception:
        return Decimal("0.00")


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _mask(value: Any, visible: int = 4) -> str:
    cleaned = _clean_str(value)

    if not cleaned:
        return ""

    if len(cleaned) <= visible:
        return "*" * len(cleaned)

    return f"{'*' * max(len(cleaned) - visible, 0)}{cleaned[-visible:]}"


def _parse_page_params(request) -> tuple[int, int]:
    page = max(_to_int(request.GET.get("page"), 1), 1)
    page_size = min(max(_to_int(request.GET.get("page_size"), 20), 1), 100)
    return page, page_size


def _paginate(queryset, *, page: int, page_size: int) -> dict[str, Any]:
    paginator = Paginator(queryset, page_size)
    current_page = paginator.get_page(page)

    return {
        "items": list(current_page.object_list),
        "pagination": {
            "page": current_page.number,
            "page_size": page_size,
            "total_pages": paginator.num_pages,
            "total_items": paginator.count,
            "has_next": current_page.has_next(),
            "has_previous": current_page.has_previous(),
        },
    }


# ============================================================
# Serializers
# ============================================================

def _serialize_gateway_config(obj: PaymentGatewayConfig) -> dict[str, Any]:
    return {
        "id": obj.id,
        "provider": obj.provider,
        "provider_label": obj.get_provider_display(),
        "display_name": obj.display_name,
        "environment": obj.environment,
        "is_enabled": bool(obj.is_enabled),
        "is_default": bool(obj.is_default),
        "base_url": obj.base_url,
        "timeout_seconds": obj.timeout_seconds,
        "verify_webhook": bool(obj.verify_webhook),
        "merchant_id": obj.merchant_id,
        "source_id": obj.source_id,

        # لا نرجع المفاتيح الخام نهائيًا
        "masked_api_token": getattr(obj, "masked_api_token", "") or _mask(getattr(obj, "api_token", "")),
        "masked_secret_key": getattr(obj, "masked_secret_key", "") or _mask(getattr(obj, "secret_key", "")),
        "masked_public_key": getattr(obj, "masked_public_key", "") or _mask(getattr(obj, "public_key", "")),
        "masked_notification_token": (
            getattr(obj, "masked_notification_token", "")
            or _mask(getattr(obj, "notification_token", ""))
        ),

        "has_api_token": bool(_clean_str(getattr(obj, "api_token", ""))),
        "has_secret_key": bool(_clean_str(getattr(obj, "secret_key", ""))),
        "has_public_key": bool(_clean_str(getattr(obj, "public_key", ""))),
        "has_notification_token": bool(_clean_str(getattr(obj, "notification_token", ""))),

        "created_at": _iso_datetime(obj.created_at),
        "updated_at": _iso_datetime(obj.updated_at),
    }


def _serialize_gateway_transaction(obj: PaymentGatewayTransaction) -> dict[str, Any]:
    return {
        "id": obj.id,
        "transaction_id": obj.id,
        "provider": obj.provider,
        "status": obj.status,
        "gateway_status": obj.gateway_status,
        "payment_method": obj.payment_method,
        "currency": obj.currency,
        "amount": obj.amount,

        "local_reference_type": obj.local_reference_type,
        "local_reference_id": obj.local_reference_id,
        "local_reference": obj.local_reference,

        "customer_name": obj.customer_name,
        "customer_email": obj.customer_email,
        "customer_phone": obj.customer_phone,

        "remote_transaction_id": obj.remote_transaction_id,
        "remote_order_id": obj.remote_order_id,
        "remote_checkout_id": obj.remote_checkout_id,
        "gateway_reference": obj.gateway_reference,

        "payment_url": obj.payment_url,
        "redirect_url": obj.redirect_url,

        "is_webhook_verified": bool(obj.is_webhook_verified),
        "last_webhook_at": _iso_datetime(obj.last_webhook_at),
        "paid_at": _iso_datetime(obj.paid_at),

        "is_final": bool(getattr(obj, "is_final", False)),
        "is_success": bool(getattr(obj, "is_success", False)),

        "notes": obj.notes,
        "error_message": obj.error_message,

        "created_at": _iso_datetime(obj.created_at),
        "updated_at": _iso_datetime(obj.updated_at),
    }


# ============================================================
# Query Builders
# ============================================================

def _apply_config_filters(queryset, request):
    provider = _clean_str(request.GET.get("provider")).upper()
    environment = _clean_str(request.GET.get("environment")).lower()
    is_enabled = _to_bool(request.GET.get("is_enabled"), None)
    is_default = _to_bool(request.GET.get("is_default"), None)
    q = _clean_str(request.GET.get("q") or request.GET.get("search"))

    if provider:
        queryset = queryset.filter(provider=provider)

    if environment:
        queryset = queryset.filter(environment=environment)

    if is_enabled is not None:
        queryset = queryset.filter(is_enabled=is_enabled)

    if is_default is not None:
        queryset = queryset.filter(is_default=is_default)

    if q:
        queryset = queryset.filter(
            Q(provider__icontains=q)
            | Q(display_name__icontains=q)
            | Q(environment__icontains=q)
            | Q(merchant_id__icontains=q)
            | Q(source_id__icontains=q)
        )

    return queryset


def _apply_transaction_filters(queryset, request):
    provider = _clean_str(request.GET.get("provider")).upper()
    status_value = _clean_str(request.GET.get("status")).upper()
    gateway_status = _clean_str(request.GET.get("gateway_status")).upper()
    payment_method = _clean_str(request.GET.get("payment_method")).upper()
    currency = _clean_str(request.GET.get("currency")).upper()

    local_reference = _clean_str(request.GET.get("local_reference"))
    local_reference_type = _clean_str(request.GET.get("local_reference_type")).upper()
    local_reference_id = _clean_str(request.GET.get("local_reference_id"))

    remote_transaction_id = _clean_str(request.GET.get("remote_transaction_id"))
    remote_order_id = _clean_str(request.GET.get("remote_order_id"))
    remote_checkout_id = _clean_str(request.GET.get("remote_checkout_id"))
    gateway_reference = _clean_str(request.GET.get("gateway_reference"))

    customer = _clean_str(request.GET.get("customer"))
    q = _clean_str(request.GET.get("q") or request.GET.get("search"))

    date_from = _clean_str(request.GET.get("date_from"))
    date_to = _clean_str(request.GET.get("date_to"))

    is_webhook_verified = _to_bool(request.GET.get("is_webhook_verified"), None)

    if provider:
        queryset = queryset.filter(provider=provider)

    if status_value:
        queryset = queryset.filter(status=status_value)

    if gateway_status:
        queryset = queryset.filter(gateway_status__icontains=gateway_status)

    if payment_method:
        queryset = queryset.filter(payment_method__icontains=payment_method)

    if currency:
        queryset = queryset.filter(currency=currency)

    if local_reference:
        queryset = queryset.filter(local_reference__icontains=local_reference)

    if local_reference_type:
        queryset = queryset.filter(local_reference_type=local_reference_type)

    if local_reference_id:
        queryset = queryset.filter(local_reference_id=local_reference_id)

    if remote_transaction_id:
        queryset = queryset.filter(remote_transaction_id=remote_transaction_id)

    if remote_order_id:
        queryset = queryset.filter(remote_order_id=remote_order_id)

    if remote_checkout_id:
        queryset = queryset.filter(remote_checkout_id=remote_checkout_id)

    if gateway_reference:
        queryset = queryset.filter(gateway_reference__icontains=gateway_reference)

    if customer:
        queryset = queryset.filter(
            Q(customer_name__icontains=customer)
            | Q(customer_email__icontains=customer)
            | Q(customer_phone__icontains=customer)
        )

    if is_webhook_verified is not None:
        queryset = queryset.filter(is_webhook_verified=is_webhook_verified)

    if date_from:
        queryset = queryset.filter(created_at__date__gte=date_from)

    if date_to:
        queryset = queryset.filter(created_at__date__lte=date_to)

    if q:
        queryset = queryset.filter(
            Q(local_reference__icontains=q)
            | Q(local_reference_id__icontains=q)
            | Q(remote_transaction_id__icontains=q)
            | Q(remote_order_id__icontains=q)
            | Q(remote_checkout_id__icontains=q)
            | Q(gateway_reference__icontains=q)
            | Q(customer_name__icontains=q)
            | Q(customer_email__icontains=q)
            | Q(customer_phone__icontains=q)
            | Q(gateway_status__icontains=q)
            | Q(error_message__icontains=q)
        )

    return queryset


# ============================================================
# Summary Builders
# ============================================================

def _build_config_summary(queryset) -> dict[str, Any]:
    totals = queryset.aggregate(
        total=Count("id"),
        enabled=Count("id", filter=Q(is_enabled=True)),
        disabled=Count("id", filter=Q(is_enabled=False)),
        defaults=Count("id", filter=Q(is_default=True)),
    )

    provider_breakdown = list(
        queryset
        .values("provider")
        .annotate(
            count=Count("id"),
            enabled=Count("id", filter=Q(is_enabled=True)),
            defaults=Count("id", filter=Q(is_default=True)),
        )
        .order_by("provider")
    )

    return {
        "total": totals["total"] or 0,
        "enabled": totals["enabled"] or 0,
        "disabled": totals["disabled"] or 0,
        "defaults": totals["defaults"] or 0,
        "provider_breakdown": [
            {
                "provider": item["provider"],
                "count": item["count"] or 0,
                "enabled": item["enabled"] or 0,
                "defaults": item["defaults"] or 0,
            }
            for item in provider_breakdown
        ],
    }


def _build_transaction_summary(queryset) -> dict[str, Any]:
    totals = queryset.aggregate(
        total=Count("id"),
        amount=Sum("amount"),
        success=Count("id", filter=Q(status="SUCCESS")),
        failed=Count("id", filter=Q(status="FAILED")),
        pending=Count("id", filter=Q(status="PENDING")),
        initiated=Count("id", filter=Q(status="INITIATED")),
        processing=Count("id", filter=Q(status="PROCESSING")),
        requires_action=Count("id", filter=Q(status="REQUIRES_ACTION")),
        verified_webhooks=Count("id", filter=Q(is_webhook_verified=True)),
    )

    provider_breakdown = list(
        queryset
        .values("provider")
        .annotate(
            count=Count("id"),
            amount=Sum("amount"),
            success=Count("id", filter=Q(status="SUCCESS")),
            failed=Count("id", filter=Q(status="FAILED")),
        )
        .order_by("provider")
    )

    status_breakdown = list(
        queryset
        .values("status")
        .annotate(
            count=Count("id"),
            amount=Sum("amount"),
        )
        .order_by("status")
    )

    return {
        "total": totals["total"] or 0,
        "amount": _money(totals["amount"]),
        "success": totals["success"] or 0,
        "failed": totals["failed"] or 0,
        "pending": totals["pending"] or 0,
        "initiated": totals["initiated"] or 0,
        "processing": totals["processing"] or 0,
        "requires_action": totals["requires_action"] or 0,
        "verified_webhooks": totals["verified_webhooks"] or 0,
        "currency": "SAR",
        "provider_breakdown": [
            {
                "provider": item["provider"],
                "count": item["count"] or 0,
                "amount": _money(item["amount"]),
                "success": item["success"] or 0,
                "failed": item["failed"] or 0,
            }
            for item in provider_breakdown
        ],
        "status_breakdown": [
            {
                "status": item["status"],
                "count": item["count"] or 0,
                "amount": _money(item["amount"]),
            }
            for item in status_breakdown
        ],
    }


# ============================================================
# Gateway Configs List
# GET /api/payment-gateways/configs/
# ============================================================

@require_GET
def payment_gateway_configs_list_api(request):
    try:
        queryset = (
            PaymentGatewayConfig.objects
            .all()
            .order_by("provider", "-is_default", "-id")
        )

        queryset = _apply_config_filters(queryset, request)

        page, page_size = _parse_page_params(request)
        paginated = _paginate(queryset, page=page, page_size=page_size)

        items = [
            _serialize_gateway_config(obj)
            for obj in paginated["items"]
        ]

        return _json_success(
            {
                "items": items,
                "results": items,
                "summary": _build_config_summary(queryset),
                "pagination": paginated["pagination"],
                "filters": {
                    "provider": request.GET.get("provider") or "",
                    "environment": request.GET.get("environment") or "",
                    "is_enabled": request.GET.get("is_enabled") or "",
                    "is_default": request.GET.get("is_default") or "",
                    "q": request.GET.get("q") or request.GET.get("search") or "",
                },
            },
            message="Payment gateway configs loaded successfully.",
            extra={
                # توافق خلفي مع الفرونت القديم
                "count": paginated["pagination"]["total_items"],
                "results": items,
                "page": paginated["pagination"]["page"],
                "page_size": paginated["pagination"]["page_size"],
                "pagination": paginated["pagination"],
            },
        )

    except Exception as exc:
        logger.exception("Failed to load payment gateway configs: %s", exc)
        return _json_error(
            "Unexpected error while loading payment gateway configs.",
            status=500,
        )


# ============================================================
# Gateway Transactions List
# GET /api/payment-gateways/transactions/
# ============================================================

@require_GET
def payment_gateway_transactions_list_api(request):
    try:
        queryset = PaymentGatewayTransaction.objects.all().order_by("-id")
        queryset = _apply_transaction_filters(queryset, request)

        page, page_size = _parse_page_params(request)
        paginated = _paginate(queryset, page=page, page_size=page_size)

        items = [
            _serialize_gateway_transaction(obj)
            for obj in paginated["items"]
        ]

        return _json_success(
            {
                "items": items,
                "results": items,
                "summary": _build_transaction_summary(queryset),
                "pagination": paginated["pagination"],
                "filters": {
                    "provider": request.GET.get("provider") or "",
                    "status": request.GET.get("status") or "",
                    "gateway_status": request.GET.get("gateway_status") or "",
                    "payment_method": request.GET.get("payment_method") or "",
                    "currency": request.GET.get("currency") or "",
                    "local_reference": request.GET.get("local_reference") or "",
                    "local_reference_type": request.GET.get("local_reference_type") or "",
                    "local_reference_id": request.GET.get("local_reference_id") or "",
                    "remote_transaction_id": request.GET.get("remote_transaction_id") or "",
                    "remote_order_id": request.GET.get("remote_order_id") or "",
                    "remote_checkout_id": request.GET.get("remote_checkout_id") or "",
                    "gateway_reference": request.GET.get("gateway_reference") or "",
                    "customer": request.GET.get("customer") or "",
                    "is_webhook_verified": request.GET.get("is_webhook_verified") or "",
                    "date_from": request.GET.get("date_from") or "",
                    "date_to": request.GET.get("date_to") or "",
                    "q": request.GET.get("q") or request.GET.get("search") or "",
                },
            },
            message="Payment gateway transactions loaded successfully.",
            extra={
                # توافق خلفي مع الفرونت القديم
                "count": paginated["pagination"]["total_items"],
                "results": items,
                "page": paginated["pagination"]["page"],
                "page_size": paginated["pagination"]["page_size"],
                "pagination": paginated["pagination"],
            },
        )

    except Exception as exc:
        logger.exception("Failed to load payment gateway transactions: %s", exc)
        return _json_error(
            "Unexpected error while loading payment gateway transactions.",
            status=500,
        )