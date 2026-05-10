# ============================================================
# 📂 api/orders/list.py
# 🧭 Primey Care — Orders API List/Create V2
# ------------------------------------------------------------
# ✅ قائمة الطلبات
# ✅ إنشاء الطلب عبر orders.services.create_order الرسمي
# ✅ لا ينشئ فاتورة إلا إذا auto_create_invoice=true
# ✅ لا يصدر فاتورة إلا إذا issue_invoice_immediately=true
# ✅ يدعم ربط المندوب والعمولة عبر orders.services
# ✅ متوافق مع Accounting / Treasury backend flow
# ✅ استجابة موحدة للواجهة: ok / success / data
# ✅ يحافظ على results/pagination للتوافق مع الفرونت الحالي
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from orders.models import Order
from orders.services import (
    apply_order_filters,
    create_order,
    paginate_queryset,
    parse_int,
    parse_json_body,
    serialize_order,
)


logger = logging.getLogger(__name__)


# ============================================================
# 🔹 JSON Helpers
# ============================================================

def _decimal_to_string(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)

    if isinstance(value, dict):
        return {key: _decimal_to_string(val) for key, val in value.items()}

    if isinstance(value, list):
        return [_decimal_to_string(item) for item in value]

    if isinstance(value, tuple):
        return tuple(_decimal_to_string(item) for item in value)

    return value


def _json_error(
    message: str,
    status: int = 400,
    *,
    errors: Any = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": False,
        "success": False,
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


def _validation_errors(exc: ValidationError) -> Any:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return exc.messages

    return str(exc)


# ============================================================
# 🔹 Auth / Queryset Helpers
# ============================================================

def _ensure_authenticated(request):
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return None, _json_error("Authentication required.", 401)

    return request.user, None


def _orders_queryset():
    return (
        Order.objects.select_related(
            "customer",
            "product",
            "provider",
            "contract",
            "agent",
            "created_by",
            "updated_by",
        )
        .prefetch_related("status_history")
        .all()
    )


def _parse_page_params(request) -> tuple[int, int]:
    page = parse_int(request.GET.get("page"), 1) or 1
    page_size = parse_int(request.GET.get("page_size"), 20) or 20

    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)

    return page, page_size


def _build_create_flags(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "auto_create_agent_order": payload.get("auto_create_agent_order", True),
        "create_commission": payload.get("create_commission", True),
        "auto_create_invoice": payload.get("auto_create_invoice", False),
        "issue_invoice_immediately": payload.get("issue_invoice_immediately", False),
        "auto_post_accounting": payload.get("auto_post_accounting", True),
    }


# ============================================================
# 🔹 Orders API
# ============================================================

@require_http_methods(["GET", "POST"])
def orders_api(request):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "GET":
        try:
            queryset = apply_order_filters(_orders_queryset(), request.GET)

            page, page_size = _parse_page_params(request)
            paginated = paginate_queryset(queryset, page=page, page_size=page_size)

            items = [
                serialize_order(item, include_history=False)
                for item in paginated["items"]
            ]

            return _json_success(
                {
                    "items": items,
                    "results": items,
                    "pagination": paginated["pagination"],
                },
                message="Orders loaded successfully.",
                extra={
                    # توافق خلفي مع الفرونت الحالي
                    "results": items,
                    "pagination": paginated["pagination"],
                },
            )

        except ValidationError as exc:
            return _json_error(
                "Validation failed while loading orders.",
                400,
                errors=_validation_errors(exc),
            )

        except Exception as exc:
            logger.exception("Failed to load orders: %s", exc)
            return _json_error("Unexpected error while loading orders.", 500)

    try:
        payload = parse_json_body(request)

        order = create_order(
            payload=payload,
            user=user,
        )

        fresh_order = _orders_queryset().get(pk=order.pk)
        serialized_order = serialize_order(fresh_order)

        return _json_success(
            {
                "order": serialized_order,
                "flags": _build_create_flags(payload),
            },
            message="Order created successfully.",
            status=201,
            extra={
                # توافق خلفي مع الفرونت الحالي
                "data": serialized_order,
            },
        )

    except ValidationError as exc:
        return _json_error(
            "Validation failed while creating order.",
            400,
            errors=_validation_errors(exc),
        )

    except Exception as exc:
        logger.exception("Failed to create order: %s", exc)
        return _json_error("Unexpected error while creating order.", 500)


# ============================================================
# 🔹 Active / Open Orders API
# ============================================================

@require_http_methods(["GET"])
def open_orders_api(request):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    try:
        queryset = _orders_queryset().exclude(
            status__in=[
                Order.Status.CANCELLED,
                Order.Status.REFUNDED,
                Order.Status.COMPLETED,
            ]
        )

        queryset = apply_order_filters(queryset, request.GET)

        page, page_size = _parse_page_params(request)
        paginated = paginate_queryset(queryset, page=page, page_size=page_size)

        items = [
            serialize_order(item, include_history=False)
            for item in paginated["items"]
        ]

        return _json_success(
            {
                "items": items,
                "results": items,
                "pagination": paginated["pagination"],
            },
            message="Open orders loaded successfully.",
            extra={
                # توافق خلفي مع الفرونت الحالي
                "results": items,
                "pagination": paginated["pagination"],
            },
        )

    except ValidationError as exc:
        return _json_error(
            "Validation failed while loading open orders.",
            400,
            errors=_validation_errors(exc),
        )

    except Exception as exc:
        logger.exception("Failed to load open orders: %s", exc)
        return _json_error("Unexpected error while loading open orders.", 500)