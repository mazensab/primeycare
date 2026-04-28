# ============================================================
# 📂 api/contracts/list.py
# 🧠 Primey Care | Contracts API List/Create
# ------------------------------------------------------------
# ✅ List Contracts
# ✅ Create Contract
# ✅ Filters + Pagination
# ✅ Lightweight Summary
# ✅ Authenticated Access
# ============================================================

from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from django.db.models import Count, Q
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from contracts.models import Contract, ContractStatus
from contracts.services import (
    apply_contract_filters,
    create_contract,
    paginate_queryset,
    parse_int,
    parse_json_body,
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


def _validation_errors(exc: ValidationError):
    if hasattr(exc, "message_dict"):
        return exc.message_dict
    return exc.messages


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


def _build_contracts_summary() -> dict:
    status_counts = {
        item["status"]: item["total"]
        for item in Contract.objects.values("status").annotate(total=Count("id"))
    }

    return {
        "total_contracts": Contract.objects.count(),
        "active_contracts": status_counts.get(ContractStatus.ACTIVE, 0),
        "draft_contracts": status_counts.get(ContractStatus.DRAFT, 0),
        "suspended_contracts": status_counts.get(ContractStatus.SUSPENDED, 0),
        "expired_contracts": status_counts.get(ContractStatus.EXPIRED, 0),
        "terminated_contracts": status_counts.get(ContractStatus.TERMINATED, 0),
        "contracts_with_products": (
            Contract.objects.filter(contract_products__isnull=False)
            .distinct()
            .count()
        ),
    }


# ============================================================
# 🔹 Contracts API
# ============================================================

@require_http_methods(["GET", "POST"])
def contracts_api(request):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "GET":
        permission_error = _ensure_permission(
            user,
            (
                "contracts.view_contract",
                "contracts.list_contract",
                "contracts.manage_contracts",
                "view_contract",
                "list_contract",
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
        queryset = apply_contract_filters(queryset, request.GET)

        page = parse_int(request.GET.get("page"), 1) or 1
        page_size = parse_int(request.GET.get("page_size"), 20) or 20

        paginated = paginate_queryset(queryset, page=page, page_size=page_size)

        return JsonResponse(
            {
                "ok": True,
                "message": "Contracts loaded successfully.",
                "summary": _build_contracts_summary(),
                "results": [
                    serialize_contract(item)
                    for item in paginated["items"]
                ],
                "pagination": paginated["pagination"],
            },
            status=200,
        )

    permission_error = _ensure_permission(
        user,
        (
            "contracts.add_contract",
            "contracts.create_contract",
            "contracts.manage_contracts",
            "add_contract",
            "create_contract",
            "manage_contracts",
        ),
    )
    if permission_error:
        return permission_error

    try:
        payload = parse_json_body(request)
        contract = create_contract(payload=payload)

        contract = (
            Contract.objects.select_related("provider")
            .prefetch_related("contract_products__product")
            .get(pk=contract.pk)
        )

        return JsonResponse(
            {
                "ok": True,
                "message": "Contract created successfully.",
                "data": serialize_contract(contract),
            },
            status=201,
        )
    except ValidationError as exc:
        return _json_error(
            "Validation failed while creating contract.",
            400,
            errors=_validation_errors(exc),
        )
    except Exception as exc:
        logger.exception("Failed to create contract: %s", exc)
        return _json_error("Unexpected error while creating contract.", 500)