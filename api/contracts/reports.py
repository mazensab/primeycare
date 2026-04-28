# ============================================================
# 📂 api/contracts/reports.py
# 🧠 Primey Care | Contracts API Reports
# ------------------------------------------------------------
# ✅ Contracts Summary
# ✅ Status Distribution
# ✅ Pricing Model Distribution
# ✅ Providers Coverage
# ============================================================

from __future__ import annotations

import logging

from django.db.models import Count
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from contracts.models import Contract, ContractProduct, ContractStatus, PricingModel
from contracts.services import (
    apply_contract_filters,
    parse_int,
    serialize_contract,
)

logger = logging.getLogger(__name__)


# ============================================================
# 🔹 Helpers
# ============================================================

def _json_error(message: str, status: int = 400, *, errors=None) -> JsonResponse:
    payload = {
        "ok": False,
        "message": message,
    }
    if errors is not None:
        payload["errors"] = errors
    return JsonResponse(payload, status=status)


def _ensure_authenticated(request):
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return None, _json_error("Authentication required.", 401)
    return request.user, None


def _user_has_any_permission(user, permissions: tuple[str, ...]) -> bool:
    if getattr(user, "is_superuser", False):
        return True

    for permission in permissions:
        try:
            if user.has_perm(permission):
                return True
        except Exception:
            continue

    profile = getattr(user, "profile", None) or getattr(user, "userprofile", None)

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

    return _json_error("You do not have permission to perform this action.", 403)


def _choice_label(choices, value: str) -> str:
    labels = dict(choices)
    return labels.get(value, value)


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

    queryset = (
        Contract.objects.select_related("provider")
        .prefetch_related("contract_products__product")
        .all()
    )
    filtered_queryset = apply_contract_filters(queryset, request.GET)

    latest_limit = parse_int(request.GET.get("latest_limit"), 10) or 10
    latest_limit = min(max(latest_limit, 1), 50)

    status_distribution = [
        {
            "status": item["status"],
            "label": _choice_label(ContractStatus.choices, item["status"]),
            "total": item["total"],
        }
        for item in filtered_queryset.values("status").annotate(total=Count("id")).order_by("status")
    ]

    pricing_distribution = [
        {
            "pricing_model": item["pricing_model"],
            "label": _choice_label(PricingModel.choices, item["pricing_model"]),
            "total": item["total"],
        }
        for item in filtered_queryset.values("pricing_model").annotate(total=Count("id")).order_by("pricing_model")
    ]

    provider_distribution = [
        {
            "provider_id": item["provider_id"],
            "provider_name": item["provider__name"],
            "total": item["total"],
        }
        for item in filtered_queryset.values("provider_id", "provider__name")
        .annotate(total=Count("id"))
        .order_by("-total", "provider__name")[:20]
    ]

    total_contracts = filtered_queryset.count()
    active_contracts = filtered_queryset.filter(status=ContractStatus.ACTIVE).count()
    draft_contracts = filtered_queryset.filter(status=ContractStatus.DRAFT).count()
    suspended_contracts = filtered_queryset.filter(status=ContractStatus.SUSPENDED).count()
    expired_contracts = filtered_queryset.filter(status=ContractStatus.EXPIRED).count()
    terminated_contracts = filtered_queryset.filter(status=ContractStatus.TERMINATED).count()

    active_products_count = ContractProduct.objects.filter(
        contract__in=filtered_queryset,
        is_active=True,
    ).count()

    latest_contracts = [
        serialize_contract(item)
        for item in filtered_queryset.order_by("-created_at", "-id")[:latest_limit]
    ]

    return JsonResponse(
        {
            "ok": True,
            "message": "Contracts report loaded successfully.",
            "summary": {
                "total_contracts": total_contracts,
                "active_contracts": active_contracts,
                "draft_contracts": draft_contracts,
                "suspended_contracts": suspended_contracts,
                "expired_contracts": expired_contracts,
                "terminated_contracts": terminated_contracts,
                "active_contract_products": active_products_count,
            },
            "status_distribution": status_distribution,
            "pricing_distribution": pricing_distribution,
            "provider_distribution": provider_distribution,
            "latest_contracts": latest_contracts,
        },
        status=200,
    )