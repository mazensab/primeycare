# ============================================================
# 📂 whatsapp_center/event_router.py
# 🧠 Primey Care - WhatsApp Event Router V1 Core
# ------------------------------------------------------------
# ✅ Router رسمي لأحداث Primey Care عبر WhatsApp Center
# ✅ متوافق مع whatsapp_center.services.send_event_whatsapp_message
# ✅ لا يعتمد على Company FK مباشر
# ✅ يعتمد على:
#    - scope_type
#    - company_reference
#    - company_name
# ✅ يدعم أحداث المرحلة 15:
#    - إنشاء طلب
#    - إصدار فاتورة
#    - دفع فاتورة / تأكيد دفعة
#    - تسجيل عمولة مندوب
#    - اعتماد عمولة مندوب
# ✅ يبقي دوال Legacy آمنة للتوافق المؤقت
# ============================================================

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.utils import timezone

from .models import ScopeType, TriggerSource
from .services import send_event_whatsapp_message


# ============================================================
# 🔧 Helpers
# ============================================================

def _clean_text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _safe_getattr(obj: Any, attr_name: str, default: Any = "") -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _safe_id(obj: Any) -> str:
    value = _safe_getattr(obj, "pk", None)
    if value is None:
        value = _safe_getattr(obj, "id", "")
    return _clean_text(value)


def _safe_model_label(obj: Any, fallback: str = "") -> str:
    if obj is None:
        return fallback

    meta = _safe_getattr(obj, "_meta", None)
    if meta:
        app_label = _clean_text(_safe_getattr(meta, "app_label", ""))
        object_name = _clean_text(_safe_getattr(meta, "object_name", ""))
        if app_label and object_name:
            return f"{app_label}.{object_name}"

    return fallback or obj.__class__.__name__


def _money(value: Any) -> str:
    if value is None or value == "":
        return "0"

    try:
        number = Decimal(str(value))
        return f"{number:,.2f}"
    except Exception:
        return _clean_text(value)


def _first_value(*values: Any) -> str:
    for value in values:
        clean = _clean_text(value)
        if clean:
            return clean
    return ""


def _resolve_company_reference(
    *,
    company=None,
    company_reference: str | None = None,
    context: dict | None = None,
) -> str:
    if company_reference:
        return _clean_text(company_reference)

    context = context if isinstance(context, dict) else {}

    for key in ["company_reference", "company_id", "company_code", "provider_id", "center_id"]:
        value = _clean_text(context.get(key))
        if value:
            return value

    if company is not None:
        for attr_name in ["company_reference", "reference", "code", "pk", "id"]:
            value = _safe_getattr(company, attr_name, "")
            if value not in [None, ""]:
                return _clean_text(value)

    return ""


def _resolve_company_name(
    *,
    company=None,
    company_name: str | None = None,
    context: dict | None = None,
) -> str:
    if company_name:
        return _clean_text(company_name)

    context = context if isinstance(context, dict) else {}

    for key in ["company_name", "provider_name", "center_name", "tenant_name"]:
        value = _clean_text(context.get(key))
        if value:
            return value

    if company is not None:
        for attr_name in ["company_name", "name", "title"]:
            value = _clean_text(_safe_getattr(company, attr_name, ""))
            if value:
                return value

    return ""


def _resolve_user_display_name(user: Any | None) -> str:
    if not user:
        return ""

    get_full_name = _safe_getattr(user, "get_full_name", None)
    if callable(get_full_name):
        full_name = _clean_text(get_full_name())
        if full_name:
            return full_name

    return _first_value(
        _safe_getattr(user, "full_name", ""),
        _safe_getattr(user, "name", ""),
        _safe_getattr(user, "username", ""),
        _safe_getattr(user, "email", ""),
    )


def _resolve_customer_name(customer: Any | None, fallback: str = "") -> str:
    if not customer:
        return fallback

    return _first_value(
        _safe_getattr(customer, "full_name", ""),
        _safe_getattr(customer, "name", ""),
        _safe_getattr(customer, "customer_name", ""),
        _safe_getattr(customer, "display_name", ""),
        _safe_getattr(customer, "phone", ""),
        fallback,
    )


def _resolve_agent_name(agent: Any | None, fallback: str = "") -> str:
    if not agent:
        return fallback

    related_user = _safe_getattr(agent, "user", None)

    return _first_value(
        _safe_getattr(agent, "full_name", ""),
        _safe_getattr(agent, "name", ""),
        _safe_getattr(agent, "agent_name", ""),
        _resolve_user_display_name(related_user),
        fallback,
    )


def _resolve_invoice_number(invoice: Any | None, fallback: str = "") -> str:
    if not invoice:
        return fallback

    return _first_value(
        _safe_getattr(invoice, "invoice_number", ""),
        _safe_getattr(invoice, "number", ""),
        _safe_getattr(invoice, "code", ""),
        _safe_id(invoice),
        fallback,
    )


def _resolve_order_number(order: Any | None, fallback: str = "") -> str:
    if not order:
        return fallback

    return _first_value(
        _safe_getattr(order, "order_number", ""),
        _safe_getattr(order, "number", ""),
        _safe_getattr(order, "code", ""),
        _safe_id(order),
        fallback,
    )


def _trigger_source(name: str, fallback: str = "system") -> str:
    """
    TriggerSource قد لا يحتوي كل القيم الجديدة في كل مرحلة.
    لذلك نقرأها بأمان ونرجع string fallback عند عدم وجودها.
    """
    value = _safe_getattr(TriggerSource, name, "")
    return _clean_text(value) or fallback


def _send_primey_event(
    *,
    event_code: str,
    recipient_phone: str,
    recipient_name: str = "",
    recipient_role: str = "user",
    trigger_source: str = "",
    scope_type: str = ScopeType.SYSTEM,
    company=None,
    company_reference: str | None = None,
    company_name: str | None = None,
    language_code: str = "ar",
    context: dict | None = None,
    related_model: str = "",
    related_object_id: str = "",
    attachment_url: str = "",
    attachment_name: str = "",
    mime_type: str = "",
):
    """
    الممر الداخلي الموحد لإرسال WhatsApp Events.
    """
    context = context if isinstance(context, dict) else {}

    resolved_company_reference = _resolve_company_reference(
        company=company,
        company_reference=company_reference,
        context=context,
    )
    resolved_company_name = _resolve_company_name(
        company=company,
        company_name=company_name,
        context=context,
    )

    return send_event_whatsapp_message(
        scope_type=scope_type,
        trigger_source=trigger_source or _trigger_source("SYSTEM", "system"),
        event_code=event_code,
        recipient_phone=recipient_phone,
        recipient_name=recipient_name,
        recipient_role=recipient_role,
        company=company,
        company_reference=resolved_company_reference,
        company_name=resolved_company_name,
        language_code=language_code,
        context=context,
        related_model=related_model,
        related_object_id=related_object_id,
        attachment_url=attachment_url,
        attachment_name=attachment_name,
        mime_type=mime_type,
    )


# ============================================================
# 🛒 Orders
# ============================================================

def notify_order_created(
    *,
    order,
    recipient_phone: str,
    recipient_name: str = "",
    customer=None,
    company=None,
    company_reference: str | None = None,
    company_name: str | None = None,
    language_code: str = "ar",
):
    """
    إشعار WhatsApp عند إنشاء طلب جديد.
    """
    customer_obj = customer or _safe_getattr(order, "customer", None)
    order_number = _resolve_order_number(order)
    customer_name = _resolve_customer_name(customer_obj, fallback=recipient_name)

    context = {
        "message": (
            f"تم إنشاء طلب جديد في Primey Care.\n"
            f"رقم الطلب: {order_number}\n"
            f"العميل: {customer_name}\n"
            f"الحالة: {_clean_text(_safe_getattr(order, 'status', 'pending'))}"
        ),
        "order_id": _safe_id(order),
        "order_number": order_number,
        "customer_name": customer_name,
        "customer_id": _safe_id(customer_obj),
        "status": _clean_text(_safe_getattr(order, "status", "")),
        "total_amount": _money(
            _first_value(
                _safe_getattr(order, "total_amount", ""),
                _safe_getattr(order, "grand_total", ""),
                _safe_getattr(order, "amount", ""),
            )
        ),
        "created_at": timezone.now().strftime("%Y-%m-%d %H:%M"),
    }

    return _send_primey_event(
        event_code="order_created",
        trigger_source=_trigger_source("ORDER", "order"),
        recipient_phone=recipient_phone,
        recipient_name=recipient_name or customer_name,
        recipient_role="customer",
        scope_type=ScopeType.SYSTEM,
        company=company,
        company_reference=company_reference,
        company_name=company_name,
        language_code=language_code,
        context=context,
        related_model=_safe_model_label(order, "Order"),
        related_object_id=_safe_id(order),
    )


def notify_order_status_changed(
    *,
    order,
    recipient_phone: str,
    recipient_name: str = "",
    customer=None,
    old_status: str = "",
    new_status: str = "",
    company=None,
    company_reference: str | None = None,
    company_name: str | None = None,
    language_code: str = "ar",
):
    """
    إشعار WhatsApp عند تغيير حالة الطلب.
    """
    customer_obj = customer or _safe_getattr(order, "customer", None)
    order_number = _resolve_order_number(order)
    resolved_new_status = _clean_text(new_status) or _clean_text(_safe_getattr(order, "status", ""))
    customer_name = _resolve_customer_name(customer_obj, fallback=recipient_name)

    context = {
        "message": (
            f"تم تحديث حالة الطلب.\n"
            f"رقم الطلب: {order_number}\n"
            f"الحالة الجديدة: {resolved_new_status}"
        ),
        "order_id": _safe_id(order),
        "order_number": order_number,
        "customer_name": customer_name,
        "customer_id": _safe_id(customer_obj),
        "old_status": _clean_text(old_status),
        "new_status": resolved_new_status,
        "status": resolved_new_status,
        "updated_at": timezone.now().strftime("%Y-%m-%d %H:%M"),
    }

    return _send_primey_event(
        event_code="order_status_changed",
        trigger_source=_trigger_source("ORDER", "order"),
        recipient_phone=recipient_phone,
        recipient_name=recipient_name or customer_name,
        recipient_role="customer",
        scope_type=ScopeType.SYSTEM,
        company=company,
        company_reference=company_reference,
        company_name=company_name,
        language_code=language_code,
        context=context,
        related_model=_safe_model_label(order, "Order"),
        related_object_id=_safe_id(order),
    )


# ============================================================
# 🧾 Invoices
# ============================================================

def notify_invoice_issued(
    *,
    invoice,
    recipient_phone: str,
    recipient_name: str = "",
    customer=None,
    company=None,
    company_reference: str | None = None,
    company_name: str | None = None,
    language_code: str = "ar",
    attachment_url: str = "",
    attachment_name: str = "",
    mime_type: str = "application/pdf",
):
    """
    إشعار WhatsApp عند إصدار فاتورة.
    """
    customer_obj = customer or _safe_getattr(invoice, "customer", None)
    invoice_number = _resolve_invoice_number(invoice)
    customer_name = _resolve_customer_name(customer_obj, fallback=recipient_name)

    total_amount = _money(
        _first_value(
            _safe_getattr(invoice, "total_amount", ""),
            _safe_getattr(invoice, "grand_total", ""),
            _safe_getattr(invoice, "amount", ""),
        )
    )

    context = {
        "message": (
            f"تم إصدار فاتورة جديدة.\n"
            f"رقم الفاتورة: {invoice_number}\n"
            f"المبلغ: {total_amount}"
        ),
        "invoice_id": _safe_id(invoice),
        "invoice_number": invoice_number,
        "customer_name": customer_name,
        "customer_id": _safe_id(customer_obj),
        "amount": total_amount,
        "total_amount": total_amount,
        "status": _clean_text(_safe_getattr(invoice, "status", "")),
        "issued_at": timezone.now().strftime("%Y-%m-%d %H:%M"),
    }

    return _send_primey_event(
        event_code="invoice_issued",
        trigger_source=_trigger_source("INVOICE", "invoice"),
        recipient_phone=recipient_phone,
        recipient_name=recipient_name or customer_name,
        recipient_role="customer",
        scope_type=ScopeType.SYSTEM,
        company=company,
        company_reference=company_reference,
        company_name=company_name,
        language_code=language_code,
        context=context,
        related_model=_safe_model_label(invoice, "Invoice"),
        related_object_id=_safe_id(invoice),
        attachment_url=attachment_url,
        attachment_name=attachment_name or f"invoice-{invoice_number}.pdf",
        mime_type=mime_type,
    )


def notify_invoice_paid(
    *,
    invoice,
    recipient_phone: str,
    recipient_name: str = "",
    customer=None,
    payment=None,
    company=None,
    company_reference: str | None = None,
    company_name: str | None = None,
    language_code: str = "ar",
):
    """
    إشعار WhatsApp عند دفع الفاتورة.
    """
    customer_obj = customer or _safe_getattr(invoice, "customer", None)
    invoice_number = _resolve_invoice_number(invoice)
    customer_name = _resolve_customer_name(customer_obj, fallback=recipient_name)

    paid_amount = _money(
        _first_value(
            _safe_getattr(payment, "amount", ""),
            _safe_getattr(payment, "paid_amount", ""),
            _safe_getattr(invoice, "paid_amount", ""),
            _safe_getattr(invoice, "total_amount", ""),
        )
    )

    context = {
        "message": (
            f"تم تسجيل دفع الفاتورة بنجاح.\n"
            f"رقم الفاتورة: {invoice_number}\n"
            f"المبلغ المدفوع: {paid_amount}"
        ),
        "invoice_id": _safe_id(invoice),
        "invoice_number": invoice_number,
        "payment_id": _safe_id(payment),
        "customer_name": customer_name,
        "customer_id": _safe_id(customer_obj),
        "amount": paid_amount,
        "paid_amount": paid_amount,
        "status": _clean_text(_safe_getattr(invoice, "status", "paid")),
        "paid_at": timezone.now().strftime("%Y-%m-%d %H:%M"),
    }

    return _send_primey_event(
        event_code="invoice_paid",
        trigger_source=_trigger_source("PAYMENT", "payment"),
        recipient_phone=recipient_phone,
        recipient_name=recipient_name or customer_name,
        recipient_role="customer",
        scope_type=ScopeType.SYSTEM,
        company=company,
        company_reference=company_reference,
        company_name=company_name,
        language_code=language_code,
        context=context,
        related_model=_safe_model_label(invoice, "Invoice"),
        related_object_id=_safe_id(invoice),
    )


# ============================================================
# 💳 Payments
# ============================================================

def notify_payment_confirmed(
    *,
    payment,
    recipient_phone: str,
    recipient_name: str = "",
    customer=None,
    invoice=None,
    company=None,
    company_reference: str | None = None,
    company_name: str | None = None,
    language_code: str = "ar",
):
    """
    إشعار WhatsApp عند تأكيد دفعة.
    """
    invoice_obj = invoice or _safe_getattr(payment, "invoice", None)
    customer_obj = customer or _safe_getattr(payment, "customer", None) or _safe_getattr(invoice_obj, "customer", None)

    customer_name = _resolve_customer_name(customer_obj, fallback=recipient_name)
    invoice_number = _resolve_invoice_number(invoice_obj)
    amount = _money(_safe_getattr(payment, "amount", ""))

    context = {
        "message": (
            f"تم تأكيد الدفعة بنجاح.\n"
            f"المبلغ: {amount}\n"
            f"رقم الفاتورة: {invoice_number or '-'}"
        ),
        "payment_id": _safe_id(payment),
        "invoice_id": _safe_id(invoice_obj),
        "invoice_number": invoice_number,
        "customer_name": customer_name,
        "customer_id": _safe_id(customer_obj),
        "amount": amount,
        "payment_method": _clean_text(_safe_getattr(payment, "payment_method", "")),
        "reference_number": _clean_text(
            _first_value(
                _safe_getattr(payment, "reference_number", ""),
                _safe_getattr(payment, "gateway_reference", ""),
                _safe_getattr(payment, "bank_reference", ""),
            )
        ),
        "confirmed_at": timezone.now().strftime("%Y-%m-%d %H:%M"),
    }

    return _send_primey_event(
        event_code="payment_confirmed",
        trigger_source=_trigger_source("PAYMENT", "payment"),
        recipient_phone=recipient_phone,
        recipient_name=recipient_name or customer_name,
        recipient_role="customer",
        scope_type=ScopeType.SYSTEM,
        company=company,
        company_reference=company_reference,
        company_name=company_name,
        language_code=language_code,
        context=context,
        related_model=_safe_model_label(payment, "Payment"),
        related_object_id=_safe_id(payment),
    )


# ============================================================
# 👤 Agents / Commissions
# ============================================================

def notify_agent_commission_registered(
    *,
    commission,
    recipient_phone: str,
    recipient_name: str = "",
    agent=None,
    company=None,
    company_reference: str | None = None,
    company_name: str | None = None,
    language_code: str = "ar",
):
    """
    إشعار WhatsApp عند تسجيل عمولة مندوب.
    """
    agent_obj = agent or _safe_getattr(commission, "agent", None)
    agent_name = _resolve_agent_name(agent_obj, fallback=recipient_name)

    amount = _money(
        _first_value(
            _safe_getattr(commission, "commission_amount", ""),
            _safe_getattr(commission, "amount", ""),
        )
    )

    context = {
        "message": (
            f"تم تسجيل عمولة مندوب جديدة.\n"
            f"المندوب: {agent_name}\n"
            f"قيمة العمولة: {amount}"
        ),
        "commission_id": _safe_id(commission),
        "agent_id": _safe_id(agent_obj),
        "agent_name": agent_name,
        "amount": amount,
        "commission_amount": amount,
        "status": _clean_text(_safe_getattr(commission, "status", "registered")),
        "registered_at": timezone.now().strftime("%Y-%m-%d %H:%M"),
    }

    return _send_primey_event(
        event_code="agent_commission_registered",
        trigger_source=_trigger_source("AGENT", "agent"),
        recipient_phone=recipient_phone,
        recipient_name=recipient_name or agent_name,
        recipient_role="agent",
        scope_type=ScopeType.SYSTEM,
        company=company,
        company_reference=company_reference,
        company_name=company_name,
        language_code=language_code,
        context=context,
        related_model=_safe_model_label(commission, "AgentCommission"),
        related_object_id=_safe_id(commission),
    )


def notify_agent_commission_approved(
    *,
    commission,
    recipient_phone: str,
    recipient_name: str = "",
    agent=None,
    company=None,
    company_reference: str | None = None,
    company_name: str | None = None,
    language_code: str = "ar",
):
    """
    إشعار WhatsApp عند اعتماد عمولة مندوب.
    """
    agent_obj = agent or _safe_getattr(commission, "agent", None)
    agent_name = _resolve_agent_name(agent_obj, fallback=recipient_name)

    amount = _money(
        _first_value(
            _safe_getattr(commission, "commission_amount", ""),
            _safe_getattr(commission, "amount", ""),
        )
    )

    context = {
        "message": (
            f"تم اعتماد عمولتك بنجاح.\n"
            f"المندوب: {agent_name}\n"
            f"قيمة العمولة: {amount}"
        ),
        "commission_id": _safe_id(commission),
        "agent_id": _safe_id(agent_obj),
        "agent_name": agent_name,
        "amount": amount,
        "commission_amount": amount,
        "status": _clean_text(_safe_getattr(commission, "status", "approved")),
        "approved_at": timezone.now().strftime("%Y-%m-%d %H:%M"),
    }

    return _send_primey_event(
        event_code="agent_commission_approved",
        trigger_source=_trigger_source("AGENT", "agent"),
        recipient_phone=recipient_phone,
        recipient_name=recipient_name or agent_name,
        recipient_role="agent",
        scope_type=ScopeType.SYSTEM,
        company=company,
        company_reference=company_reference,
        company_name=company_name,
        language_code=language_code,
        context=context,
        related_model=_safe_model_label(commission, "AgentCommission"),
        related_object_id=_safe_id(commission),
    )


# ============================================================
# 🔔 Notification Center Bridge Convenience
# ============================================================

def notify_from_notification_event(
    *,
    event_code: str,
    recipient_phone: str,
    recipient_name: str = "",
    recipient_role: str = "user",
    title: str = "",
    message: str = "",
    severity: str = "info",
    link: str = "",
    language_code: str = "ar",
    company=None,
    company_reference: str | None = None,
    company_name: str | None = None,
    context: dict | None = None,
    related_model: str = "",
    related_object_id: str = "",
):
    """
    دالة مساعدة عامة لو احتجنا إرسال WhatsApp من حدث Notification Center يدويًا.
    """
    context = context if isinstance(context, dict) else {}
    merged_context = {
        **context,
        "title": title,
        "message": message or title,
        "severity": severity,
        "link": link,
    }

    return _send_primey_event(
        event_code=event_code,
        trigger_source=_trigger_source("NOTIFICATION", "notification"),
        recipient_phone=recipient_phone,
        recipient_name=recipient_name,
        recipient_role=recipient_role,
        scope_type=ScopeType.SYSTEM,
        company=company,
        company_reference=company_reference,
        company_name=company_name,
        language_code=language_code,
        context=merged_context,
        related_model=related_model,
        related_object_id=related_object_id,
    )


# ============================================================
# 🧩 Legacy Compatibility Wrappers
# ------------------------------------------------------------
# تبقى مؤقتًا حتى لا ينكسر أي استدعاء قديم.
# لا نستخدمها في Primey Care الجديد إلا عند الحاجة.
# ============================================================

def notify_company_created(*, company, company_phone: str, company_name: str):
    """
    Legacy wrapper.
    """
    context = {
        "message": f"تم إنشاء الجهة {company_name} بنجاح في Primey Care.",
        "company_name": company_name,
        "company_reference": _resolve_company_reference(company=company),
    }

    return _send_primey_event(
        event_code="company_created",
        trigger_source=_trigger_source("SYSTEM", "system"),
        recipient_phone=company_phone,
        recipient_name=company_name,
        recipient_role="provider",
        scope_type=ScopeType.SYSTEM,
        company=None,
        company_reference="",
        company_name="",
        language_code="ar",
        context=context,
        related_model=_safe_model_label(company, "Company"),
        related_object_id=_safe_id(company),
    )


def notify_subscription_expiring_7_days(
    *,
    company,
    recipient_phone: str,
    recipient_name: str = "",
):
    """
    Legacy wrapper للتوافق مع tasks.py القديمة.
    """
    company_name = _resolve_company_name(company=company)
    context = {
        "message": f"تنبيه: الاشتراك الخاص بـ {company_name or 'حسابكم'} سينتهي خلال 7 أيام.",
        "company_name": company_name,
        "company_reference": _resolve_company_reference(company=company),
        "days_left": 7,
    }

    return _send_primey_event(
        event_code="subscription_expiring_7_days",
        trigger_source=_trigger_source("SYSTEM", "system"),
        recipient_phone=recipient_phone,
        recipient_name=recipient_name or company_name,
        recipient_role="provider",
        scope_type=ScopeType.SYSTEM,
        company=None,
        company_reference="",
        company_name="",
        language_code="ar",
        context=context,
        related_model=_safe_model_label(company, "Company"),
        related_object_id=_safe_id(company),
    )


def notify_employee_absent(
    *,
    company,
    employee,
    recipient_phone: str,
    recipient_name: str = "",
):
    """
    Legacy wrapper قديم من HR.
    يبقى آمنًا لكنه غير مستخدم في Primey Care الجديد.
    """
    company_reference = _resolve_company_reference(company=company)
    company_name = _resolve_company_name(company=company)
    employee_name = _first_value(
        _safe_getattr(employee, "full_name", ""),
        _safe_getattr(employee, "employee_code", ""),
        _safe_getattr(employee, "name", ""),
    )

    context = {
        "message": (
            f"تنبيه حضور: الموظف {employee_name or '-'} مسجل كغائب."
        ),
        "employee_name": employee_name,
        "company_name": company_name,
        "company_reference": company_reference,
    }

    return _send_primey_event(
        event_code="employee_absent",
        trigger_source=_trigger_source("SYSTEM", "system"),
        recipient_phone=recipient_phone,
        recipient_name=recipient_name,
        recipient_role="provider_admin",
        scope_type=ScopeType.COMPANY if company_reference else ScopeType.SYSTEM,
        company=company,
        company_reference=company_reference,
        company_name=company_name,
        language_code="ar",
        context=context,
        related_model=_safe_model_label(employee, "Employee"),
        related_object_id=_safe_id(employee),
    )