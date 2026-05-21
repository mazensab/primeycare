# ===============================================================
# 📂 الملف: api/users/reset_password.py
# 🧭 Primey Care — User Reset Password API
# 🚀 الإصدار: Users Reset Password API V1.0
# ---------------------------------------------------------------
# ✅ Resets user password using uid + token
# ✅ Compatible with api/users/send_password_link.py
# ✅ Public endpoint: لا يحتاج login_required
# ✅ Supports frontend aliases:
#    - uid / uidb64
#    - password / new_password
#    - password_confirm / confirm_password
# ✅ Validates Django password reset token
# ✅ Optional activate_user=true
# ✅ Returns safe user/profile payload
# ===============================================================

from __future__ import annotations

import json
from typing import Any

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.http import HttpRequest, JsonResponse
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

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


def _decode_uid(uidb64: str) -> int | None:
    try:
        decoded = force_str(urlsafe_base64_decode(uidb64))
        return int(decoded)
    except Exception:
        return None


def _get_user_from_uid(uidb64: str):
    user_id = _decode_uid(uidb64)

    if not user_id:
        return None

    return (
        User.objects
        .filter(pk=user_id)
        .select_related("profile")
        .first()
    )


def _validation_errors(exc: ValidationError) -> dict[str, Any]:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return {"password": exc.messages}

    return {"password": [str(exc)]}


def _validate_password_strength(password: str, user: Any | None = None) -> None:
    if not password:
        raise ValidationError({"password": ["كلمة المرور مطلوبة."]})

    if len(password) < 8:
        raise ValidationError({"password": ["كلمة المرور يجب ألا تقل عن 8 أحرف."]})

    if password.isdigit():
        raise ValidationError({"password": ["كلمة المرور لا يمكن أن تكون أرقامًا فقط."]})

    validate_password(password, user=user)


def _serialize_profile(profile: Any | None) -> dict[str, Any] | None:
    if not profile:
        return None

    extra_data = getattr(profile, "extra_data", {})
    if not isinstance(extra_data, dict):
        extra_data = {}

    tags = getattr(profile, "tags", [])
    if not isinstance(tags, list):
        tags = []

    return {
        "display_name": getattr(profile, "display_name", "") or "",
        "user_type": getattr(profile, "user_type", "") or "",
        "role": getattr(profile, "role", "") or "",
        "phone_number": getattr(profile, "phone_number", None),
        "whatsapp_number": getattr(profile, "whatsapp_number", None),
        "alternate_email": getattr(profile, "alternate_email", None),
        "preferred_language": getattr(profile, "preferred_language", "ar") or "ar",
        "timezone": getattr(profile, "timezone", "Asia/Riyadh") or "Asia/Riyadh",
        "is_phone_verified": bool(getattr(profile, "is_phone_verified", False)),
        "is_whatsapp_verified": bool(getattr(profile, "is_whatsapp_verified", False)),
        "is_email_verified": bool(getattr(profile, "is_email_verified", False)),
        "is_profile_completed": bool(getattr(profile, "is_profile_completed", False)),
        "extra_data": extra_data,
        "tags": tags,
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


def _read_reset_payload(payload: dict[str, Any]) -> dict[str, Any]:
    uidb64 = _clean_text(
        payload.get("uid")
        or payload.get("uidb64")
        or payload.get("user")
    )

    token = _clean_text(payload.get("token"))

    password = _clean_text(
        payload.get("password")
        or payload.get("new_password")
        or payload.get("newPassword")
    )

    password_confirm = _clean_text(
        payload.get("password_confirm")
        or payload.get("confirm_password")
        or payload.get("confirmPassword")
        or payload.get("password_confirmation")
    )

    activate_user = _bool_from_payload(
        payload.get("activate_user")
        or payload.get("activate")
        or payload.get("is_active"),
        default=True,
    )

    return {
        "uidb64": uidb64,
        "token": token,
        "password": password,
        "password_confirm": password_confirm,
        "activate_user": activate_user,
    }


# ===============================================================
# API
# ===============================================================

@require_POST
@csrf_protect
def users_reset_password_api(request: HttpRequest) -> JsonResponse:
    payload = _json_body(request)
    reset_payload = _read_reset_payload(payload)

    uidb64 = reset_payload["uidb64"]
    token = reset_payload["token"]
    password = reset_payload["password"]
    password_confirm = reset_payload["password_confirm"]
    activate_user = reset_payload["activate_user"]

    errors: dict[str, Any] = {}

    if not uidb64:
        errors["uid"] = ["رابط إعادة تعيين كلمة المرور غير مكتمل."]

    if not token:
        errors["token"] = ["رمز إعادة تعيين كلمة المرور غير موجود."]

    if not password:
        errors["password"] = ["كلمة المرور الجديدة مطلوبة."]

    if password_confirm and password != password_confirm:
        errors["password_confirm"] = ["تأكيد كلمة المرور غير مطابق."]

    if errors:
        return _json_error(
            "بيانات إعادة تعيين كلمة المرور غير مكتملة.",
            status=400,
            errors=errors,
        )

    user = _get_user_from_uid(uidb64)

    if not user:
        return _json_error(
            "رابط إعادة تعيين كلمة المرور غير صالح.",
            status=400,
            errors={"uid": ["المستخدم غير موجود أو الرابط غير صحيح."]},
        )

    if not default_token_generator.check_token(user, token):
        return _json_error(
            "رابط إعادة تعيين كلمة المرور منتهي أو غير صالح.",
            status=400,
            errors={"token": ["Invalid or expired password reset token."]},
        )

    try:
        _validate_password_strength(password, user=user)

    except ValidationError as exc:
        return _json_error(
            "كلمة المرور غير صالحة.",
            status=400,
            errors=_validation_errors(exc),
        )

    user.set_password(password)

    update_fields = ["password"]

    if activate_user and not user.is_active:
        user.is_active = True
        update_fields.append("is_active")

    user.save(update_fields=update_fields)

    user = (
        User.objects
        .filter(pk=user.pk)
        .select_related("profile")
        .first()
    )

    serialized_user = _serialize_user(user)

    return _json_success(
        {
            "message": "تم تعيين كلمة المرور بنجاح.",
            "user": serialized_user,
            "item": serialized_user,
            "data": {
                "user": serialized_user,
                "password_reset": {
                    "completed": True,
                    "activated_user": activate_user,
                },
            },
            "password_reset": {
                "completed": True,
                "activated_user": activate_user,
            },
            "redirect_to": "/login",
        },
        status=200,
    )