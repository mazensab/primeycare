# ============================================================
# 📂 api/customers/detail.py
# 🧠 Primey Care | Customer Detail API
# ------------------------------------------------------------
# ✅ GET    /api/customers/<id>/  -> تفاصيل العميل
# ✅ PATCH  /api/customers/<id>/  -> تعديل جزئي
# ✅ POST   /api/customers/<id>/  -> تعديل جزئي للتوافق
# ✅ DELETE /api/customers/<id>/  -> حذف العميل
# ------------------------------------------------------------
# تحسينات هذا الإصدار:
# - توحيد قيم الفورنت lowercase إلى قيم الموديل uppercase
# - full_clean قبل save
# - رسائل أخطاء أوضح
# - منع تحديث الحقول غير المسموحة
# - الحفاظ على نفس شكل Response السابق بدون كسر الفرونت
# ============================================================

from __future__ import annotations

import json
import logging
from typing import Any

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.db.models.deletion import ProtectedError
from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_http_methods

from customers.models import Customer
from .list import serialize_customer

logger = logging.getLogger(__name__)


# ============================================================
# 🔧 Response Helpers
# ============================================================

def _json_error(
    message: str,
    status: int = 400,
    *,
    errors: dict[str, Any] | None = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": False,
        "message": message,
    }

    if errors:
        payload["errors"] = errors

    return JsonResponse(payload, status=status)


def _json_success(data: dict[str, Any], status: int = 200) -> JsonResponse:
    payload = {"ok": True}
    payload.update(data)
    return JsonResponse(payload, status=status)


# ============================================================
# 🧰 Helpers
# ============================================================

def _parse_json_body(request: HttpRequest) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        raise ValueError("صيغة JSON غير صحيحة.")

    if not isinstance(payload, dict):
        raise ValueError("صيغة البيانات غير صحيحة.")

    return payload


def _clean_string(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_choice(value: Any, allowed: set[str], current: str) -> str:
    cleaned = _clean_string(value)

    if not cleaned:
        return current

    normalized = cleaned.upper()

    return normalized if normalized in allowed else current


def _validation_errors(exc: ValidationError) -> dict[str, Any]:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    return {"__all__": exc.messages}


def _get_customer(customer_id: int) -> Customer | None:
    return (
        Customer.objects
        .select_related("created_by", "updated_by")
        .filter(pk=customer_id)
        .first()
    )


# ============================================================
# ✅ Choice Sets
# ============================================================

CUSTOMER_TYPE_VALUES = {
    Customer.CustomerType.INDIVIDUAL,
    Customer.CustomerType.CORPORATE,
}

STATUS_VALUES = {
    Customer.Status.ACTIVE,
    Customer.Status.INACTIVE,
    Customer.Status.BLOCKED,
    Customer.Status.LEAD,
}

SOURCE_VALUES = {
    Customer.Source.WEBSITE,
    Customer.Source.WHATSAPP,
    Customer.Source.AGENT,
    Customer.Source.ADMIN,
    Customer.Source.IMPORT,
    Customer.Source.OTHER,
}

GENDER_VALUES = {
    Customer.Gender.MALE,
    Customer.Gender.FEMALE,
    Customer.Gender.NOT_SPECIFIED,
}


# ============================================================
# ✏️ Update
# ============================================================

UPDATABLE_FIELDS = {
    "customer_type",
    "status",
    "source",
    "first_name",
    "last_name",
    "company_name",
    "gender",
    "date_of_birth",
    "national_id",
    "passport_number",
    "nationality",
    "email",
    "phone_number",
    "whatsapp_number",
    "alternative_phone_number",
    "country",
    "city",
    "district",
    "street_address",
    "postal_code",
    "national_address_text",
    "notes",
    "tags",
}

CHOICE_FIELDS = {
    "customer_type": CUSTOMER_TYPE_VALUES,
    "status": STATUS_VALUES,
    "source": SOURCE_VALUES,
    "gender": GENDER_VALUES,
}


def _update_customer(request: HttpRequest, customer: Customer) -> JsonResponse:
    try:
        payload = _parse_json_body(request)

        ignored_fields = sorted(
            key for key in payload.keys() if key not in UPDATABLE_FIELDS
        )

        for field in UPDATABLE_FIELDS:
            if field not in payload:
                continue

            value = payload.get(field)

            if field == "date_of_birth":
                setattr(customer, field, value or None)
                continue

            if field in CHOICE_FIELDS:
                current_value = getattr(customer, field)
                normalized_value = _normalize_choice(
                    value,
                    CHOICE_FIELDS[field],
                    current_value,
                )
                setattr(customer, field, normalized_value)
                continue

            setattr(customer, field, _clean_string(value))

        customer.updated_by = request.user if request.user.is_authenticated else None

        customer.full_clean()
        customer.save()

        response_data: dict[str, Any] = {
            "message": "تم تحديث بيانات العميل بنجاح.",
            "customer": serialize_customer(customer),
        }

        if ignored_fields:
            response_data["ignored_fields"] = ignored_fields

        return _json_success(response_data)

    except ValueError as exc:
        return _json_error(str(exc), status=400)

    except ValidationError as exc:
        return _json_error(
            "بيانات العميل غير صحيحة.",
            status=400,
            errors=_validation_errors(exc),
        )

    except Exception as exc:
        logger.exception(
            "Failed to update customer | customer_id=%s | error=%s",
            customer.pk,
            exc,
        )
        return _json_error("تعذر تحديث بيانات العميل.", status=500)


# ============================================================
# 🗑️ Delete
# ============================================================

def _delete_customer(customer: Customer) -> JsonResponse:
    try:
        customer_id = customer.pk
        customer_name = (
            customer.display_name
            or customer.customer_code
            or f"Customer #{customer.pk}"
        )

        customer.delete()

        return _json_success(
            {
                "message": "تم حذف العميل بنجاح.",
                "deleted_customer": {
                    "id": customer_id,
                    "display_name": customer_name,
                },
            }
        )

    except ProtectedError:
        return _json_error(
            "لا يمكن حذف العميل لوجود بيانات مرتبطة به. يمكن تعطيله بدل الحذف.",
            status=409,
        )

    except Exception as exc:
        logger.exception(
            "Failed to delete customer | customer_id=%s | error=%s",
            customer.pk,
            exc,
        )
        return _json_error("تعذر حذف العميل.", status=500)


# ============================================================
# 🌐 API Entry
# ============================================================

@login_required
@require_http_methods(["GET", "POST", "PATCH", "DELETE"])
def customer_detail_api(request: HttpRequest, customer_id: int) -> JsonResponse:
    customer = _get_customer(customer_id)

    if not customer:
        return _json_error("العميل غير موجود.", status=404)

    if request.method == "GET":
        return _json_success(
            {
                "customer": serialize_customer(customer),
            }
        )

    if request.method in {"POST", "PATCH"}:
        return _update_customer(request, customer)

    if request.method == "DELETE":
        return _delete_customer(customer)

    return _json_error("طريقة الطلب غير مدعومة.", status=405)