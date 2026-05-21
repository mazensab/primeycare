# ===============================================================
# 📂 الملف: api/users/send_password_link.py
# 🧭 Primey Care — User Password Link API
# 🚀 الإصدار: Users Password Link API V1.2
# ---------------------------------------------------------------
# ✅ Generates password reset link for a user
# ✅ Does not send notification yet
# ✅ Ready for notification_center integration later
# ✅ Protected by permissions: users.edit
# ✅ No localhost fallback
# ✅ Compatible with Users management page:
#    - إرسال رابط كلمة مرور
#    - إدارة حساب الدخول فقط
# ===============================================================

from __future__ import annotations

import json
from typing import Any
from urllib.parse import quote, urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.contrib.auth.tokens import default_token_generator
from django.http import HttpRequest, JsonResponse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

from auth_center.permissions import PermissionCodes, permission_required

User = get_user_model()


# ===============================================================
# Helpers
# ===============================================================

def _json_body(request: HttpRequest) -> dict[str, Any]:
    try:
        if not request.body:
            return {}

        payload = json.loads(request.body.decode("utf-8"))
        return payload if isinstance(payload, dict) else {}

    except Exception:
        return {}


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _bool_from_payload(value: Any, default: bool = False) -> bool:
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    normalized = str(value).strip().lower()

    if normalized in {"1", "true", "yes", "y", "on", "نعم", "صح"}:
        return True

    if normalized in {"0", "false", "no", "n", "off", "لا", "خطأ"}:
        return False

    return default


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


def _json_success(data: dict[str, Any], *, status: int = 200) -> JsonResponse:
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


def _get_request_origin(request: HttpRequest) -> str:
    origin = _clean_text(request.headers.get("Origin"))
    if origin:
        return origin.rstrip("/")

    referer = _clean_text(request.headers.get("Referer"))
    if referer:
        # نحتاج فقط scheme + host.
        try:
            from urllib.parse import urlsplit

            parsed = urlsplit(referer)
            if parsed.scheme and parsed.netloc:
                return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
        except Exception:
            pass

    scheme = "https" if request.is_secure() else "http"
    host = _clean_text(request.get_host())

    if host:
        return f"{scheme}://{host}".rstrip("/")

    return ""


def _resolve_frontend_base_url(request: HttpRequest, payload: dict[str, Any]) -> str:
    frontend_base_url = (
        _clean_text(payload.get("frontend_base_url"))
        or _clean_text(payload.get("base_url"))
        or _clean_text(getattr(settings, "FRONTEND_BASE_URL", ""))
        or _clean_text(getattr(settings, "NEXT_PUBLIC_APP_URL", ""))
        or _clean_text(getattr(settings, "PUBLIC_FRONTEND_URL", ""))
        or _get_request_origin(request)
    ).rstrip("/")

    # لا نستخدم localhost كقيمة افتراضية حتى لا يظهر في بيئة الإنتاج.
    # لو لم تتوفر أي قيمة، نرجع مسار نسبي فقط.
    if not frontend_base_url:
        return ""

    return frontend_base_url


def _resolve_reset_path(payload: dict[str, Any]) -> str:
    reset_path = (
        _clean_text(payload.get("reset_path"))
        or _clean_text(payload.get("password_reset_path"))
        or "/reset-password"
    )

    if not reset_path.startswith("/"):
        reset_path = f"/{reset_path}"

    return reset_path


def _build_reset_url(
    *,
    frontend_base_url: str,
    reset_path: str,
    uidb64: str,
    token: str,
    next_path: str = "",
) -> tuple[str, str]:
    query_params: dict[str, str] = {
        "uid": uidb64,
        "token": token,
    }

    if next_path:
        query_params["next"] = next_path

    query = urlencode(query_params, quote_via=quote)

    final_reset_path = f"{reset_path}?{query}"
    reset_url = f"{frontend_base_url}{final_reset_path}" if frontend_base_url else final_reset_path

    return final_reset_path, reset_url


def _serialize_profile(profile: Any | None) -> dict[str, Any] | None:
    if not profile:
        return None

    return {
        "display_name": getattr(profile, "display_name", "") or "",
        "user_type": getattr(profile, "user_type", "") or "",
        "role": getattr(profile, "role", "") or "",
        "phone_number": getattr(profile, "phone_number", None),
        "whatsapp_number": getattr(profile, "whatsapp_number", None),
        "alternate_email": getattr(profile, "alternate_email", None),
        "preferred_language": getattr(profile, "preferred_language", "ar") or "ar",
        "timezone": getattr(profile, "timezone", "Asia/Riyadh") or "Asia/Riyadh",
        "extra_data": (
            getattr(profile, "extra_data", {})
            if isinstance(getattr(profile, "extra_data", {}), dict)
            else {}
        ),
    }


def _serialize_user(user: Any) -> dict[str, Any]:
    profile = getattr(user, "profile", None)

    full_name = ""
    try:
        full_name = (user.get_full_name() or "").strip()
    except Exception:
        full_name = ""

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email or "",
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "full_name": full_name,
        "is_active": user.is_active,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "date_joined": user.date_joined.isoformat() if user.date_joined else None,
        "profile": _serialize_profile(profile),
    }


# ===============================================================
# API
# ===============================================================

@login_required
@require_POST
@csrf_protect
@permission_required(PermissionCodes.USERS_EDIT)
def users_send_password_link_api(request: HttpRequest, user_id: int):
    user = (
        User.objects
        .filter(id=user_id)
        .select_related("profile")
        .first()
    )

    if not user:
        return _json_error(
            "User not found.",
            status=404,
            errors={"user_id": ["لم يتم العثور على المستخدم."]},
        )

    if not user.is_active:
        return _json_error(
            "Cannot generate password link for inactive user.",
            status=400,
            errors={"is_active": ["لا يمكن إنشاء رابط كلمة مرور لمستخدم غير نشط."]},
        )

    payload = _json_body(request)

    frontend_base_url = _resolve_frontend_base_url(request, payload)
    reset_path = _resolve_reset_path(payload)
    next_path = _clean_text(payload.get("next") or payload.get("next_path"))

    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)

    final_reset_path, reset_url = _build_reset_url(
        frontend_base_url=frontend_base_url,
        reset_path=reset_path,
        uidb64=uidb64,
        token=token,
        next_path=next_path,
    )

    user_payload = _serialize_user(user)

    notification_payload = {
        "sent": False,
        "channel": None,
        "reason": "notification_center integration is pending.",
    }

    # تجهيز اختياري للمستقبل بدون إرسال فعلي الآن.
    # لو أرسل الفرونت preview_message=true نرجع نص مقترح فقط للعرض/النسخ.
    preview_message = None
    if _bool_from_payload(payload.get("preview_message"), default=False):
        display_name = (
            (user_payload.get("profile") or {}).get("display_name")
            or user_payload.get("full_name")
            or user_payload.get("username")
            or "Primey Care User"
        )

        preview_message = {
            "title": "رابط تعيين كلمة المرور",
            "body": (
                f"مرحبًا {display_name}،\n"
                "تم إنشاء رابط لتعيين كلمة المرور الخاصة بحسابك في Primey Care.\n"
                f"{reset_url}\n"
                "إذا لم تطلب هذا الرابط، يمكنك تجاهل هذه الرسالة."
            ),
        }

    response_payload: dict[str, Any] = {
        "message": (
            "Password reset link generated successfully. "
            "Notification sending will be connected later."
        ),
        "user": user_payload,
        "item": user_payload,
        "data": {
            "user": user_payload,
            "reset": {
                "uid": uidb64,
                "token": token,
                "reset_path": final_reset_path,
                "reset_url": reset_url,
                "frontend_base_url": frontend_base_url,
            },
            "notification": notification_payload,
        },
        "reset": {
            "uid": uidb64,
            "token": token,
            "reset_path": final_reset_path,
            "reset_url": reset_url,
            "frontend_base_url": frontend_base_url,
        },
        "notification": notification_payload,
    }

    if preview_message:
        response_payload["preview_message"] = preview_message
        response_payload["data"]["preview_message"] = preview_message

    return _json_success(response_payload, status=200)