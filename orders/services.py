# ============================================================
# 📂 orders/services.py
# 🧭 Primey Care — Orders Services V2.7
# ------------------------------------------------------------
# ✅ Parsing / Validation / Serialization
# ✅ Filtering / Pagination
# ✅ Create / Update Order
# ✅ Auto resolve/create Customer from phone when customer_id is missing
# ✅ Auto resolve Agent from current logged-in agent user
# ✅ Allow system/order managers to assign an optional sales agent
# ✅ Support public checkout referral/agent code resolution
# ✅ Support offer_id / contract_product_id from /api/offers/
# ✅ Auto resolve Product / Provider / Contract from ContractProduct
# ✅ Apply ContractProduct pricing snapshot when available
# ✅ Supports Order fields:
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
# ✅ Full Order Lifecycle
# ✅ Status history tracking
# ✅ Operational Order Timeline tracking
# ✅ Product/Offer financial snapshot
# ✅ Payment status synchronization
# ✅ Optional AgentOrder + AgentCommission creation
# ✅ Optional Invoice creation via invoices.services.create_invoice_from_order
# ✅ Auto create AgentFinancialEntry for:
#    - COD custody on collecting cash
#    - Sales agent commission on completed order
#    - Delivery agent fee on completed order
#    - Broker share on completed order when broker is linked
# ✅ Auto post AgentFinancialEntry to accounting when available
# ✅ Compatible with Accounting / Treasury backend flow
# ------------------------------------------------------------
# ✅ Business Rule:
#    - Product = كتالوج ثابت
#    - ContractProduct = عرض/سعر/خصم المنتج حسب مقدم الخدمة والعقد
#    - إذا جاء الطلب من /api/offers/ يجب إرسال offer_id أو contract_product_id
#    - Order يحفظ Snapshot ولا يتأثر بتغيير العرض لاحقًا
# ============================================================

from __future__ import annotations

import json
import logging
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from importlib import import_module
from typing import Any, Callable, Optional

from django.apps import apps
from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Q, QuerySet
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

from customers.models import Customer, normalize_customer_phone
from customers.services import get_or_create_customer_from_phone
from orders.models import Order, OrderStatusHistory, OrderTimeline
from products.models import Product


logger = logging.getLogger(__name__)


# ============================================================
# 🔹 Constants
# ============================================================

DEFAULT_TAX_RATE = Decimal("15.00")

AGENT_ASSIGN_PERMISSION_CODES = {
    "orders.assign_agent",
    "orders.create_for_agent",
    "agents.view",
    "agents.list",
    "agents.manage",
}

DELIVERY_ASSIGN_PERMISSION_CODES = {
    "orders.assign_delivery",
    "orders.delivery.assign",
    "orders.manage_delivery",
    "agents.view",
    "agents.list",
    "agents.manage",
}

SYSTEM_MANAGER_ROLES = {
    "system_admin",
    "superuser",
    "admin",
    "order_manager",
    "orders_manager",
    "sales_manager",
    "support",
}

AGENT_ROLE_VALUES = {
    "agent",
    "agent_user",
    "sales_agent",
    "representative",
}


# ============================================================
# 🔹 JSON Helpers
# ============================================================

def parse_json_body(request) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        data = json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValidationError(f"Invalid JSON body: {exc}") from exc

    if not isinstance(data, dict):
        raise ValidationError("JSON body must be an object.")

    return data


# ============================================================
# 🔹 Primitive Helpers
# ============================================================

def normalize_text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def normalize_lower(value: Any, default: str = "") -> str:
    return normalize_text(value, default).lower()


def parse_bool(value: Any, default: bool | None = None) -> bool | None:
    if value in (None, ""):
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return bool(value)

    value_str = str(value).strip().lower()

    if value_str in {"1", "true", "yes", "y", "on", "نعم", "صح"}:
        return True

    if value_str in {"0", "false", "no", "n", "off", "لا", "خطأ"}:
        return False

    return default


def parse_int(value: Any, default: int | None = None) -> int | None:
    if value in (None, ""):
        return default

    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def parse_decimal(value: Any, default: Decimal | None = None) -> Decimal | None:
    if value in (None, ""):
        return default

    try:
        return Decimal(str(value).strip()).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
    except (InvalidOperation, AttributeError, TypeError, ValueError) as exc:
        raise ValidationError(f"Invalid decimal value: {value}") from exc


def money(value: Any, default: Decimal = Decimal("0.00")) -> Decimal:
    parsed = parse_decimal(value, default)

    if parsed is None:
        return default.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    if parsed < Decimal("0.00"):
        return Decimal("0.00")

    return parsed.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def percent(value: Any, default: Decimal = Decimal("0.00")) -> Decimal:
    parsed = parse_decimal(value, default)

    if parsed is None:
        parsed = default

    if parsed < Decimal("0.00"):
        return Decimal("0.00")

    if parsed > Decimal("100.00"):
        return Decimal("100.00")

    return parsed.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def parse_date_value(value: Any):
    if value in (None, ""):
        return None

    if hasattr(value, "year") and hasattr(value, "month") and hasattr(value, "day"):
        if hasattr(value, "date") and not isinstance(value, str):
            try:
                return value.date()
            except Exception:
                return value
        return value

    parsed = parse_date(str(value))

    if parsed is None:
        parsed_datetime = parse_datetime(str(value))
        if parsed_datetime is not None:
            return parsed_datetime.date()

    if parsed is None:
        raise ValidationError(f"Invalid date value: {value}")

    return parsed


def parse_datetime_value(value: Any):
    if value in (None, ""):
        return None

    if hasattr(value, "isoformat"):
        return value

    parsed = parse_datetime(str(value))

    if parsed is None:
        raise ValidationError(f"Invalid datetime value: {value}")

    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())

    return parsed


def _first_non_empty(*values: Any) -> Any:
    for value in values:
        if value not in (None, "", [], {}, ()):
            return value
    return None


def _safe_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


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


def _resolve_import_callable(module_path: str, function_name: str) -> Optional[Callable[..., Any]]:
    try:
        module = import_module(module_path)
        fn = getattr(module, function_name, None)

        if callable(fn):
            return fn

    except Exception as exc:
        logger.debug("Unable to import %s.%s: %s", module_path, function_name, exc)

    return None


def _get_optional_model(app_label: str, model_name: str):
    try:
        return apps.get_model(app_label, model_name)
    except LookupError:
        return None


def _model_has_field(model, field_name: str) -> bool:
    if not model:
        return False

    try:
        model._meta.get_field(field_name)
        return True
    except Exception:
        return False


def _safe_order_latest(queryset):
    model = getattr(queryset, "model", None)

    for field_name in ("updated_at", "created_at", "id"):
        if model and _model_has_field(model, field_name):
            direction = f"-{field_name}" if field_name != "id" else "-id"
            try:
                return queryset.order_by(direction)
            except Exception:
                return queryset

    return queryset


# ============================================================
# 🔹 User / Permission Helpers
# ============================================================

def _is_authenticated_user(user) -> bool:
    return bool(getattr(user, "is_authenticated", False))


def _collect_codes_from_value(value: Any) -> set[str]:
    codes: set[str] = set()

    if not value:
        return codes

    if isinstance(value, str):
        codes.add(value)
        return codes

    if isinstance(value, (list, tuple, set)):
        for item in value:
            codes |= _collect_codes_from_value(item)
        return codes

    if isinstance(value, dict):
        for key in ("code", "codes", "permission", "permissions", "permission_codes"):
            if key in value:
                codes |= _collect_codes_from_value(value.get(key))
        return codes

    for attr_name in ("code", "codes", "permission_codes"):
        attr_value = getattr(value, attr_name, None)
        if attr_value:
            codes |= _collect_codes_from_value(attr_value)

    return codes


def _get_user_permission_codes(user) -> set[str]:
    codes: set[str] = set()

    if not user:
        return codes

    for attr_name in (
        "permission_codes",
        "permissions",
        "profile_permissions",
        "extra_permissions",
    ):
        codes |= _collect_codes_from_value(getattr(user, attr_name, None))

    profile = getattr(user, "profile", None) or getattr(user, "userprofile", None)
    if profile:
        for attr_name in (
            "permission_codes",
            "permissions",
            "profile_permissions",
            "extra_data",
        ):
            codes |= _collect_codes_from_value(getattr(profile, attr_name, None))

    return {normalize_lower(code) for code in codes if normalize_text(code)}


def _get_user_role_values(user) -> set[str]:
    values: set[str] = set()

    if not user:
        return values

    candidate_attrs = (
        "role",
        "user_type",
        "account_type",
        "workspace",
        "type",
    )

    for attr_name in candidate_attrs:
        value = getattr(user, attr_name, None)
        if value not in (None, ""):
            values.add(normalize_lower(value))

    profile = getattr(user, "profile", None) or getattr(user, "userprofile", None)
    if profile:
        for attr_name in candidate_attrs:
            value = getattr(profile, attr_name, None)
            if value not in (None, ""):
                values.add(normalize_lower(value))

        extra_data = getattr(profile, "extra_data", None)
        if isinstance(extra_data, dict):
            for key in candidate_attrs:
                value = extra_data.get(key)
                if value not in (None, ""):
                    values.add(normalize_lower(value))

    return values


def _user_can_assign_agent(user) -> bool:
    if not _is_authenticated_user(user):
        return False

    if getattr(user, "is_superuser", False):
        return True

    role_values = _get_user_role_values(user)
    if role_values & SYSTEM_MANAGER_ROLES:
        return True

    permission_codes = _get_user_permission_codes(user)
    if permission_codes & AGENT_ASSIGN_PERMISSION_CODES:
        return True

    return False


def _user_can_assign_delivery(user) -> bool:
    if not _is_authenticated_user(user):
        return False

    if getattr(user, "is_superuser", False):
        return True

    role_values = _get_user_role_values(user)
    if role_values & SYSTEM_MANAGER_ROLES:
        return True

    permission_codes = _get_user_permission_codes(user)
    if permission_codes & DELIVERY_ASSIGN_PERMISSION_CODES:
        return True

    return False


def _user_looks_like_agent(user) -> bool:
    if not _is_authenticated_user(user):
        return False

    role_values = _get_user_role_values(user)
    if role_values & AGENT_ROLE_VALUES:
        return True

    workspace = normalize_lower(getattr(user, "workspace", ""))
    user_type = normalize_lower(getattr(user, "user_type", ""))
    role = normalize_lower(getattr(user, "role", ""))

    return "agent" in {workspace, user_type, role}


# ============================================================
# 🔹 Pagination
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

# ============================================================
# 🔹 Filters
# ============================================================

def apply_order_filters(queryset: QuerySet[Order], params) -> QuerySet[Order]:
    q = normalize_text(params.get("q") or params.get("search"))
    status = normalize_lower(params.get("status"))
    payment_status = normalize_lower(params.get("payment_status"))
    fulfillment_status = normalize_lower(params.get("fulfillment_status"))
    source = normalize_lower(params.get("source"))
    order_kind = normalize_lower(params.get("order_kind") or params.get("kind"))
    payment_method = normalize_lower(params.get("payment_method"))
    offer_source = normalize_lower(params.get("offer_source"))

    customer_id = parse_int(params.get("customer_id"))
    product_id = parse_int(params.get("product_id"))
    provider_id = parse_int(params.get("provider_id"))
    contract_id = parse_int(params.get("contract_id"))
    contract_product_id = parse_int(params.get("contract_product_id") or params.get("offer_id"))
    agent_id = parse_int(params.get("agent_id"))
    delivery_agent_id = parse_int(params.get("delivery_agent_id"))
    invoice_id = parse_int(params.get("invoice_id"))
    created_by_id = parse_int(params.get("created_by_id"))

    is_cod = parse_bool(params.get("is_cod"), None)
    cash_collected = parse_bool(params.get("cash_collected"), None)

    starts_from = normalize_text(params.get("starts_from") or params.get("start_from"))
    starts_to = normalize_text(params.get("starts_to") or params.get("start_to"))
    ends_from = normalize_text(params.get("ends_from") or params.get("end_from"))
    ends_to = normalize_text(params.get("ends_to") or params.get("end_to"))

    date_from = normalize_text(params.get("date_from"))
    date_to = normalize_text(params.get("date_to"))

    if q:
        normalized_phone = normalize_customer_phone(q)

        search_filter = (
            Q(order_number__icontains=q)
            | Q(product_name__icontains=q)
            | Q(product_type__icontains=q)
            | Q(order_kind__icontains=q)
            | Q(offer_title__icontains=q)
            | Q(offer_badge__icontains=q)
            | Q(offer_source__icontains=q)
            | Q(payment_method__icontains=q)
            | Q(payment_reference__icontains=q)
            | Q(referral_code_used__icontains=q)
            | Q(customer__customer_code__icontains=q)
            | Q(customer__display_name__icontains=q)
            | Q(customer__phone_number__icontains=q)
            | Q(customer__whatsapp_number__icontains=q)
            | Q(customer__normalized_phone__icontains=q)
            | Q(customer__email__icontains=q)
            | Q(product__name__icontains=q)
            | Q(product__code__icontains=q)
            | Q(contract_product__offer_title__icontains=q)
            | Q(contract_product__offer_subtitle__icontains=q)
            | Q(contract_product__offer_badge__icontains=q)
            | Q(contract_product__product__name__icontains=q)
            | Q(contract_product__product__code__icontains=q)
            | Q(provider__name__icontains=q)
            | Q(provider__name_ar__icontains=q)
            | Q(provider__name_en__icontains=q)
            | Q(agent__full_name__icontains=q)
            | Q(agent__agent_code__icontains=q)
            | Q(delivery_agent__full_name__icontains=q)
            | Q(delivery_agent__agent_code__icontains=q)
            | Q(customer_notes__icontains=q)
            | Q(internal_notes__icontains=q)
            | Q(delivery_notes__icontains=q)
            | Q(issue_reference__icontains=q)
        )

        if normalized_phone:
            search_filter |= Q(customer__normalized_phone__icontains=normalized_phone)

        queryset = queryset.filter(search_filter)

    if status:
        queryset = queryset.filter(status=status)

    if payment_status:
        queryset = queryset.filter(payment_status=payment_status)

    if fulfillment_status:
        queryset = queryset.filter(fulfillment_status=fulfillment_status)

    if source:
        queryset = queryset.filter(source=source)

    if order_kind:
        queryset = queryset.filter(order_kind=order_kind)

    if offer_source:
        queryset = queryset.filter(offer_source=offer_source)

    if payment_method:
        queryset = queryset.filter(payment_method=payment_method)

    if customer_id:
        queryset = queryset.filter(customer_id=customer_id)

    if product_id:
        queryset = queryset.filter(product_id=product_id)

    if provider_id:
        queryset = queryset.filter(provider_id=provider_id)

    if contract_id:
        queryset = queryset.filter(contract_id=contract_id)

    if contract_product_id:
        queryset = queryset.filter(contract_product_id=contract_product_id)

    if agent_id:
        queryset = queryset.filter(agent_id=agent_id)

    if delivery_agent_id:
        queryset = queryset.filter(delivery_agent_id=delivery_agent_id)

    if invoice_id:
        queryset = queryset.filter(invoice__id=invoice_id)

    if created_by_id:
        queryset = queryset.filter(created_by_id=created_by_id)

    if is_cod is True:
        queryset = queryset.filter(payment_method=Order.PaymentMethod.CASH_ON_DELIVERY)
    elif is_cod is False:
        queryset = queryset.exclude(payment_method=Order.PaymentMethod.CASH_ON_DELIVERY)

    if cash_collected is True:
        queryset = queryset.filter(
            cash_collected_amount__gt=Decimal("0.00"),
            cash_collected_at__isnull=False,
        )
    elif cash_collected is False:
        queryset = queryset.filter(payment_method=Order.PaymentMethod.CASH_ON_DELIVERY).filter(
            Q(cash_collected_amount__lte=Decimal("0.00")) | Q(cash_collected_at__isnull=True)
        )

    if starts_from:
        queryset = queryset.filter(starts_at__gte=starts_from)

    if starts_to:
        queryset = queryset.filter(starts_at__lte=starts_to)

    if ends_from:
        queryset = queryset.filter(ends_at__gte=ends_from)

    if ends_to:
        queryset = queryset.filter(ends_at__lte=ends_to)

    if date_from:
        queryset = queryset.filter(created_at__date__gte=date_from)

    if date_to:
        queryset = queryset.filter(created_at__date__lte=date_to)

    return queryset.order_by("-created_at", "-id")


# ============================================================
# 🔹 Validation Helpers
# ============================================================

def _validate_status(value: str) -> str:
    allowed = {choice for choice, _ in Order.Status.choices}

    if value not in allowed:
        raise ValidationError(f"Invalid status. Allowed values: {sorted(allowed)}")

    return value


def _validate_payment_status(value: str) -> str:
    allowed = {choice for choice, _ in Order.PaymentStatus.choices}

    if value not in allowed:
        raise ValidationError(f"Invalid payment_status. Allowed values: {sorted(allowed)}")

    return value


def _validate_fulfillment_status(value: str) -> str:
    allowed = {choice for choice, _ in Order.FulfillmentStatus.choices}

    if value not in allowed:
        raise ValidationError(f"Invalid fulfillment_status. Allowed values: {sorted(allowed)}")

    return value


def _validate_source(value: str) -> str:
    allowed = {choice for choice, _ in Order.OrderSource.choices}

    if value not in allowed:
        raise ValidationError(f"Invalid source. Allowed values: {sorted(allowed)}")

    return value


def _validate_order_kind(value: str) -> str:
    allowed = {choice for choice, _ in Order.OrderKind.choices}

    if value not in allowed:
        raise ValidationError(f"Invalid order_kind. Allowed values: {sorted(allowed)}")

    return value


def _validate_payment_method(value: str) -> str:
    allowed = {choice for choice, _ in Order.PaymentMethod.choices}

    if value not in allowed:
        raise ValidationError(f"Invalid payment_method. Allowed values: {sorted(allowed)}")

    return value


def _validate_status_transition(from_status: str, to_status: str) -> None:
    if from_status == to_status:
        return

    allowed_transitions = {
        Order.Status.DRAFT: {
            Order.Status.PENDING,
            Order.Status.CANCELLED,
        },
        Order.Status.PENDING: {
            Order.Status.CONFIRMED,
            Order.Status.CANCELLED,
        },
        Order.Status.CONFIRMED: {
            Order.Status.PROCESSING,
            Order.Status.CARD_READY,
            Order.Status.ASSIGNED_FOR_DELIVERY,
            Order.Status.COMPLETED,
            Order.Status.CANCELLED,
        },
        Order.Status.PROCESSING: {
            Order.Status.CARD_READY,
            Order.Status.ASSIGNED_FOR_DELIVERY,
            Order.Status.COMPLETED,
            Order.Status.CANCELLED,
        },
        Order.Status.CARD_READY: {
            Order.Status.ASSIGNED_FOR_DELIVERY,
            Order.Status.OUT_FOR_DELIVERY,
            Order.Status.DELIVERED,
            Order.Status.CANCELLED,
        },
        Order.Status.ASSIGNED_FOR_DELIVERY: {
            Order.Status.OUT_FOR_DELIVERY,
            Order.Status.DELIVERED,
            Order.Status.CANCELLED,
        },
        Order.Status.OUT_FOR_DELIVERY: {
            Order.Status.DELIVERED,
            Order.Status.CANCELLED,
        },
        Order.Status.DELIVERED: {
            Order.Status.COMPLETED,
            Order.Status.REFUNDED,
        },
        Order.Status.COMPLETED: {
            Order.Status.REFUNDED,
        },
        Order.Status.CANCELLED: set(),
        Order.Status.REFUNDED: set(),
    }

    if to_status not in allowed_transitions.get(from_status, set()):
        raise ValidationError(f"Invalid order status transition: {from_status} -> {to_status}")


# ============================================================
# 🔹 Customer Resolve Helpers
# ============================================================

def _resolve_customer(customer_id: Any) -> Customer:
    if customer_id in (None, "", 0, "0"):
        raise ValidationError("Customer is required.")

    try:
        return Customer.objects.get(pk=int(customer_id))
    except (Customer.DoesNotExist, TypeError, ValueError) as exc:
        raise ValidationError("Selected customer does not exist.") from exc


def _payload_has_customer_id(payload: dict[str, Any]) -> bool:
    customer_id = payload.get("customer_id") or payload.get("customer")
    return customer_id not in (None, "", 0, "0")


def _resolve_customer_phone_from_payload(payload: dict[str, Any]) -> str:
    customer_payload = _safe_dict(payload.get("customer"))

    return normalize_text(
        _first_non_empty(
            payload.get("customer_phone"),
            payload.get("customer_phone_number"),
            payload.get("customer_mobile"),
            payload.get("customer_whatsapp"),
            payload.get("phone_number"),
            payload.get("mobile_number"),
            payload.get("whatsapp_number"),
            payload.get("phone"),
            payload.get("whatsapp"),
            customer_payload.get("phone_number"),
            customer_payload.get("whatsapp_number"),
            customer_payload.get("phone"),
            customer_payload.get("whatsapp"),
            customer_payload.get("mobile_number"),
            "",
        )
    )


def _resolve_customer_source_from_payload(payload: dict[str, Any]) -> str:
    source = normalize_lower(
        _first_non_empty(
            payload.get("customer_source"),
            payload.get("source"),
            payload.get("order_source"),
            "",
        )
    )

    allowed_sources = {
        Customer.Source.WEBSITE,
        Customer.Source.WHATSAPP,
        Customer.Source.AGENT,
        Customer.Source.ADMIN,
        Customer.Source.IMPORT,
        Customer.Source.OTHER,
    }

    if source in allowed_sources:
        return source

    order_source = normalize_lower(payload.get("source"))
    if order_source == getattr(Order.OrderSource, "AGENT", "agent"):
        return Customer.Source.AGENT

    if order_source == getattr(Order.OrderSource, "WEBSITE", "website"):
        return Customer.Source.WEBSITE

    if order_source == getattr(Order.OrderSource, "LANDING", "landing"):
        return Customer.Source.WEBSITE

    if order_source == getattr(Order.OrderSource, "CHECKOUT", "checkout"):
        return Customer.Source.WEBSITE

    return Customer.Source.ADMIN


def _build_customer_payload_from_order_payload(payload: dict[str, Any]) -> dict[str, Any]:
    customer_payload = _safe_dict(payload.get("customer"))

    full_name = normalize_text(
        _first_non_empty(
            payload.get("customer_name"),
            payload.get("full_name"),
            payload.get("name"),
            customer_payload.get("display_name"),
            customer_payload.get("full_name"),
            customer_payload.get("name"),
            "",
        )
    )

    phone_number = _resolve_customer_phone_from_payload(payload)

    return {
        "first_name": normalize_text(
            _first_non_empty(
                payload.get("customer_first_name"),
                payload.get("first_name"),
                customer_payload.get("first_name"),
                "",
            )
        ),
        "last_name": normalize_text(
            _first_non_empty(
                payload.get("customer_last_name"),
                payload.get("last_name"),
                customer_payload.get("last_name"),
                "",
            )
        ),
        "display_name": full_name,
        "full_name": full_name,
        "name": full_name,
        "email": normalize_lower(
            _first_non_empty(
                payload.get("customer_email"),
                payload.get("email"),
                customer_payload.get("email"),
                "",
            )
        ),
        "phone_number": phone_number,
        "whatsapp_number": normalize_text(
            _first_non_empty(
                payload.get("customer_whatsapp"),
                payload.get("whatsapp_number"),
                payload.get("whatsapp"),
                customer_payload.get("whatsapp_number"),
                customer_payload.get("whatsapp"),
                phone_number,
            )
        ),
        "city": normalize_text(
            _first_non_empty(
                payload.get("customer_city"),
                payload.get("city"),
                customer_payload.get("city"),
                "",
            )
        ),
        "district": normalize_text(
            _first_non_empty(
                payload.get("customer_district"),
                payload.get("district"),
                customer_payload.get("district"),
                "",
            )
        ),
        "street_address": normalize_text(
            _first_non_empty(
                payload.get("customer_address"),
                payload.get("street_address"),
                payload.get("address"),
                customer_payload.get("street_address"),
                customer_payload.get("address"),
                "",
            )
        ),
        "national_address_text": normalize_text(
            _first_non_empty(
                payload.get("national_address_text"),
                customer_payload.get("national_address_text"),
                "",
            )
        ),
        "national_id": normalize_text(
            _first_non_empty(
                payload.get("customer_national_id"),
                payload.get("national_id"),
                customer_payload.get("national_id"),
                "",
            )
        ),
        "nationality": normalize_text(
            _first_non_empty(
                payload.get("customer_nationality"),
                payload.get("nationality"),
                customer_payload.get("nationality"),
                "",
            )
        ),
        "gender": normalize_lower(
            _first_non_empty(
                payload.get("customer_gender"),
                payload.get("gender"),
                customer_payload.get("gender"),
                "",
            )
        ),
        "source": _resolve_customer_source_from_payload(payload),
        "notes": normalize_text(
            _first_non_empty(
                payload.get("customer_notes"),
                customer_payload.get("notes"),
                "",
            )
        ),
        "tags": normalize_text(
            _first_non_empty(
                payload.get("customer_tags"),
                customer_payload.get("tags"),
                "",
            )
        ),
    }


def _resolve_customer_from_payload(payload: dict[str, Any], user=None) -> Customer:
    if _payload_has_customer_id(payload):
        return _resolve_customer(payload.get("customer_id") or payload.get("customer"))

    phone_number = _resolve_customer_phone_from_payload(payload)

    if not phone_number:
        raise ValidationError("Customer is required. Send customer_id or customer phone number.")

    account_result = get_or_create_customer_from_phone(
        phone_number=phone_number,
        payload=_build_customer_payload_from_order_payload(payload),
        source=_resolve_customer_source_from_payload(payload),
        create_user=False,
        created_by=user if _is_authenticated_user(user) else None,
    )

    payload["customer_id"] = account_result.customer.pk

    return account_result.customer


# ============================================================
# 🔹 Resolve Helpers
# ============================================================

def _resolve_product(product_id: Any) -> Product:
    if product_id in (None, "", 0, "0"):
        raise ValidationError("Product is required.")

    try:
        return Product.objects.get(pk=int(product_id))
    except (Product.DoesNotExist, TypeError, ValueError) as exc:
        raise ValidationError("Selected product does not exist.") from exc


def _resolve_optional_model(app_label: str, model_name: str, value: Any, error_message: str):
    if value in (None, "", 0, "0"):
        return None

    try:
        model = apps.get_model(app_label, model_name)
    except LookupError as exc:
        raise ValidationError(error_message) from exc

    try:
        return model.objects.get(pk=int(value))
    except (model.DoesNotExist, TypeError, ValueError) as exc:
        raise ValidationError(error_message) from exc


def _resolve_provider(provider_id: Any):
    return _resolve_optional_model(
        "providers",
        "Provider",
        provider_id,
        "Selected provider does not exist.",
    )


def _resolve_contract(contract_id: Any):
    return _resolve_optional_model(
        "contracts",
        "Contract",
        contract_id,
        "Selected contract does not exist.",
    )


def _resolve_contract_product_by_id(value: Any):
    return _resolve_optional_model(
        "contracts",
        "ContractProduct",
        value,
        "Selected offer does not exist.",
    )


def _resolve_agent(agent_id: Any):
    return _resolve_optional_model(
        "agents",
        "Agent",
        agent_id,
        "Selected agent does not exist.",
    )


def _resolve_invoice(invoice_id: Any):
    return _resolve_optional_model(
        "invoices",
        "Invoice",
        invoice_id,
        "Selected invoice does not exist.",
    )


def _resolve_contract_product_id_from_payload(payload: dict[str, Any]) -> int | None:
    return parse_int(
        _first_non_empty(
            payload.get("contract_product_id"),
            payload.get("contract_product"),
            payload.get("offer_id"),
            payload.get("offer"),
            payload.get("selected_offer_id"),
            None,
        )
    )


# ============================================================
# 🔹 New Order Field Resolvers
# ============================================================

def _resolve_order_kind_from_product(product: Product, payload: dict[str, Any]) -> str:
    explicit = normalize_lower(
        _first_non_empty(
            payload.get("order_kind"),
            payload.get("kind"),
            payload.get("request_type"),
            payload.get("order_type"),
            "",
        )
    )

    if explicit:
        return _validate_order_kind(explicit)

    product_type = normalize_lower(
        _first_non_empty(
            payload.get("product_type"),
            _safe_attr(product, "product_type"),
            _safe_attr(product, "type"),
            "",
        )
    )

    mapping = {
        "card": Order.OrderKind.CARD,
        "cards": Order.OrderKind.CARD,
        "membership": Order.OrderKind.CARD,
        "membership_card": Order.OrderKind.CARD,
        "program": Order.OrderKind.PROGRAM,
        "programs": Order.OrderKind.PROGRAM,
        "medical_program": Order.OrderKind.PROGRAM,
        "service": Order.OrderKind.SERVICE,
        "services": Order.OrderKind.SERVICE,
        "medical_service": Order.OrderKind.SERVICE,
        "subscription": Order.OrderKind.SUBSCRIPTION,
        "subscriptions": Order.OrderKind.SUBSCRIPTION,
        "plan": Order.OrderKind.SUBSCRIPTION,
        "plans": Order.OrderKind.SUBSCRIPTION,
    }

    return mapping.get(product_type, Order.OrderKind.GENERAL)


def _resolve_start_date_from_payload(payload: dict[str, Any]):
    value = _first_non_empty(
        payload.get("starts_at"),
        payload.get("start_date"),
        payload.get("subscription_start"),
        payload.get("valid_from"),
        payload.get("effective_from"),
        None,
    )
    return parse_date_value(value)


def _resolve_end_date_from_payload(payload: dict[str, Any]):
    value = _first_non_empty(
        payload.get("ends_at"),
        payload.get("end_date"),
        payload.get("subscription_end"),
        payload.get("valid_to"),
        payload.get("effective_to"),
        None,
    )
    return parse_date_value(value)


def _resolve_scheduled_at_from_payload(payload: dict[str, Any]):
    value = _first_non_empty(
        payload.get("scheduled_at"),
        payload.get("appointment_at"),
        payload.get("service_at"),
        payload.get("service_date"),
        payload.get("execution_at"),
        None,
    )

    if value in (None, ""):
        return None

    if isinstance(value, str) and len(value) == 10:
        parsed_date = parse_date_value(value)
        if parsed_date:
            return timezone.make_aware(
                timezone.datetime.combine(parsed_date, timezone.datetime.min.time()),
                timezone.get_current_timezone(),
            )

    return parse_datetime_value(value)


def _resolve_payment_method_from_payload(payload: dict[str, Any]) -> str:
    value = normalize_lower(
        _first_non_empty(
            payload.get("payment_method"),
            payload.get("payment_type"),
            payload.get("method"),
            "",
        )
    )

    if not value:
        return Order.PaymentMethod.NONE

    aliases = {
        "gateway": Order.PaymentMethod.PAYMENT_GATEWAY,
        "online": Order.PaymentMethod.PAYMENT_GATEWAY,
        "online_payment": Order.PaymentMethod.PAYMENT_GATEWAY,
        "credit_card": Order.PaymentMethod.CARD,
        "mada": Order.PaymentMethod.CARD,
        "visa": Order.PaymentMethod.CARD,
        "mastercard": Order.PaymentMethod.CARD,
        "cod": Order.PaymentMethod.CASH_ON_DELIVERY,
        "cash_delivery": Order.PaymentMethod.CASH_ON_DELIVERY,
        "cash_on_delivery": Order.PaymentMethod.CASH_ON_DELIVERY,
        "transfer": Order.PaymentMethod.BANK_TRANSFER,
        "bank": Order.PaymentMethod.BANK_TRANSFER,
    }

    value = aliases.get(value, value)
    return _validate_payment_method(value)


def _resolve_payment_reference_from_payload(payload: dict[str, Any]) -> str:
    return normalize_text(
        _first_non_empty(
            payload.get("payment_reference"),
            payload.get("payment_ref"),
            payload.get("transaction_reference"),
            payload.get("gateway_reference"),
            payload.get("gateway_transaction_id"),
            payload.get("payment_id"),
            "",
        )
    )


def _resolve_referral_code_used_from_payload(payload: dict[str, Any]) -> str:
    return normalize_text(
        _first_non_empty(
            payload.get("referral_code_used"),
            payload.get("referral_code"),
            payload.get("agent_code"),
            payload.get("employee_code"),
            payload.get("sales_code"),
            payload.get("ref"),
            "",
        )
    )


def _apply_business_fields_to_order(order: Order, product: Product, payload: dict[str, Any]) -> None:
    order.order_kind = _resolve_order_kind_from_product(product, payload)
    order.starts_at = _resolve_start_date_from_payload(payload)
    order.ends_at = _resolve_end_date_from_payload(payload)
    order.scheduled_at = _resolve_scheduled_at_from_payload(payload)
    order.payment_method = _resolve_payment_method_from_payload(payload)
    order.payment_reference = _resolve_payment_reference_from_payload(payload)
    order.referral_code_used = _resolve_referral_code_used_from_payload(payload)


def _patch_business_fields_on_order(instance: Order, product: Product, payload: dict[str, Any]) -> None:
    if any(key in payload for key in ("order_kind", "kind", "request_type", "order_type", "product_type")):
        instance.order_kind = _resolve_order_kind_from_product(product, payload)

    if any(key in payload for key in ("starts_at", "start_date", "subscription_start", "valid_from", "effective_from")):
        instance.starts_at = _resolve_start_date_from_payload(payload)

    if any(key in payload for key in ("ends_at", "end_date", "subscription_end", "valid_to", "effective_to")):
        instance.ends_at = _resolve_end_date_from_payload(payload)

    if any(key in payload for key in ("scheduled_at", "appointment_at", "service_at", "service_date", "execution_at")):
        instance.scheduled_at = _resolve_scheduled_at_from_payload(payload)

    if any(key in payload for key in ("payment_method", "payment_type", "method")):
        instance.payment_method = _resolve_payment_method_from_payload(payload)

    if any(
        key in payload
        for key in (
            "payment_reference",
            "payment_ref",
            "transaction_reference",
            "gateway_reference",
            "gateway_transaction_id",
            "payment_id",
        )
    ):
        instance.payment_reference = _resolve_payment_reference_from_payload(payload)

    if any(
        key in payload
        for key in (
            "referral_code_used",
            "referral_code",
            "agent_code",
            "employee_code",
            "sales_code",
            "ref",
        )
    ):
        instance.referral_code_used = _resolve_referral_code_used_from_payload(payload)


# ============================================================
# 🔹 Agent Resolve Helpers
# ============================================================

def _resolve_agent_code_from_payload(payload: dict[str, Any]) -> str:
    return _resolve_referral_code_used_from_payload(payload)


def _agent_queryset():
    Agent = _get_optional_model("agents", "Agent")
    if not Agent:
        return None
    return Agent.objects.all()


def _find_agent_for_user(user):
    if not _is_authenticated_user(user):
        return None

    queryset = _agent_queryset()
    if queryset is None:
        return None

    Agent = queryset.model
    filters = Q()

    if _model_has_field(Agent, "user"):
        filters |= Q(user_id=user.pk)

    if _model_has_field(Agent, "created_by"):
        filters |= Q(created_by_id=user.pk)

    if _model_has_field(Agent, "email"):
        email = normalize_lower(getattr(user, "email", ""))
        if email:
            filters |= Q(email__iexact=email)

    if not filters:
        return None

    try:
        return queryset.filter(filters).first()
    except Exception:
        return None


def _resolve_agent_by_code(code: str):
    code = normalize_text(code)
    if not code:
        return None

    queryset = _agent_queryset()
    if queryset is None:
        return None

    Agent = queryset.model
    filters = Q()

    for field_name in (
        "agent_code",
        "code",
        "referral_code",
        "employee_code",
        "sales_code",
    ):
        if _model_has_field(Agent, field_name):
            filters |= Q(**{f"{field_name}__iexact": code})

    if not filters:
        return None

    try:
        return queryset.filter(filters).first()
    except Exception:
        return None


def _payload_has_agent_reference(payload: dict[str, Any]) -> bool:
    return bool(
        payload.get("agent_id")
        or payload.get("agent")
        or _resolve_agent_code_from_payload(payload)
    )


def _resolve_agent_for_order(payload: dict[str, Any], user=None, *, existing_agent=None):
    agent_code = _resolve_agent_code_from_payload(payload)

    if _is_authenticated_user(user) and _user_looks_like_agent(user) and not _user_can_assign_agent(user):
        current_agent = _find_agent_for_user(user)
        if not current_agent:
            raise ValidationError("No active agent profile is linked to the current user.")

        payload["agent_id"] = current_agent.pk
        payload["referral_code_used"] = agent_code or _safe_attr(
            current_agent,
            "agent_code",
            "code",
            "referral_code",
            default="",
        )
        return current_agent

    if _is_authenticated_user(user) and _user_can_assign_agent(user):
        explicit_agent_id = payload.get("agent_id") or payload.get("agent")

        if explicit_agent_id not in (None, "", 0, "0"):
            agent = _resolve_agent(explicit_agent_id)
            payload["agent_id"] = agent.pk if agent else None
            payload["referral_code_used"] = agent_code or _safe_attr(
                agent,
                "agent_code",
                "code",
                "referral_code",
                default="",
            )
            return agent

        if agent_code:
            agent = _resolve_agent_by_code(agent_code)
            if not agent:
                raise ValidationError("Invalid agent/referral code.")

            payload["agent_id"] = agent.pk
            payload["referral_code_used"] = agent_code
            return agent

        return existing_agent

    if not _is_authenticated_user(user):
        if payload.get("agent_id") or payload.get("agent"):
            raise ValidationError("Public checkout cannot assign agent_id directly. Use referral code instead.")

        if agent_code:
            agent = _resolve_agent_by_code(agent_code)
            if not agent:
                payload["referral_code_used"] = agent_code
                return None

            payload["agent_id"] = agent.pk
            payload["referral_code_used"] = agent_code
            return agent

        return existing_agent

    if payload.get("agent_id") or payload.get("agent"):
        raise ValidationError("You do not have permission to assign orders to agents.")

    if agent_code:
        agent = _resolve_agent_by_code(agent_code)
        if agent:
            payload["agent_id"] = agent.pk
            payload["referral_code_used"] = agent_code
            return agent

    return existing_agent


def _payload_has_delivery_agent_reference(payload: dict[str, Any]) -> bool:
    return bool(payload.get("delivery_agent_id") or payload.get("delivery_agent"))


def _resolve_delivery_agent_for_order(payload: dict[str, Any], user=None, *, existing_delivery_agent=None):
    explicit_agent_id = payload.get("delivery_agent_id") or payload.get("delivery_agent")

    if explicit_agent_id in (None, "", 0, "0"):
        return existing_delivery_agent

    if not _user_can_assign_delivery(user):
        raise ValidationError("You do not have permission to assign a delivery agent.")

    return _resolve_agent(explicit_agent_id)


# ============================================================
# 🔹 Provider / Contract / Offer Auto Resolve Helpers
# ============================================================

def _resolve_provider_from_product(product: Product):
    provider_id = _safe_attr(product, "provider_id", default=None)

    if provider_id:
        return _resolve_provider(provider_id)

    provider = _safe_attr(product, "provider", default=None)
    if provider:
        return provider

    return None


def _resolve_provider_from_contract(contract):
    if not contract:
        return None

    provider_id = _safe_attr(contract, "provider_id", default=None)
    if provider_id:
        return _resolve_provider(provider_id)

    provider = _safe_attr(contract, "provider", default=None)
    if provider:
        return provider

    return None


def _filter_active_records(queryset):
    model = getattr(queryset, "model", None)

    if model and _model_has_field(model, "is_active"):
        try:
            queryset = queryset.filter(is_active=True)
        except Exception:
            pass

    if model and _model_has_field(model, "status"):
        try:
            active_values = ["active", "ACTIVE", "approved", "APPROVED", "published", "PUBLISHED"]
            queryset = queryset.filter(status__in=active_values)
        except Exception:
            pass

    return queryset


def _filter_current_contract_products(queryset):
    today = timezone.localdate()

    try:
        queryset = queryset.filter(
            is_active=True,
            contract__status="ACTIVE",
        ).filter(
            Q(contract__start_date__isnull=True) | Q(contract__start_date__lte=today),
            Q(contract__end_date__isnull=True) | Q(contract__end_date__gte=today),
            Q(offer_start_date__isnull=True) | Q(offer_start_date__lte=today),
            Q(offer_end_date__isnull=True) | Q(offer_end_date__gte=today),
        )
    except Exception:
        queryset = _filter_active_records(queryset)

    return queryset


def _validate_contract_product_available(contract_product) -> None:
    if not contract_product:
        return

    is_available = getattr(contract_product, "is_currently_available", None)

    if is_available is False:
        raise ValidationError("Selected offer is not currently available.")


def _validate_contract_product_relation(*, contract_product, product=None, provider=None, contract=None) -> None:
    if not contract_product:
        return

    if product and getattr(contract_product, "product_id", None) and int(contract_product.product_id) != int(product.pk):
        raise ValidationError("Selected offer does not belong to the selected product.")

    if contract and getattr(contract_product, "contract_id", None) and int(contract_product.contract_id) != int(contract.pk):
        raise ValidationError("Selected offer does not belong to the selected contract.")

    contract_obj = getattr(contract_product, "contract", None)

    if provider and contract_obj and getattr(contract_obj, "provider_id", None):
        if int(contract_obj.provider_id) != int(provider.pk):
            raise ValidationError("Selected offer does not belong to the selected provider.")


def _resolve_contract_product_from_payload(payload: dict[str, Any]):
    contract_product_id = _resolve_contract_product_id_from_payload(payload)

    if not contract_product_id:
        return None

    contract_product = _resolve_contract_product_by_id(contract_product_id)

    if not contract_product:
        raise ValidationError("Selected offer does not exist.")

    _validate_contract_product_available(contract_product)
    payload["contract_product_id"] = contract_product.pk
    payload["offer_id"] = contract_product.pk

    return contract_product


def _resolve_contract_product(
    *,
    product: Product,
    provider=None,
    contract=None,
):
    ContractProduct = _get_optional_model("contracts", "ContractProduct")
    if not ContractProduct:
        return None

    queryset = (
        ContractProduct.objects
        .select_related("contract", "contract__provider", "product")
        .filter(product_id=product.pk)
    )

    if contract:
        queryset = queryset.filter(contract_id=contract.pk)

    if provider:
        try:
            queryset = queryset.filter(contract__provider_id=provider.pk)
        except Exception:
            pass

    queryset = _filter_current_contract_products(queryset)
    queryset = _safe_order_latest(queryset)

    try:
        return queryset.first()
    except Exception:
        return None


def _resolve_active_contract(
    *,
    product: Product,
    provider=None,
):
    Contract = _get_optional_model("contracts", "Contract")
    if not Contract:
        return None

    contract_product = _resolve_contract_product(product=product, provider=provider, contract=None)
    if contract_product and getattr(contract_product, "contract_id", None):
        return contract_product.contract

    queryset = Contract.objects.all()

    if provider:
        try:
            queryset = queryset.filter(provider_id=provider.pk)
        except Exception:
            return None

    queryset = _filter_active_records(queryset)
    queryset = _safe_order_latest(queryset)

    try:
        return queryset.first()
    except Exception:
        return None


def _validate_provider_contract_relation(provider, contract):
    if not provider or not contract:
        return

    contract_provider_id = _safe_attr(contract, "provider_id", default=None)
    if contract_provider_id and int(contract_provider_id) != int(provider.pk):
        raise ValidationError("Selected contract does not belong to the selected provider.")


def _resolve_provider_contract_for_order(
    *,
    product: Product | None,
    payload: dict[str, Any],
):
    explicit_contract_product = _resolve_contract_product_from_payload(payload)

    if explicit_contract_product:
        product = explicit_contract_product.product
        contract = explicit_contract_product.contract
        provider = _resolve_provider_from_contract(contract)

        payload["product_id"] = product.pk
        payload["contract_id"] = contract.pk if contract else None
        payload["provider_id"] = provider.pk if provider else None
        payload["contract_product_id"] = explicit_contract_product.pk
        payload["offer_source"] = Order.OfferSource.CONTRACT_PRODUCT

        return provider, contract, explicit_contract_product, product

    if not product:
        raise ValidationError("Product is required.")

    provider = _resolve_provider(payload.get("provider_id"))
    contract = _resolve_contract(payload.get("contract_id"))

    if not provider:
        provider = _resolve_provider_from_product(product)

    if contract and not provider:
        provider = _resolve_provider_from_contract(contract)

    _validate_provider_contract_relation(provider, contract)

    contract_product = _resolve_contract_product(
        product=product,
        provider=provider,
        contract=contract,
    )

    if contract_product:
        _validate_contract_product_relation(
            contract_product=contract_product,
            product=product,
            provider=provider,
            contract=contract,
        )

    if contract_product and not contract:
        contract = getattr(contract_product, "contract", None)

    if not contract:
        contract = _resolve_active_contract(product=product, provider=provider)

    if contract and not provider:
        provider = _resolve_provider_from_contract(contract)

    if contract and provider:
        _validate_provider_contract_relation(provider, contract)

    if contract and not contract_product:
        contract_product = _resolve_contract_product(
            product=product,
            provider=provider,
            contract=contract,
        )

    if provider:
        payload["provider_id"] = provider.pk

    if contract:
        payload["contract_id"] = contract.pk

    if contract_product:
        payload["contract_product_id"] = contract_product.pk

    return provider, contract, contract_product, product


# ============================================================
# 🔹 Product / Amount Helpers
# ============================================================

def _resolve_product_name(product: Product, payload: dict[str, Any]) -> str:
    return normalize_text(
        _first_non_empty(
            payload.get("product_name"),
            _safe_attr(product, "name"),
            _safe_attr(product, "title"),
            f"Product #{product.pk}",
        )
    )


def _resolve_product_type(product: Product, payload: dict[str, Any]) -> str:
    return normalize_text(
        _first_non_empty(
            payload.get("product_type"),
            _safe_attr(product, "product_type"),
            _safe_attr(product, "type"),
            "",
        )
    )


def _resolve_currency(product: Product, payload: dict[str, Any]) -> str:
    return normalize_text(
        _first_non_empty(
            payload.get("currency_code"),
            payload.get("currency"),
            _safe_attr(product, "currency_code"),
            _safe_attr(product, "currency"),
            "SAR",
        ),
        "SAR",
    ).upper()


def _resolve_base_product_price(product: Product) -> Decimal:
    return money(
        _first_non_empty(
            _safe_attr(product, "price_after_discount", default=None),
            _safe_attr(product, "effective_price", default=None),
            _safe_attr(product, "sale_price", default=None),
            _safe_attr(product, "price", default=None),
            "0.00",
        )
    )


def _resolve_product_price_before_discount(product: Product) -> Decimal:
    return money(
        _first_non_empty(
            _safe_attr(product, "price_before_discount", default=None),
            _safe_attr(product, "price", default=None),
            "0.00",
        )
    )


def _apply_contract_product_pricing_to_payload(
    *,
    product: Product,
    contract_product,
    payload: dict[str, Any],
) -> None:
    if not contract_product:
        return

    _validate_contract_product_available(contract_product)
    _validate_contract_product_relation(contract_product=contract_product, product=product)

    before = _first_non_empty(
        _safe_attr(contract_product, "effective_price_before_discount", default=None),
        _safe_attr(contract_product, "price_before_discount", default=None),
        _safe_attr(product, "price_before_discount", default=None),
        _safe_attr(product, "price", default=None),
        "0.00",
    )

    after = _first_non_empty(
        _safe_attr(contract_product, "effective_price_after_discount", default=None),
        _safe_attr(contract_product, "price_after_discount", default=None),
        _safe_attr(contract_product, "special_price", default=None),
        _safe_attr(product, "price_after_discount", default=None),
        _safe_attr(product, "effective_price", default=None),
        _safe_attr(product, "sale_price", default=None),
        _safe_attr(product, "price", default=None),
        "0.00",
    )

    discount_percentage = _first_non_empty(
        _safe_attr(contract_product, "discount_percentage", default=None),
        "0.00",
    )

    quantity = Decimal(parse_int(payload.get("quantity"), 1) or 1)
    before_amount = money(before)
    after_amount = money(after)
    discount_amount = money((before_amount - after_amount) * quantity)

    payload["contract_product_id"] = contract_product.pk
    payload["offer_id"] = contract_product.pk
    payload["offer_source"] = Order.OfferSource.CONTRACT_PRODUCT
    payload["offer_title"] = _safe_attr(contract_product, "offer_title", default="") or _safe_attr(product, "offer_title", "name")
    payload["offer_badge"] = _safe_attr(contract_product, "offer_badge", default="")
    payload["unit_price_before_discount"] = str(before_amount)
    payload["unit_discount_percentage"] = str(percent(discount_percentage))
    payload["unit_price"] = str(after_amount)
    payload["discount_amount"] = str(discount_amount if discount_amount > Decimal("0.00") else Decimal("0.00"))


def _resolve_unit_price_before_discount(product: Product, payload: dict[str, Any]) -> Decimal:
    explicit = payload.get("unit_price_before_discount")

    if explicit not in (None, ""):
        return money(explicit)

    return _resolve_product_price_before_discount(product)


def _resolve_unit_discount_percentage(payload: dict[str, Any]) -> Decimal:
    return percent(
        _first_non_empty(
            payload.get("unit_discount_percentage"),
            payload.get("discount_percentage"),
            payload.get("discount_percent"),
            payload.get("discount_rate"),
            "0.00",
        )
    )


def _resolve_unit_price(product: Product, payload: dict[str, Any]) -> Decimal:
    explicit_price = payload.get("unit_price")

    if explicit_price not in (None, ""):
        return money(explicit_price)

    return _resolve_base_product_price(product)


def _resolve_quantity(payload: dict[str, Any]) -> int:
    quantity = parse_int(payload.get("quantity"), 1) or 1

    if quantity <= 0:
        raise ValidationError("Quantity must be greater than zero.")

    return quantity


def _calculate_tax_amount(
    *,
    subtotal_amount: Decimal,
    discount_amount: Decimal,
    payload: dict[str, Any],
) -> Decimal:
    explicit_tax_amount = payload.get("tax_amount")

    if explicit_tax_amount not in (None, ""):
        tax_amount = money(explicit_tax_amount)

        if tax_amount < Decimal("0.00"):
            raise ValidationError("Tax amount cannot be negative.")

        return tax_amount

    taxable_amount = subtotal_amount - discount_amount

    if taxable_amount <= Decimal("0.00"):
        return Decimal("0.00")

    tax_rate = money(payload.get("tax_rate"), DEFAULT_TAX_RATE)

    if tax_rate < Decimal("0.00"):
        raise ValidationError("Tax rate cannot be negative.")

    return money(taxable_amount * tax_rate / Decimal("100.00"))


def _calculate_order_amounts(
    *,
    unit_price_before_discount: Decimal,
    unit_price: Decimal,
    quantity: int,
    payload: dict[str, Any],
) -> dict[str, Decimal]:
    subtotal_amount = money(unit_price_before_discount * Decimal(quantity))
    subtotal_after_discount = money(unit_price * Decimal(quantity))

    explicit_discount_amount = payload.get("discount_amount")

    if explicit_discount_amount not in (None, ""):
        discount_amount = money(explicit_discount_amount)
    else:
        discount_amount = money(subtotal_amount - subtotal_after_discount)

    if discount_amount < Decimal("0.00"):
        discount_amount = Decimal("0.00")

    if discount_amount > subtotal_amount:
        raise ValidationError("Discount amount cannot be greater than subtotal amount.")

    tax_amount = _calculate_tax_amount(
        subtotal_amount=subtotal_amount,
        discount_amount=discount_amount,
        payload=payload,
    )

    total_amount = money(subtotal_amount - discount_amount + tax_amount)

    amount_paid_value = _first_non_empty(
        payload.get("amount_paid"),
        payload.get("paid_amount"),
        "0.00",
    )
    amount_paid = money(amount_paid_value, Decimal("0.00"))

    if amount_paid < Decimal("0.00"):
        raise ValidationError("Amount paid cannot be negative.")

    if amount_paid > total_amount:
        raise ValidationError("Amount paid cannot be greater than order total.")

    return {
        "unit_price_before_discount": unit_price_before_discount,
        "unit_discount_percentage": _resolve_unit_discount_percentage(payload),
        "unit_price": unit_price,
        "subtotal_amount": subtotal_amount,
        "discount_amount": discount_amount,
        "tax_amount": tax_amount,
        "total_amount": total_amount,
        "amount_paid": amount_paid,
    }


def _sync_payment_status_from_amount(order: Order) -> None:
    total_amount = money(order.total_amount)
    amount_paid = money(order.amount_paid)

    if order.payment_method == Order.PaymentMethod.CASH_ON_DELIVERY and amount_paid <= Decimal("0.00"):
        order.payment_status = Order.PaymentStatus.COD_PENDING
    elif amount_paid <= Decimal("0.00"):
        order.payment_status = Order.PaymentStatus.UNPAID
    elif amount_paid < total_amount:
        order.payment_status = Order.PaymentStatus.PARTIALLY_PAID
    else:
        order.payment_status = Order.PaymentStatus.PAID


def _apply_order_snapshot_from_product(
    *,
    order: Order,
    product: Product,
    payload: dict[str, Any],
    contract_product=None,
    force_payment_status_from_amount: bool = True,
) -> None:
    _apply_contract_product_pricing_to_payload(
        product=product,
        contract_product=contract_product,
        payload=payload,
    )

    unit_price_before_discount = _resolve_unit_price_before_discount(product, payload)
    unit_price = _resolve_unit_price(product, payload)
    quantity = _resolve_quantity(payload)

    amounts = _calculate_order_amounts(
        unit_price_before_discount=unit_price_before_discount,
        unit_price=unit_price,
        quantity=quantity,
        payload=payload,
    )

    order.product_name = _resolve_product_name(product, payload)
    order.product_type = _resolve_product_type(product, payload)
    order.currency_code = _resolve_currency(product, payload)

    order.contract_product = contract_product
    order.offer_source = normalize_lower(payload.get("offer_source")) or (
        Order.OfferSource.CONTRACT_PRODUCT if contract_product else Order.OfferSource.PRODUCT
    )
    order.offer_title = normalize_text(payload.get("offer_title"))
    order.offer_badge = normalize_text(payload.get("offer_badge"))

    order.unit_price_before_discount = amounts["unit_price_before_discount"]
    order.unit_discount_percentage = amounts["unit_discount_percentage"]
    order.unit_price = amounts["unit_price"]
    order.quantity = quantity
    order.subtotal_amount = amounts["subtotal_amount"]
    order.discount_amount = amounts["discount_amount"]
    order.tax_amount = amounts["tax_amount"]
    order.total_amount = amounts["total_amount"]
    order.amount_paid = amounts["amount_paid"]

    if force_payment_status_from_amount:
        _sync_payment_status_from_amount(order)


# ============================================================
# 🔹 Invoice Reverse Relation Helpers
# ============================================================

def _get_linked_invoice(order: Order):
    try:
        invoice = order.invoice
    except Exception:
        return None

    if hasattr(invoice, "all"):
        return invoice.all().first()

    return invoice


def _attach_invoice_to_order(*, order: Order, invoice) -> None:
    if not invoice:
        return

    invoice.order = order
    invoice.save(update_fields=["order", "updated_at"] if hasattr(invoice, "updated_at") else ["order"])


# ============================================================
# 🔹 Financial Helpers — Agents / Brokers / COD / Accounting
# ============================================================

def _financial_model():
    return _get_optional_model("agents", "AgentFinancialEntry")


def _commission_rule_model():
    return _get_optional_model("agents", "AgentCommissionRule")


def _broker_model():
    return _get_optional_model("agents", "Broker")


def _financial_model_has_field(field_name: str) -> bool:
    model = _financial_model()
    return _model_has_field(model, field_name)


def _agent_has_field(agent, field_name: str) -> bool:
    return _model_has_field(agent.__class__ if agent else None, field_name)


def _broker_has_field(broker, field_name: str) -> bool:
    return _model_has_field(broker.__class__ if broker else None, field_name)


def _financial_entry_reference(*, order: Order, entry_type: str, party_id: Any = "") -> str:
    return f"{entry_type}:ORDER:{order.pk}:PARTY:{party_id or ''}"


def _financial_source_id(*, order: Order, entry_type: str, party_id: Any = "") -> str:
    return f"order:{order.pk}:{entry_type}:{party_id or ''}"


def _financial_entry_exists(*, order: Order, entry_type: str, party_id: Any = "") -> bool:
    model = _financial_model()
    if not model:
        return False

    queryset = model.objects.all()

    if _model_has_field(model, "source_type") and _model_has_field(model, "source_id"):
        return queryset.filter(
            source_type="order",
            source_id=_financial_source_id(order=order, entry_type=entry_type, party_id=party_id),
        ).exists()

    filters = Q()

    if _model_has_field(model, "order"):
        filters &= Q(order_id=order.pk)

    if _model_has_field(model, "entry_type"):
        filters &= Q(entry_type=entry_type)

    if party_id:
        if _model_has_field(model, "agent"):
            filters &= Q(agent_id=party_id)
        elif _model_has_field(model, "broker"):
            filters &= Q(broker_id=party_id)

    if not filters:
        return False

    return queryset.filter(filters).exists()


def _set_if_model_field(instance, field_name: str, value: Any) -> None:
    if _model_has_field(instance.__class__, field_name):
        setattr(instance, field_name, value)


def _financial_entry_status_value() -> str:
    model = _financial_model()

    if not model or not _model_has_field(model, "status"):
        return ""

    field = model._meta.get_field("status")
    choices = {str(value).upper(): str(value) for value, _ in getattr(field, "choices", [])}

    for candidate in ("APPROVED", "EARNED", "CONFIRMED", "POSTED", "PENDING"):
        if candidate in choices:
            return choices[candidate]

    return next(iter(choices.values()), "")


def _financial_entry_direction_credit() -> str:
    model = _financial_model()

    if not model or not _model_has_field(model, "direction"):
        return ""

    field = model._meta.get_field("direction")
    choices = {str(value).upper(): str(value) for value, _ in getattr(field, "choices", [])}

    for candidate in ("CREDIT", "CR"):
        if candidate in choices:
            return choices[candidate]

    return next(iter(choices.values()), "CREDIT")


def _financial_entry_direction_debit() -> str:
    model = _financial_model()

    if not model or not _model_has_field(model, "direction"):
        return ""

    field = model._meta.get_field("direction")
    choices = {str(value).upper(): str(value) for value, _ in getattr(field, "choices", [])}

    for candidate in ("DEBIT", "DR"):
        if candidate in choices:
            return choices[candidate]

    return next(iter(choices.values()), "DEBIT")


def _resolve_order_broker(order: Order):
    agent = getattr(order, "agent", None)

    if agent:
        broker = _safe_attr(agent, "broker", default=None)
        if broker:
            return broker

        broker_id = _safe_attr(agent, "broker_id", default=None)
        if broker_id:
            Broker = _broker_model()
            if Broker:
                try:
                    return Broker.objects.filter(pk=broker_id).first()
                except Exception:
                    return None

    return None


def _resolve_commission_rule_for_agent(*, agent, order: Order, rule_kind: str):
    Rule = _commission_rule_model()
    if not Rule or not agent:
        return None

    queryset = Rule.objects.all()

    if _model_has_field(Rule, "agent"):
        queryset = queryset.filter(agent=agent)

    if _model_has_field(Rule, "rule_kind"):
        queryset = queryset.filter(rule_kind=rule_kind)
    elif _model_has_field(Rule, "commission_kind"):
        queryset = queryset.filter(commission_kind=rule_kind)
    elif _model_has_field(Rule, "entry_type"):
        queryset = queryset.filter(entry_type=rule_kind)

    if _model_has_field(Rule, "product") and order.product_id:
        product_qs = queryset.filter(product_id=order.product_id)
        if product_qs.exists():
            queryset = product_qs

    if _model_has_field(Rule, "contract_product") and order.contract_product_id:
        offer_qs = queryset.filter(contract_product_id=order.contract_product_id)
        if offer_qs.exists():
            queryset = offer_qs

    if _model_has_field(Rule, "order_kind"):
        kind_qs = queryset.filter(order_kind=order.order_kind)
        if kind_qs.exists():
            queryset = kind_qs

    if _model_has_field(Rule, "is_active"):
        queryset = queryset.filter(is_active=True)

    if _model_has_field(Rule, "status"):
        queryset = queryset.filter(status__in=["ACTIVE", "active", "APPROVED", "approved"])

    return _safe_order_latest(queryset).first()


def _calculate_percentage_or_fixed(*, base_amount: Decimal, value: Any, value_type: str = "") -> Decimal:
    amount_value = money(value, Decimal("0.00"))
    normalized_type = normalize_lower(value_type)

    if amount_value <= Decimal("0.00"):
        return Decimal("0.00")

    if normalized_type in {"percentage", "percent", "%", "rate"}:
        return money(base_amount * amount_value / Decimal("100.00"))

    if normalized_type in {"fixed", "amount", "flat"}:
        return amount_value

    if amount_value <= Decimal("100.00"):
        return money(base_amount * amount_value / Decimal("100.00"))

    return amount_value


def _calculate_agent_sales_commission(*, order: Order, agent) -> Decimal:
    if not agent:
        return Decimal("0.00")

    base_amount = money(order.subtotal_amount - order.discount_amount)
    rule = _resolve_commission_rule_for_agent(agent=agent, order=order, rule_kind="SALES_COMMISSION")

    if rule:
        value = _first_non_empty(
            _safe_attr(rule, "commission_value", default=None),
            _safe_attr(rule, "value", default=None),
            _safe_attr(rule, "amount", default=None),
            "0.00",
        )
        value_type = _first_non_empty(
            _safe_attr(rule, "commission_type", default=None),
            _safe_attr(rule, "value_type", default=None),
            _safe_attr(rule, "type", default=None),
            "",
        )
        return _calculate_percentage_or_fixed(
            base_amount=base_amount,
            value=value,
            value_type=value_type,
        )

    value = _first_non_empty(
        _safe_attr(agent, "default_commission_value", default=None),
        _safe_attr(agent, "commission_value", default=None),
        _safe_attr(agent, "commission_rate", default=None),
        "0.00",
    )
    value_type = _first_non_empty(
        _safe_attr(agent, "default_commission_type", default=None),
        _safe_attr(agent, "commission_type", default=None),
        "percentage",
    )

    return _calculate_percentage_or_fixed(
        base_amount=base_amount,
        value=value,
        value_type=value_type,
    )


def _calculate_delivery_fee(*, order: Order, delivery_agent) -> Decimal:
    if not delivery_agent:
        return Decimal("0.00")

    rule = _resolve_commission_rule_for_agent(agent=delivery_agent, order=order, rule_kind="DELIVERY_FEE")

    if rule:
        value = _first_non_empty(
            _safe_attr(rule, "delivery_fee", default=None),
            _safe_attr(rule, "commission_value", default=None),
            _safe_attr(rule, "value", default=None),
            _safe_attr(rule, "amount", default=None),
            "0.00",
        )
        value_type = _first_non_empty(
            _safe_attr(rule, "commission_type", default=None),
            _safe_attr(rule, "value_type", default=None),
            "fixed",
        )
        return _calculate_percentage_or_fixed(
            base_amount=money(order.total_amount),
            value=value,
            value_type=value_type,
        )

    return money(
        _first_non_empty(
            _safe_attr(delivery_agent, "default_delivery_fee", default=None),
            _safe_attr(delivery_agent, "delivery_fee", default=None),
            "0.00",
        )
    )


def _calculate_broker_share(*, order: Order, broker) -> Decimal:
    if not broker:
        return Decimal("0.00")

    base_amount = money(order.subtotal_amount - order.discount_amount)

    value = _first_non_empty(
        _safe_attr(broker, "default_commission_value", default=None),
        _safe_attr(broker, "commission_value", default=None),
        _safe_attr(broker, "commission_rate", default=None),
        _safe_attr(broker, "share_value", default=None),
        _safe_attr(broker, "share_percentage", default=None),
        "0.00",
    )
    value_type = _first_non_empty(
        _safe_attr(broker, "default_commission_type", default=None),
        _safe_attr(broker, "commission_type", default=None),
        _safe_attr(broker, "share_type", default=None),
        "percentage",
    )

    return _calculate_percentage_or_fixed(
        base_amount=base_amount,
        value=value,
        value_type=value_type,
    )


def _create_financial_entry(
    *,
    order: Order,
    entry_type: str,
    amount: Decimal,
    description: str,
    agent=None,
    broker=None,
    direction: str = "CREDIT",
    source_number: str = "",
    metadata: dict[str, Any] | None = None,
):
    model = _financial_model()

    if not model:
        logger.warning("agents.AgentFinancialEntry model was not found. Skipping %s for order %s.", entry_type, order.pk)
        return None

    amount = money(amount)

    if amount <= Decimal("0.00"):
        return None

    party_id = _safe_attr(agent, "pk", default=None) or _safe_attr(broker, "pk", default=None) or ""
    source_id = _financial_source_id(order=order, entry_type=entry_type, party_id=party_id)

    if _financial_entry_exists(order=order, entry_type=entry_type, party_id=party_id):
        return model.objects.filter(source_id=source_id).first() if _model_has_field(model, "source_id") else None

    entry = model()

    if _model_has_field(model, "agent") and agent:
        entry.agent = agent

    if _model_has_field(model, "broker") and broker:
        entry.broker = broker

    if _model_has_field(model, "order"):
        entry.order = order

    if _model_has_field(model, "customer") and order.customer_id:
        entry.customer = order.customer

    if _model_has_field(model, "product") and order.product_id:
        entry.product = order.product

    if _model_has_field(model, "contract_product") and order.contract_product_id:
        entry.contract_product = order.contract_product

    if _model_has_field(model, "entry_type"):
        entry.entry_type = entry_type

    if _model_has_field(model, "direction"):
        entry.direction = _financial_entry_direction_debit() if direction.upper() == "DEBIT" else _financial_entry_direction_credit()

    if _model_has_field(model, "amount"):
        entry.amount = amount

    if _model_has_field(model, "currency"):
        entry.currency = order.currency_code or "SAR"

    if _model_has_field(model, "description"):
        entry.description = description

    if _model_has_field(model, "reference"):
        entry.reference = _financial_entry_reference(order=order, entry_type=entry_type, party_id=party_id)

    if _model_has_field(model, "entry_number"):
        entry.entry_number = _financial_entry_reference(order=order, entry_type=entry_type, party_id=party_id)

    if _model_has_field(model, "source_type"):
        entry.source_type = "order"

    if _model_has_field(model, "source_id"):
        entry.source_id = source_id

    if _model_has_field(model, "source_number"):
        entry.source_number = source_number or order.order_number

    if _model_has_field(model, "status"):
        status_value = _financial_entry_status_value()
        if status_value:
            entry.status = status_value

    now = timezone.now()

    if _model_has_field(model, "earned_at"):
        entry.earned_at = now

    if _model_has_field(model, "approved_at"):
        entry.approved_at = now

    if _model_has_field(model, "posted_at"):
        entry.posted_at = None

    if _model_has_field(model, "is_accounting_posted"):
        entry.is_accounting_posted = False

    entry_metadata = {
        "order_id": order.pk,
        "order_number": order.order_number,
        "customer_id": order.customer_id,
        "product_id": order.product_id,
        "provider_id": order.provider_id,
        "contract_id": order.contract_id,
        "contract_product_id": order.contract_product_id,
        "offer_source": order.offer_source,
        "order_kind": order.order_kind,
        "payment_method": order.payment_method,
        "cash_collected_amount": str(order.cash_collected_amount),
        "source_number": source_number or order.order_number,
        **(metadata or {}),
    }

    if _model_has_field(model, "metadata"):
        entry.metadata = entry_metadata

    entry.full_clean()
    entry.save()

    _post_financial_entry_to_accounting(entry)

    return entry


def _post_financial_entry_to_accounting(financial_entry) -> None:
    if not financial_entry:
        return

    already_posted = bool(_safe_attr(financial_entry, "is_accounting_posted", default=False))
    if already_posted:
        return

    post_fn = _resolve_import_callable(
        "accounting.services",
        "post_agent_financial_entry_accrual",
    )

    if not post_fn:
        logger.warning("accounting.services.post_agent_financial_entry_accrual was not found.")
        return

    try:
        post_fn(financial_entry)
    except Exception as exc:
        logger.exception("Failed to post financial entry %s to accounting: %s", getattr(financial_entry, "pk", ""), exc)
        raise ValidationError(f"Failed to post financial entry to accounting: {exc}") from exc


def _resolve_cod_collector(order: Order, user=None):
    if order.delivery_agent_id:
        return order.delivery_agent

    if _is_authenticated_user(user) and _user_looks_like_agent(user):
        agent = _find_agent_for_user(user)
        if agent:
            return agent

    if order.agent_id:
        return order.agent

    return None


def _create_cod_custody_entry_for_order(*, order: Order, user=None) -> None:
    if not order.is_cash_on_delivery:
        return

    amount = money(order.cash_collected_amount)

    if amount <= Decimal("0.00"):
        return

    collector = _resolve_cod_collector(order, user=user)

    if not collector:
        logger.warning("COD collected for order %s but no collector agent was resolved.", order.pk)
        return

    _create_financial_entry(
        order=order,
        entry_type="COD_CUSTODY",
        amount=amount,
        description=f"إثبات عهدة COD على المندوب للطلب {order.order_number}",
        agent=collector,
        direction="DEBIT",
        source_number=order.order_number,
        metadata={
            "collector_agent_id": getattr(collector, "pk", None),
            "cash_collected_by_id": order.cash_collected_by_id,
            "entry_reason": "cod_cash_collected",
        },
    )


def _create_order_earnings_entries(*, order: Order) -> None:
    if order.status != Order.Status.COMPLETED:
        return

    if order.agent_id:
        sales_commission = _calculate_agent_sales_commission(order=order, agent=order.agent)
        _create_financial_entry(
            order=order,
            entry_type="SALES_COMMISSION",
            amount=sales_commission,
            description=f"استحقاق عمولة مندوب البيع للطلب {order.order_number}",
            agent=order.agent,
            direction="CREDIT",
            source_number=order.order_number,
            metadata={
                "sales_agent_id": order.agent_id,
                "entry_reason": "order_completed_sales_commission",
            },
        )

    if order.delivery_agent_id:
        delivery_fee = _calculate_delivery_fee(order=order, delivery_agent=order.delivery_agent)
        _create_financial_entry(
            order=order,
            entry_type="DELIVERY_FEE",
            amount=delivery_fee,
            description=f"استحقاق قيمة توصيل للطلب {order.order_number}",
            agent=order.delivery_agent,
            direction="CREDIT",
            source_number=order.order_number,
            metadata={
                "delivery_agent_id": order.delivery_agent_id,
                "entry_reason": "order_completed_delivery_fee",
            },
        )

    broker = _resolve_order_broker(order)
    if broker:
        broker_share = _calculate_broker_share(order=order, broker=broker)
        _create_financial_entry(
            order=order,
            entry_type="BROKER_SHARE",
            amount=broker_share,
            description=f"استحقاق حصة الوسيط للطلب {order.order_number}",
            broker=broker,
            direction="CREDIT",
            source_number=order.order_number,
            metadata={
                "broker_id": getattr(broker, "pk", None),
                "entry_reason": "order_completed_broker_share",
            },
        )


def _sync_order_financial_effects(*, order: Order, user=None, event: str = "") -> None:
    """
    نقطة الربط الرسمية بين الطلب والدورة المالية.

    - COD عند التحصيل: يثبت عهدة على المندوب المحصل.
    - Completed: يثبت عمولة مندوب البيع، قيمة التوصيل، وحصة الوسيط.
    - كل سجل مالي يترحل محاسبيًا عبر accounting.services.
    - الإنشاء idempotent ولا يكرر نفس الأثر لنفس الطلب والطرف.
    """
    try:
        if order.is_cash_on_delivery and money(order.cash_collected_amount) > Decimal("0.00"):
            _create_cod_custody_entry_for_order(order=order, user=user)

        if order.status == Order.Status.COMPLETED:
            _create_order_earnings_entries(order=order)

    except ValidationError:
        raise
    except Exception as exc:
        logger.exception("Failed to sync financial effects for order %s: %s", order.pk, exc)
        raise ValidationError(f"Failed to sync order financial effects: {exc}") from exc


# ============================================================
# 🔹 Optional Financial/Agent Integrations
# ============================================================

def _maybe_create_agent_order(
    *,
    order: Order,
    payload: dict[str, Any],
    user=None,
) -> None:
    if not order.agent_id:
        return

    auto_create = parse_bool(payload.get("auto_create_agent_order"), True)

    if not auto_create:
        return

    create_agent_order = _resolve_import_callable("agents.services", "create_agent_order")

    if not create_agent_order:
        logger.warning("agents.services.create_agent_order was not found. Skipping agent order creation.")
        return

    try:
        create_agent_order(
            order=order,
            agent=order.agent,
            customer=order.customer,
            sales_amount=order.total_amount,
            commission_type=payload.get("commission_type") or None,
            commission_value=payload.get("commission_value") or None,
            referral_code_used=order.referral_code_used or payload.get("referral_code_used") or "",
            notes=payload.get("agent_notes") or payload.get("internal_notes") or "",
            create_commission=parse_bool(payload.get("create_commission"), True),
        )
    except Exception as exc:
        logger.exception("Failed to create agent order for order %s: %s", order.pk, exc)
        raise ValidationError(f"Failed to create agent order/commission: {exc}") from exc


def _maybe_create_invoice_from_order(
    *,
    order: Order,
    payload: dict[str, Any],
    user=None,
) -> None:
    auto_create_invoice = parse_bool(
        _first_non_empty(
            payload.get("auto_create_invoice"),
            payload.get("create_invoice"),
            False,
        ),
        False,
    )
    issue_immediately = parse_bool(payload.get("issue_invoice_immediately"), False)

    if not auto_create_invoice and not issue_immediately:
        return

    create_invoice_from_order = _resolve_import_callable(
        "invoices.services",
        "create_invoice_from_order",
    )

    if not create_invoice_from_order:
        logger.warning("invoices.services.create_invoice_from_order was not found. Skipping invoice creation.")
        return

    try:
        create_invoice_from_order(
            order=order,
            actor=user if _is_authenticated_user(user) else None,
            sync_items=True,
            issue_immediately=bool(issue_immediately),
            auto_post_accounting=parse_bool(payload.get("auto_post_accounting"), True),
            notes=payload.get("invoice_notes") or "",
            internal_notes=payload.get("invoice_internal_notes") or "",
        )
    except Exception as exc:
        logger.exception("Failed to create invoice for order %s: %s", order.pk, exc)
        raise ValidationError(f"Failed to create invoice from order: {exc}") from exc
    
    # ============================================================
# 🔹 Serialization Helpers
# ============================================================

def _serialize_user_name(user) -> str:
    if not user:
        return ""

    get_full_name = getattr(user, "get_full_name", None)

    if callable(get_full_name):
        full_name = get_full_name()

        if full_name:
            return full_name

    return getattr(user, "username", "") or getattr(user, "email", "") or ""


def _serialize_agent(agent) -> dict[str, Any] | None:
    if not agent:
        return None

    return {
        "id": agent.id,
        "agent_code": _safe_attr(agent, "agent_code", "code"),
        "name": _safe_attr(agent, "display_name", "full_name", "name"),
        "phone_number": _safe_attr(agent, "phone_number", "phone"),
        "email": _safe_attr(agent, "email"),
        "status": _safe_attr(agent, "status"),
    }


def _serialize_contract_product(contract_product) -> dict[str, Any] | None:
    if not contract_product:
        return None

    product = getattr(contract_product, "product", None)
    contract = getattr(contract_product, "contract", None)
    provider = getattr(contract, "provider", None) if contract else None

    return {
        "id": contract_product.id,
        "offer_id": contract_product.id,
        "contract_product_id": contract_product.id,
        "product_id": getattr(contract_product, "product_id", None),
        "contract_id": getattr(contract_product, "contract_id", None),
        "provider_id": getattr(provider, "id", None),
        "offer_title": _safe_attr(contract_product, "offer_title"),
        "offer_subtitle": _safe_attr(contract_product, "offer_subtitle"),
        "offer_badge": _safe_attr(contract_product, "offer_badge"),
        "offer_description": _safe_attr(contract_product, "offer_description"),
        "price_before_discount": str(
            money(
                _safe_attr(
                    contract_product,
                    "effective_price_before_discount",
                    "price_before_discount",
                    default=Decimal("0.00"),
                )
            )
        ),
        "price_after_discount": str(
            money(
                _safe_attr(
                    contract_product,
                    "effective_price_after_discount",
                    "price_after_discount",
                    "special_price",
                    default=Decimal("0.00"),
                )
            )
        ),
        "discount_percentage": str(
            percent(_safe_attr(contract_product, "discount_percentage", default=Decimal("0.00")))
        ),
        "is_active": bool(_safe_attr(contract_product, "is_active", default=False)),
        "is_featured": bool(_safe_attr(contract_product, "is_featured", default=False)),
        "show_on_landing": bool(_safe_attr(contract_product, "show_on_landing", default=False)),
        "show_on_mobile": bool(_safe_attr(contract_product, "show_on_mobile", default=False)),
        "show_on_offers": bool(_safe_attr(contract_product, "show_on_offers", default=False)),
        "is_currently_available": bool(_safe_attr(contract_product, "is_currently_available", default=False)),
        "product": {
            "id": getattr(product, "id", None),
            "code": _safe_attr(product, "code"),
            "name": _safe_attr(product, "name"),
            "product_type": _safe_attr(product, "product_type"),
        } if product else None,
        "contract": {
            "id": getattr(contract, "id", None),
            "contract_number": _safe_attr(contract, "contract_number"),
            "title": _safe_attr(contract, "title"),
            "status": _safe_attr(contract, "status"),
        } if contract else None,
        "provider": {
            "id": getattr(provider, "id", None),
            "name": _safe_attr(provider, "name", "name_ar", "name_en"),
            "name_ar": _safe_attr(provider, "name_ar"),
            "name_en": _safe_attr(provider, "name_en"),
            "status": _safe_attr(provider, "status"),
        } if provider else None,
    }


def serialize_order_status_history(obj: OrderStatusHistory) -> dict[str, Any]:
    return {
        "id": obj.id,
        "order_id": obj.order_id,
        "from_status": obj.from_status,
        "to_status": obj.to_status,
        "note": obj.note,
        "changed_by_id": obj.changed_by_id,
        "changed_by_name": _serialize_user_name(obj.changed_by) if obj.changed_by_id else "",
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
    }


def serialize_order_timeline(obj: OrderTimeline) -> dict[str, Any]:
    return {
        "id": obj.id,
        "order_id": obj.order_id,
        "event_type": obj.event_type,
        "from_status": obj.from_status,
        "to_status": obj.to_status,
        "from_payment_status": obj.from_payment_status,
        "to_payment_status": obj.to_payment_status,
        "from_fulfillment_status": obj.from_fulfillment_status,
        "to_fulfillment_status": obj.to_fulfillment_status,
        "title": obj.title,
        "description": obj.description,
        "amount": str(obj.amount) if obj.amount is not None else None,
        "agent_id": obj.agent_id,
        "agent": _serialize_agent(obj.agent) if obj.agent_id else None,
        "delivery_agent_id": obj.delivery_agent_id,
        "delivery_agent": _serialize_agent(obj.delivery_agent) if obj.delivery_agent_id else None,
        "actor_id": obj.actor_id,
        "actor_name": _serialize_user_name(obj.actor) if obj.actor_id else "",
        "metadata": obj.metadata or {},
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
    }


def get_order_available_actions(order: Order) -> list[str]:
    actions: list[str] = []

    if order.can_be_confirmed:
        actions.append("confirm")

    if order.status in {Order.Status.CONFIRMED, Order.Status.PROCESSING}:
        actions.append("mark_card_printed")
        actions.append("mark_card_ready")

    if order.can_be_assigned_for_delivery:
        actions.append("assign_delivery")

    if order.can_start_delivery:
        actions.append("start_delivery")

    if order.can_be_delivered:
        actions.append("confirm_delivery")

    if order.is_cash_on_delivery and order.payment_status != Order.PaymentStatus.PAID:
        actions.append("collect_cash")

    if order.can_be_completed:
        actions.append("complete")

    if order.can_be_cancelled:
        actions.append("cancel")

    if order.status == Order.Status.COMPLETED and order.payment_status in {
        Order.PaymentStatus.PAID,
        Order.PaymentStatus.PARTIALLY_PAID,
    }:
        actions.append("refund")

    return actions


def serialize_order(obj: Order, include_history: bool = True) -> dict[str, Any]:
    invoice = _get_linked_invoice(obj)

    data = {
        "id": obj.id,
        "order_number": obj.order_number,

        "customer_id": obj.customer_id,
        "customer": {
            "id": obj.customer.id,
            "customer_code": _safe_attr(obj.customer, "customer_code"),
            "display_name": _safe_attr(obj.customer, "display_name", "full_name"),
            "phone_number": _safe_attr(obj.customer, "phone_number", "phone"),
            "whatsapp_number": _safe_attr(obj.customer, "whatsapp_number"),
            "email": _safe_attr(obj.customer, "email"),
            "status": _safe_attr(obj.customer, "status"),
            "normalized_phone": _safe_attr(obj.customer, "normalized_phone"),
            "has_customer_account": bool(_safe_attr(obj.customer, "user_id", default=None)),
            "is_phone_verified": bool(_safe_attr(obj.customer, "phone_verified_at", default=None)),
            "is_whatsapp_verified": bool(_safe_attr(obj.customer, "whatsapp_verified_at", default=None)),
        } if obj.customer_id else None,

        "product_id": obj.product_id,
        "product": {
            "id": obj.product.id,
            "name": _safe_attr(obj.product, "name"),
            "code": _safe_attr(obj.product, "code"),
            "slug": _safe_attr(obj.product, "slug"),
            "product_type": _safe_attr(obj.product, "product_type"),
            "status": _safe_attr(obj.product, "status"),
            "currency_code": _safe_attr(obj.product, "currency_code", default="SAR"),
            "price": str(_safe_attr(obj.product, "price", default=Decimal("0.00"))),
            "sale_price": (
                str(getattr(obj.product, "sale_price"))
                if getattr(obj.product, "sale_price", None) is not None
                else None
            ),
            "effective_price": str(
                _safe_attr(
                    obj.product,
                    "price_after_discount",
                    "effective_price",
                    "price",
                    default=Decimal("0.00"),
                )
            ),
        } if obj.product_id else None,

        "contract_product_id": obj.contract_product_id,
        "offer_id": obj.contract_product_id,
        "contract_product": _serialize_contract_product(obj.contract_product) if obj.contract_product_id else None,
        "offer": _serialize_contract_product(obj.contract_product) if obj.contract_product_id else None,
        "offer_source": obj.offer_source,
        "offer_title": obj.offer_title,
        "offer_badge": obj.offer_badge,
        "has_offer": obj.has_offer,

        "provider_id": obj.provider_id,
        "provider": {
            "id": obj.provider.id,
            "name": _safe_attr(obj.provider, "name", "display_name", "provider_name"),
            "name_ar": _safe_attr(obj.provider, "name_ar"),
            "name_en": _safe_attr(obj.provider, "name_en"),
            "code": _safe_attr(obj.provider, "code", "provider_code"),
            "status": _safe_attr(obj.provider, "status"),
        } if obj.provider_id else None,

        "contract_id": obj.contract_id,
        "contract": {
            "id": obj.contract.id,
            "contract_number": _safe_attr(obj.contract, "contract_number", "number"),
            "title": _safe_attr(obj.contract, "title", "name"),
            "status": _safe_attr(obj.contract, "status"),
        } if obj.contract_id else None,

        "agent_id": obj.agent_id,
        "agent": _serialize_agent(obj.agent) if obj.agent_id else None,

        "delivery_agent_id": obj.delivery_agent_id,
        "delivery_agent": _serialize_agent(obj.delivery_agent) if obj.delivery_agent_id else None,

        "invoice_id": invoice.id if invoice else None,
        "invoice": {
            "id": invoice.id,
            "invoice_number": _safe_attr(invoice, "invoice_number", "number"),
            "status": _safe_attr(invoice, "status"),
            "total_amount": str(_safe_attr(invoice, "total_amount", default=Decimal("0.00"))),
            "paid_amount": str(_safe_attr(invoice, "paid_amount", default=Decimal("0.00"))),
            "due_amount": str(_safe_attr(invoice, "due_amount", default=Decimal("0.00"))),
            "accounting_entry_reference": _safe_attr(invoice, "accounting_entry_reference"),
            "is_accounting_posted": bool(_safe_attr(invoice, "is_accounting_posted", default=False)),
        } if invoice else None,

        "status": obj.status,
        "payment_status": obj.payment_status,
        "fulfillment_status": obj.fulfillment_status,
        "source": obj.source,

        "order_kind": obj.order_kind,
        "starts_at": obj.starts_at.isoformat() if obj.starts_at else None,
        "ends_at": obj.ends_at.isoformat() if obj.ends_at else None,
        "scheduled_at": obj.scheduled_at.isoformat() if obj.scheduled_at else None,
        "duration_days": obj.duration_days,
        "is_subscription_like": obj.is_subscription_like,
        "is_service_like": obj.is_service_like,

        "confirmed_at": obj.confirmed_at.isoformat() if obj.confirmed_at else None,
        "card_printed_at": obj.card_printed_at.isoformat() if obj.card_printed_at else None,
        "card_ready_at": obj.card_ready_at.isoformat() if obj.card_ready_at else None,
        "assigned_for_delivery_at": obj.assigned_for_delivery_at.isoformat() if obj.assigned_for_delivery_at else None,
        "out_for_delivery_at": obj.out_for_delivery_at.isoformat() if obj.out_for_delivery_at else None,
        "delivered_at": obj.delivered_at.isoformat() if obj.delivered_at else None,
        "completed_at": obj.completed_at.isoformat() if obj.completed_at else None,

        "payment_method": obj.payment_method,
        "payment_reference": obj.payment_reference,
        "referral_code_used": obj.referral_code_used,

        "cash_collected_amount": str(obj.cash_collected_amount),
        "cash_collected_at": obj.cash_collected_at.isoformat() if obj.cash_collected_at else None,
        "cash_collected_by_id": obj.cash_collected_by_id,
        "cash_collected_by_name": _serialize_user_name(obj.cash_collected_by) if obj.cash_collected_by_id else "",

        "product_name": obj.product_name,
        "product_type": obj.product_type,
        "currency_code": obj.currency_code,
        "unit_price_before_discount": str(obj.unit_price_before_discount),
        "unit_discount_percentage": str(obj.unit_discount_percentage),
        "unit_price": str(obj.unit_price),
        "quantity": obj.quantity,
        "subtotal_amount": str(obj.subtotal_amount),
        "discount_amount": str(obj.discount_amount),
        "tax_amount": str(obj.tax_amount),
        "total_amount": str(obj.total_amount),
        "amount_paid": str(obj.amount_paid),
        "remaining_amount": str(obj.remaining_amount),
        "is_paid": obj.is_paid,
        "is_cash_on_delivery": obj.is_cash_on_delivery,
        "has_invoice": bool(invoice),

        "issue_reference": obj.issue_reference,
        "issued_at": obj.issued_at.isoformat() if obj.issued_at else None,

        "customer_notes": obj.customer_notes,
        "internal_notes": obj.internal_notes,
        "delivery_notes": obj.delivery_notes,
        "cancellation_reason": obj.cancellation_reason,

        "available_actions": get_order_available_actions(obj),

        "created_by_id": obj.created_by_id,
        "updated_by_id": obj.updated_by_id,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }

    if include_history:
        data["status_history"] = [
            serialize_order_status_history(item)
            for item in obj.status_history.all().order_by("-created_at")
        ]
        data["timeline"] = [
            serialize_order_timeline(item)
            for item in obj.timeline.all().order_by("-created_at", "-id")
        ]

    return data


# ============================================================
# 🔹 Status History / Timeline
# ============================================================

def create_status_history(
    *,
    order: Order,
    from_status: str,
    to_status: str,
    note: str = "",
    user=None,
) -> OrderStatusHistory:
    return OrderStatusHistory.objects.create(
        order=order,
        from_status=from_status or "",
        to_status=to_status,
        note=normalize_text(note),
        changed_by=user if _is_authenticated_user(user) else None,
    )


def create_timeline_event(
    *,
    order: Order,
    event_type: str,
    title: str,
    description: str = "",
    from_status: str = "",
    to_status: str = "",
    from_payment_status: str = "",
    to_payment_status: str = "",
    from_fulfillment_status: str = "",
    to_fulfillment_status: str = "",
    amount: Decimal | None = None,
    agent=None,
    delivery_agent=None,
    actor=None,
    metadata: dict[str, Any] | None = None,
) -> OrderTimeline:
    return OrderTimeline.objects.create(
        order=order,
        event_type=event_type,
        from_status=from_status or "",
        to_status=to_status or "",
        from_payment_status=from_payment_status or "",
        to_payment_status=to_payment_status or "",
        from_fulfillment_status=from_fulfillment_status or "",
        to_fulfillment_status=to_fulfillment_status or "",
        title=normalize_text(title, "Order updated"),
        description=normalize_text(description),
        amount=amount,
        agent=agent or order.agent,
        delivery_agent=delivery_agent or order.delivery_agent,
        actor=actor if _is_authenticated_user(actor) else None,
        metadata=metadata or {},
    )


def _record_order_status_change(
    *,
    order: Order,
    from_status: str,
    to_status: str,
    note: str,
    user=None,
    event_type: str = OrderTimeline.EventType.UPDATED,
    title: str = "",
    description: str = "",
    from_payment_status: str = "",
    to_payment_status: str = "",
    from_fulfillment_status: str = "",
    to_fulfillment_status: str = "",
    amount: Decimal | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    create_status_history(
        order=order,
        from_status=from_status,
        to_status=to_status,
        note=note,
        user=user,
    )

    create_timeline_event(
        order=order,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        from_payment_status=from_payment_status,
        to_payment_status=to_payment_status,
        from_fulfillment_status=from_fulfillment_status,
        to_fulfillment_status=to_fulfillment_status,
        title=title or note or "Order updated",
        description=description or note,
        amount=amount,
        actor=user,
        metadata=metadata or {},
    )


# ============================================================
# 🔹 Create / Update
# ============================================================

def _default_order_source_for_context(*, payload: dict[str, Any], user=None, agent=None) -> str:
    explicit_source = normalize_lower(payload.get("source") or payload.get("order_source"))
    if explicit_source:
        return explicit_source

    if not _is_authenticated_user(user):
        return Order.OrderSource.WEBSITE

    if agent and _user_looks_like_agent(user) and not _user_can_assign_agent(user):
        return Order.OrderSource.AGENT

    return Order.OrderSource.ADMIN


def create_order(*, payload: dict[str, Any], user=None) -> Order:
    customer = _resolve_customer_from_payload(payload, user=user)

    initial_product = None
    if payload.get("product_id"):
        initial_product = _resolve_product(payload.get("product_id"))

    provider, contract, contract_product, product = _resolve_provider_contract_for_order(
        product=initial_product,
        payload=payload,
    )

    agent = _resolve_agent_for_order(payload, user=user)
    delivery_agent = _resolve_delivery_agent_for_order(payload, user=user)
    invoice = _resolve_invoice(payload.get("invoice_id"))

    status = normalize_lower(payload.get("status")) or Order.Status.PENDING
    payment_status = normalize_lower(payload.get("payment_status")) or Order.PaymentStatus.UNPAID
    fulfillment_status = normalize_lower(payload.get("fulfillment_status")) or Order.FulfillmentStatus.NOT_STARTED
    source = _default_order_source_for_context(payload=payload, user=user, agent=agent)

    status = _validate_status(status)
    payment_status = _validate_payment_status(payment_status)
    fulfillment_status = _validate_fulfillment_status(fulfillment_status)
    source = _validate_source(source)

    if status == Order.Status.CANCELLED and not normalize_text(payload.get("cancellation_reason")):
        raise ValidationError("Cancellation reason is required when order is cancelled.")

    order = Order(
        customer=customer,
        product=product,
        contract_product=contract_product,
        provider=provider,
        contract=contract,
        agent=agent,
        delivery_agent=delivery_agent,
        status=status,
        payment_status=payment_status,
        fulfillment_status=fulfillment_status,
        source=source,
        issue_reference=normalize_text(payload.get("issue_reference")),
        issued_at=parse_datetime_value(payload.get("issued_at")),
        customer_notes=normalize_text(payload.get("customer_notes") or payload.get("notes")),
        internal_notes=normalize_text(payload.get("internal_notes")),
        delivery_notes=normalize_text(payload.get("delivery_notes")),
        cancellation_reason=normalize_text(payload.get("cancellation_reason")),
        created_by=user if _is_authenticated_user(user) else None,
        updated_by=user if _is_authenticated_user(user) else None,
    )

    _apply_business_fields_to_order(order, product, payload)

    _apply_order_snapshot_from_product(
        order=order,
        product=product,
        payload=payload,
        contract_product=contract_product,
        force_payment_status_from_amount=("payment_status" not in payload),
    )

    if "payment_status" in payload:
        order.payment_status = payment_status

    with transaction.atomic():
        order.full_clean()
        order.save()

        if invoice:
            _attach_invoice_to_order(order=order, invoice=invoice)

        create_status_history(
            order=order,
            from_status="",
            to_status=order.status,
            note=normalize_text(payload.get("status_note"), "Order created"),
            user=user,
        )

        create_timeline_event(
            order=order,
            event_type=OrderTimeline.EventType.CREATED,
            from_status="",
            to_status=order.status,
            from_payment_status="",
            to_payment_status=order.payment_status,
            from_fulfillment_status="",
            to_fulfillment_status=order.fulfillment_status,
            title="Order created",
            description=normalize_text(payload.get("status_note"), "Order created"),
            amount=order.total_amount,
            actor=user,
            metadata={
                "source": order.source,
                "payment_method": order.payment_method,
                "referral_code_used": order.referral_code_used,
                "contract_product_id": order.contract_product_id,
                "offer_id": order.contract_product_id,
                "offer_source": order.offer_source,
                "provider_id": order.provider_id,
                "contract_id": order.contract_id,
            },
        )

        _maybe_create_agent_order(order=order, payload=payload, user=user)
        _maybe_create_invoice_from_order(order=order, payload=payload, user=user)
        _sync_order_financial_effects(order=order, user=user, event="created")

    order.refresh_from_db()
    return order


def update_order(*, instance: Order, payload: dict[str, Any], user=None) -> Order:
    previous_status = instance.status
    previous_payment_status = instance.payment_status
    previous_fulfillment_status = instance.fulfillment_status
    previous_agent_id = instance.agent_id
    previous_delivery_agent_id = instance.delivery_agent_id

    invoice_to_attach = None
    should_attach_invoice = "invoice_id" in payload and payload.get("invoice_id") not in (None, "", 0, "0")

    if "customer_id" in payload or "customer" in payload:
        instance.customer = _resolve_customer(payload.get("customer_id") or payload.get("customer"))
    elif _resolve_customer_phone_from_payload(payload):
        instance.customer = _resolve_customer_from_payload(payload, user=user)

    product_changed = False
    provider_contract_changed = False
    contract_product_changed = False

    if any(key in payload for key in ("contract_product_id", "contract_product", "offer_id", "offer", "selected_offer_id")):
        contract_product = _resolve_contract_product_from_payload(payload)
        if contract_product:
            instance.contract_product = contract_product
            instance.product = contract_product.product
            instance.contract = contract_product.contract
            instance.provider = _resolve_provider_from_contract(contract_product.contract)
            contract_product_changed = True
            product_changed = True
            provider_contract_changed = True
    else:
        contract_product = instance.contract_product

    if "product_id" in payload and not contract_product_changed:
        instance.product = _resolve_product(payload.get("product_id"))
        product_changed = True
        provider_contract_changed = True

    if "provider_id" in payload and not contract_product_changed:
        instance.provider = _resolve_provider(payload.get("provider_id"))
        provider_contract_changed = True

    if "contract_id" in payload and not contract_product_changed:
        instance.contract = _resolve_contract(payload.get("contract_id"))
        provider_contract_changed = True

    if provider_contract_changed and not contract_product_changed:
        provider, contract, resolved_contract_product, product = _resolve_provider_contract_for_order(
            product=instance.product,
            payload={
                **payload,
                "provider_id": getattr(instance.provider, "pk", None),
                "contract_id": getattr(instance.contract, "pk", None),
            },
        )
        instance.product = product
        instance.provider = provider
        instance.contract = contract
        contract_product = resolved_contract_product
        instance.contract_product = contract_product
    elif not contract_product:
        contract_product = _resolve_contract_product(
            product=instance.product,
            provider=instance.provider,
            contract=instance.contract,
        )
        instance.contract_product = contract_product

    if _payload_has_agent_reference(payload):
        instance.agent = _resolve_agent_for_order(
            payload,
            user=user,
            existing_agent=instance.agent,
        )

    if _payload_has_delivery_agent_reference(payload):
        instance.delivery_agent = _resolve_delivery_agent_for_order(
            payload,
            user=user,
            existing_delivery_agent=instance.delivery_agent,
        )

    if should_attach_invoice:
        invoice_to_attach = _resolve_invoice(payload.get("invoice_id"))

    if "status" in payload:
        instance.status = normalize_lower(payload.get("status"))

    if "payment_status" in payload:
        instance.payment_status = normalize_lower(payload.get("payment_status"))

    if "fulfillment_status" in payload:
        instance.fulfillment_status = normalize_lower(payload.get("fulfillment_status"))

    if "source" in payload:
        instance.source = normalize_lower(payload.get("source"))

    if "issue_reference" in payload:
        instance.issue_reference = normalize_text(payload.get("issue_reference"))

    if "issued_at" in payload:
        instance.issued_at = parse_datetime_value(payload.get("issued_at"))

    if "customer_notes" in payload or "notes" in payload:
        instance.customer_notes = normalize_text(payload.get("customer_notes") or payload.get("notes"))

    if "internal_notes" in payload:
        instance.internal_notes = normalize_text(payload.get("internal_notes"))

    if "delivery_notes" in payload:
        instance.delivery_notes = normalize_text(payload.get("delivery_notes"))

    if "cancellation_reason" in payload:
        instance.cancellation_reason = normalize_text(payload.get("cancellation_reason"))

    if "cash_collected_amount" in payload:
        instance.cash_collected_amount = money(payload.get("cash_collected_amount"))

    _patch_business_fields_on_order(instance, instance.product, payload)

    instance.status = _validate_status(instance.status)
    instance.payment_status = _validate_payment_status(instance.payment_status)
    instance.fulfillment_status = _validate_fulfillment_status(instance.fulfillment_status)
    instance.source = _validate_source(instance.source)
    instance.order_kind = _validate_order_kind(instance.order_kind)
    instance.payment_method = _validate_payment_method(instance.payment_method)

    allow_any_status = parse_bool(payload.get("allow_any_status"), False)

    if not allow_any_status:
        _validate_status_transition(previous_status, instance.status)

    should_recalculate_amounts = product_changed or provider_contract_changed or contract_product_changed or any(
        key in payload
        for key in [
            "product_id",
            "contract_product_id",
            "offer_id",
            "product_name",
            "product_type",
            "currency_code",
            "currency",
            "unit_price_before_discount",
            "unit_discount_percentage",
            "unit_price",
            "quantity",
            "discount_amount",
            "tax_amount",
            "tax_rate",
            "amount_paid",
            "paid_amount",
        ]
    )

    if should_recalculate_amounts:
        product = instance.product
        recalculation_payload = {
            "product_name": payload.get("product_name", instance.product_name),
            "product_type": payload.get("product_type", instance.product_type),
            "currency_code": payload.get("currency_code", instance.currency_code),
            "currency": payload.get("currency", instance.currency_code),
            "unit_price_before_discount": payload.get("unit_price_before_discount", instance.unit_price_before_discount),
            "unit_discount_percentage": payload.get("unit_discount_percentage", instance.unit_discount_percentage),
            "unit_price": payload.get("unit_price", instance.unit_price),
            "quantity": payload.get("quantity", instance.quantity),
            "discount_amount": payload.get("discount_amount", instance.discount_amount),
            "tax_amount": payload.get("tax_amount", instance.tax_amount),
            "tax_rate": payload.get("tax_rate", None),
            "amount_paid": _first_non_empty(payload.get("amount_paid"), payload.get("paid_amount"), instance.amount_paid),
            "offer_source": payload.get("offer_source", instance.offer_source),
            "offer_title": payload.get("offer_title", instance.offer_title),
            "offer_badge": payload.get("offer_badge", instance.offer_badge),
        }

        if (provider_contract_changed or contract_product_changed) and "unit_price" not in payload:
            recalculation_payload.pop("unit_price", None)
            recalculation_payload.pop("unit_price_before_discount", None)
            recalculation_payload.pop("unit_discount_percentage", None)
            recalculation_payload.pop("discount_amount", None)

        _apply_order_snapshot_from_product(
            order=instance,
            product=product,
            payload=recalculation_payload,
            contract_product=contract_product,
            force_payment_status_from_amount=("payment_status" not in payload),
        )

    if _is_authenticated_user(user):
        instance.updated_by = user

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        if invoice_to_attach:
            _attach_invoice_to_order(order=instance, invoice=invoice_to_attach)

        if previous_status != instance.status:
            create_status_history(
                order=instance,
                from_status=previous_status,
                to_status=instance.status,
                note=normalize_text(payload.get("status_note"), "Status updated"),
                user=user,
            )

        if (
            previous_status != instance.status
            or previous_payment_status != instance.payment_status
            or previous_fulfillment_status != instance.fulfillment_status
            or previous_delivery_agent_id != instance.delivery_agent_id
        ):
            create_timeline_event(
                order=instance,
                event_type=OrderTimeline.EventType.UPDATED,
                from_status=previous_status,
                to_status=instance.status,
                from_payment_status=previous_payment_status,
                to_payment_status=instance.payment_status,
                from_fulfillment_status=previous_fulfillment_status,
                to_fulfillment_status=instance.fulfillment_status,
                title="Order updated",
                description=normalize_text(payload.get("status_note"), "Order updated"),
                amount=instance.total_amount,
                actor=user,
                metadata={
                    "delivery_agent_changed": previous_delivery_agent_id != instance.delivery_agent_id,
                    "previous_delivery_agent_id": previous_delivery_agent_id,
                    "delivery_agent_id": instance.delivery_agent_id,
                    "contract_product_id": instance.contract_product_id,
                    "offer_id": instance.contract_product_id,
                    "offer_source": instance.offer_source,
                },
            )

        if instance.agent_id and instance.agent_id != previous_agent_id:
            _maybe_create_agent_order(order=instance, payload=payload, user=user)

        _sync_order_financial_effects(order=instance, user=user, event="updated")

    instance.refresh_from_db()
    return instance


# ============================================================
# 🔹 Lifecycle Actions
# ============================================================

def confirm_order(*, instance: Order, user=None, note: str = "") -> Order:
    previous_status = instance.status
    previous_payment_status = instance.payment_status
    previous_fulfillment_status = instance.fulfillment_status

    _validate_status_transition(previous_status, Order.Status.CONFIRMED)

    instance.status = Order.Status.CONFIRMED
    instance.fulfillment_status = Order.FulfillmentStatus.NOT_STARTED

    if _is_authenticated_user(user):
        instance.updated_by = user

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        _record_order_status_change(
            order=instance,
            from_status=previous_status,
            to_status=instance.status,
            from_payment_status=previous_payment_status,
            to_payment_status=instance.payment_status,
            from_fulfillment_status=previous_fulfillment_status,
            to_fulfillment_status=instance.fulfillment_status,
            note=normalize_text(note, "Order confirmed"),
            user=user,
            event_type=OrderTimeline.EventType.CONFIRMED,
            title="Order confirmed",
            description=normalize_text(note, "Order confirmed"),
            amount=instance.total_amount,
        )

        _sync_order_financial_effects(order=instance, user=user, event="confirmed")

    return instance


def start_processing_order(*, instance: Order, user=None, note: str = "") -> Order:
    previous_status = instance.status
    previous_payment_status = instance.payment_status
    previous_fulfillment_status = instance.fulfillment_status

    _validate_status_transition(previous_status, Order.Status.PROCESSING)

    instance.status = Order.Status.PROCESSING
    instance.fulfillment_status = Order.FulfillmentStatus.IN_PROGRESS

    if _is_authenticated_user(user):
        instance.updated_by = user

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        _record_order_status_change(
            order=instance,
            from_status=previous_status,
            to_status=instance.status,
            from_payment_status=previous_payment_status,
            to_payment_status=instance.payment_status,
            from_fulfillment_status=previous_fulfillment_status,
            to_fulfillment_status=instance.fulfillment_status,
            note=normalize_text(note, "Order processing started"),
            user=user,
            event_type=OrderTimeline.EventType.UPDATED,
            title="Order processing started",
            description=normalize_text(note, "Order processing started"),
            amount=instance.total_amount,
        )

    return instance


def mark_card_printed(*, instance: Order, user=None, note: str = "") -> Order:
    if instance.status not in {
        Order.Status.CONFIRMED,
        Order.Status.PROCESSING,
        Order.Status.CARD_READY,
    }:
        raise ValidationError("Only confirmed or processing orders can be marked as card printed.")

    previous_status = instance.status
    previous_payment_status = instance.payment_status
    previous_fulfillment_status = instance.fulfillment_status

    if not instance.card_printed_at:
        instance.card_printed_at = timezone.now()

    instance.fulfillment_status = Order.FulfillmentStatus.IN_PROGRESS

    if _is_authenticated_user(user):
        instance.updated_by = user

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        create_timeline_event(
            order=instance,
            event_type=OrderTimeline.EventType.CARD_PRINTED,
            from_status=previous_status,
            to_status=instance.status,
            from_payment_status=previous_payment_status,
            to_payment_status=instance.payment_status,
            from_fulfillment_status=previous_fulfillment_status,
            to_fulfillment_status=instance.fulfillment_status,
            title="Card printed",
            description=normalize_text(note, "Card printed"),
            amount=instance.total_amount,
            actor=user,
        )

    return instance


def mark_card_ready(*, instance: Order, user=None, note: str = "") -> Order:
    previous_status = instance.status
    previous_payment_status = instance.payment_status
    previous_fulfillment_status = instance.fulfillment_status

    _validate_status_transition(previous_status, Order.Status.CARD_READY)

    instance.status = Order.Status.CARD_READY
    instance.fulfillment_status = Order.FulfillmentStatus.READY

    if not instance.card_printed_at:
        instance.card_printed_at = timezone.now()

    if not instance.card_ready_at:
        instance.card_ready_at = timezone.now()

    if _is_authenticated_user(user):
        instance.updated_by = user

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        _record_order_status_change(
            order=instance,
            from_status=previous_status,
            to_status=instance.status,
            from_payment_status=previous_payment_status,
            to_payment_status=instance.payment_status,
            from_fulfillment_status=previous_fulfillment_status,
            to_fulfillment_status=instance.fulfillment_status,
            note=normalize_text(note, "Card is ready for delivery"),
            user=user,
            event_type=OrderTimeline.EventType.CARD_READY,
            title="Card ready",
            description=normalize_text(note, "Card is ready for delivery"),
            amount=instance.total_amount,
        )

    return instance


def assign_order_delivery(*, instance: Order, delivery_agent_id: Any, user=None, note: str = "") -> Order:
    delivery_agent = _resolve_agent(delivery_agent_id)

    if not delivery_agent:
        raise ValidationError("Delivery agent is required.")

    if not _user_can_assign_delivery(user):
        raise ValidationError("You do not have permission to assign delivery.")

    previous_status = instance.status
    previous_payment_status = instance.payment_status
    previous_fulfillment_status = instance.fulfillment_status

    _validate_status_transition(previous_status, Order.Status.ASSIGNED_FOR_DELIVERY)

    instance.delivery_agent = delivery_agent
    instance.status = Order.Status.ASSIGNED_FOR_DELIVERY
    instance.fulfillment_status = Order.FulfillmentStatus.ASSIGNED

    if not instance.assigned_for_delivery_at:
        instance.assigned_for_delivery_at = timezone.now()

    if _is_authenticated_user(user):
        instance.updated_by = user

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        _record_order_status_change(
            order=instance,
            from_status=previous_status,
            to_status=instance.status,
            from_payment_status=previous_payment_status,
            to_payment_status=instance.payment_status,
            from_fulfillment_status=previous_fulfillment_status,
            to_fulfillment_status=instance.fulfillment_status,
            note=normalize_text(note, "Order assigned for delivery"),
            user=user,
            event_type=OrderTimeline.EventType.DELIVERY_ASSIGNED,
            title="Delivery assigned",
            description=normalize_text(note, "Order assigned for delivery"),
            amount=instance.total_amount,
            metadata={
                "delivery_agent_id": delivery_agent.pk,
                "delivery_agent_name": _safe_attr(delivery_agent, "display_name", "full_name", "name"),
            },
        )

    return instance


def start_order_delivery(*, instance: Order, user=None, note: str = "") -> Order:
    if not instance.delivery_agent_id:
        raise ValidationError("Delivery agent is required before starting delivery.")

    previous_status = instance.status
    previous_payment_status = instance.payment_status
    previous_fulfillment_status = instance.fulfillment_status

    _validate_status_transition(previous_status, Order.Status.OUT_FOR_DELIVERY)

    instance.status = Order.Status.OUT_FOR_DELIVERY
    instance.fulfillment_status = Order.FulfillmentStatus.OUT_FOR_DELIVERY

    if not instance.out_for_delivery_at:
        instance.out_for_delivery_at = timezone.now()

    if _is_authenticated_user(user):
        instance.updated_by = user

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        _record_order_status_change(
            order=instance,
            from_status=previous_status,
            to_status=instance.status,
            from_payment_status=previous_payment_status,
            to_payment_status=instance.payment_status,
            from_fulfillment_status=previous_fulfillment_status,
            to_fulfillment_status=instance.fulfillment_status,
            note=normalize_text(note, "Order is out for delivery"),
            user=user,
            event_type=OrderTimeline.EventType.OUT_FOR_DELIVERY,
            title="Out for delivery",
            description=normalize_text(note, "Order is out for delivery"),
            amount=instance.total_amount,
        )

    return instance


def collect_order_cash(
    *,
    instance: Order,
    amount: Any | None = None,
    user=None,
    note: str = "",
) -> Order:
    if not instance.is_cash_on_delivery:
        raise ValidationError("Cash collection is only available for cash on delivery orders.")

    previous_status = instance.status
    previous_payment_status = instance.payment_status
    previous_fulfillment_status = instance.fulfillment_status

    collected_amount = money(amount, instance.remaining_amount or instance.total_amount)

    if collected_amount <= Decimal("0.00"):
        raise ValidationError("Cash collected amount must be greater than zero.")

    if collected_amount > instance.total_amount:
        raise ValidationError("Cash collected amount cannot exceed order total.")

    instance.cash_collected_amount = collected_amount
    instance.amount_paid = collected_amount
    instance.payment_status = Order.PaymentStatus.PAID
    instance.cash_collected_at = timezone.now()
    instance.cash_collected_by = user if _is_authenticated_user(user) else None

    if _is_authenticated_user(user):
        instance.updated_by = user

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        create_timeline_event(
            order=instance,
            event_type=OrderTimeline.EventType.CASH_COLLECTED,
            from_status=previous_status,
            to_status=instance.status,
            from_payment_status=previous_payment_status,
            to_payment_status=instance.payment_status,
            from_fulfillment_status=previous_fulfillment_status,
            to_fulfillment_status=instance.fulfillment_status,
            title="Cash collected",
            description=normalize_text(note, "Cash collected from customer"),
            amount=collected_amount,
            actor=user,
            metadata={
                "cash_collected_amount": str(collected_amount),
                "cash_collected_by_id": getattr(user, "pk", None) if _is_authenticated_user(user) else None,
            },
        )

        _sync_order_financial_effects(order=instance, user=user, event="cash_collected")

    return instance


def confirm_order_delivery(
    *,
    instance: Order,
    user=None,
    cash_collected_amount: Any | None = None,
    note: str = "",
    complete_after_delivery: bool = False,
) -> Order:
    if not instance.delivery_agent_id:
        raise ValidationError("Delivery agent is required before confirming delivery.")

    previous_status = instance.status
    previous_payment_status = instance.payment_status
    previous_fulfillment_status = instance.fulfillment_status

    _validate_status_transition(previous_status, Order.Status.DELIVERED)

    if instance.is_cash_on_delivery:
        collected_amount = money(cash_collected_amount, instance.remaining_amount or instance.total_amount)

        if collected_amount <= Decimal("0.00"):
            raise ValidationError("Cash collected amount is required for cash on delivery orders.")

        if collected_amount > instance.total_amount:
            raise ValidationError("Cash collected amount cannot exceed order total.")

        instance.cash_collected_amount = collected_amount
        instance.amount_paid = collected_amount
        instance.payment_status = Order.PaymentStatus.PAID
        instance.cash_collected_at = timezone.now()
        instance.cash_collected_by = user if _is_authenticated_user(user) else None

    instance.status = Order.Status.DELIVERED
    instance.fulfillment_status = Order.FulfillmentStatus.DELIVERED

    if not instance.delivered_at:
        instance.delivered_at = timezone.now()

    if not instance.issued_at:
        instance.issued_at = timezone.now()

    if note:
        instance.delivery_notes = normalize_text(
            f"{instance.delivery_notes}\n{note}" if instance.delivery_notes else note
        )

    if _is_authenticated_user(user):
        instance.updated_by = user

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        _record_order_status_change(
            order=instance,
            from_status=previous_status,
            to_status=instance.status,
            from_payment_status=previous_payment_status,
            to_payment_status=instance.payment_status,
            from_fulfillment_status=previous_fulfillment_status,
            to_fulfillment_status=instance.fulfillment_status,
            note=normalize_text(note, "Order delivered to customer"),
            user=user,
            event_type=OrderTimeline.EventType.DELIVERED,
            title="Order delivered",
            description=normalize_text(note, "Order delivered to customer"),
            amount=instance.cash_collected_amount if instance.is_cash_on_delivery else instance.total_amount,
            metadata={
                "cash_collected": bool(instance.is_cash_on_delivery),
                "cash_collected_amount": str(instance.cash_collected_amount),
            },
        )

        if instance.is_cash_on_delivery:
            create_timeline_event(
                order=instance,
                event_type=OrderTimeline.EventType.CASH_COLLECTED,
                from_status=previous_status,
                to_status=instance.status,
                from_payment_status=previous_payment_status,
                to_payment_status=instance.payment_status,
                from_fulfillment_status=previous_fulfillment_status,
                to_fulfillment_status=instance.fulfillment_status,
                title="Cash collected",
                description=normalize_text(note, "Cash collected on delivery"),
                amount=instance.cash_collected_amount,
                actor=user,
                metadata={
                    "cash_collected_amount": str(instance.cash_collected_amount),
                    "cash_collected_by_id": getattr(user, "pk", None) if _is_authenticated_user(user) else None,
                },
            )

        _sync_order_financial_effects(order=instance, user=user, event="delivered")

    if complete_after_delivery:
        instance.refresh_from_db()
        return complete_order(instance=instance, user=user, note="Order completed after delivery")

    return instance


def complete_order(*, instance: Order, user=None, note: str = "") -> Order:
    previous_status = instance.status
    previous_payment_status = instance.payment_status
    previous_fulfillment_status = instance.fulfillment_status

    _validate_status_transition(previous_status, Order.Status.COMPLETED)

    if instance.is_cash_on_delivery and instance.payment_status != Order.PaymentStatus.PAID:
        raise ValidationError("Cash on delivery orders must be paid before completion.")

    instance.status = Order.Status.COMPLETED

    if instance.fulfillment_status in {
        Order.FulfillmentStatus.NOT_STARTED,
        Order.FulfillmentStatus.PENDING,
        Order.FulfillmentStatus.IN_PROGRESS,
        Order.FulfillmentStatus.READY,
        Order.FulfillmentStatus.ASSIGNED,
        Order.FulfillmentStatus.OUT_FOR_DELIVERY,
    }:
        instance.fulfillment_status = Order.FulfillmentStatus.DELIVERED

    if not instance.issued_at:
        instance.issued_at = timezone.now()

    if not instance.completed_at:
        instance.completed_at = timezone.now()

    if _is_authenticated_user(user):
        instance.updated_by = user

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        _record_order_status_change(
            order=instance,
            from_status=previous_status,
            to_status=instance.status,
            from_payment_status=previous_payment_status,
            to_payment_status=instance.payment_status,
            from_fulfillment_status=previous_fulfillment_status,
            to_fulfillment_status=instance.fulfillment_status,
            note=normalize_text(note, "Order completed"),
            user=user,
            event_type=OrderTimeline.EventType.COMPLETED,
            title="Order completed",
            description=normalize_text(note, "Order completed"),
            amount=instance.total_amount,
        )

        _sync_order_financial_effects(order=instance, user=user, event="completed")

    return instance


def cancel_order(*, instance: Order, reason: str, user=None, note: str = "") -> Order:
    reason = normalize_text(reason)

    if not reason:
        raise ValidationError("Cancellation reason is required.")

    previous_status = instance.status
    previous_payment_status = instance.payment_status
    previous_fulfillment_status = instance.fulfillment_status

    _validate_status_transition(previous_status, Order.Status.CANCELLED)

    if instance.payment_status in {
        Order.PaymentStatus.PAID,
        Order.PaymentStatus.PARTIALLY_PAID,
    }:
        raise ValidationError("Cannot cancel a paid or partially paid order. Refund it instead.")

    instance.status = Order.Status.CANCELLED
    instance.fulfillment_status = Order.FulfillmentStatus.FAILED
    instance.cancellation_reason = reason

    if _is_authenticated_user(user):
        instance.updated_by = user

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        _record_order_status_change(
            order=instance,
            from_status=previous_status,
            to_status=instance.status,
            from_payment_status=previous_payment_status,
            to_payment_status=instance.payment_status,
            from_fulfillment_status=previous_fulfillment_status,
            to_fulfillment_status=instance.fulfillment_status,
            note=normalize_text(note, reason),
            user=user,
            event_type=OrderTimeline.EventType.CANCELLED,
            title="Order cancelled",
            description=normalize_text(note, reason),
            amount=instance.total_amount,
            metadata={"reason": reason},
        )

    return instance


def refund_order(*, instance: Order, user=None, note: str = "") -> Order:
    previous_status = instance.status
    previous_payment_status = instance.payment_status
    previous_fulfillment_status = instance.fulfillment_status

    _validate_status_transition(previous_status, Order.Status.REFUNDED)

    if instance.payment_status not in {
        Order.PaymentStatus.PAID,
        Order.PaymentStatus.PARTIALLY_PAID,
    }:
        raise ValidationError("Only paid or partially paid orders can be refunded.")

    instance.status = Order.Status.REFUNDED
    instance.payment_status = Order.PaymentStatus.REFUNDED

    if _is_authenticated_user(user):
        instance.updated_by = user

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        _record_order_status_change(
            order=instance,
            from_status=previous_status,
            to_status=instance.status,
            from_payment_status=previous_payment_status,
            to_payment_status=instance.payment_status,
            from_fulfillment_status=previous_fulfillment_status,
            to_fulfillment_status=instance.fulfillment_status,
            note=normalize_text(note, "Order refunded"),
            user=user,
            event_type=OrderTimeline.EventType.REFUNDED,
            title="Order refunded",
            description=normalize_text(note, "Order refunded"),
            amount=instance.amount_paid,
        )

    return instance


def attach_invoice(*, instance: Order, invoice_id: Any, user=None, note: str = "") -> Order:
    invoice = _resolve_invoice(invoice_id)

    with transaction.atomic():
        _attach_invoice_to_order(order=instance, invoice=invoice)

        if _is_authenticated_user(user):
            instance.updated_by = user
            instance.save(update_fields=["updated_by", "updated_at"])

        create_status_history(
            order=instance,
            from_status=instance.status,
            to_status=instance.status,
            note=normalize_text(note, "Invoice attached to order"),
            user=user,
        )

        create_timeline_event(
            order=instance,
            event_type=OrderTimeline.EventType.UPDATED,
            from_status=instance.status,
            to_status=instance.status,
            from_payment_status=instance.payment_status,
            to_payment_status=instance.payment_status,
            from_fulfillment_status=instance.fulfillment_status,
            to_fulfillment_status=instance.fulfillment_status,
            title="Invoice attached",
            description=normalize_text(note, "Invoice attached to order"),
            amount=instance.total_amount,
            actor=user,
            metadata={
                "invoice_id": getattr(invoice, "pk", None),
                "invoice_number": _safe_attr(invoice, "invoice_number", "number"),
            },
        )

    return instance