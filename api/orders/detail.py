# ============================================================
# 📂 api/orders/detail.py
# 🧭 Primey Care — Orders API Detail/Update/Cancel V2.7
# ------------------------------------------------------------
# ✅ تفاصيل الطلب
# ✅ تعديل الطلب عبر orders.services.update_order الرسمي
# ✅ إلغاء آمن عبر orders.services.cancel_order الرسمي
# ✅ لا حذف فعلي للطلب
# ✅ متوافق مع منطق ربط مندوب البيع في orders.services
# ✅ متوافق مع حل مقدم الخدمة/العقد تلقائيًا في orders.services
# ✅ يدعم تحديث الطلب من offer_id / contract_product_id
# ✅ يرجع بيانات العرض ContractProduct داخل التفاصيل والسياق
# ✅ يرجع Financial Context لسجلات:
#    - COD_CUSTODY
#    - SALES_COMMISSION
#    - DELIVERY_FEE
#    - BROKER_SHARE
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
# ✅ يرجع timeline و available_actions من serialize_order
# ✅ يرجع transition/context أوضح للواجهة
# ✅ متوافق مع دورة الطلب المالية والتشغيلية الجديدة
# ✅ Unified response: ok / success / data / order / context
# ✅ يحافظ على top-level order/context للتوافق مع الفرونت الحالي
# ------------------------------------------------------------
# القاعدة المعتمدة:
# - Product = كتالوج ثابت
# - ContractProduct = عرض/سعر/خصم المنتج حسب مقدم الخدمة والعقد
# - Order يحفظ Snapshot ولا يتأثر بتغيير العرض لاحقًا
# - الدورة المالية لا تنفذ هنا مباشرة، بل عبر orders.services
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from django.apps import apps
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from orders.models import Order
from orders.services import (
    cancel_order,
    parse_json_body,
    serialize_order,
    update_order,
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
# 🔹 Helpers
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


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


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


def _money_str(value: Any) -> str:
    try:
        return str(Decimal(str(value or "0.00")).quantize(Decimal("0.01")))
    except Exception:
        return "0.00"


def _percent_str(value: Any) -> str:
    try:
        parsed = Decimal(str(value or "0.00")).quantize(Decimal("0.01"))
    except Exception:
        parsed = Decimal("0.00")

    if parsed < Decimal("0.00"):
        parsed = Decimal("0.00")

    if parsed > Decimal("100.00"):
        parsed = Decimal("100.00")

    return str(parsed)


def _iso_date(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return str(value)


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return str(value)


def _serialize_user_name(user) -> str:
    if not user:
        return ""

    get_full_name = getattr(user, "get_full_name", None)

    if callable(get_full_name):
        full_name = get_full_name()
        if full_name:
            return full_name

    return getattr(user, "username", "") or getattr(user, "email", "") or ""


def _get_linked_invoice(order: Order):
    try:
        invoice = order.invoice
    except Exception:
        return None

    if hasattr(invoice, "all"):
        return invoice.all().first()

    return invoice


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


# ============================================================
# 🔹 Snapshot / Context
# ============================================================

def _serialize_offer_snapshot(order: Order) -> dict[str, Any]:
    contract_product = getattr(order, "contract_product", None)
    product = getattr(contract_product, "product", None) if contract_product else None
    contract = getattr(contract_product, "contract", None) if contract_product else None
    provider = getattr(contract, "provider", None) if contract else None

    return {
        "offer_id": order.contract_product_id,
        "contract_product_id": order.contract_product_id,
        "has_offer": bool(order.contract_product_id),
        "offer_source": order.offer_source,
        "offer_title": order.offer_title,
        "offer_badge": order.offer_badge,

        "contract_product_offer_title": _safe_attr(contract_product, "offer_title"),
        "contract_product_offer_subtitle": _safe_attr(contract_product, "offer_subtitle"),
        "contract_product_offer_badge": _safe_attr(contract_product, "offer_badge"),
        "contract_product_offer_description": _safe_attr(contract_product, "offer_description"),

        "product_id": getattr(product, "id", None),
        "product_name": _safe_attr(product, "name"),
        "product_code": _safe_attr(product, "code"),
        "product_type": _safe_attr(product, "product_type"),

        "provider_id": getattr(provider, "id", None),
        "provider_name": _safe_attr(provider, "name", "name_ar", "name_en"),

        "contract_id": getattr(contract, "id", None),
        "contract_number": _safe_attr(contract, "contract_number", "number"),
        "contract_title": _safe_attr(contract, "title", "name"),

        "unit_price_before_discount": _money_str(order.unit_price_before_discount),
        "unit_discount_percentage": _percent_str(order.unit_discount_percentage),
        "unit_price": _money_str(order.unit_price),
        "discount_amount": _money_str(order.discount_amount),
        "total_amount": _money_str(order.total_amount),

        "is_currently_available": bool(
            _safe_attr(contract_product, "is_currently_available", default=False)
        ) if contract_product else False,
    }


def _snapshot_order(order: Order) -> dict[str, Any]:
    invoice = _get_linked_invoice(order)

    return {
        "id": order.id,
        "order_number": order.order_number,

        "customer_id": order.customer_id,
        "customer_name": _safe_attr(order.customer, "display_name", "full_name", "name"),
        "customer_phone": _safe_attr(order.customer, "normalized_phone", "phone_number", "whatsapp_number"),

        "product_id": order.product_id,
        "product_name": order.product_name,
        "product_type": order.product_type,

        "contract_product_id": order.contract_product_id,
        "offer_id": order.contract_product_id,
        "offer_source": order.offer_source,
        "offer_title": order.offer_title,
        "offer_badge": order.offer_badge,

        "order_kind": order.order_kind,
        "starts_at": _iso_date(order.starts_at),
        "ends_at": _iso_date(order.ends_at),
        "scheduled_at": _iso_datetime(order.scheduled_at),
        "duration_days": order.duration_days,
        "is_subscription_like": order.is_subscription_like,
        "is_service_like": order.is_service_like,

        "provider_id": order.provider_id,
        "provider_name": _safe_attr(order.provider, "name", "display_name", "provider_name"),

        "contract_id": order.contract_id,
        "contract_number": _safe_attr(order.contract, "contract_number", "number"),
        "contract_title": _safe_attr(order.contract, "title", "name"),

        "agent_id": order.agent_id,
        "agent_code": _safe_attr(order.agent, "agent_code", "code"),
        "agent_name": _safe_attr(order.agent, "display_name", "full_name", "name"),

        "delivery_agent_id": order.delivery_agent_id,
        "delivery_agent_code": _safe_attr(order.delivery_agent, "agent_code", "code"),
        "delivery_agent_name": _safe_attr(order.delivery_agent, "display_name", "full_name", "name"),

        "invoice_id": invoice.id if invoice else None,
        "invoice_number": _safe_attr(invoice, "invoice_number", "number"),

        "status": order.status,
        "payment_status": order.payment_status,
        "fulfillment_status": order.fulfillment_status,
        "source": order.source,

        "confirmed_at": _iso_datetime(order.confirmed_at),
        "card_printed_at": _iso_datetime(order.card_printed_at),
        "card_ready_at": _iso_datetime(order.card_ready_at),
        "assigned_for_delivery_at": _iso_datetime(order.assigned_for_delivery_at),
        "out_for_delivery_at": _iso_datetime(order.out_for_delivery_at),
        "delivered_at": _iso_datetime(order.delivered_at),
        "completed_at": _iso_datetime(order.completed_at),

        "payment_method": order.payment_method,
        "payment_reference": order.payment_reference,
        "referral_code_used": order.referral_code_used,

        "cash_collected_amount": order.cash_collected_amount,
        "cash_collected_at": _iso_datetime(order.cash_collected_at),
        "cash_collected_by_id": order.cash_collected_by_id,
        "cash_collected_by_name": _serialize_user_name(order.cash_collected_by),

        "unit_price_before_discount": order.unit_price_before_discount,
        "unit_discount_percentage": order.unit_discount_percentage,
        "unit_price": order.unit_price,
        "quantity": order.quantity,
        "subtotal_amount": order.subtotal_amount,
        "discount_amount": order.discount_amount,
        "tax_amount": order.tax_amount,
        "total_amount": order.total_amount,
        "amount_paid": order.amount_paid,
        "remaining_amount": order.remaining_amount,

        "issue_reference": order.issue_reference,
        "issued_at": _iso_datetime(order.issued_at),

        "customer_notes": order.customer_notes,
        "internal_notes": order.internal_notes,
        "delivery_notes": order.delivery_notes,
        "cancellation_reason": order.cancellation_reason,

        "has_offer": order.has_offer,
        "has_invoice": bool(invoice),
        "is_paid": order.is_paid,
        "is_cash_on_delivery": order.is_cash_on_delivery,
        "is_cancelled": order.status == Order.Status.CANCELLED,
        "is_refunded": order.status == Order.Status.REFUNDED,
        "is_completed": order.status == Order.Status.COMPLETED,
        "available_actions": list(getattr(order, "available_actions", []) or []),
    }


def _value_changed(before: dict[str, Any], after: dict[str, Any], key: str) -> bool:
    return str(before.get(key) or "") != str(after.get(key) or "")


def _build_update_transition(before: dict[str, Any], after: Order) -> dict[str, Any]:
    after_snapshot = _snapshot_order(after)

    tracked_keys = [
        "customer_id",
        "customer_name",
        "customer_phone",
        "product_id",
        "product_name",
        "product_type",
        "contract_product_id",
        "offer_id",
        "offer_source",
        "offer_title",
        "offer_badge",
        "order_kind",
        "starts_at",
        "ends_at",
        "scheduled_at",
        "duration_days",
        "is_subscription_like",
        "is_service_like",
        "provider_id",
        "provider_name",
        "contract_id",
        "contract_number",
        "contract_title",
        "agent_id",
        "agent_code",
        "agent_name",
        "delivery_agent_id",
        "delivery_agent_code",
        "delivery_agent_name",
        "invoice_id",
        "invoice_number",
        "status",
        "payment_status",
        "fulfillment_status",
        "source",
        "confirmed_at",
        "card_printed_at",
        "card_ready_at",
        "assigned_for_delivery_at",
        "out_for_delivery_at",
        "delivered_at",
        "completed_at",
        "payment_method",
        "payment_reference",
        "referral_code_used",
        "cash_collected_amount",
        "cash_collected_at",
        "cash_collected_by_id",
        "cash_collected_by_name",
        "unit_price_before_discount",
        "unit_discount_percentage",
        "unit_price",
        "quantity",
        "subtotal_amount",
        "discount_amount",
        "tax_amount",
        "total_amount",
        "amount_paid",
        "remaining_amount",
        "issue_reference",
        "issued_at",
        "customer_notes",
        "internal_notes",
        "delivery_notes",
        "cancellation_reason",
        "has_offer",
        "has_invoice",
        "is_paid",
        "is_cash_on_delivery",
        "is_cancelled",
        "is_refunded",
        "is_completed",
    ]

    changed_fields = [
        key
        for key in tracked_keys
        if _value_changed(before, after_snapshot, key)
    ]

    return {
        "changed_fields": changed_fields,
        "has_changes": bool(changed_fields),

        "status_before": before.get("status"),
        "status_after": after_snapshot.get("status"),

        "payment_status_before": before.get("payment_status"),
        "payment_status_after": after_snapshot.get("payment_status"),

        "fulfillment_status_before": before.get("fulfillment_status"),
        "fulfillment_status_after": after_snapshot.get("fulfillment_status"),

        "offer_id_before": before.get("offer_id"),
        "offer_id_after": after_snapshot.get("offer_id"),

        "contract_product_id_before": before.get("contract_product_id"),
        "contract_product_id_after": after_snapshot.get("contract_product_id"),

        "offer_source_before": before.get("offer_source"),
        "offer_source_after": after_snapshot.get("offer_source"),

        "offer_title_before": before.get("offer_title"),
        "offer_title_after": after_snapshot.get("offer_title"),

        "offer_badge_before": before.get("offer_badge"),
        "offer_badge_after": after_snapshot.get("offer_badge"),

        "order_kind_before": before.get("order_kind"),
        "order_kind_after": after_snapshot.get("order_kind"),

        "starts_at_before": before.get("starts_at"),
        "starts_at_after": after_snapshot.get("starts_at"),

        "ends_at_before": before.get("ends_at"),
        "ends_at_after": after_snapshot.get("ends_at"),

        "scheduled_at_before": before.get("scheduled_at"),
        "scheduled_at_after": after_snapshot.get("scheduled_at"),

        "payment_method_before": before.get("payment_method"),
        "payment_method_after": after_snapshot.get("payment_method"),

        "customer_id_before": before.get("customer_id"),
        "customer_id_after": after_snapshot.get("customer_id"),

        "product_id_before": before.get("product_id"),
        "product_id_after": after_snapshot.get("product_id"),

        "provider_id_before": before.get("provider_id"),
        "provider_id_after": after_snapshot.get("provider_id"),

        "contract_id_before": before.get("contract_id"),
        "contract_id_after": after_snapshot.get("contract_id"),

        "agent_id_before": before.get("agent_id"),
        "agent_id_after": after_snapshot.get("agent_id"),

        "delivery_agent_id_before": before.get("delivery_agent_id"),
        "delivery_agent_id_after": after_snapshot.get("delivery_agent_id"),

        "invoice_id_before": before.get("invoice_id"),
        "invoice_id_after": after_snapshot.get("invoice_id"),

        "cash_collected_amount_before": before.get("cash_collected_amount"),
        "cash_collected_amount_after": after_snapshot.get("cash_collected_amount"),

        "cash_collected_at_before": before.get("cash_collected_at"),
        "cash_collected_at_after": after_snapshot.get("cash_collected_at"),

        "unit_price_before_discount_before": before.get("unit_price_before_discount"),
        "unit_price_before_discount_after": after_snapshot.get("unit_price_before_discount"),

        "unit_discount_percentage_before": before.get("unit_discount_percentage"),
        "unit_discount_percentage_after": after_snapshot.get("unit_discount_percentage"),

        "unit_price_before": before.get("unit_price"),
        "unit_price_after": after_snapshot.get("unit_price"),

        "total_amount_before": before.get("total_amount"),
        "total_amount_after": after_snapshot.get("total_amount"),

        "amount_paid_before": before.get("amount_paid"),
        "amount_paid_after": after_snapshot.get("amount_paid"),

        "remaining_amount_before": before.get("remaining_amount"),
        "remaining_amount_after": after_snapshot.get("remaining_amount"),

        "referral_code_before": before.get("referral_code_used"),
        "referral_code_after": after_snapshot.get("referral_code_used"),

        "before": before,
        "after": after_snapshot,
    }


def _build_order_context(order: Order) -> dict[str, Any]:
    invoice = _get_linked_invoice(order)

    return {
        "customer": {
            "customer_id": order.customer_id,
            "has_customer": bool(order.customer_id),
            "customer_name": _safe_attr(order.customer, "display_name", "full_name", "name"),
            "customer_phone": _safe_attr(order.customer, "normalized_phone", "phone_number", "whatsapp_number"),
            "has_customer_account": bool(
                getattr(order.customer, "user_id", None)
            ) if order.customer_id else False,
            "phone_verified": bool(
                getattr(order.customer, "phone_verified_at", None)
            ) if order.customer_id else False,
            "whatsapp_verified": bool(
                getattr(order.customer, "whatsapp_verified_at", None)
            ) if order.customer_id else False,
        },
        "offer": _serialize_offer_snapshot(order),
        "agent": {
            "agent_id": order.agent_id,
            "has_agent": bool(order.agent_id),
            "agent_code": _safe_attr(order.agent, "agent_code", "code"),
            "agent_name": _safe_attr(order.agent, "display_name", "full_name", "name"),
            "referral_code_used": order.referral_code_used,
        },
        "delivery": {
            "delivery_agent_id": order.delivery_agent_id,
            "has_delivery_agent": bool(order.delivery_agent_id),
            "delivery_agent_code": _safe_attr(order.delivery_agent, "agent_code", "code"),
            "delivery_agent_name": _safe_attr(order.delivery_agent, "display_name", "full_name", "name"),
            "delivery_agent_phone": _safe_attr(order.delivery_agent, "phone_number", "phone"),
            "assigned_for_delivery_at": _iso_datetime(order.assigned_for_delivery_at),
            "out_for_delivery_at": _iso_datetime(order.out_for_delivery_at),
            "delivered_at": _iso_datetime(order.delivered_at),
            "delivery_notes": order.delivery_notes,
        },
        "provider": {
            "provider_id": order.provider_id,
            "has_provider": bool(order.provider_id),
            "provider_name": _safe_attr(order.provider, "name", "display_name", "provider_name"),
        },
        "contract": {
            "contract_id": order.contract_id,
            "has_contract": bool(order.contract_id),
            "contract_number": _safe_attr(order.contract, "contract_number", "number"),
            "contract_title": _safe_attr(order.contract, "title", "name"),
        },
        "product": {
            "product_id": order.product_id,
            "product_name": order.product_name,
            "product_type": order.product_type,
        },
        "business": {
            "order_kind": order.order_kind,
            "is_subscription_like": order.is_subscription_like,
            "is_service_like": order.is_service_like,
        },
        "validity": {
            "starts_at": _iso_date(order.starts_at),
            "ends_at": _iso_date(order.ends_at),
            "duration_days": order.duration_days,
            "scheduled_at": _iso_datetime(order.scheduled_at),
        },
        "invoice": {
            "invoice_id": invoice.id if invoice else None,
            "has_invoice": bool(invoice),
            "invoice_number": _safe_attr(invoice, "invoice_number", "number"),
            "status": _safe_attr(invoice, "status"),
            "journal_entry_reference": _safe_attr(invoice, "journal_entry_reference", "accounting_entry_reference"),
            "is_accounting_posted": bool(_safe_attr(invoice, "is_accounting_posted", default=False)),
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
            "cash_collected_at": _iso_datetime(order.cash_collected_at),
            "cash_collected_by_id": order.cash_collected_by_id,
            "cash_collected_by_name": _serialize_user_name(order.cash_collected_by),
        },
        "fulfillment": {
            "status": order.fulfillment_status,
            "issue_reference": order.issue_reference,
            "issued_at": _iso_datetime(order.issued_at),
            "card_printed_at": _iso_datetime(order.card_printed_at),
            "card_ready_at": _iso_datetime(order.card_ready_at),
        },
        "financial": _build_financial_context(order),
        "lifecycle": {
            "can_be_confirmed": order.can_be_confirmed,
            "can_be_marked_card_ready": order.can_be_marked_card_ready,
            "can_be_assigned_for_delivery": order.can_be_assigned_for_delivery,
            "can_start_delivery": order.can_start_delivery,
            "can_be_delivered": order.can_be_delivered,
            "can_be_completed": order.can_be_completed,
            "can_be_cancelled": order.can_be_cancelled,
            "is_cancelled": order.status == Order.Status.CANCELLED,
            "is_refunded": order.status == Order.Status.REFUNDED,
            "is_completed": order.status == Order.Status.COMPLETED,
        },
        "source": order.source,
    }


# ============================================================
# 🔹 Order Detail API
# ============================================================

@require_http_methods(["GET", "PATCH", "PUT", "DELETE"])
def order_detail_api(request, order_id: int):
    user, auth_error = _ensure_authenticated(request)

    if auth_error:
        return auth_error

    order = get_object_or_404(_orders_queryset(), pk=order_id)

    if request.method == "GET":
        serialized_order = serialize_order(order)
        context = _build_order_context(order)

        response_data = {
            "order": serialized_order,
            "context": context,
        }

        return _json_success(
            response_data,
            message="Order loaded successfully.",
            extra={
                "order": serialized_order,
                "context": context,
            },
        )

    if request.method in {"PATCH", "PUT"}:
        try:
            payload = parse_json_body(request)
            before = _snapshot_order(order)

            updated_order = update_order(
                instance=order,
                payload=payload,
                user=user,
            )

            fresh_order = _orders_queryset().get(pk=updated_order.pk)
            serialized_order = serialize_order(fresh_order)
            transition = _build_update_transition(before, fresh_order)
            context = _build_order_context(fresh_order)

            response_data = {
                "order": serialized_order,
                "transition": transition,
                "context": context,
            }

            return _json_success(
                response_data,
                message="Order updated successfully.",
                extra={
                    "order": serialized_order,
                    "transition": transition,
                    "context": context,
                },
            )

        except ValidationError as exc:
            return _json_error(
                "Validation failed while updating order.",
                400,
                errors=_validation_errors(exc),
            )

        except Exception as exc:
            logger.exception("Failed to update order %s: %s", order_id, exc)
            return _json_error("Unexpected error while updating order.", 500)

    if request.method == "DELETE":
        try:
            payload = parse_json_body(request)
            before = _snapshot_order(order)

            reason = _clean_text(
                payload.get("reason")
                or payload.get("cancellation_reason")
                or "Cancelled from order detail API."
            )

            cancelled_order = cancel_order(
                instance=order,
                reason=reason,
                user=user,
                note=_clean_text(payload.get("status_note")) or reason,
            )

            fresh_order = _orders_queryset().get(pk=cancelled_order.pk)
            serialized_order = serialize_order(fresh_order)
            transition = _build_update_transition(before, fresh_order)
            context = _build_order_context(fresh_order)

            response_data = {
                "order": serialized_order,
                "transition": transition,
                "context": context,
                "cancel": {
                    "reason": reason,
                    "safe_cancel": True,
                    "deleted": False,
                },
            }

            return _json_success(
                response_data,
                message="Order cancelled successfully.",
                extra={
                    "order": serialized_order,
                    "transition": transition,
                    "context": context,
                },
            )

        except ValidationError as exc:
            return _json_error(
                "Validation failed while cancelling order.",
                400,
                errors=_validation_errors(exc),
            )

        except Exception as exc:
            logger.exception("Failed to cancel order %s: %s", order_id, exc)
            return _json_error("Unexpected error while cancelling order.", 500)

    return _json_error("Unsupported method.", 405)