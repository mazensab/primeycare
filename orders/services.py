# ============================================================
# 📂 orders/services.py
# 🧭 Primey Care — Orders Services V2
# ------------------------------------------------------------
# ✅ Parsing / Validation / Serialization
# ✅ Filtering / Pagination
# ✅ Create / Update Order
# ✅ Full Order Lifecycle
# ✅ Status history tracking
# ✅ Product financial snapshot
# ✅ Payment status synchronization
# ✅ Optional AgentOrder + AgentCommission creation
# ✅ Optional Invoice creation via invoices.services.create_invoice_from_order
# ✅ Compatible with Accounting / Treasury backend flow
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
from django.utils.dateparse import parse_datetime

from customers.models import Customer
from orders.models import Order, OrderStatusHistory
from products.models import Product


logger = logging.getLogger(__name__)


# ============================================================
# 🔹 Constants
# ============================================================

DEFAULT_TAX_RATE = Decimal("15.00")


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


def parse_bool(value: Any, default: bool | None = None) -> bool | None:
    if value in (None, ""):
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return bool(value)

    value_str = str(value).strip().lower()

    if value_str in {"1", "true", "yes", "y", "on"}:
        return True

    if value_str in {"0", "false", "no", "n", "off"}:
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

    return parsed.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


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


def _call_if_exists(obj: Any, method_name: str, *args: Any, **kwargs: Any) -> Any:
    method = getattr(obj, method_name, None)

    if callable(method):
        return method(*args, **kwargs)

    return None


def _resolve_import_callable(module_path: str, function_name: str) -> Optional[Callable[..., Any]]:
    try:
        module = import_module(module_path)
        fn = getattr(module, function_name, None)

        if callable(fn):
            return fn

    except Exception as exc:
        logger.debug("Unable to import %s.%s: %s", module_path, function_name, exc)

    return None


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
    status = normalize_text(params.get("status"))
    payment_status = normalize_text(params.get("payment_status"))
    fulfillment_status = normalize_text(params.get("fulfillment_status"))
    source = normalize_text(params.get("source"))

    customer_id = parse_int(params.get("customer_id"))
    product_id = parse_int(params.get("product_id"))
    provider_id = parse_int(params.get("provider_id"))
    contract_id = parse_int(params.get("contract_id"))
    agent_id = parse_int(params.get("agent_id"))
    invoice_id = parse_int(params.get("invoice_id"))
    created_by_id = parse_int(params.get("created_by_id"))

    date_from = normalize_text(params.get("date_from"))
    date_to = normalize_text(params.get("date_to"))

    if q:
        queryset = queryset.filter(
            Q(order_number__icontains=q)
            | Q(product_name__icontains=q)
            | Q(product_type__icontains=q)
            | Q(customer__customer_code__icontains=q)
            | Q(customer__display_name__icontains=q)
            | Q(customer__phone_number__icontains=q)
            | Q(customer__whatsapp_number__icontains=q)
            | Q(customer__email__icontains=q)
            | Q(product__name__icontains=q)
            | Q(product__code__icontains=q)
            | Q(provider__name__icontains=q)
            | Q(agent__full_name__icontains=q)
            | Q(agent__agent_code__icontains=q)
            | Q(customer_notes__icontains=q)
            | Q(internal_notes__icontains=q)
            | Q(issue_reference__icontains=q)
        )

    if status:
        queryset = queryset.filter(status=status)

    if payment_status:
        queryset = queryset.filter(payment_status=payment_status)

    if fulfillment_status:
        queryset = queryset.filter(fulfillment_status=fulfillment_status)

    if source:
        queryset = queryset.filter(source=source)

    if customer_id:
        queryset = queryset.filter(customer_id=customer_id)

    if product_id:
        queryset = queryset.filter(product_id=product_id)

    if provider_id:
        queryset = queryset.filter(provider_id=provider_id)

    if contract_id:
        queryset = queryset.filter(contract_id=contract_id)

    if agent_id:
        queryset = queryset.filter(agent_id=agent_id)

    if invoice_id:
        queryset = queryset.filter(invoice__id=invoice_id)

    if created_by_id:
        queryset = queryset.filter(created_by_id=created_by_id)

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
            Order.Status.COMPLETED,
            Order.Status.CANCELLED,
        },
        Order.Status.PROCESSING: {
            Order.Status.COMPLETED,
            Order.Status.CANCELLED,
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
# 🔹 Resolve Helpers
# ============================================================

def _resolve_customer(customer_id: Any) -> Customer:
    if customer_id in (None, "", 0, "0"):
        raise ValidationError("Customer is required.")

    try:
        return Customer.objects.get(pk=int(customer_id))
    except (Customer.DoesNotExist, TypeError, ValueError) as exc:
        raise ValidationError("Selected customer does not exist.") from exc


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


def _resolve_unit_price(product: Product, payload: dict[str, Any]) -> Decimal:
    explicit_price = payload.get("unit_price")

    if explicit_price not in (None, ""):
        return money(explicit_price)

    return money(
        _first_non_empty(
            _safe_attr(product, "effective_price", default=None),
            _safe_attr(product, "sale_price", default=None),
            _safe_attr(product, "price", default=None),
            "0.00",
        )
    )


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
    unit_price: Decimal,
    quantity: int,
    payload: dict[str, Any],
) -> dict[str, Decimal]:
    discount_amount = money(payload.get("discount_amount"), Decimal("0.00"))

    if discount_amount < Decimal("0.00"):
        raise ValidationError("Discount amount cannot be negative.")

    subtotal_amount = money(unit_price * Decimal(quantity))

    if discount_amount > subtotal_amount:
        raise ValidationError("Discount amount cannot be greater than subtotal amount.")

    tax_amount = _calculate_tax_amount(
        subtotal_amount=subtotal_amount,
        discount_amount=discount_amount,
        payload=payload,
    )

    total_amount = money(subtotal_amount - discount_amount + tax_amount)
    amount_paid = money(payload.get("amount_paid"), Decimal("0.00"))

    if amount_paid < Decimal("0.00"):
        raise ValidationError("Amount paid cannot be negative.")

    if amount_paid > total_amount:
        raise ValidationError("Amount paid cannot be greater than order total.")

    return {
        "unit_price": unit_price,
        "subtotal_amount": subtotal_amount,
        "discount_amount": discount_amount,
        "tax_amount": tax_amount,
        "total_amount": total_amount,
        "amount_paid": amount_paid,
        "remaining_amount": money(total_amount - amount_paid),
    }


def _sync_payment_status_from_amount(order: Order) -> None:
    total_amount = money(order.total_amount)
    amount_paid = money(order.amount_paid)

    if amount_paid <= Decimal("0.00"):
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
    force_payment_status_from_amount: bool = True,
) -> None:
    unit_price = _resolve_unit_price(product, payload)
    quantity = _resolve_quantity(payload)

    amounts = _calculate_order_amounts(
        unit_price=unit_price,
        quantity=quantity,
        payload=payload,
    )

    order.product_name = _resolve_product_name(product, payload)
    order.product_type = _resolve_product_type(product, payload)
    order.currency_code = _resolve_currency(product, payload)

    order.unit_price = amounts["unit_price"]
    order.quantity = quantity
    order.subtotal_amount = amounts["subtotal_amount"]
    order.discount_amount = amounts["discount_amount"]
    order.tax_amount = amounts["tax_amount"]
    order.total_amount = amounts["total_amount"]
    order.amount_paid = amounts["amount_paid"]
    order.remaining_amount = amounts["remaining_amount"]

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
            referral_code_used=payload.get("referral_code_used") or "",
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
    auto_create_invoice = parse_bool(payload.get("auto_create_invoice"), False)
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
            actor=user,
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
            "effective_price": str(_safe_attr(obj.product, "effective_price", "price", default=Decimal("0.00"))),
        } if obj.product_id else None,

        "provider_id": obj.provider_id,
        "provider": {
            "id": obj.provider.id,
            "name": _safe_attr(obj.provider, "name", "display_name", "provider_name"),
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
        "agent": {
            "id": obj.agent.id,
            "agent_code": _safe_attr(obj.agent, "agent_code", "code"),
            "name": _safe_attr(obj.agent, "display_name", "full_name", "name"),
            "phone_number": _safe_attr(obj.agent, "phone_number", "phone"),
            "status": _safe_attr(obj.agent, "status"),
        } if obj.agent_id else None,

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

        "product_name": obj.product_name,
        "product_type": obj.product_type,
        "currency_code": obj.currency_code,
        "unit_price": str(obj.unit_price),
        "quantity": obj.quantity,
        "subtotal_amount": str(obj.subtotal_amount),
        "discount_amount": str(obj.discount_amount),
        "tax_amount": str(obj.tax_amount),
        "total_amount": str(obj.total_amount),
        "amount_paid": str(obj.amount_paid),
        "remaining_amount": str(obj.remaining_amount),
        "is_paid": obj.is_paid,
        "has_invoice": bool(invoice),

        "issue_reference": obj.issue_reference,
        "issued_at": obj.issued_at.isoformat() if obj.issued_at else None,

        "customer_notes": obj.customer_notes,
        "internal_notes": obj.internal_notes,
        "cancellation_reason": obj.cancellation_reason,

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

    return data


# ============================================================
# 🔹 Status History
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
        changed_by=user if getattr(user, "is_authenticated", False) else None,
    )


# ============================================================
# 🔹 Create / Update
# ============================================================

def create_order(*, payload: dict[str, Any], user=None) -> Order:
    customer = _resolve_customer(payload.get("customer_id"))
    product = _resolve_product(payload.get("product_id"))

    provider = _resolve_provider(payload.get("provider_id"))
    contract = _resolve_contract(payload.get("contract_id"))
    agent = _resolve_agent(payload.get("agent_id"))
    invoice = _resolve_invoice(payload.get("invoice_id"))

    status = normalize_text(payload.get("status")) or Order.Status.PENDING
    payment_status = normalize_text(payload.get("payment_status")) or Order.PaymentStatus.UNPAID
    fulfillment_status = normalize_text(payload.get("fulfillment_status")) or Order.FulfillmentStatus.NOT_STARTED
    source = normalize_text(payload.get("source")) or Order.OrderSource.ADMIN

    status = _validate_status(status)
    payment_status = _validate_payment_status(payment_status)
    fulfillment_status = _validate_fulfillment_status(fulfillment_status)
    source = _validate_source(source)

    if status == Order.Status.CANCELLED and not normalize_text(payload.get("cancellation_reason")):
        raise ValidationError("Cancellation reason is required when order is cancelled.")

    order = Order(
        customer=customer,
        product=product,
        provider=provider,
        contract=contract,
        agent=agent,
        status=status,
        payment_status=payment_status,
        fulfillment_status=fulfillment_status,
        source=source,
        issue_reference=normalize_text(payload.get("issue_reference")),
        issued_at=parse_datetime_value(payload.get("issued_at")),
        customer_notes=normalize_text(payload.get("customer_notes")),
        internal_notes=normalize_text(payload.get("internal_notes")),
        cancellation_reason=normalize_text(payload.get("cancellation_reason")),
        created_by=user if getattr(user, "is_authenticated", False) else None,
        updated_by=user if getattr(user, "is_authenticated", False) else None,
    )

    _apply_order_snapshot_from_product(
        order=order,
        product=product,
        payload=payload,
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

        _maybe_create_agent_order(
            order=order,
            payload=payload,
            user=user,
        )

        _maybe_create_invoice_from_order(
            order=order,
            payload=payload,
            user=user,
        )

    order.refresh_from_db()
    return order


def update_order(*, instance: Order, payload: dict[str, Any], user=None) -> Order:
    previous_status = instance.status
    previous_agent_id = instance.agent_id
    invoice_to_attach = None
    should_attach_invoice = "invoice_id" in payload and payload.get("invoice_id") not in (None, "", 0, "0")

    if "customer_id" in payload:
        instance.customer = _resolve_customer(payload.get("customer_id"))

    if "product_id" in payload:
        instance.product = _resolve_product(payload.get("product_id"))

    if "provider_id" in payload:
        instance.provider = _resolve_provider(payload.get("provider_id"))

    if "contract_id" in payload:
        instance.contract = _resolve_contract(payload.get("contract_id"))

    if "agent_id" in payload:
        instance.agent = _resolve_agent(payload.get("agent_id"))

    if should_attach_invoice:
        invoice_to_attach = _resolve_invoice(payload.get("invoice_id"))

    if "status" in payload:
        instance.status = normalize_text(payload.get("status"))

    if "payment_status" in payload:
        instance.payment_status = normalize_text(payload.get("payment_status"))

    if "fulfillment_status" in payload:
        instance.fulfillment_status = normalize_text(payload.get("fulfillment_status"))

    if "source" in payload:
        instance.source = normalize_text(payload.get("source"))

    if "issue_reference" in payload:
        instance.issue_reference = normalize_text(payload.get("issue_reference"))

    if "issued_at" in payload:
        instance.issued_at = parse_datetime_value(payload.get("issued_at"))

    if "customer_notes" in payload:
        instance.customer_notes = normalize_text(payload.get("customer_notes"))

    if "internal_notes" in payload:
        instance.internal_notes = normalize_text(payload.get("internal_notes"))

    if "cancellation_reason" in payload:
        instance.cancellation_reason = normalize_text(payload.get("cancellation_reason"))

    instance.status = _validate_status(instance.status)
    instance.payment_status = _validate_payment_status(instance.payment_status)
    instance.fulfillment_status = _validate_fulfillment_status(instance.fulfillment_status)
    instance.source = _validate_source(instance.source)

    allow_any_status = parse_bool(payload.get("allow_any_status"), False)

    if not allow_any_status:
        _validate_status_transition(previous_status, instance.status)

    should_recalculate_amounts = any(
        key in payload
        for key in [
            "product_id",
            "product_name",
            "product_type",
            "currency_code",
            "currency",
            "unit_price",
            "quantity",
            "discount_amount",
            "tax_amount",
            "tax_rate",
            "amount_paid",
        ]
    )

    if should_recalculate_amounts:
        product = instance.product
        _apply_order_snapshot_from_product(
            order=instance,
            product=product,
            payload={
                "product_name": payload.get("product_name", instance.product_name),
                "product_type": payload.get("product_type", instance.product_type),
                "currency_code": payload.get("currency_code", instance.currency_code),
                "currency": payload.get("currency", instance.currency_code),
                "unit_price": payload.get("unit_price", instance.unit_price),
                "quantity": payload.get("quantity", instance.quantity),
                "discount_amount": payload.get("discount_amount", instance.discount_amount),
                "tax_amount": payload.get("tax_amount", instance.tax_amount),
                "tax_rate": payload.get("tax_rate", None),
                "amount_paid": payload.get("amount_paid", instance.amount_paid),
            },
            force_payment_status_from_amount=("payment_status" not in payload),
        )

    if getattr(user, "is_authenticated", False):
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

        if instance.agent_id and instance.agent_id != previous_agent_id:
            _maybe_create_agent_order(
                order=instance,
                payload=payload,
                user=user,
            )

    instance.refresh_from_db()
    return instance


# ============================================================
# 🔹 Lifecycle Actions
# ============================================================

def confirm_order(*, instance: Order, user=None, note: str = "") -> Order:
    previous_status = instance.status
    _validate_status_transition(previous_status, Order.Status.CONFIRMED)

    instance.status = Order.Status.CONFIRMED
    instance.fulfillment_status = Order.FulfillmentStatus.NOT_STARTED

    if getattr(user, "is_authenticated", False):
        instance.updated_by = user

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        create_status_history(
            order=instance,
            from_status=previous_status,
            to_status=instance.status,
            note=normalize_text(note, "Order confirmed"),
            user=user,
        )

    return instance


def start_processing_order(*, instance: Order, user=None, note: str = "") -> Order:
    previous_status = instance.status
    _validate_status_transition(previous_status, Order.Status.PROCESSING)

    instance.status = Order.Status.PROCESSING
    instance.fulfillment_status = Order.FulfillmentStatus.IN_PROGRESS

    if getattr(user, "is_authenticated", False):
        instance.updated_by = user

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        create_status_history(
            order=instance,
            from_status=previous_status,
            to_status=instance.status,
            note=normalize_text(note, "Order processing started"),
            user=user,
        )

    return instance


def complete_order(*, instance: Order, user=None, note: str = "") -> Order:
    previous_status = instance.status
    _validate_status_transition(previous_status, Order.Status.COMPLETED)

    instance.status = Order.Status.COMPLETED

    if instance.fulfillment_status in {
        Order.FulfillmentStatus.NOT_STARTED,
        Order.FulfillmentStatus.IN_PROGRESS,
    }:
        instance.fulfillment_status = Order.FulfillmentStatus.DELIVERED

    if not instance.issued_at:
        instance.issued_at = timezone.now()

    if getattr(user, "is_authenticated", False):
        instance.updated_by = user

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        create_status_history(
            order=instance,
            from_status=previous_status,
            to_status=instance.status,
            note=normalize_text(note, "Order completed"),
            user=user,
        )

    return instance


def cancel_order(*, instance: Order, reason: str, user=None, note: str = "") -> Order:
    reason = normalize_text(reason)

    if not reason:
        raise ValidationError("Cancellation reason is required.")

    previous_status = instance.status
    _validate_status_transition(previous_status, Order.Status.CANCELLED)

    if instance.payment_status in {
        Order.PaymentStatus.PAID,
        Order.PaymentStatus.PARTIALLY_PAID,
    }:
        raise ValidationError("Cannot cancel a paid or partially paid order. Refund it instead.")

    instance.status = Order.Status.CANCELLED
    instance.fulfillment_status = Order.FulfillmentStatus.FAILED
    instance.cancellation_reason = reason

    if getattr(user, "is_authenticated", False):
        instance.updated_by = user

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        create_status_history(
            order=instance,
            from_status=previous_status,
            to_status=instance.status,
            note=normalize_text(note, reason),
            user=user,
        )

    return instance


def refund_order(*, instance: Order, user=None, note: str = "") -> Order:
    previous_status = instance.status
    _validate_status_transition(previous_status, Order.Status.REFUNDED)

    if instance.payment_status not in {
        Order.PaymentStatus.PAID,
        Order.PaymentStatus.PARTIALLY_PAID,
    }:
        raise ValidationError("Only paid or partially paid orders can be refunded.")

    instance.status = Order.Status.REFUNDED
    instance.payment_status = Order.PaymentStatus.REFUNDED
    instance.remaining_amount = Decimal("0.00")

    if getattr(user, "is_authenticated", False):
        instance.updated_by = user

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        create_status_history(
            order=instance,
            from_status=previous_status,
            to_status=instance.status,
            note=normalize_text(note, "Order refunded"),
            user=user,
        )

    return instance


def attach_invoice(*, instance: Order, invoice_id: Any, user=None, note: str = "") -> Order:
    invoice = _resolve_invoice(invoice_id)

    with transaction.atomic():
        _attach_invoice_to_order(order=instance, invoice=invoice)

        if getattr(user, "is_authenticated", False):
            instance.updated_by = user
            instance.save(update_fields=["updated_by", "updated_at"])

        create_status_history(
            order=instance,
            from_status=instance.status,
            to_status=instance.status,
            note=normalize_text(note, "Invoice attached to order"),
            user=user,
        )

    return instance