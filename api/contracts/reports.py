# ============================================================
# 📂 api/contracts/reports.py
# 🧠 Primey Care | Contracts API Reports V2
# ------------------------------------------------------------
# ✅ Contracts Summary
# ✅ Status Distribution
# ✅ Pricing Model Distribution
# ✅ Providers Coverage
# ✅ Provider Login User Coverage
# ✅ ContractProduct Offers Summary
# ✅ Landing / Mobile / Offers Visibility Reports
# ------------------------------------------------------------
# القاعدة المعتمدة:
# - Product = كتالوج ثابت
# - Provider = كيان مقدم الخدمة في الشبكة
# - Contract = عقد مقدم الخدمة وبداية العلاقة الرسمية
# - Provider.user = حساب دخول رئيسي اختياري ينشأ من العقد
# - ContractProduct = عرض/سعر/خصم المنتج حسب مقدم الخدمة والعقد
# ============================================================

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.db.models import Count, Max, Min, Q, QuerySet
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from contracts.models import Contract, ContractProduct, ContractStatus, PricingModel
from contracts.services import (
    apply_contract_filters,
    parse_int,
    serialize_contract,
)


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
    payload = {
        "ok": True,
        "success": True,
    }
    payload.update(data)

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _ensure_authenticated(request):
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return None, _json_error("Authentication required.", 401)

    return request.user, None


def _user_has_any_permission(user, permissions: tuple[str, ...]) -> bool:
    if getattr(user, "is_superuser", False):
        return True

    profile = getattr(user, "profile", None) or getattr(user, "userprofile", None)
    role = str(getattr(profile, "role", "") or "").lower() if profile else ""
    user_type = str(getattr(profile, "user_type", "") or "").upper() if profile else ""

    if role == "system_admin" or user_type in {"SUPER_ADMIN", "SYSTEM_ADMIN"}:
        return True

    for permission in permissions:
        try:
            if user.has_perm(permission):
                return True
        except Exception:
            continue

    for attr in ("permission_codes", "permissions", "profile_permissions"):
        value = getattr(profile, attr, None) if profile else None

        if not value:
            continue

        if isinstance(value, dict):
            codes = value.get("codes", [])
            if any(code in permissions for code in codes):
                return True

        if isinstance(value, (list, tuple, set)):
            if any(code in permissions for code in value):
                return True

        manager = getattr(value, "all", None)

        if callable(manager):
            for item in value.all():
                code = getattr(item, "code", None) or getattr(item, "codename", None)
                if code in permissions:
                    return True

    return False


def _ensure_permission(user, permissions: tuple[str, ...]):
    if _user_has_any_permission(user, permissions):
        return None

    return _json_error(
        "You do not have permission to perform this action.",
        403,
        errors={"required_permissions": list(permissions)},
    )


def _choice_label(choices, value: str) -> str:
    labels = dict(choices)
    return labels.get(value, value)


def _money(value: Any) -> Decimal:
    if value in (None, ""):
        return Decimal("0.00")

    try:
        parsed = Decimal(str(value))
    except Exception:
        parsed = Decimal("0.00")

    if parsed < Decimal("0.00"):
        parsed = Decimal("0.00")

    return parsed.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _percent(value: Any) -> Decimal:
    if value in (None, ""):
        return Decimal("0.00")

    try:
        parsed = Decimal(str(value))
    except Exception:
        parsed = Decimal("0.00")

    if parsed < Decimal("0.00"):
        parsed = Decimal("0.00")

    if parsed > Decimal("100.00"):
        parsed = Decimal("100.00")

    return parsed.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _money_str(value: Any) -> str:
    return str(_money(value))


def _percent_str(value: Any) -> str:
    return str(_percent(value))


def _parse_bool_filter(value: Any) -> bool | None:
    if value in (None, ""):
        return None

    if isinstance(value, bool):
        return value

    normalized = str(value).strip().lower()

    if normalized in {"1", "true", "yes", "y", "on", "نعم", "صح"}:
        return True

    if normalized in {"0", "false", "no", "n", "off", "لا", "خطأ"}:
        return False

    return None


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _current_contract_offer_q() -> Q:
    today = timezone.localdate()

    return (
        Q(is_active=True)
        & Q(contract__status=ContractStatus.ACTIVE)
        & (
            Q(contract__start_date__isnull=True)
            | Q(contract__start_date__lte=today)
        )
        & (
            Q(contract__end_date__isnull=True)
            | Q(contract__end_date__gte=today)
        )
        & (
            Q(offer_start_date__isnull=True)
            | Q(offer_start_date__lte=today)
        )
        & (
            Q(offer_end_date__isnull=True)
            | Q(offer_end_date__gte=today)
        )
    )


# ============================================================
# 🔹 Login User Serialization
# ============================================================

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
        "last_login": _iso_datetime(getattr(user, "last_login", None)),
        "date_joined": _iso_datetime(getattr(user, "date_joined", None)),
    }


def _provider_name_from_values(item: dict[str, Any]) -> str:
    return (
        item.get("provider__name_ar")
        or item.get("provider__name")
        or item.get("provider__name_en")
        or ""
    )


def _contract_provider_name_from_values(item: dict[str, Any]) -> str:
    return (
        item.get("contract__provider__name_ar")
        or item.get("contract__provider__name")
        or item.get("contract__provider__name_en")
        or ""
    )


def _enrich_contract_with_provider_login(contract_payload: dict[str, Any]) -> dict[str, Any]:
    provider = contract_payload.get("provider")

    if not isinstance(provider, dict):
        return contract_payload

    provider_user = provider.get("login_user")
    has_login_user = bool(
        provider.get("has_login_user")
        or provider.get("user_id")
        or provider_user
    )

    contract_payload["provider_user_id"] = provider.get("user_id")
    contract_payload["has_provider_login_user"] = has_login_user
    contract_payload["provider_login_user"] = provider_user

    return contract_payload


# ============================================================
# 🔹 Query Builders
# ============================================================

def _contracts_queryset():
    return (
        Contract.objects
        .select_related(
            "provider",
            "provider__user",
        )
        .prefetch_related(
            "contract_products",
            "contract_products__product",
            "contract_products__product__category",
        )
        .all()
    )


def _apply_extra_report_filters(
    queryset: QuerySet[Contract],
    request,
) -> QuerySet[Contract]:
    has_provider_login_user = _parse_bool_filter(
        request.GET.get("has_provider_login_user")
        or request.GET.get("provider_has_login_user")
        or request.GET.get("has_login_user")
    )

    if has_provider_login_user is True:
        queryset = queryset.filter(provider__user__isnull=False)

    elif has_provider_login_user is False:
        queryset = queryset.filter(provider__user__isnull=True)

    return queryset


def _contract_products_queryset(filtered_contracts: QuerySet[Contract]):
    return (
        ContractProduct.objects
        .select_related(
            "contract",
            "contract__provider",
            "contract__provider__user",
            "product",
            "product__category",
        )
        .filter(
            contract__in=filtered_contracts,
        )
    )


# ============================================================
# 🔹 Offer Summary Builders
# ============================================================

def _build_offer_visibility_summary(contract_products: QuerySet[ContractProduct]) -> dict[str, int]:
    return {
        "total_contract_products": contract_products.count(),
        "active_contract_products": contract_products.filter(is_active=True).count(),
        "current_available_offers": contract_products.filter(_current_contract_offer_q()).count(),
        "featured_contract_offers": contract_products.filter(is_featured=True).count(),
        "landing_contract_offers": contract_products.filter(show_on_landing=True).count(),
        "mobile_contract_offers": contract_products.filter(show_on_mobile=True).count(),
        "offers_page_contract_offers": contract_products.filter(show_on_offers=True).count(),
        "offers_with_marketing_image": contract_products.exclude(marketing_image_url="").count(),
        "distinct_products_in_contracts": contract_products.values("product_id").distinct().count(),
        "distinct_providers_in_contracts": contract_products.values("contract__provider_id").distinct().count(),
    }


def _build_offer_price_summary(contract_products: QuerySet[ContractProduct]) -> dict[str, str]:
    try:
        aggregate = contract_products.aggregate(
            min_price_before_discount=Min("price_before_discount"),
            max_price_before_discount=Max("price_before_discount"),
            min_price_after_discount=Min("price_after_discount"),
            max_price_after_discount=Max("price_after_discount"),
            max_discount_percentage=Max("discount_percentage"),
            max_system_commission_percentage=Max("system_commission_percentage"),
        )
    except Exception:
        aggregate = {}

    return {
        "min_price_before_discount": _money_str(aggregate.get("min_price_before_discount")),
        "max_price_before_discount": _money_str(aggregate.get("max_price_before_discount")),
        "min_price_after_discount": _money_str(aggregate.get("min_price_after_discount")),
        "max_price_after_discount": _money_str(aggregate.get("max_price_after_discount")),
        "max_discount_percentage": _percent_str(aggregate.get("max_discount_percentage")),
        "max_system_commission_percentage": _percent_str(aggregate.get("max_system_commission_percentage")),
    }


def _build_product_type_distribution(contract_products: QuerySet[ContractProduct]) -> list[dict[str, Any]]:
    return [
        {
            "product_type": item["product__product_type"],
            "total": item["total"],
        }
        for item in (
            contract_products
            .values("product__product_type")
            .annotate(total=Count("id"))
            .order_by("-total", "product__product_type")
        )
    ]


def _build_provider_offer_distribution(contract_products: QuerySet[ContractProduct]) -> list[dict[str, Any]]:
    return [
        {
            "provider_id": item["contract__provider_id"],
            "provider_name": _contract_provider_name_from_values(item),
            "provider_name_raw": item["contract__provider__name"],
            "provider_name_ar": item["contract__provider__name_ar"],
            "provider_name_en": item["contract__provider__name_en"],
            "provider_user_id": item["contract__provider__user_id"],
            "has_provider_login_user": bool(item["contract__provider__user_id"]),
            "provider_login_user": _serialize_login_user(
                {
                    "id": item["contract__provider__user_id"],
                    "username": item["contract__provider__user__username"],
                    "email": item["contract__provider__user__email"],
                    "first_name": item["contract__provider__user__first_name"],
                    "last_name": item["contract__provider__user__last_name"],
                    "is_active": item["contract__provider__user__is_active"],
                }
            ) if False else {
                "id": item["contract__provider__user_id"],
                "username": item["contract__provider__user__username"] or "",
                "email": item["contract__provider__user__email"] or "",
                "first_name": item["contract__provider__user__first_name"] or "",
                "last_name": item["contract__provider__user__last_name"] or "",
                "full_name": " ".join(
                    part for part in [
                        item["contract__provider__user__first_name"] or "",
                        item["contract__provider__user__last_name"] or "",
                    ] if part
                ),
                "is_active": bool(item["contract__provider__user__is_active"]),
                "is_staff": False,
                "is_superuser": False,
                "last_login": None,
                "date_joined": None,
            } if item["contract__provider__user_id"] else None,
            "total_offers": item["total_offers"],
            "active_offers": item["active_offers"],
            "landing_offers": item["landing_offers"],
            "mobile_offers": item["mobile_offers"],
            "featured_offers": item["featured_offers"],
        }
        for item in (
            contract_products
            .values(
                "contract__provider_id",
                "contract__provider__name",
                "contract__provider__name_ar",
                "contract__provider__name_en",
                "contract__provider__user_id",
                "contract__provider__user__username",
                "contract__provider__user__email",
                "contract__provider__user__first_name",
                "contract__provider__user__last_name",
                "contract__provider__user__is_active",
            )
            .annotate(
                total_offers=Count("id"),
                active_offers=Count("id", filter=Q(is_active=True)),
                landing_offers=Count("id", filter=Q(show_on_landing=True)),
                mobile_offers=Count("id", filter=Q(show_on_mobile=True)),
                featured_offers=Count("id", filter=Q(is_featured=True)),
            )
            .order_by("-total_offers", "contract__provider__name")[:20]
        )
    ]


def _build_provider_distribution(filtered_queryset: QuerySet[Contract]) -> list[dict[str, Any]]:
    return [
        {
            "provider_id": item["provider_id"],
            "provider_name": _provider_name_from_values(item),
            "provider_name_raw": item["provider__name"],
            "provider_name_ar": item["provider__name_ar"],
            "provider_name_en": item["provider__name_en"],
            "provider_user_id": item["provider__user_id"],
            "has_provider_login_user": bool(item["provider__user_id"]),
            "provider_login_user": {
                "id": item["provider__user_id"],
                "username": item["provider__user__username"] or "",
                "email": item["provider__user__email"] or "",
                "first_name": item["provider__user__first_name"] or "",
                "last_name": item["provider__user__last_name"] or "",
                "full_name": " ".join(
                    part for part in [
                        item["provider__user__first_name"] or "",
                        item["provider__user__last_name"] or "",
                    ] if part
                ),
                "is_active": bool(item["provider__user__is_active"]),
                "is_staff": False,
                "is_superuser": False,
                "last_login": None,
                "date_joined": None,
            } if item["provider__user_id"] else None,
            "total": item["total"],
        }
        for item in (
            filtered_queryset
            .values(
                "provider_id",
                "provider__name",
                "provider__name_ar",
                "provider__name_en",
                "provider__user_id",
                "provider__user__username",
                "provider__user__email",
                "provider__user__first_name",
                "provider__user__last_name",
                "provider__user__is_active",
            )
            .annotate(total=Count("id"))
            .order_by("-total", "provider__name")[:20]
        )
    ]


def _build_visibility_distribution(contract_products: QuerySet[ContractProduct]) -> list[dict[str, Any]]:
    return [
        {
            "key": "show_on_landing",
            "label": "Landing",
            "total": contract_products.filter(show_on_landing=True).count(),
        },
        {
            "key": "show_on_mobile",
            "label": "Mobile",
            "total": contract_products.filter(show_on_mobile=True).count(),
        },
        {
            "key": "show_on_offers",
            "label": "Offers Page",
            "total": contract_products.filter(show_on_offers=True).count(),
        },
        {
            "key": "is_featured",
            "label": "Featured",
            "total": contract_products.filter(is_featured=True).count(),
        },
    ]


def _build_provider_login_summary(filtered_queryset: QuerySet[Contract]) -> dict[str, int]:
    providers_count = filtered_queryset.values("provider_id").distinct().count()
    providers_with_login_users = (
        filtered_queryset
        .filter(provider__user__isnull=False)
        .values("provider_id")
        .distinct()
        .count()
    )

    return {
        "providers_in_contracts": providers_count,
        "providers_with_login_users": providers_with_login_users,
        "providers_without_login_users": max(0, providers_count - providers_with_login_users),
    }


# ============================================================
# 🔹 Reports API
# ============================================================

@require_http_methods(["GET"])
def contracts_reports_api(request):
    user, auth_error = _ensure_authenticated(request)

    if auth_error:
        return auth_error

    permission_error = _ensure_permission(
        user,
        (
            "contracts.view_contract",
            "contracts.report_contract",
            "contracts.manage_contracts",
            "view_contract",
            "report_contract",
            "manage_contracts",
        ),
    )

    if permission_error:
        return permission_error

    queryset = _contracts_queryset()
    filtered_queryset = apply_contract_filters(queryset, request.GET)
    filtered_queryset = _apply_extra_report_filters(filtered_queryset, request)
    contract_products = _contract_products_queryset(filtered_queryset)

    latest_limit = parse_int(request.GET.get("latest_limit"), 10) or 10
    latest_limit = min(max(latest_limit, 1), 50)

    status_distribution = [
        {
            "status": item["status"],
            "label": _choice_label(ContractStatus.choices, item["status"]),
            "total": item["total"],
        }
        for item in (
            filtered_queryset
            .values("status")
            .annotate(total=Count("id"))
            .order_by("status")
        )
    ]

    pricing_distribution = [
        {
            "pricing_model": item["pricing_model"],
            "label": _choice_label(PricingModel.choices, item["pricing_model"]),
            "total": item["total"],
        }
        for item in (
            filtered_queryset
            .values("pricing_model")
            .annotate(total=Count("id"))
            .order_by("pricing_model")
        )
    ]

    provider_distribution = _build_provider_distribution(filtered_queryset)

    total_contracts = filtered_queryset.count()
    active_contracts = filtered_queryset.filter(status=ContractStatus.ACTIVE).count()
    draft_contracts = filtered_queryset.filter(status=ContractStatus.DRAFT).count()
    suspended_contracts = filtered_queryset.filter(status=ContractStatus.SUSPENDED).count()
    expired_contracts = filtered_queryset.filter(status=ContractStatus.EXPIRED).count()
    terminated_contracts = filtered_queryset.filter(status=ContractStatus.TERMINATED).count()

    offer_visibility_summary = _build_offer_visibility_summary(contract_products)
    offer_price_summary = _build_offer_price_summary(contract_products)
    provider_login_summary = _build_provider_login_summary(filtered_queryset)

    latest_contracts = [
        _enrich_contract_with_provider_login(serialize_contract(item))
        for item in filtered_queryset.order_by("-created_at", "-id")[:latest_limit]
    ]

    summary = {
        "total_contracts": total_contracts,
        "active_contracts": active_contracts,
        "draft_contracts": draft_contracts,
        "suspended_contracts": suspended_contracts,
        "expired_contracts": expired_contracts,
        "terminated_contracts": terminated_contracts,
        **provider_login_summary,
        **offer_visibility_summary,
        **offer_price_summary,
    }

    response_payload = {
        "message": "Contracts report loaded successfully.",
        "summary": summary,
        "status_distribution": status_distribution,
        "pricing_distribution": pricing_distribution,
        "provider_distribution": provider_distribution,
        "provider_offer_distribution": _build_provider_offer_distribution(contract_products),
        "product_type_distribution": _build_product_type_distribution(contract_products),
        "offer_visibility_distribution": _build_visibility_distribution(contract_products),
        "latest_contracts": latest_contracts,
        "filters": {
            "status": request.GET.get("status") or "",
            "provider_id": request.GET.get("provider_id") or request.GET.get("provider") or "",
            "pricing_model": request.GET.get("pricing_model") or "",
            "has_provider_login_user": (
                request.GET.get("has_provider_login_user")
                or request.GET.get("provider_has_login_user")
                or request.GET.get("has_login_user")
                or ""
            ),
            "latest_limit": latest_limit,
        },
        "data": {
            "summary": summary,
            "status_distribution": status_distribution,
            "pricing_distribution": pricing_distribution,
            "provider_distribution": provider_distribution,
            "provider_offer_distribution": _build_provider_offer_distribution(contract_products),
            "product_type_distribution": _build_product_type_distribution(contract_products),
            "offer_visibility_distribution": _build_visibility_distribution(contract_products),
            "latest_contracts": latest_contracts,
        },
    }

    return _json_success(response_payload, status=200)