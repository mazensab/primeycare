# ===============================================================
# 📂 الملف: api/auth/logout.py
# 🧭 Primey Care — Auth Logout API
# 🚀 الإصدار: Primey Care Logout API V2.0
# ---------------------------------------------------------------
# ✅ Session-based logout
# ✅ Deactivates current ActiveUserSession safely
# ✅ CSRF protected
# ✅ Clears session cookies
# ✅ Returns normalized frontend payload
# ===============================================================

from __future__ import annotations

import logging
from typing import Any

from django.contrib.auth import logout
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

from auth_center.models import ActiveUserSession

logger = logging.getLogger(__name__)


# ===============================================================
# 🔧 JSON Helpers
# ===============================================================

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
# 🔐 Session Helpers
# ===============================================================

def _deactivate_active_session(request) -> dict[str, Any]:
    """
    تعطيل الجلسة الحالية بشكل آمن.

    يدعم حالتين:
    - وجود method اسمها mark_logged_out داخل ActiveUserSession.
    - عدم وجودها، فنحدث الحقول يدويًا إذا كانت موجودة.
    """

    session_key = request.session.session_key
    user = getattr(request, "user", None)

    result = {
        "session_key": session_key,
        "was_authenticated": bool(
            user is not None
            and getattr(user, "is_authenticated", False)
        ),
        "session_deactivated": False,
    }

    if not result["was_authenticated"] or not session_key:
        return result

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
        return result

    try:
        if hasattr(active_session, "mark_logged_out"):
            active_session.mark_logged_out()
            result["session_deactivated"] = True
            return result

        update_fields: list[str] = []

        if hasattr(active_session, "is_active"):
            active_session.is_active = False
            update_fields.append("is_active")

        if hasattr(active_session, "is_current"):
            active_session.is_current = False
            update_fields.append("is_current")

        if hasattr(active_session, "logged_out_at"):
            active_session.logged_out_at = timezone.now()
            update_fields.append("logged_out_at")

        if hasattr(active_session, "last_seen"):
            active_session.last_seen = timezone.now()
            update_fields.append("last_seen")

        if update_fields:
            active_session.save(update_fields=sorted(set(update_fields)))
            result["session_deactivated"] = True

        return result

    except Exception as exc:
        logger.warning(
            "Failed to deactivate active session during logout | session_key=%s | error=%s",
            session_key,
            exc,
        )
        return result


# ===============================================================
# 🚀 API
# ===============================================================

@require_POST
@csrf_protect
def logout_api(request):
    session_result = _deactivate_active_session(request)

    logout(request)

    try:
        request.session.flush()
    except Exception as exc:
        logger.warning("Failed to flush session during logout | error=%s", exc)

    response_payload = {
        "message": "Logout successful.",
        "authenticated": False,
        "workspace": None,
        "dashboard_path": "/login",
        "redirect_to": "/login",
        "home_path": "/login",
        "session": session_result,
        "data": {
            "authenticated": False,
            "workspace": None,
            "dashboard_path": "/login",
            "redirect_to": "/login",
            "home_path": "/login",
            "session": session_result,
        },
    }

    response = _json_success(
        response_payload,
        status=200,
    )

    response.delete_cookie("sessionid", path="/", samesite="Lax")
    response.delete_cookie("csrftoken", path="/", samesite="Lax")

    return response