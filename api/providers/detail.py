# ============================================================
# 📂 api/providers/detail.py
# 🧠 Primey Care | Providers API Detail/Update/Safe Disable V3
# ------------------------------------------------------------
# ✅ Provider detail
# ✅ Provider update
# ✅ Safe disable instead of destructive delete
# ✅ Compatible with imported medical network records
# ✅ Returns Arabic/English names, CR, tax number, Drive fields
# ✅ Returns provider documents for detail/report pages
# ✅ Returns Provider.user login account relation
# ✅ Does not edit Provider.user from PATCH
# ✅ Protected by permissions:
#    - providers.view
#    - providers.edit
#    - providers.disable / providers.delete
# ============================================================

from __future__ import annotations

import json
import logging
from typing import Any

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods

from auth_center.permissions import PermissionCodes, has_permission
from providers.models import Provider, ProviderStatus
from providers.services import (
    parse_json_body,
    serialize_provider,
    update_provider,
)

logger = logging.getLogger(__name__)


# ============================================================
# 🔹 Permission Helpers
# ============================================================

def _permission_code(name: str, fallback: str) -> str:
    return str(getattr(PermissionCodes, name, fallback))


PERMISSION_PROVIDERS_VIEW = _permission_code("PROVIDERS_VIEW", "providers.view")
PERMISSION_PROVIDERS_EDIT = _permission_code("PROVIDERS_EDIT", "providers.edit")
PERMISSION_PROVIDERS_DISABLE = _permission_code("PROVIDERS_DISABLE", "providers.disable")
PERMISSION_PROVIDERS_DELETE = _permission_code("PROVIDERS_DELETE", "providers.delete")


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


def _has_any_required_permission(user: Any, permission_codes: tuple[str, ...]) -> bool:
    return any(_has_required_permission(user, code) for code in permission_codes)


def _required_permission_for_method(method: str) -> tuple[str, ...]:
    if method == "GET":
        return (PERMISSION_PROVIDERS_VIEW,)

    if method == "PATCH":
        return (PERMISSION_PROVIDERS_EDIT,)

    if method == "DELETE":
        return (
            PERMISSION_PROVIDERS_DISABLE,
            PERMISSION_PROVIDERS_DELETE,
        )

    return (PERMISSION_PROVIDERS_VIEW,)


# ============================================================
# 🔹 Response Helpers
# ============================================================

def _json_error(
    message: str,
    status: int = 400,
    *,
    errors: Any = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
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


def _json_success(
    data: dict[str, Any],
    status: int = 200,
) -> JsonResponse:
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


def _forbidden(required_permissions: tuple[str, ...]) -> JsonResponse:
    return _json_error(
        "غير مصرح لك بتنفيذ هذا الإجراء.",
        status=403,
        errors={
            "required_permissions": list(required_permissions),
        },
    )


# ============================================================
# 🔹 Safe Helpers
# ============================================================

def _ensure_authenticated(request):
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return None, _json_error("Authentication required.", 401)

    return request.user, None


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


def _serialize_user_profile(user: Any | None) -> dict[str, Any] | None:
    if not user:
        return None

    profile = getattr(user, "profile", None)
    if not profile:
        return None

    return {
        "id": getattr(profile, "pk", None),
        "display_name": getattr(profile, "display_name", "") or "",
        "user_type": getattr(profile, "user_type", "") or "",
        "role": getattr(profile, "role", "") or "",
        "phone_number": getattr(profile, "phone_number", "") or "",
        "whatsapp_number": getattr(profile, "whatsapp_number", "") or "",
        "alternate_email": getattr(profile, "alternate_email", "") or "",
        "preferred_language": getattr(profile, "preferred_language", "") or "",
        "timezone": getattr(profile, "timezone", "") or "",
        "extra_data": getattr(profile, "extra_data", {}) or {},
        "tags": getattr(profile, "tags", []) or [],
    }


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
        "profile": _serialize_user_profile(user),
    }


def _safe_parse_body_for_ignored_fields(request) -> dict[str, Any]:
    try:
        if not request.body:
            return {}

        payload = json.loads(request.body.decode("utf-8"))

        return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}


def _serialize_validation_errors(exc: ValidationError) -> Any:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return exc.messages

    return str(exc)


def _provider_account_fields() -> set[str]:
    """
    Provider detail PATCH must not create/update login accounts.

    Login account creation is handled from provider create flow through:
    - api/providers/list.py POST
    - create_login_user / login_* fields
    - auth_center.services.create_actor_user
    """

    return {
        "user",
        "user_id",
        "login_user",
        "has_login_user",
        "create_login_user",
        "create_user",
        "create_account",
        "login_username",
        "username",
        "login_email",
        "user_email",
        "login_password",
        "password",
        "login_display_name",
        "login_phone",
        "login_phone_number",
        "login_whatsapp",
        "login_whatsapp_number",
    }


# ============================================================
# 🔹 Provider Query / Serialization
# ============================================================

def _provider_queryset_base():
    """
    Load provider with related documents and optional user relation.

    Notes:
    - Prefetching documents keeps the detail/report page efficient.
    - select_related("user", "user__profile") is applied only if Provider.user exists.
    - The provider serializer decides whether to include documents or not.
    """

    queryset = Provider.objects.prefetch_related(
        "documents",
        "documents__uploaded_by",
    )

    if _model_has_field("user"):
        try:
            queryset = queryset.select_related("user", "user__profile")
        except Exception:
            try:
                queryset = queryset.select_related("user")
            except Exception:
                pass

    return queryset


def _get_provider_or_404(provider_id: int) -> Provider:
    return get_object_or_404(_provider_queryset_base(), pk=provider_id)


def _serialize_provider_detail(provider: Provider) -> dict[str, Any]:
    data = serialize_provider(provider, include_documents=True)

    user = getattr(provider, "user", None)

    data["user_id"] = getattr(provider, "user_id", None)
    data["has_login_user"] = bool(getattr(provider, "user_id", None))
    data["login_user"] = _serialize_login_user(user)

    return data


def _provider_response(
    *,
    provider: Provider,
    message: str,
    status: int = 200,
    extra: dict[str, Any] | None = None,
) -> JsonResponse:
    provider_payload = _serialize_provider_detail(provider)

    response_data: dict[str, Any] = {
        "message": message,
        "provider": provider_payload,
        "item": provider_payload,
        "data": {
            "provider": provider_payload,
        },
    }

    if extra:
        response_data.update(extra)
        response_data["data"].update(extra)

    return _json_success(response_data, status=status)


# ============================================================
# 🔹 Provider Detail API
# ============================================================

@csrf_protect
@require_http_methods(["GET", "PATCH", "DELETE"])
def provider_detail_api(request, provider_id: int):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    required_permissions = _required_permission_for_method(request.method)
    if not _has_any_required_permission(user, required_permissions):
        return _forbidden(required_permissions)

    provider = _get_provider_or_404(provider_id)

    if request.method == "GET":
        return _provider_response(
            provider=provider,
            message="Provider loaded successfully.",
            status=200,
        )

    if request.method == "PATCH":
        try:
            raw_payload = _safe_parse_body_for_ignored_fields(request)
            account_fields = _provider_account_fields()

            ignored_account_fields = sorted(
                key
                for key in raw_payload.keys()
                if key in account_fields
            )

            payload = parse_json_body(request)

            for blocked_field in ignored_account_fields:
                payload.pop(blocked_field, None)

            provider = update_provider(instance=provider, payload=payload)

            provider = _get_provider_or_404(provider.id)

            extra: dict[str, Any] = {}
            if ignored_account_fields:
                extra["ignored_account_fields"] = ignored_account_fields

            return _provider_response(
                provider=provider,
                message="Provider updated successfully.",
                status=200,
                extra=extra,
            )

        except ValidationError as exc:
            return _json_error(
                "Validation failed while updating provider.",
                400,
                errors=_serialize_validation_errors(exc),
            )

        except Exception as exc:
            logger.exception("Failed to update provider %s: %s", provider_id, exc)
            return _json_error("Unexpected error while updating provider.", 500)

    # ========================================================
    # 🔹 Safe Disable Instead of Hard Delete
    # ========================================================
    # Important:
    # - Providers may be linked to contracts, orders, invoices,
    #   payments, imported medical network rows, documents,
    #   Drive folders, or reports.
    # - Hard delete can break operational history.
    # - DELETE keeps the API route compatible, but performs a
    #   safe status change to INACTIVE.
    # ========================================================

    if provider.status == ProviderStatus.INACTIVE:
        return _provider_response(
            provider=provider,
            message="Provider is already inactive.",
            status=200,
        )

    provider.status = ProviderStatus.INACTIVE
    provider.save(update_fields=["status", "updated_at"])

    provider = _get_provider_or_404(provider.id)

    return _provider_response(
        provider=provider,
        message="Provider disabled successfully.",
        status=200,
    )