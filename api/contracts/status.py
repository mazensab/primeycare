# ============================================================
# 📂 api/contracts/status.py
# 🧠 Primey Care | Contracts API Status Actions
# ------------------------------------------------------------
# ✅ Activate Contract
# ✅ Suspend Contract
# ✅ Terminate Contract
# ✅ Expire Contract
# ============================================================

from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from contracts.models import Contract, ContractStatus
from contracts.services import serialize_contract

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


def _get_contract(contract_id: int) -> Contract:
    return get_object_or_404(
        Contract.objects.select_related("provider").prefetch_related("contract_products__product"),
        pk=contract_id,
    )


def _set_contract_status(contract: Contract, status: str) -> Contract:
    contract.status = status
    contract.full_clean()
    contract.save(update_fields=["status", "updated_at"])
    return _get_contract(contract.pk)


# ============================================================
# 🔹 Status Actions
# ============================================================

@require_http_methods(["POST", "PATCH"])
def activate_contract_api(request, contract_id: int):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    permission_error = _ensure_permission(
        user,
        (
            "contracts.change_contract",
            "contracts.activate_contract",
            "contracts.manage_contracts",
            "change_contract",
            "activate_contract",
            "manage_contracts",
        ),
    )
    if permission_error:
        return permission_error

    try:
        contract = _get_contract(contract_id)
        contract = _set_contract_status(contract, ContractStatus.ACTIVE)

        return JsonResponse(
            {
                "ok": True,
                "message": "Contract activated successfully.",
                "data": serialize_contract(contract),
            },
            status=200,
        )
    except ValidationError as exc:
        return _json_error(
            "Validation failed while activating contract.",
            400,
            errors=_validation_errors(exc),
        )
    except Exception as exc:
        logger.exception("Failed to activate contract %s: %s", contract_id, exc)
        return _json_error("Unexpected error while activating contract.", 500)


@require_http_methods(["POST", "PATCH"])
def suspend_contract_api(request, contract_id: int):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    permission_error = _ensure_permission(
        user,
        (
            "contracts.change_contract",
            "contracts.suspend_contract",
            "contracts.manage_contracts",
            "change_contract",
            "suspend_contract",
            "manage_contracts",
        ),
    )
    if permission_error:
        return permission_error

    try:
        contract = _get_contract(contract_id)
        contract = _set_contract_status(contract, ContractStatus.SUSPENDED)

        return JsonResponse(
            {
                "ok": True,
                "message": "Contract suspended successfully.",
                "data": serialize_contract(contract),
            },
            status=200,
        )
    except ValidationError as exc:
        return _json_error(
            "Validation failed while suspending contract.",
            400,
            errors=_validation_errors(exc),
        )
    except Exception as exc:
        logger.exception("Failed to suspend contract %s: %s", contract_id, exc)
        return _json_error("Unexpected error while suspending contract.", 500)


@require_http_methods(["POST", "PATCH"])
def terminate_contract_api(request, contract_id: int):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    permission_error = _ensure_permission(
        user,
        (
            "contracts.change_contract",
            "contracts.terminate_contract",
            "contracts.manage_contracts",
            "change_contract",
            "terminate_contract",
            "manage_contracts",
        ),
    )
    if permission_error:
        return permission_error

    try:
        contract = _get_contract(contract_id)
        contract = _set_contract_status(contract, ContractStatus.TERMINATED)

        return JsonResponse(
            {
                "ok": True,
                "message": "Contract terminated successfully.",
                "data": serialize_contract(contract),
            },
            status=200,
        )
    except ValidationError as exc:
        return _json_error(
            "Validation failed while terminating contract.",
            400,
            errors=_validation_errors(exc),
        )
    except Exception as exc:
        logger.exception("Failed to terminate contract %s: %s", contract_id, exc)
        return _json_error("Unexpected error while terminating contract.", 500)


@require_http_methods(["POST", "PATCH"])
def expire_contract_api(request, contract_id: int):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    permission_error = _ensure_permission(
        user,
        (
            "contracts.change_contract",
            "contracts.expire_contract",
            "contracts.manage_contracts",
            "change_contract",
            "expire_contract",
            "manage_contracts",
        ),
    )
    if permission_error:
        return permission_error

    try:
        contract = _get_contract(contract_id)
        contract = _set_contract_status(contract, ContractStatus.EXPIRED)

        return JsonResponse(
            {
                "ok": True,
                "message": "Contract expired successfully.",
                "data": serialize_contract(contract),
            },
            status=200,
        )
    except ValidationError as exc:
        return _json_error(
            "Validation failed while expiring contract.",
            400,
            errors=_validation_errors(exc),
        )
    except Exception as exc:
        logger.exception("Failed to expire contract %s: %s", contract_id, exc)
        return _json_error("Unexpected error while expiring contract.", 500)