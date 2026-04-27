# ===============================================================
# 📂 الملف: api/auth/change_password.py
# 🧭 Primey Care — Auth Change Password API
# ---------------------------------------------------------------
# ✅ Authenticated password change
# ✅ Validates current password
# ✅ Keeps current session alive safely
# ✅ Updates ActiveUserSession version
# ===============================================================

from __future__ import annotations

import json

from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

from auth_center.models import ActiveUserSession


def _json_body(request) -> dict:
    try:
        if not request.body:
            return {}
        return json.loads(request.body.decode("utf-8"))
    except Exception:
        return {}


def _clean_text(value: str | None) -> str:
    return (value or "").strip()


@login_required
@require_POST
@csrf_protect
def change_password_api(request):
    payload = _json_body(request)

    current_password = _clean_text(payload.get("current_password"))
    new_password = _clean_text(payload.get("new_password"))
    confirm_password = _clean_text(payload.get("confirm_password"))

    errors = {}

    if not current_password:
        errors["current_password"] = "Current password is required."

    if not new_password:
        errors["new_password"] = "New password is required."
    elif len(new_password) < 8:
        errors["new_password"] = "New password must be at least 8 characters."

    if not confirm_password:
        errors["confirm_password"] = "Confirm password is required."
    elif new_password != confirm_password:
        errors["confirm_password"] = "Passwords do not match."

    if errors:
        return JsonResponse(
            {
                "success": False,
                "message": "Validation error.",
                "errors": errors,
            },
            status=400,
        )

    user = request.user

    if not user.check_password(current_password):
        return JsonResponse(
            {
                "success": False,
                "message": "Current password is incorrect.",
            },
            status=400,
        )

    if current_password == new_password:
        return JsonResponse(
            {
                "success": False,
                "message": "New password must be different from the current password.",
            },
            status=400,
        )

    with transaction.atomic():
        user.set_password(new_password)
        user.save(update_fields=["password"])

        update_session_auth_hash(request, user)

        session_key = request.session.session_key
        if session_key:
            session = ActiveUserSession.objects.filter(
                session_key=session_key,
                user=user,
                is_active=True,
            ).first()
            if session:
                session.session_version += 1
                session.save(update_fields=["session_version", "last_seen"])
                request.session["session_version"] = session.session_version
                request.session.modified = True

    return JsonResponse(
        {
            "success": True,
            "message": "Password changed successfully.",
        },
        status=200,
    )