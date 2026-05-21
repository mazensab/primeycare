# ===============================================================
# 📂 الملف: api/auth/change_password.py
# 🧭 Primey Care — Auth Change Password API
# 🚀 الإصدار: Primey Care Change Password API V2.0
# ---------------------------------------------------------------
# ✅ Authenticated password change
# ✅ Validates current password
# ✅ Uses Django password validators
# ✅ Keeps current session alive safely
# ✅ Updates ActiveUserSession version safely
# ✅ Returns normalized frontend payload
# ===============================================================

from __future__ import annotations

import json
import logging
from typing import Any

from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.decorators import login_required
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

from auth_center.models import ActiveUserSession

logger = logging.getLogger(__name__)


# ===============================================================
# 🔧 JSON Helpers
# ===============================================================

def _json_body(request) -> dict[str, Any]:
    try:
        if not request.body:
            return {}

        parsed = json.loads(request.body.decode("utf-8"))

        return parsed if isinstance(parsed, dict) else {}

    except Exception:
        return {}


def _json_error(
    message: str,
    *,
    status: int = 400,
    errors: dict[str, Any] | None = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": False,
        "success": False,
        "message": message,
    }

    if errors:
        payload["errors"] = errors

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _json_success(
    data: dict[str, Any],
    *,
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


# ===============================================================
# 🧰 Safe Helpers
# ===============================================================

def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _serialize_validation_error(exc: ValidationError) -> list[str]:
    if hasattr(exc, "messages"):
        return [str(item) for item in exc.messages]

    return [str(exc)]


def _active_session_payload(session: ActiveUserSession | None) -> dict[str, Any] | None:
    if not session:
        return None

    return {
        "key": getattr(session, "session_key", None),
        "version": getattr(session, "session_version", None),
        "auth_channel": getattr(session, "auth_channel", None),
        "is_current": bool(getattr(session, "is_current", False)),
        "is_active": bool(getattr(session, "is_active", False)),
        "ip_address": getattr(session, "ip_address", None),
        "last_seen": _iso_datetime(getattr(session, "last_seen", None)),
        "created_at": _iso_datetime(getattr(session, "created_at", None)),
    }


def _touch_password_session(request, user) -> ActiveUserSession | None:
    """
    بعد تغيير كلمة المرور:
    - نزيد session_version للجلسة الحالية.
    - نحافظ على الجلسة الحالية عبر update_session_auth_hash.
    - نحدث last_seen فقط إذا كان الحقل موجودًا.
    """

    session_key = request.session.session_key

    if not session_key:
        return None

    active_session = (
        ActiveUserSession.objects
        .filter(
            session_key=session_key,
            user=user,
            is_active=True,
        )
        .first()
    )

    if not active_session:
        return None

    update_fields: list[str] = []

    try:
        active_session.session_version = int(active_session.session_version or 1) + 1
    except Exception:
        active_session.session_version = 2

    update_fields.append("session_version")

    if hasattr(active_session, "is_current"):
        active_session.is_current = True
        update_fields.append("is_current")

    if hasattr(active_session, "last_seen"):
        active_session.last_seen = timezone.now()
        update_fields.append("last_seen")

    active_session.save(update_fields=sorted(set(update_fields)))

    request.session["session_version"] = active_session.session_version
    request.session.modified = True

    return active_session


# ===============================================================
# 🚀 API
# ===============================================================

@login_required
@require_POST
@csrf_protect
def change_password_api(request):
    payload = _json_body(request)

    current_password = _clean_text(payload.get("current_password"))
    new_password = _clean_text(payload.get("new_password"))
    confirm_password = _clean_text(payload.get("confirm_password"))

    errors: dict[str, Any] = {}

    if not current_password:
        errors["current_password"] = "Current password is required."

    if not new_password:
        errors["new_password"] = "New password is required."

    if not confirm_password:
        errors["confirm_password"] = "Confirm password is required."

    if new_password and confirm_password and new_password != confirm_password:
        errors["confirm_password"] = "Passwords do not match."

    if errors:
        return _json_error(
            "Validation error.",
            status=400,
            errors=errors,
        )

    user = request.user

    if not user.check_password(current_password):
        return _json_error(
            "Current password is incorrect.",
            status=400,
            errors={
                "current_password": "Current password is incorrect.",
            },
        )

    if current_password == new_password:
        return _json_error(
            "New password must be different from the current password.",
            status=400,
            errors={
                "new_password": "New password must be different from the current password.",
            },
        )

    try:
        validate_password(new_password, user=user)
    except ValidationError as exc:
        return _json_error(
            "Password does not meet security requirements.",
            status=400,
            errors={
                "new_password": _serialize_validation_error(exc),
            },
        )

    try:
        with transaction.atomic():
            user.set_password(new_password)
            user.save(update_fields=["password"])

            update_session_auth_hash(request, user)

            active_session = _touch_password_session(request, user)

    except Exception as exc:
        logger.exception("Failed to change password for user %s: %s", user.pk, exc)

        return _json_error(
            "Unable to change password.",
            status=500,
        )

    session_payload = _active_session_payload(active_session)

    response_payload = {
        "message": "Password changed successfully.",
        "authenticated": True,
        "workspace": None,
        "dashboard_path": None,
        "redirect_to": None,
        "session": session_payload,
        "data": {
            "authenticated": True,
            "session": session_payload,
        },
    }

    return _json_success(
        response_payload,
        status=200,
    )