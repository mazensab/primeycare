# ============================================================
# 📂 api/providers/list.py
# 🧠 Primey Care | Providers API List/Create V2 Login-User Ready
# ------------------------------------------------------------
# ✅ List providers
# ✅ Create provider
# ✅ Public/filtered operational list
# ✅ Summary stats for frontend dashboards/lists
# ✅ Supports imported medical network fields through services
# ✅ Supports Arabic/English provider names
# ✅ Supports CR / tax number / logo / image / Google Drive fields
# ✅ Supports Provider.user login account relation
# ✅ Supports create_login_user / create_user / create_account
# ✅ Uses auth_center.services.create_actor_user for Provider user
# ✅ Adds orders_count per provider when an Order relation exists
# ✅ Adds total_orders to summary
# ✅ Supports ordering by most orders and new provider fields
# ✅ Adds real customer medical network summary from active contracts
# ✅ Protected by permissions:
#    - providers.view
#    - providers.create
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal
from functools import lru_cache
from typing import Any

from django.core.exceptions import FieldError, ValidationError
from django.db import transaction
from django.db.models import Count, IntegerField, Max, Q, QuerySet, Sum, Value
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods

from auth_center.permissions import PermissionCodes, has_permission
from auth_center.services import create_actor_user
from providers.models import Provider, ProviderStatus, ProviderType
from providers.services import (
    apply_provider_filters,
    create_provider,
    paginate_queryset,
    parse_int,
    parse_json_body,
    serialize_provider,
)

logger = logging.getLogger(__name__)


# ============================================================
# 🔹 Helpers
# ============================================================

def _json_error(message: str, status: int = 400, *, errors=None) -> JsonResponse:
    payload = {
        "ok": False,
        "success": False,
        "message": message,
    }

    if errors is not None:
        payload["errors"] = errors

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _json_success(data: dict[str, Any], status: int = 200) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": True,
        "success": True,
    }
    payload.update(data)

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _permission_code(name: str, fallback: str) -> str:
    return str(getattr(PermissionCodes, name, fallback))


PERMISSION_PROVIDERS_VIEW = _permission_code("PROVIDERS_VIEW", "providers.view")
PERMISSION_PROVIDERS_CREATE = _permission_code("PROVIDERS_CREATE", "providers.create")


def _ensure_authenticated(request):
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return None, _json_error("Authentication required.", 401)

    return request.user, None


def _forbidden(required_permission: str) -> JsonResponse:
    return _json_error(
        "غير مصرح لك بتنفيذ هذا الإجراء.",
        403,
        errors={"required_permission": [required_permission]},
    )


def _has_required_permission(user: Any, permission_code: str) -> bool:
    try:
        if getattr(user, "is_superuser", False):
            return True

        profile = getattr(user, "profile", None)
        role = str(getattr(profile, "role", "") or "").lower()
        user_type = str(getattr(profile, "user_type", "") or "").upper()

        if role == "system_admin" or user_type in {"SUPER_ADMIN", "SYSTEM_ADMIN"}:
            return True

        return bool(has_permission(user, permission_code))
    except Exception:
        return False


def _safe_count(queryset: QuerySet[Provider], **filters) -> int:
    try:
        return queryset.filter(**filters).count()
    except Exception:
        return 0


def _safe_filter_count(queryset: QuerySet[Provider], condition: Q) -> int:
    try:
        return queryset.filter(condition).count()
    except Exception:
        return 0


def _safe_exclude_count(queryset: QuerySet[Provider], **filters) -> int:
    try:
        return queryset.exclude(**filters).count()
    except Exception:
        return 0


def _safe_decimal(value: Any) -> Decimal:
    try:
        if value in (None, ""):
            return Decimal("0.00")
        parsed = Decimal(str(value))
    except Exception:
        return Decimal("0.00")

    if parsed < Decimal("0.00"):
        return Decimal("0.00")

    return parsed


def _decimal_str(value: Any) -> str:
    return str(_safe_decimal(value).quantize(Decimal("0.01")))


def _parse_bool_param(value):
    value_str = str(value or "").strip().lower()

    if value_str in {"1", "true", "yes", "on", "نعم"}:
        return True

    if value_str in {"0", "false", "no", "off", "لا"}:
        return False

    return None


def _parse_bool_value(value: Any, default: bool = False) -> bool:
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    value_str = str(value or "").strip().lower()

    if value_str in {"1", "true", "yes", "on", "y", "نعم", "صح"}:
        return True

    if value_str in {"0", "false", "no", "off", "n", "لا", "خطأ"}:
        return False

    return default


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _clean_email(value: Any) -> str:
    return _clean_text(value).lower()


def _model_has_field(field_name: str) -> bool:
    try:
        Provider._meta.get_field(field_name)
        return True
    except Exception:
        return False


def _date_iso(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _serialize_validation_error(exc: ValidationError) -> Any:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return exc.messages

    return str(exc)


def _serialize_login_user(user: Any | None) -> dict[str, Any] | None:
    if not user:
        return None

    full_name = ""
    try:
        full_name = (user.get_full_name() or "").strip()
    except Exception:
        full_name = ""

    return {
        "id": getattr(user, "pk", None),
        "username": getattr(user, "username", "") or "",
        "email": getattr(user, "email", "") or "",
        "first_name": getattr(user, "first_name", "") or "",
        "last_name": getattr(user, "last_name", "") or "",
        "full_name": full_name,
        "is_active": bool(getattr(user, "is_active", False)),
        "is_staff": bool(getattr(user, "is_staff", False)),
        "is_superuser": bool(getattr(user, "is_superuser", False)),
        "last_login": _date_iso(getattr(user, "last_login", None)),
        "date_joined": _date_iso(getattr(user, "date_joined", None)),
    }


def _provider_display_name(provider: Provider) -> str:
    return (
        _clean_text(getattr(provider, "name", ""))
        or _clean_text(getattr(provider, "name_ar", ""))
        or _clean_text(getattr(provider, "name_en", ""))
        or str(provider)
    )


def _provider_phone(provider: Provider) -> str:
    return (
        _clean_text(getattr(provider, "mobile", ""))
        or _clean_text(getattr(provider, "phone", ""))
        or _clean_text(getattr(provider, "phone_number", ""))
    )


def _provider_email(provider: Provider) -> str:
    return _clean_email(getattr(provider, "email", ""))


def _create_login_user_for_provider(
    *,
    provider: Provider,
    payload: dict[str, Any],
    actor: Any,
) -> tuple[Any | None, bool, bool, str]:
    """
    Create/link a login account for Provider using auth_center.services.create_actor_user.

    Expected profile rule:
    - user_type = PROVIDER
    - role = provider_admin
    - workspace/entity = provider
    - Provider.user = User
    """

    if not _model_has_field("user"):
        raise ValidationError({
            "login_user": [
                "Provider.user field is not available on this model."
            ]
        })

    existing_user = getattr(provider, "user", None)
    if existing_user:
        return existing_user, False, True, "Provider already has a linked login user."

    display_name = (
        _clean_text(payload.get("login_display_name"))
        or _clean_text(payload.get("display_name"))
        or _provider_display_name(provider)
    )

    login_email = (
        _clean_email(payload.get("login_email"))
        or _clean_email(payload.get("user_email"))
        or _clean_email(payload.get("email"))
        or _provider_email(provider)
        or None
    )

    login_username = (
        _clean_text(payload.get("login_username"))
        or _clean_text(payload.get("username"))
        or None
    )

    login_phone = (
        _clean_text(payload.get("login_phone"))
        or _clean_text(payload.get("login_phone_number"))
        or _clean_text(payload.get("phone_number"))
        or _clean_text(payload.get("phone"))
        or _clean_text(payload.get("mobile"))
        or _provider_phone(provider)
        or None
    )

    login_whatsapp = (
        _clean_text(payload.get("login_whatsapp"))
        or _clean_text(payload.get("login_whatsapp_number"))
        or _clean_text(payload.get("whatsapp_number"))
        or _clean_text(payload.get("whatsapp"))
        or _clean_text(payload.get("mobile"))
        or _clean_text(payload.get("phone"))
        or _provider_phone(provider)
        or None
    )

    password = (
        _clean_text(payload.get("login_password"))
        or _clean_text(payload.get("password"))
        or None
    )

    if not login_email and not login_username and not login_phone and not login_whatsapp:
        raise ValidationError({
            "login_user": [
                "لا يمكن إنشاء حساب دخول لمقدم الخدمة بدون بريد أو اسم مستخدم أو رقم جوال."
            ]
        })

    name_parts = display_name.split()
    first_name = name_parts[0] if name_parts else ""
    last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

    result = create_actor_user(
        user_type="PROVIDER",
        role="provider_admin",
        email=login_email,
        username=login_username,
        password=password,
        first_name=first_name or None,
        last_name=last_name or None,
        display_name=display_name or None,
        phone_number=login_phone,
        whatsapp_number=login_whatsapp,
        alternate_email=None,
        preferred_language=_clean_text(payload.get("preferred_language")) or "ar",
        timezone=_clean_text(payload.get("timezone")) or "Asia/Riyadh",
        entity_type="provider",
        entity_id=provider.pk,
        provider_id=provider.pk,
        center_id=None,
        is_active=True,
        is_staff=False,
        is_superuser=False,
        extra_data={
            "source": "api_providers_create",
            "provider_id": provider.pk,
            "entity_type": "provider",
            "entity_id": provider.pk,
            "workspace": "provider",
            "created_by_user_id": getattr(actor, "pk", None),
        },
        tags=["provider"],
        create_group=True,
        update_existing=True,
    )

    user = result.user

    if getattr(provider, "user_id", None) != getattr(user, "pk", None):
        provider.user = user
        provider.save(update_fields=["user", "updated_at"])

    return user, bool(result.created), bool(getattr(result, "linked", True)), result.message


# ============================================================
# 🔹 Contracts / Medical Network Helpers
# ============================================================

def _active_contract_q(prefix: str = "contracts") -> Q:
    today = timezone.localdate()

    return (
        Q(**{f"{prefix}__status": "ACTIVE"})
        & (
            Q(**{f"{prefix}__start_date__isnull": True})
            | Q(**{f"{prefix}__start_date__lte": today})
        )
        & (
            Q(**{f"{prefix}__end_date__isnull": True})
            | Q(**{f"{prefix}__end_date__gte": today})
        )
    )


def _active_contract_product_q() -> Q:
    today = timezone.localdate()

    return (
        Q(contracts__status="ACTIVE")
        & Q(contracts__contract_products__is_active=True)
        & (
            Q(contracts__start_date__isnull=True)
            | Q(contracts__start_date__lte=today)
        )
        & (
            Q(contracts__end_date__isnull=True)
            | Q(contracts__end_date__gte=today)
        )
    )


def annotate_provider_network_fields(queryset: QuerySet[Provider]) -> QuerySet[Provider]:
    """
    Add customer medical network fields safely:
    - active_contracts_count
    - contracted_products_count
    - highest_contract_discount_percent
    - highest_product_discount_percent
    """

    try:
        return queryset.annotate(
            active_contracts_count=Count(
                "contracts",
                filter=_active_contract_q("contracts"),
                distinct=True,
            ),
            contracted_products_count=Count(
                "contracts__contract_products__product",
                filter=_active_contract_product_q(),
                distinct=True,
            ),
            highest_contract_discount_percent=Max(
                "contracts__discount_percentage",
                filter=_active_contract_q("contracts"),
            ),
            highest_product_discount_percent=Max(
                "contracts__contract_products__discount_percentage",
                filter=_active_contract_product_q(),
            ),
        )
    except FieldError as exc:
        logger.warning("Unable to annotate provider network fields: %s", exc)

        return queryset.annotate(
            active_contracts_count=Value(0, output_field=IntegerField()),
            contracted_products_count=Value(0, output_field=IntegerField()),
            highest_contract_discount_percent=Value(0, output_field=IntegerField()),
            highest_product_discount_percent=Value(0, output_field=IntegerField()),
        )


def _apply_medical_network_filter(queryset: QuerySet[Provider], params) -> QuerySet[Provider]:
    """
    Compatibility filter for frontend:
    - has_active_contract=true
    - has_active_contracts=true
    - has_contract=true
    - contracted=true
    """

    has_active_contract = _parse_bool_param(params.get("has_active_contract"))
    has_active_contracts = _parse_bool_param(params.get("has_active_contracts"))
    has_contract = _parse_bool_param(params.get("has_contract"))
    contracted = _parse_bool_param(params.get("contracted"))

    contract_filter_value = (
        has_active_contract
        if has_active_contract is not None
        else has_active_contracts
        if has_active_contracts is not None
        else has_contract
        if has_contract is not None
        else contracted
    )

    if contract_filter_value is True:
        return queryset.filter(_active_contract_product_q())

    if contract_filter_value is False:
        return queryset.exclude(_active_contract_product_q())

    return queryset


def _provider_highest_discount(provider: Provider) -> Decimal:
    contract_discount = _safe_decimal(
        getattr(provider, "highest_contract_discount_percent", Decimal("0.00"))
    )
    product_discount = _safe_decimal(
        getattr(provider, "highest_product_discount_percent", Decimal("0.00"))
    )

    return max(contract_discount, product_discount)


def _safe_medical_network_totals(queryset: QuerySet[Provider]) -> dict[str, Any]:
    """
    Build network summary from already filtered queryset.
    """

    try:
        contracted_queryset = queryset.filter(_active_contract_product_q()).distinct()
        contracted_providers = contracted_queryset.count()
    except Exception:
        contracted_queryset = queryset.none()
        contracted_providers = 0

    try:
        contracted_products_count = (
            contracted_queryset.aggregate(
                total=Count(
                    "contracts__contract_products__product",
                    filter=_active_contract_product_q(),
                    distinct=True,
                )
            ).get("total")
            or 0
        )
    except Exception:
        contracted_products_count = 0

    try:
        highest_contract_discount = (
            contracted_queryset.aggregate(
                value=Max(
                    "contracts__discount_percentage",
                    filter=_active_contract_q("contracts"),
                )
            ).get("value")
            or Decimal("0.00")
        )
    except Exception:
        highest_contract_discount = Decimal("0.00")

    try:
        highest_product_discount = (
            contracted_queryset.aggregate(
                value=Max(
                    "contracts__contract_products__discount_percentage",
                    filter=_active_contract_product_q(),
                )
            ).get("value")
            or Decimal("0.00")
        )
    except Exception:
        highest_product_discount = Decimal("0.00")

    highest_discount = max(
        _safe_decimal(highest_contract_discount),
        _safe_decimal(highest_product_discount),
    )

    try:
        providers_with_discounts = contracted_queryset.filter(
            Q(contracts__discount_percentage__gt=0)
            | Q(contracts__contract_products__discount_percentage__gt=0)
            | Q(contracts__contract_products__special_price__isnull=False)
        ).distinct().count()
    except Exception:
        providers_with_discounts = 0

    return {
        "contracted_providers": contracted_providers,
        "providers_with_active_contracts": contracted_providers,
        "active_contracts_providers": contracted_providers,
        "contracted_products_count": int(contracted_products_count or 0),
        "highest_discount_percent": _decimal_str(highest_discount),
        "max_discount_percent": _decimal_str(highest_discount),
        "providers_with_discounts": providers_with_discounts,
    }


# ============================================================
# 🔹 Orders Relation Helpers
# ============================================================

@lru_cache(maxsize=1)
def _get_orders_reverse_relation_name() -> str:
    """
    Detect the reverse relation from Provider to Order safely.

    This avoids hard-coding related_name because different builds may use:
    - provider.orders
    - provider.order_set
    - another custom related_name

    If no relation exists, the API returns orders_count = 0 safely.
    """

    try:
        for relation in Provider._meta.related_objects:
            related_model = relation.related_model
            related_app = getattr(related_model._meta, "app_label", "")
            related_model_name = getattr(related_model._meta, "model_name", "")

            if related_app == "orders" or related_model_name == "order":
                accessor_name = relation.get_accessor_name()
                if accessor_name:
                    return accessor_name
    except Exception as exc:
        logger.warning("Unable to detect provider orders relation: %s", exc)

    return ""


def annotate_provider_orders_count(queryset: QuerySet[Provider]) -> QuerySet[Provider]:
    """
    Add orders_count annotation if an orders relation exists.
    Falls back to 0 without failing the providers API.
    """

    relation_name = _get_orders_reverse_relation_name()

    if not relation_name:
        return queryset.annotate(
            orders_count=Value(0, output_field=IntegerField()),
        )

    try:
        return queryset.annotate(
            orders_count=Count(relation_name, distinct=True),
        )
    except FieldError as exc:
        logger.warning("Unable to annotate orders_count using relation %s: %s", relation_name, exc)

        return queryset.annotate(
            orders_count=Value(0, output_field=IntegerField()),
        )


def _safe_total_orders(queryset: QuerySet[Provider]) -> int:
    try:
        result = queryset.aggregate(total_orders=Sum("orders_count"))
        return int(result.get("total_orders") or 0)
    except Exception:
        return 0


# ============================================================
# 🔹 Extra Filters / Ordering
# ============================================================

def _apply_manual_source_filter(queryset: QuerySet[Provider], params) -> QuerySet[Provider]:
    """
    Extra compatibility for frontend filters.

    Existing apply_provider_filters may already handle import_source.
    This keeps manual/imported filtering safe for both old and new frontend payloads.
    """

    source = str(params.get("source", "") or "").strip().lower()
    import_source = str(params.get("import_source", "") or "").strip()

    if source == "manual":
        return queryset.filter(import_source="")

    if source == "imported":
        return queryset.exclude(import_source="")

    if import_source:
        return queryset.filter(import_source=import_source)

    return queryset


def _apply_provider_identity_filters(queryset: QuerySet[Provider], params) -> QuerySet[Provider]:
    """
    Optional filters for provider identity and document readiness.

    Supported:
    - has_commercial_registration=true/false
    - has_tax_number=true/false
    - has_logo=true/false
    - has_image=true/false
    - has_drive_folder=true/false
    - has_login_user=true/false

    Notes:
    - apply_provider_filters in services.py already supports some of these.
    - This function keeps the API safe if an older services.py is loaded.
    """

    has_commercial_registration = _parse_bool_param(params.get("has_commercial_registration"))
    has_tax_number = _parse_bool_param(params.get("has_tax_number"))
    has_logo = _parse_bool_param(params.get("has_logo"))
    has_image = _parse_bool_param(params.get("has_image"))
    has_drive_folder = _parse_bool_param(params.get("has_drive_folder"))
    has_login_user = _parse_bool_param(
        params.get("has_login_user")
        if params.get("has_login_user") not in (None, "")
        else params.get("has_user")
    )

    if has_commercial_registration is True:
        queryset = queryset.exclude(commercial_registration="")

    if has_commercial_registration is False:
        queryset = queryset.filter(commercial_registration="")

    if has_tax_number is True:
        queryset = queryset.exclude(tax_number="")

    if has_tax_number is False:
        queryset = queryset.filter(tax_number="")

    if has_logo is True:
        queryset = queryset.filter(Q(logo_url__gt="") | Q(logo_drive_file_id__gt=""))

    if has_logo is False:
        queryset = queryset.filter(logo_url="", logo_drive_file_id="")

    if has_image is True:
        queryset = queryset.filter(Q(image_url__gt="") | Q(image_drive_file_id__gt=""))

    if has_image is False:
        queryset = queryset.filter(image_url="", image_drive_file_id="")

    if has_drive_folder is True:
        queryset = queryset.exclude(drive_folder_id="")

    if has_drive_folder is False:
        queryset = queryset.filter(drive_folder_id="")

    if _model_has_field("user"):
        if has_login_user is True:
            queryset = queryset.filter(user__isnull=False)
        elif has_login_user is False:
            queryset = queryset.filter(user__isnull=True)

    return queryset


def _apply_provider_ordering(queryset: QuerySet[Provider], params) -> QuerySet[Provider]:
    """
    Safe ordering for provider list.

    Supported values:
    - sort=most_orders
    - sort=highest_discount
    - sort=contracted
    - ordering=-orders_count
    - ordering=-highest_discount_percent
    - ordering=-contracted_products_count
    - ordering=-active_contracts_count
    """

    requested_ordering = (
        str(params.get("ordering", "") or "").strip()
        or str(params.get("order_by", "") or "").strip()
    )
    requested_sort = str(params.get("sort", "") or "").strip().lower()

    if requested_sort == "most_orders":
        return queryset.order_by("-orders_count", "name", "id")

    if requested_sort in {"highest_discount", "most_discount", "top_discount"}:
        return queryset.order_by(
            "-highest_product_discount_percent",
            "-highest_contract_discount_percent",
            "name",
            "id",
        )

    if requested_sort in {"contracted", "active_contracts", "network"}:
        return queryset.order_by(
            "-active_contracts_count",
            "-contracted_products_count",
            "name",
            "id",
        )

    if requested_sort == "newest":
        return queryset.order_by("-created_at", "-id")

    if requested_sort == "oldest":
        return queryset.order_by("created_at", "id")

    if requested_sort == "name":
        return queryset.order_by("name", "id")

    if requested_sort == "arabic_name":
        return queryset.order_by("name_ar", "name", "id")

    if requested_sort == "english_name":
        return queryset.order_by("name_en", "name", "id")

    allowed_ordering = {
        "name",
        "-name",
        "name_ar",
        "-name_ar",
        "name_en",
        "-name_en",
        "code",
        "-code",
        "commercial_registration",
        "-commercial_registration",
        "tax_number",
        "-tax_number",
        "city",
        "-city",
        "region",
        "-region",
        "area",
        "-area",
        "status",
        "-status",
        "provider_type",
        "-provider_type",
        "source_category",
        "-source_category",
        "import_source",
        "-import_source",
        "created_at",
        "-created_at",
        "updated_at",
        "-updated_at",
        "orders_count",
        "-orders_count",
        "active_contracts_count",
        "-active_contracts_count",
        "contracted_products_count",
        "-contracted_products_count",
        "highest_contract_discount_percent",
        "-highest_contract_discount_percent",
        "highest_product_discount_percent",
        "-highest_product_discount_percent",
    }

    if requested_ordering in {"highest_discount_percent", "discount_percent"}:
        return queryset.order_by(
            "highest_product_discount_percent",
            "highest_contract_discount_percent",
            "name",
            "id",
        )

    if requested_ordering in {"-highest_discount_percent", "-discount_percent"}:
        return queryset.order_by(
            "-highest_product_discount_percent",
            "-highest_contract_discount_percent",
            "name",
            "id",
        )

    if requested_ordering in allowed_ordering:
        return queryset.order_by(requested_ordering, "id")

    return queryset.order_by("-created_at", "-id")


# ============================================================
# 🔹 Serialization / Summary
# ============================================================

def serialize_provider_with_orders(provider: Provider) -> dict[str, Any]:
    """
    Preserve the current serializer output and add count fields needed by frontend.
    """

    data = serialize_provider(provider)
    orders_count = int(getattr(provider, "orders_count", 0) or 0)

    active_contracts_count = int(getattr(provider, "active_contracts_count", 0) or 0)
    contracted_products_count = int(getattr(provider, "contracted_products_count", 0) or 0)
    highest_discount = _provider_highest_discount(provider)

    user = getattr(provider, "user", None)

    data["user_id"] = getattr(provider, "user_id", None)
    data["has_login_user"] = bool(getattr(provider, "user_id", None))
    data["login_user"] = _serialize_login_user(user)

    data["orders_count"] = orders_count
    data["order_count"] = orders_count
    data["total_orders"] = orders_count

    # API-level aliases for customer medical network.
    data["active_contracts_count"] = max(
        active_contracts_count,
        int(data.get("active_contracts_count") or 0),
    )
    data["contracted_products_count"] = max(
        contracted_products_count,
        int(data.get("contracted_products_count") or 0),
    )
    data["has_active_contract"] = bool(
        data.get("has_active_contract")
        or data["active_contracts_count"] > 0
        or data["contracted_products_count"] > 0
    )
    data["has_active_contracts"] = data["has_active_contract"]

    service_discount = _safe_decimal(data.get("discount_percent"))
    data["highest_discount_percent"] = _decimal_str(max(highest_discount, service_discount))
    data["max_discount_percent"] = data["highest_discount_percent"]
    data["discount_percent"] = data["highest_discount_percent"]
    data["discount_percentage"] = data["highest_discount_percent"]
    data["discount_rate"] = data["highest_discount_percent"]

    return data


def build_providers_summary(queryset: QuerySet[Provider]) -> dict[str, Any]:
    """
    Build lightweight summary for provider dashboard/list pages.

    Notes:
    - Uses the already-filtered queryset.
    - Keeps old response shape intact by adding summary only.
    - Includes imported medical network counters.
    - Includes total_orders when orders relation exists.
    - Includes identity/document readiness counters.
    - Includes customer medical network contract counters.
    - Includes Provider.user login account counters.
    """

    total_providers = queryset.count()
    imported_providers = _safe_exclude_count(queryset, import_source="")

    providers_with_logo = _safe_filter_count(
        queryset,
        Q(logo_url__gt="") | Q(logo_drive_file_id__gt=""),
    )
    providers_with_image = _safe_filter_count(
        queryset,
        Q(image_url__gt="") | Q(image_drive_file_id__gt=""),
    )
    providers_with_drive_folder = _safe_exclude_count(queryset, drive_folder_id="")
    providers_with_commercial_registration = _safe_exclude_count(queryset, commercial_registration="")
    providers_with_tax_number = _safe_exclude_count(queryset, tax_number="")

    providers_with_login_user = 0
    if _model_has_field("user"):
        providers_with_login_user = _safe_filter_count(queryset, Q(user__isnull=False))

    medical_network_totals = _safe_medical_network_totals(queryset)

    return {
        "total_providers": total_providers,
        "active_providers": _safe_count(queryset, status=ProviderStatus.ACTIVE),
        "inactive_providers": _safe_count(queryset, status=ProviderStatus.INACTIVE),
        "suspended_providers": _safe_count(queryset, status=ProviderStatus.SUSPENDED),
        "draft_providers": _safe_count(queryset, status=ProviderStatus.DRAFT),
        "hospitals_count": _safe_count(queryset, provider_type=ProviderType.HOSPITAL),
        "medical_centers_count": _safe_count(
            queryset,
            provider_type=ProviderType.MEDICAL_CENTER,
        ),
        "pharmacies_count": _safe_count(queryset, provider_type=ProviderType.PHARMACY),
        "labs_count": _safe_count(queryset, provider_type=ProviderType.LAB),
        "clinics_count": _safe_count(queryset, provider_type=ProviderType.CLINIC),
        "partners_count": _safe_count(queryset, provider_type=ProviderType.PARTNER),
        "others_count": _safe_count(queryset, provider_type=ProviderType.OTHER),
        "featured_providers": _safe_count(queryset, is_featured=True),
        "imported_providers": imported_providers,
        "manual_providers": max(0, total_providers - imported_providers),
        "total_orders": _safe_total_orders(queryset),

        # Identity/readiness summary.
        "providers_with_logo": providers_with_logo,
        "providers_without_logo": max(0, total_providers - providers_with_logo),
        "providers_with_image": providers_with_image,
        "providers_without_image": max(0, total_providers - providers_with_image),
        "providers_with_drive_folder": providers_with_drive_folder,
        "providers_without_drive_folder": max(0, total_providers - providers_with_drive_folder),
        "providers_with_commercial_registration": providers_with_commercial_registration,
        "providers_without_commercial_registration": max(
            0,
            total_providers - providers_with_commercial_registration,
        ),
        "providers_with_tax_number": providers_with_tax_number,
        "providers_without_tax_number": max(0, total_providers - providers_with_tax_number),

        # Login account summary.
        "providers_with_login_user": providers_with_login_user,
        "providers_without_login_user": max(0, total_providers - providers_with_login_user),

        # Customer medical network summary.
        **medical_network_totals,
    }


# ============================================================
# 🔹 Providers Query Base
# ============================================================

def _providers_queryset_base() -> QuerySet[Provider]:
    queryset = Provider.objects.all()

    if _model_has_field("user"):
        try:
            queryset = queryset.select_related("user")
        except Exception:
            pass

    return queryset


# ============================================================
# 🔹 Providers API
# ============================================================

@csrf_protect
@require_http_methods(["GET", "POST"])
def providers_api(request):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    required_permission = (
        PERMISSION_PROVIDERS_CREATE
        if request.method == "POST"
        else PERMISSION_PROVIDERS_VIEW
    )
    if not _has_required_permission(user, required_permission):
        return _forbidden(required_permission)

    if request.method == "GET":
        queryset = _providers_queryset_base()
        queryset = apply_provider_filters(queryset, request.GET)
        queryset = _apply_medical_network_filter(queryset, request.GET)
        queryset = _apply_manual_source_filter(queryset, request.GET)
        queryset = _apply_provider_identity_filters(queryset, request.GET)
        queryset = annotate_provider_orders_count(queryset)
        queryset = annotate_provider_network_fields(queryset)
        queryset = _apply_provider_ordering(queryset, request.GET)

        page = parse_int(request.GET.get("page"), 1) or 1
        page_size = parse_int(request.GET.get("page_size"), 20) or 20

        summary = build_providers_summary(queryset)
        paginated = paginate_queryset(queryset, page=page, page_size=page_size)

        results = [
            serialize_provider_with_orders(item)
            for item in paginated["items"]
        ]

        return _json_success(
            {
                "message": "Providers loaded successfully.",
                "results": results,
                "providers": results,
                "pagination": paginated["pagination"],
                "summary": summary,
                "filters": {
                    "search": request.GET.get("search") or request.GET.get("q") or "",
                    "status": request.GET.get("status") or "",
                    "provider_type": request.GET.get("provider_type") or "",
                    "source": request.GET.get("source") or "",
                    "import_source": request.GET.get("import_source") or "",
                    "city": request.GET.get("city") or "",
                    "region": request.GET.get("region") or "",
                    "area": request.GET.get("area") or "",
                    "has_login_user": request.GET.get("has_login_user") or request.GET.get("has_user") or "",
                    "ordering": request.GET.get("ordering") or request.GET.get("order_by") or "",
                    "sort": request.GET.get("sort") or "",
                },
                "data": {
                    "results": results,
                    "providers": results,
                    "pagination": paginated["pagination"],
                    "summary": summary,
                },
            },
            status=200,
        )

    try:
        payload = parse_json_body(request)

        create_login_user = _parse_bool_value(
            payload.get("create_login_user")
            if "create_login_user" in payload
            else payload.get("create_user")
            if "create_user" in payload
            else payload.get("create_account"),
            default=False,
        )

        login_user = None
        login_user_created = False
        login_user_linked = False
        login_message = ""

        with transaction.atomic():
            provider = create_provider(payload=payload)

            if create_login_user:
                login_user, login_user_created, login_user_linked, login_message = (
                    _create_login_user_for_provider(
                        provider=provider,
                        payload=payload,
                        actor=user,
                    )
                )

            provider = (
                _providers_queryset_base()
                .filter(pk=provider.pk)
                .first()
                or provider
            )

        provider_payload = serialize_provider_with_orders(provider)

        return _json_success(
            {
                "message": (
                    "Provider and login user created successfully."
                    if create_login_user and provider_payload.get("has_login_user")
                    else "Provider created successfully."
                ),
                "provider": provider_payload,
                "item": provider_payload,
                "data": {
                    "provider": provider_payload,
                    "created_user": login_user_created,
                    "login_user_created": login_user_created,
                    "login_user_linked": login_user_linked,
                    "login_message": login_message,
                    "login_user": _serialize_login_user(login_user),
                },
                "created_user": login_user_created,
                "login_user_created": login_user_created,
                "login_user_linked": login_user_linked,
                "login_message": login_message,
                "login_user": _serialize_login_user(login_user),
            },
            status=201,
        )

    except ValidationError as exc:
        return _json_error(
            "Validation failed while creating provider.",
            400,
            errors=_serialize_validation_error(exc),
        )

    except Exception as exc:
        logger.exception("Failed to create provider: %s", exc)
        return _json_error("Unexpected error while creating provider.", 500)


# ============================================================
# 🔹 Active Providers API
# ============================================================

@require_http_methods(["GET"])
def active_providers_api(request):
    queryset = _providers_queryset_base().filter(status=ProviderStatus.ACTIVE)
    queryset = apply_provider_filters(queryset, request.GET)
    queryset = _apply_medical_network_filter(queryset, request.GET)
    queryset = _apply_manual_source_filter(queryset, request.GET)
    queryset = _apply_provider_identity_filters(queryset, request.GET)
    queryset = annotate_provider_orders_count(queryset)
    queryset = annotate_provider_network_fields(queryset)
    queryset = _apply_provider_ordering(queryset, request.GET)

    page = parse_int(request.GET.get("page"), 1) or 1
    page_size = parse_int(request.GET.get("page_size"), 20) or 20

    summary = build_providers_summary(queryset)
    paginated = paginate_queryset(queryset, page=page, page_size=page_size)

    results = [
        serialize_provider_with_orders(item)
        for item in paginated["items"]
    ]

    return _json_success(
        {
            "message": "Active providers loaded successfully.",
            "results": results,
            "providers": results,
            "pagination": paginated["pagination"],
            "summary": summary,
            "data": {
                "results": results,
                "providers": results,
                "pagination": paginated["pagination"],
                "summary": summary,
            },
        },
        status=200,
    )