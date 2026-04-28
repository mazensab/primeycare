# ============================================================
# 📂 api/customers/list.py
# 🧠 Primey Care | Customers List & Create API
# ------------------------------------------------------------
# ✅ GET  /api/customers/  -> قائمة العملاء
# ✅ POST /api/customers/  -> إنشاء عميل جديد
# ✅ يدعم البحث والفلاتر والترقيم
# ✅ متوافق مع صفحات:
#    - /system/customers
#    - /system/customers/list
#    - /system/customers/create
# ------------------------------------------------------------
# تحسينات هذا الإصدار:
# - توحيد قيم الفورنت lowercase إلى قيم الموديل uppercase
# - full_clean قبل save
# - رسائل أخطاء أوضح
# - دعم فلاتر status/type/source سواء lowercase أو uppercase
# - الحفاظ على نفس شكل Response السابق بدون كسر الفرونت
# ============================================================

from __future__ import annotations

import json
import logging
from typing import Any

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.db.models import Q, QuerySet
from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_http_methods

from customers.models import Customer

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
# 🧰 Parsing Helpers
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


def _safe_int(
    value: str | None,
    default: int,
    *,
    minimum: int = 1,
    maximum: int = 200,
) -> int:
    try:
        number = int(value or default)
    except (TypeError, ValueError):
        number = default

    return max(minimum, min(number, maximum))


def _clean_string(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_choice(value: Any, allowed: set[str], default: str) -> str:
    cleaned = _clean_string(value)

    if not cleaned:
        return default

    normalized = cleaned.upper()

    return normalized if normalized in allowed else default


def _normalize_optional_choice(value: Any, allowed: set[str]) -> str:
    cleaned = _clean_string(value)

    if not cleaned:
        return ""

    normalized = cleaned.upper()

    return normalized if normalized in allowed else ""


def _validation_errors(exc: ValidationError) -> dict[str, Any]:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    return {"__all__": exc.messages}


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
# 🧾 Serialization
# ============================================================

def serialize_customer(customer: Customer) -> dict[str, Any]:
    return {
        "id": customer.pk,
        "customer_code": customer.customer_code or "",
        "customer_type": customer.customer_type,
        "status": customer.status,
        "source": customer.source,
        "first_name": customer.first_name or "",
        "last_name": customer.last_name or "",
        "company_name": customer.company_name or "",
        "display_name": customer.display_name or "",
        "full_name": customer.full_name,
        "gender": customer.gender,
        "date_of_birth": customer.date_of_birth.isoformat()
        if customer.date_of_birth
        else None,
        "national_id": customer.national_id or "",
        "passport_number": customer.passport_number or "",
        "nationality": customer.nationality or "",
        "email": customer.email or "",
        "phone_number": customer.phone_number or "",
        "whatsapp_number": customer.whatsapp_number or "",
        "alternative_phone_number": customer.alternative_phone_number or "",
        "primary_contact_number": customer.primary_contact_number,
        "country": customer.country or "",
        "city": customer.city or "",
        "district": customer.district or "",
        "street_address": customer.street_address or "",
        "postal_code": customer.postal_code or "",
        "national_address_text": customer.national_address_text or "",
        "notes": customer.notes or "",
        "tags": customer.tags or "",
        "created_by_id": customer.created_by_id,
        "updated_by_id": customer.updated_by_id,
        "created_at": customer.created_at.isoformat()
        if customer.created_at
        else None,
        "updated_at": customer.updated_at.isoformat()
        if customer.updated_at
        else None,
    }


# ============================================================
# 🔍 Query Builder
# ============================================================

def _build_customers_queryset(request: HttpRequest) -> QuerySet[Customer]:
    queryset = Customer.objects.select_related("created_by", "updated_by").all()

    query = _clean_string(request.GET.get("q") or request.GET.get("search"))
    status = _normalize_optional_choice(request.GET.get("status"), STATUS_VALUES)
    customer_type = _normalize_optional_choice(
        request.GET.get("customer_type") or request.GET.get("type"),
        CUSTOMER_TYPE_VALUES,
    )
    source = _normalize_optional_choice(request.GET.get("source"), SOURCE_VALUES)
    city = _clean_string(request.GET.get("city"))

    if query:
        queryset = queryset.filter(
            Q(customer_code__icontains=query)
            | Q(display_name__icontains=query)
            | Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
            | Q(company_name__icontains=query)
            | Q(email__icontains=query)
            | Q(phone_number__icontains=query)
            | Q(whatsapp_number__icontains=query)
            | Q(national_id__icontains=query)
            | Q(city__icontains=query)
            | Q(tags__icontains=query)
        )

    if status:
        queryset = queryset.filter(status=status)

    if customer_type:
        queryset = queryset.filter(customer_type=customer_type)

    if source:
        queryset = queryset.filter(source=source)

    if city:
        queryset = queryset.filter(city__icontains=city)

    ordering = _clean_string(request.GET.get("ordering")) or "-created_at"
    allowed_ordering = {
        "created_at",
        "-created_at",
        "updated_at",
        "-updated_at",
        "display_name",
        "-display_name",
        "customer_code",
        "-customer_code",
        "status",
        "-status",
        "customer_type",
        "-customer_type",
        "city",
        "-city",
    }

    if ordering not in allowed_ordering:
        ordering = "-created_at"

    return queryset.order_by(ordering)


# ============================================================
# 📥 Create Customer
# ============================================================

def _create_customer(request: HttpRequest) -> JsonResponse:
    try:
        payload = _parse_json_body(request)

        customer_type = _normalize_choice(
            payload.get("customer_type"),
            CUSTOMER_TYPE_VALUES,
            Customer.CustomerType.INDIVIDUAL,
        )
        status = _normalize_choice(
            payload.get("status"),
            STATUS_VALUES,
            Customer.Status.ACTIVE,
        )
        source = _normalize_choice(
            payload.get("source"),
            SOURCE_VALUES,
            Customer.Source.ADMIN,
        )
        gender = _normalize_choice(
            payload.get("gender"),
            GENDER_VALUES,
            Customer.Gender.NOT_SPECIFIED,
        )

        customer = Customer(
            customer_type=customer_type,
            status=status,
            source=source,
            first_name=_clean_string(payload.get("first_name")),
            last_name=_clean_string(payload.get("last_name")),
            company_name=_clean_string(payload.get("company_name")),
            gender=gender,
            date_of_birth=payload.get("date_of_birth") or None,
            national_id=_clean_string(payload.get("national_id")),
            passport_number=_clean_string(payload.get("passport_number")),
            nationality=_clean_string(payload.get("nationality")),
            email=_clean_string(payload.get("email")),
            phone_number=_clean_string(payload.get("phone_number")),
            whatsapp_number=_clean_string(payload.get("whatsapp_number")),
            alternative_phone_number=_clean_string(
                payload.get("alternative_phone_number")
            ),
            country=_clean_string(payload.get("country")),
            city=_clean_string(payload.get("city")),
            district=_clean_string(payload.get("district")),
            street_address=_clean_string(payload.get("street_address")),
            postal_code=_clean_string(payload.get("postal_code")),
            national_address_text=_clean_string(
                payload.get("national_address_text")
            ),
            notes=_clean_string(payload.get("notes")),
            tags=_clean_string(payload.get("tags")),
            created_by=request.user if request.user.is_authenticated else None,
            updated_by=request.user if request.user.is_authenticated else None,
        )

        customer.full_clean()
        customer.save()

        return _json_success(
            {
                "message": "تم إنشاء العميل بنجاح.",
                "customer": serialize_customer(customer),
            },
            status=201,
        )

    except ValueError as exc:
        return _json_error(str(exc), status=400)

    except ValidationError as exc:
        return _json_error(
            "بيانات العميل غير صحيحة.",
            status=400,
            errors=_validation_errors(exc),
        )

    except Exception as exc:
        logger.exception("Failed to create customer | error=%s", exc)
        return _json_error("تعذر إنشاء العميل.", status=500)


# ============================================================
# 📤 List Customers
# ============================================================

def _list_customers(request: HttpRequest) -> JsonResponse:
    try:
        queryset = _build_customers_queryset(request)

        page_number = _safe_int(
            request.GET.get("page"),
            default=1,
            minimum=1,
            maximum=100000,
        )
        page_size = _safe_int(
            request.GET.get("page_size"),
            default=50,
            minimum=1,
            maximum=200,
        )

        paginator = Paginator(queryset, page_size)

        try:
            page_obj = paginator.page(page_number)
        except (PageNotAnInteger, EmptyPage):
            page_obj = paginator.page(1)

        results = [
            serialize_customer(customer)
            for customer in page_obj.object_list
        ]

        summary = {
            "total": queryset.count(),
            "active": queryset.filter(status=Customer.Status.ACTIVE).count(),
            "inactive": queryset.filter(status=Customer.Status.INACTIVE).count(),
            "blocked": queryset.filter(status=Customer.Status.BLOCKED).count(),
            "lead": queryset.filter(status=Customer.Status.LEAD).count(),
            "individual": queryset.filter(
                customer_type=Customer.CustomerType.INDIVIDUAL
            ).count(),
            "corporate": queryset.filter(
                customer_type=Customer.CustomerType.CORPORATE
            ).count(),
        }

        return _json_success(
            {
                "count": paginator.count,
                "page": page_obj.number,
                "page_size": page_size,
                "total_pages": paginator.num_pages,
                "has_next": page_obj.has_next(),
                "has_previous": page_obj.has_previous(),
                "summary": summary,
                "results": results,
                "customers": results,
            }
        )

    except Exception as exc:
        logger.exception("Failed to list customers | error=%s", exc)
        return _json_error("تعذر تحميل قائمة العملاء.", status=500)


# ============================================================
# 🌐 API Entry
# ============================================================

@login_required
@require_http_methods(["GET", "POST"])
def customers_list_create_api(request: HttpRequest) -> JsonResponse:
    if request.method == "POST":
        return _create_customer(request)

    return _list_customers(request)