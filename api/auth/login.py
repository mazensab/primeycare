# ===============================================================
# 📂 الملف: api/auth/login.py
# 🧭 Primey Care — Auth Login API
# ---------------------------------------------------------------
# ✅ Session-based login
# ✅ Supports username or email
# ✅ Creates / updates ActiveUserSession
# ✅ CSRF protected
# ===============================================================

from __future__ import annotations

import json
import logging

from django.contrib.auth import authenticate, get_user_model, login
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

from auth_center.models import ActiveUserSession

logger = logging.getLogger(__name__)
User = get_user_model()


def _json_body(request) -> dict:
    try:
        if not request.body:
            return {}
        return json.loads(request.body.decode("utf-8"))
    except Exception:
        return {}


def _clean_text(value: str | None) -> str:
    return (value or "").strip()


def _get_client_ip(request) -> str | None:
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip() or None
    return request.META.get("REMOTE_ADDR")


def _resolve_username_from_identifier(identifier: str) -> str:
    """
    يدعم تسجيل الدخول عبر:
    - username
    - email
    """
    if "@" not in identifier:
        return identifier

    user = User.objects.filter(email__iexact=identifier).only("username").first()
    return user.username if user else identifier


@require_POST
@csrf_protect
def login_api(request):
    payload = _json_body(request)

    identifier = _clean_text(payload.get("identifier") or payload.get("username"))
    password = _clean_text(payload.get("password"))

    errors = {}

    if not identifier:
        errors["identifier"] = "Username or email is required."

    if not password:
        errors["password"] = "Password is required."

    if errors:
        return JsonResponse(
            {
                "success": False,
                "message": "Validation error.",
                "errors": errors,
            },
            status=400,
        )

    username = _resolve_username_from_identifier(identifier)

    user = authenticate(
        request=request,
        username=username,
        password=password,
    )

    if not user:
        return JsonResponse(
            {
                "success": False,
                "message": "Invalid credentials.",
            },
            status=401,
        )

    if not user.is_active:
        return JsonResponse(
            {
                "success": False,
                "message": "This account is inactive.",
            },
            status=403,
        )

    login(request, user)

    if not request.session.session_key:
        request.session.save()

    session_key = request.session.session_key or ""
    ip_address = _get_client_ip(request)
    user_agent = request.META.get("HTTP_USER_AGENT", "")

    with transaction.atomic():
        ActiveUserSession.objects.filter(
            user=user,
            is_current=True,
        ).exclude(session_key=session_key).update(is_current=False)

        active_session, created = ActiveUserSession.objects.get_or_create(
            session_key=session_key,
            defaults={
                "user": user,
                "session_version": 1,
                "auth_channel": ActiveUserSession.AuthChannel.WEB,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "is_current": True,
                "is_active": True,
            },
        )

        if not created:
            active_session.user = user
            active_session.auth_channel = ActiveUserSession.AuthChannel.WEB
            active_session.ip_address = ip_address
            active_session.user_agent = user_agent
            active_session.is_current = True
            active_session.is_active = True
            active_session.save(
                update_fields=[
                    "user",
                    "auth_channel",
                    "ip_address",
                    "user_agent",
                    "is_current",
                    "is_active",
                    "last_seen",
                ]
            )

        request.session["session_version"] = active_session.session_version
        request.session.modified = True

    full_name = (user.get_full_name() or "").strip()

    return JsonResponse(
        {
            "success": True,
            "message": "Login successful.",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email or "",
                "full_name": full_name,
                "is_superuser": user.is_superuser,
                "is_staff": user.is_staff,
            },
            "session": {
                "key": session_key,
                "version": request.session.get("session_version", 1),
            },
        },
        status=200,
    )