# ============================================================
# 📂 api/orders/list.py
# 🧭 Primey Care — Orders API List/Create V2.7
# ------------------------------------------------------------
# ✅ قائمة الطلبات
# ✅ إنشاء الطلب عبر orders.services.create_order الرسمي فقط
# ✅ يدعم إنشاء/ربط العميل تلقائيًا من رقم الجوال عبر services
# ✅ يدعم ربط مندوب البيع تلقائيًا من المستخدم الحالي إذا كان مندوبًا
# ✅ يدعم اختيار مندوب البيع للمدير/المصرح عبر services
# ✅ يدعم كود الإحالة/المندوب عند تمريره إلى services
# ✅ يدعم offer_id / contract_product_id من /api/offers/
# ✅ يحل Product / Provider / Contract من ContractProduct عند إنشاء الطلب من عرض
# ✅ يحفظ Snapshot العرض والسعر داخل Order عبر services
# ✅ يدعم حقول الطلب:
#    - contract_product / offer_source / offer_title / offer_badge
#    - unit_price_before_discount / unit_discount_percentage / unit_price
#    - order_kind
#    - starts_at / ends_at
#    - scheduled_at
#    - payment_method / payment_reference
#    - referral_code_used
#    - delivery_agent
#    - delivery lifecycle timestamps
#    - cash collection fields
# ✅ يدعم ملخصات التوصيل والتحصيل والعروض
# ✅ يدعم Financial Context بعد إنشاء الطلب
# ✅ يدعم Financial Summary في القائمة
# ✅ لا ينشئ فاتورة إلا إذا auto_create_invoice=true أو create_invoice=true
# ✅ لا يصدر فاتورة إلا إذا issue_invoice_immediately=true
# ✅ متوافق مع Accounting / Treasury backend flow
# ✅ استجابة موحدة للواجهة: ok / success / data
# ✅ يحافظ على results/pagination للتوافق مع الفرونت الحالي
# ------------------------------------------------------------
# ملاحظة مهمة:
# - هذا endpoint محمي للمستخدمين الداخليين/المندوبين.
# - طلبات الموقع الخارجية العامة يفضل أن تكون في public checkout endpoint مستقل.
# - Product = كتالوج ثابت.
# - ContractProduct = عرض/سعر/خصم المنتج حسب مقدم الخدمة والعقد.
# - الدورة المالية تنفذ من orders.services وليس من هذا الملف.
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from django.apps import apps
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from orders.models import Order
from orders.services import (
    apply_order_filters,
    create_order,
    paginate_queryset,
    parse_bool,
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
        for key, value in extra.items():
            if key == "data":
                continue
            payload[key] = _decimal_to_string(value)

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
            "contract_product",
            "contract_product__product",
            "contract_product__contract",
            "contract_product__contract__provider",
            "provider",
            "contract",
            "agent",
            "delivery_agent",
            "cash_collected_by",
            "created_by",
            "updated_by",
        )
        .prefetch_related(
            "status_history",
            "timeline",
        )
        .all()
    )


def _parse_page_params(request) -> tuple[int, int]:
    page = parse_int(request.GET.get("page"), 1) or 1
    page_size = parse_int(request.GET.get("page_size"), 20) or 20

    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)

    return page, page_size


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _first_non_empty(*values: Any) -> Any:
    for value in values:
        if value not in (None, "", [], {}, ()):
            return value

    return None


def _decimal_from_item(item: dict[str, Any], key: str) -> Decimal:
    try:
        return Decimal(str(item.get(key) or "0.00"))
    except Exception:
        return Decimal("0.00")


def _money_str(value: Any) -> str:
    try:
        return str(Decimal(str(value or "0.00")).quantize(Decimal("0.01")))
    except Exception:
        return "0.00"


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return str(value)


def _safe_attr(obj: Any, *names: str, default: Any = "") -> Any:
    if not obj:
        return default

    for name in names:
        try:
            value = getattr(obj, name, None)
        except Exception:
            value = None

        if value not in (None, ""):
            return value

    return default


def _get_optional_model(app_label: str, model_name: str):
    try:
        return apps.get_model(app_label, model_name)
    except LookupError:
        return None


def _model_has_field(model_or_instance: Any, field_name: str) -> bool:
    try:
        model_or_instance._meta.get_field(field_name)
        return True
    except Exception:
        return False


# ============================================================
# 🔹 Financial Context Helpers
# ============================================================

def _financial_entry_model():
    return _get_optional_model("agents", "AgentFinancialEntry")


def _financial_entries_queryset_for_order(order: Order):
    model = _financial_entry_model()

    if not model:
        return None

    queryset = model.objects.all()

    if _model_has_field(model, "agent"):
        queryset = queryset.select_related("agent")

    if _model_has_field(model, "broker"):
        queryset = queryset.select_related("broker")

    if _model_has_field(model, "journal_entry"):
        queryset = queryset.select_related("journal_entry")

    if _model_has_field(model, "order"):
        return queryset.filter(order_id=order.pk)

    if _model_has_field(model, "source_type") and _model_has_field(model, "source_id"):
        return queryset.filter(
            source_type="order",
            source_id__startswith=f"order:{order.pk}:",
        )

    return queryset.none()


def _safe_model_value(obj: Any, field_name: str, default: Any = "") -> Any:
    if not obj or not _model_has_field(obj.__class__, field_name):
        return default

    return getattr(obj, field_name, default)


def _serialize_financial_entry(entry) -> dict[str, Any]:
    agent = _safe_model_value(entry, "agent", None)
    broker = _safe_model_value(entry, "broker", None)
    journal_entry = _safe_model_value(entry, "journal_entry", None)

    return {
        "id": getattr(entry, "pk", None),
        "entry_number": _safe_model_value(entry, "entry_number"),
        "entry_type": _safe_model_value(entry, "entry_type"),
        "direction": _safe_model_value(entry, "direction"),
        "amount": _money_str(_safe_model_value(entry, "amount", Decimal("0.00"))),
        "currency": _safe_model_value(entry, "currency", "SAR"),
        "status": _safe_model_value(entry, "status"),
        "description": _safe_model_value(entry, "description"),
        "reference": _safe_model_value(entry, "reference"),
        "source_type": _safe_model_value(entry, "source_type"),
        "source_id": _safe_model_value(entry, "source_id"),
        "source_number": _safe_model_value(entry, "source_number"),

        "agent_id": getattr(agent, "pk", None) if agent else _safe_model_value(entry, "agent_id", None),
        "agent_name": _safe_attr(agent, "display_name", "full_name", "name") if agent else "",
        "agent_code": _safe_attr(agent, "agent_code", "code") if agent else "",

        "broker_id": getattr(broker, "pk", None) if broker else _safe_model_value(entry, "broker_id", None),
        "broker_name": _safe_attr(broker, "display_name", "full_name", "name") if broker else "",
        "broker_code": _safe_attr(broker, "broker_code", "code") if broker else "",

        "journal_entry_id": getattr(journal_entry, "pk", None) if journal_entry else _safe_model_value(entry, "journal_entry_id", None),
        "journal_entry_reference": (
            _safe_attr(journal_entry, "entry_number")
            if journal_entry
            else _safe_model_value(entry, "journal_entry_reference")
        ),
        "is_accounting_posted": bool(_safe_model_value(entry, "is_accounting_posted", False)),
        "earned_at": _iso_datetime(_safe_model_value(entry, "earned_at", None)),
        "approved_at": _iso_datetime(_safe_model_value(entry, "approved_at", None)),
        "posted_at": _iso_datetime(_safe_model_value(entry, "posted_at", None)),
        "created_at": _iso_datetime(_safe_model_value(entry, "created_at", None)),
        "updated_at": _iso_datetime(_safe_model_value(entry, "updated_at", None)),
        "metadata": _safe_model_value(entry, "metadata", {}) or {},
    }


def _build_financial_context(order: Order) -> dict[str, Any]:
    queryset = _financial_entries_queryset_for_order(order)

    if queryset is None:
        return {
            "is_supported": False,
            "entries_count": 0,
            "accounting_posted_count": 0,
            "entries": [],
            "by_type": {},
        }

    try:
        entries = list(queryset.order_by("-id")[:100])
    except Exception:
        entries = []

    serialized_entries = [_serialize_financial_entry(entry) for entry in entries]

    by_type: dict[str, dict[str, Any]] = {}
    accounting_posted_count = 0

    for item in serialized_entries:
        entry_type = str(item.get("entry_type") or "UNKNOWN")
        amount = Decimal(str(item.get("amount") or "0.00"))

        is_posted = bool(
            item.get("is_accounting_posted")
            or item.get("journal_entry_id")
            or item.get("journal_entry_reference")
        )

        if is_posted:
            accounting_posted_count += 1

        current = by_type.setdefault(
            entry_type,
            {
                "count": 0,
                "amount_total": Decimal("0.00"),
                "accounting_posted_count": 0,
            },
        )

        current["count"] += 1
        current["amount_total"] += amount

        if is_posted:
            current["accounting_posted_count"] += 1

    for value in by_type.values():
        value["amount_total"] = _money_str(value["amount_total"])

    return {
        "is_supported": True,
        "entries_count": len(serialized_entries),
        "accounting_posted_count": accounting_posted_count,
        "has_cod_custody": any(item.get("entry_type") == "COD_CUSTODY" for item in serialized_entries),
        "has_sales_commission": any(item.get("entry_type") == "SALES_COMMISSION" for item in serialized_entries),
        "has_delivery_fee": any(item.get("entry_type") == "DELIVERY_FEE" for item in serialized_entries),
        "has_broker_share": any(item.get("entry_type") == "BROKER_SHARE" for item in serialized_entries),
        "by_type": by_type,
        "entries": serialized_entries,
    }


def _build_financial_summary_from_items(items: list[dict[str, Any]]) -> dict[str, Any]:
    cod_orders = 0
    cash_collected_orders = 0
    cash_pending_orders = 0
    total_cash_collected = Decimal("0.00")

    for item in items:
        payment_method = _clean_text(item.get("payment_method"))
        payment_status = _clean_text(item.get("payment_status"))
        cash_collected = _decimal_from_item(item, "cash_collected_amount")

        if payment_method == "cash_on_delivery":
            cod_orders += 1

            if payment_status == "paid" or cash_collected > Decimal("0.00"):
                cash_collected_orders += 1
            else:
                cash_pending_orders += 1

        total_cash_collected += cash_collected

    return {
        "cod_orders": cod_orders,
        "cash_collected_orders": cash_collected_orders,
        "cash_pending_orders": cash_pending_orders,
        "total_cash_collected": str(total_cash_collected),
        "note": "تفاصيل عهدة المندوب والعمولات تظهر في context المالي لتفاصيل الطلب أو بعد إنشاء الطلب.",
    }


# ============================================================
# 🔹 Response Builders
# ============================================================

def _build_create_flags(payload: dict[str, Any]) -> dict[str, Any]:
    auto_create_invoice = parse_bool(
        _first_non_empty(
            payload.get("auto_create_invoice"),
            payload.get("create_invoice"),
            False,
        ),
        False,
    )

    issue_invoice_immediately = parse_bool(
        payload.get("issue_invoice_immediately"),
        False,
    )

    return {
        "auto_create_agent_order": parse_bool(
            payload.get("auto_create_agent_order"),
            True,
        ),
        "create_commission": parse_bool(
            payload.get("create_commission"),
            True,
        ),
        "auto_create_invoice": auto_create_invoice,
        "create_invoice": auto_create_invoice,
        "issue_invoice_immediately": issue_invoice_immediately,
        "auto_post_accounting": parse_bool(
            payload.get("auto_post_accounting"),
            True,
        ),
    }


def _build_order_create_context(
    *,
    order: Order,
    payload: dict[str, Any],
) -> dict[str, Any]:
    referral_code = _clean_text(
        _first_non_empty(
            getattr(order, "referral_code_used", ""),
            payload.get("referral_code_used"),
            payload.get("referral_code"),
            payload.get("agent_code"),
            payload.get("employee_code"),
            payload.get("sales_code"),
            payload.get("ref"),
            "",
        )
    )

    offer_id = _first_non_empty(
        getattr(order, "contract_product_id", None),
        payload.get("contract_product_id"),
        payload.get("contract_product"),
        payload.get("offer_id"),
        payload.get("offer"),
        payload.get("selected_offer_id"),
        None,
    )

    return {
        "customer": {
            "customer_id": order.customer_id,
            "created_or_resolved_by": "orders.services.create_order",
            "has_customer": bool(order.customer_id),
            "has_customer_account": bool(
                getattr(order.customer, "user_id", None)
            ) if order.customer_id else False,
        },
        "offer": {
            "offer_id": offer_id,
            "contract_product_id": order.contract_product_id,
            "has_offer": bool(order.contract_product_id),
            "offer_source": order.offer_source,
            "offer_title": order.offer_title,
            "offer_badge": order.offer_badge,
            "resolved_by": "offer_id_or_contract_product_id" if order.contract_product_id else "product_catalog",
            "unit_price_before_discount": str(order.unit_price_before_discount),
            "unit_discount_percentage": str(order.unit_discount_percentage),
            "unit_price": str(order.unit_price),
        },
        "agent": {
            "agent_id": order.agent_id,
            "has_agent": bool(order.agent_id),
            "referral_code_used": referral_code,
            "resolved_by": "current_user_or_allowed_assignment_or_referral_code",
        },
        "delivery": {
            "delivery_agent_id": order.delivery_agent_id,
            "has_delivery_agent": bool(order.delivery_agent_id),
            "status": order.fulfillment_status,
            "assigned_for_delivery_at": order.assigned_for_delivery_at.isoformat() if order.assigned_for_delivery_at else None,
            "out_for_delivery_at": order.out_for_delivery_at.isoformat() if order.out_for_delivery_at else None,
            "delivered_at": order.delivered_at.isoformat() if order.delivered_at else None,
        },
        "provider": {
            "provider_id": order.provider_id,
            "has_provider": bool(order.provider_id),
            "resolved_automatically": bool(order.provider_id),
        },
        "contract": {
            "contract_id": order.contract_id,
            "has_contract": bool(order.contract_id),
            "resolved_automatically": bool(order.contract_id),
        },
        "product": {
            "product_id": order.product_id,
            "product_type": order.product_type,
            "product_name": order.product_name,
            "order_kind": order.order_kind,
            "is_subscription_like": order.is_subscription_like,
            "is_service_like": order.is_service_like,
        },
        "validity": {
            "starts_at": order.starts_at.isoformat() if order.starts_at else None,
            "ends_at": order.ends_at.isoformat() if order.ends_at else None,
            "duration_days": order.duration_days,
            "scheduled_at": order.scheduled_at.isoformat() if order.scheduled_at else None,
        },
        "payment": {
            "payment_status": order.payment_status,
            "payment_method": order.payment_method,
            "payment_reference": order.payment_reference,
            "amount_paid": str(order.amount_paid),
            "remaining_amount": str(order.remaining_amount),
            "is_paid": order.is_paid,
            "is_cash_on_delivery": order.is_cash_on_delivery,
            "cash_collected_amount": str(order.cash_collected_amount),
            "cash_collected_at": order.cash_collected_at.isoformat() if order.cash_collected_at else None,
        },
        "financial": _build_financial_context(order),
        "lifecycle": {
            "status": order.status,
            "fulfillment_status": order.fulfillment_status,
            "available_actions": serialize_order(order, include_history=False).get("available_actions", []),
        },
        "source": order.source,
    }


def _build_payment_method_counts(items: list[dict[str, Any]]) -> dict[str, int]:
    counts = {
        "none": 0,
        "cash": 0,
        "cash_on_delivery": 0,
        "bank_transfer": 0,
        "card": 0,
        "payment_gateway": 0,
        "wallet": 0,
        "tamara": 0,
        "tabby": 0,
        "other": 0,
    }

    for item in items:
        method = _clean_text(item.get("payment_method") or "none")
        if method not in counts:
            counts[method] = 0
        counts[method] += 1

    return counts


def _build_order_kind_counts(items: list[dict[str, Any]]) -> dict[str, int]:
    counts = {
        "general": 0,
        "card": 0,
        "program": 0,
        "service": 0,
        "subscription": 0,
    }

    for item in items:
        kind = _clean_text(item.get("order_kind") or "general")
        if kind not in counts:
            counts[kind] = 0
        counts[kind] += 1

    return counts


def _build_offer_source_counts(items: list[dict[str, Any]]) -> dict[str, int]:
    counts = {
        "none": 0,
        "product": 0,
        "contract_product": 0,
        "manual": 0,
    }

    for item in items:
        source = _clean_text(item.get("offer_source") or "none")
        if source not in counts:
            counts[source] = 0
        counts[source] += 1

    return counts


def _build_list_summary(items: list[dict[str, Any]], pagination: dict[str, Any]) -> dict[str, Any]:
    total_amount = Decimal("0.00")
    paid_amount = Decimal("0.00")
    remaining_amount = Decimal("0.00")
    cash_collected_amount = Decimal("0.00")

    linked_agent_count = 0
    linked_delivery_agent_count = 0
    linked_provider_count = 0
    linked_contract_count = 0
    linked_offer_count = 0
    linked_invoice_count = 0
    scheduled_count = 0
    start_date_count = 0
    end_date_count = 0
    referral_count = 0

    cash_collected_count = 0
    cash_pending_collection_count = 0
    delivery_ready_count = 0
    delivery_in_progress_count = 0
    delivery_done_count = 0

    status_counts: dict[str, int] = {}
    payment_status_counts: dict[str, int] = {}
    fulfillment_status_counts: dict[str, int] = {}
    source_counts: dict[str, int] = {}
    offer_source_counts: dict[str, int] = {}

    for item in items:
        total_amount += _decimal_from_item(item, "total_amount")
        paid_amount += _decimal_from_item(item, "amount_paid")
        remaining_amount += _decimal_from_item(item, "remaining_amount")
        cash_collected_amount += _decimal_from_item(item, "cash_collected_amount")

        if item.get("agent_id"):
            linked_agent_count += 1

        if item.get("delivery_agent_id"):
            linked_delivery_agent_count += 1

        if item.get("provider_id"):
            linked_provider_count += 1

        if item.get("contract_id"):
            linked_contract_count += 1

        if item.get("contract_product_id") or item.get("offer_id"):
            linked_offer_count += 1

        if item.get("invoice_id"):
            linked_invoice_count += 1

        if item.get("scheduled_at"):
            scheduled_count += 1

        if item.get("starts_at"):
            start_date_count += 1

        if item.get("ends_at"):
            end_date_count += 1

        if _clean_text(item.get("referral_code_used")):
            referral_count += 1

        status = _clean_text(item.get("status") or "unknown")
        payment_status = _clean_text(item.get("payment_status") or "unknown")
        fulfillment_status = _clean_text(item.get("fulfillment_status") or "unknown")
        source = _clean_text(item.get("source") or "unknown")
        payment_method = _clean_text(item.get("payment_method") or "none")
        offer_source = _clean_text(item.get("offer_source") or "none")

        status_counts[status] = status_counts.get(status, 0) + 1
        payment_status_counts[payment_status] = payment_status_counts.get(payment_status, 0) + 1
        fulfillment_status_counts[fulfillment_status] = fulfillment_status_counts.get(fulfillment_status, 0) + 1
        source_counts[source] = source_counts.get(source, 0) + 1
        offer_source_counts[offer_source] = offer_source_counts.get(offer_source, 0) + 1

        if payment_method == "cash_on_delivery":
            if payment_status == "paid" or _decimal_from_item(item, "cash_collected_amount") > Decimal("0.00"):
                cash_collected_count += 1
            else:
                cash_pending_collection_count += 1

        if status in {"card_ready", "assigned_for_delivery"} or fulfillment_status in {"ready", "assigned"}:
            delivery_ready_count += 1

        if status == "out_for_delivery" or fulfillment_status == "out_for_delivery":
            delivery_in_progress_count += 1

        if status in {"delivered", "completed"} or fulfillment_status == "delivered":
            delivery_done_count += 1

    order_kind_counts = _build_order_kind_counts(items)
    payment_method_counts = _build_payment_method_counts(items)
    normalized_offer_source_counts = _build_offer_source_counts(items)
    normalized_offer_source_counts.update(offer_source_counts)

    card_ready_orders = status_counts.get("card_ready", 0)
    assigned_for_delivery_orders = status_counts.get("assigned_for_delivery", 0)
    out_for_delivery_orders = status_counts.get("out_for_delivery", 0)
    delivered_orders = status_counts.get("delivered", 0)
    completed_orders = status_counts.get("completed", 0)

    cod_pending_orders = payment_status_counts.get("cod_pending", 0)
    paid_orders = payment_status_counts.get("paid", 0)

    return {
        "current_page_count": len(items),
        "total_items": pagination.get("total_items", len(items)),
        "total_pages": pagination.get("total_pages", 1),

        "page_total_amount": str(total_amount),
        "page_paid_amount": str(paid_amount),
        "page_remaining_amount": str(remaining_amount),
        "page_cash_collected_amount": str(cash_collected_amount),

        "linked_agent_count": linked_agent_count,
        "linked_delivery_agent_count": linked_delivery_agent_count,
        "linked_provider_count": linked_provider_count,
        "linked_contract_count": linked_contract_count,
        "linked_offer_count": linked_offer_count,
        "linked_invoice_count": linked_invoice_count,

        "scheduled_count": scheduled_count,
        "start_date_count": start_date_count,
        "end_date_count": end_date_count,
        "referral_count": referral_count,

        "cash_collected_count": cash_collected_count,
        "cash_pending_collection_count": cash_pending_collection_count,

        "delivery_ready_count": delivery_ready_count,
        "delivery_in_progress_count": delivery_in_progress_count,
        "delivery_done_count": delivery_done_count,

        "order_kind_counts": order_kind_counts,
        "payment_method_counts": payment_method_counts,
        "offer_source_counts": normalized_offer_source_counts,
        "status_counts": status_counts,
        "payment_status_counts": payment_status_counts,
        "fulfillment_status_counts": fulfillment_status_counts,
        "source_counts": source_counts,

        "card_orders": order_kind_counts.get("card", 0),
        "program_orders": order_kind_counts.get("program", 0),
        "service_orders": order_kind_counts.get("service", 0),
        "subscription_orders": order_kind_counts.get("subscription", 0),
        "general_orders": order_kind_counts.get("general", 0),

        "orders_with_offer": linked_offer_count,
        "contract_product_orders": normalized_offer_source_counts.get("contract_product", 0),
        "product_offer_orders": normalized_offer_source_counts.get("product", 0),
        "manual_offer_orders": normalized_offer_source_counts.get("manual", 0),
        "orders_without_offer": normalized_offer_source_counts.get("none", 0),

        "cash_orders": payment_method_counts.get("cash", 0),
        "cash_on_delivery_orders": payment_method_counts.get("cash_on_delivery", 0),
        "bank_transfer_orders": payment_method_counts.get("bank_transfer", 0),
        "card_payment_orders": payment_method_counts.get("card", 0),
        "payment_gateway_orders": payment_method_counts.get("payment_gateway", 0),
        "tamara_orders": payment_method_counts.get("tamara", 0),
        "tabby_orders": payment_method_counts.get("tabby", 0),

        "pending_orders": status_counts.get("pending", 0),
        "confirmed_orders": status_counts.get("confirmed", 0),
        "processing_orders": status_counts.get("processing", 0),
        "card_ready_orders": card_ready_orders,
        "assigned_for_delivery_orders": assigned_for_delivery_orders,
        "out_for_delivery_orders": out_for_delivery_orders,
        "delivered_orders": delivered_orders,
        "completed_orders": completed_orders,
        "cancelled_orders": status_counts.get("cancelled", 0),
        "refunded_orders": status_counts.get("refunded", 0),

        "unpaid_orders": payment_status_counts.get("unpaid", 0),
        "cod_pending_orders": cod_pending_orders,
        "partially_paid_orders": payment_status_counts.get("partially_paid", 0),
        "paid_orders": paid_orders,
        "payment_failed_orders": payment_status_counts.get("failed", 0),
        "payment_refunded_orders": payment_status_counts.get("refunded", 0),

        "not_started_fulfillment_orders": fulfillment_status_counts.get("not_started", 0),
        "pending_fulfillment_orders": fulfillment_status_counts.get("pending", 0),
        "in_progress_fulfillment_orders": fulfillment_status_counts.get("in_progress", 0),
        "issued_fulfillment_orders": fulfillment_status_counts.get("issued", 0),
        "ready_fulfillment_orders": fulfillment_status_counts.get("ready", 0),
        "assigned_fulfillment_orders": fulfillment_status_counts.get("assigned", 0),
        "out_for_delivery_fulfillment_orders": fulfillment_status_counts.get("out_for_delivery", 0),
        "delivered_fulfillment_orders": fulfillment_status_counts.get("delivered", 0),
        "failed_fulfillment_orders": fulfillment_status_counts.get("failed", 0),
        "returned_fulfillment_orders": fulfillment_status_counts.get("returned", 0),

        "financial": _build_financial_summary_from_items(items),
        "currency": "SAR",
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

            summary = _build_list_summary(
                items=items,
                pagination=paginated["pagination"],
            )

            response_data = {
                "items": items,
                "results": items,
                "pagination": paginated["pagination"],
                "summary": summary,
            }

            return _json_success(
                response_data,
                message="Orders loaded successfully.",
                extra={
                    "results": items,
                    "pagination": paginated["pagination"],
                    "summary": summary,
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

        create_context = _build_order_create_context(
            order=fresh_order,
            payload=payload,
        )

        response_data: dict[str, Any] = {
            "order": serialized_order,
            "flags": _build_create_flags(payload),
            "context": create_context,
        }

        return _json_success(
            response_data,
            message="Order created successfully.",
            status=201,
            extra={
                "order": serialized_order,
                "context": create_context,
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

        summary = _build_list_summary(
            items=items,
            pagination=paginated["pagination"],
        )

        response_data = {
            "items": items,
            "results": items,
            "pagination": paginated["pagination"],
            "summary": summary,
        }

        return _json_success(
            response_data,
            message="Open orders loaded successfully.",
            extra={
                "results": items,
                "pagination": paginated["pagination"],
                "summary": summary,
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