# ============================================================
# 📂 api/whatsapp/status.py
# Primey Care - System WhatsApp Status + Session APIs
# ============================================================

from __future__ import annotations

from typing import Any

from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_GET, require_POST

from whatsapp_center.models import ScopeType, SystemWhatsAppConfig
from whatsapp_center.services import (
    create_whatsapp_pairing_code_session,
    create_whatsapp_qr_session,
    disconnect_whatsapp_session,
    get_whatsapp_session_status,
)
from api.whatsapp.helpers import (
    clean_phone,
    get_model_attr,
    json_bad_request,
    json_ok,
    json_server_error,
    read_json_body,
)


# ============================================================
# 🔒 Session Constants
# ============================================================
WEB_SESSION_PROVIDER = "whatsapp_web_session"
DEFAULT_SESSION_NAME = "primey-care-system-session"
DEFAULT_SESSION_MODE = "qr"

ALLOWED_SESSION_MODES = {"qr", "pairing_code"}


# ============================================================
# 🔧 Internal Helpers
# ============================================================
def _safe_str(value: Any, default: str = "") -> str:
    if value is None:
        return default

    text = str(value).strip()
    return text or default


def _safe_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value

    if value is None:
        return default

    if isinstance(value, str):
        normalized = value.strip().lower()

        if normalized in {"1", "true", "yes", "on"}:
            return True

        if normalized in {"0", "false", "no", "off"}:
            return False

    if isinstance(value, int):
        return value == 1

    return default


def _safe_iso(value: Any) -> str | None:
    try:
        return value.isoformat() if value else None
    except Exception:
        return None


def _get_config():
    config, _ = SystemWhatsAppConfig.objects.get_or_create(
        id=1,
        defaults={
            "provider": WEB_SESSION_PROVIDER,
            "session_name": DEFAULT_SESSION_NAME,
            "session_mode": DEFAULT_SESSION_MODE,
            "is_enabled": True,
            "is_active": False,
        },
    )
    return config


def _session_name_from_body_or_config(body: dict, config) -> str:
    session_name = _safe_str(
        body.get("session_name")
        or get_model_attr(config, "session_name", "")
        or DEFAULT_SESSION_NAME,
        DEFAULT_SESSION_NAME,
    )

    return session_name or DEFAULT_SESSION_NAME


def _session_mode_from_body_or_config(body: dict, config) -> str:
    session_mode = _safe_str(
        body.get("mode")
        or body.get("session_mode")
        or get_model_attr(config, "session_mode", "")
        or DEFAULT_SESSION_MODE,
        DEFAULT_SESSION_MODE,
    )

    if session_mode not in ALLOWED_SESSION_MODES:
        return DEFAULT_SESSION_MODE

    return session_mode


def _update_config_fields_if_needed(config, **values) -> None:
    """
    تحديث الحقول الموجودة فقط داخل config
    بدون افتراض أن كل الإصدارات تحتوي نفس الأعمدة.
    """
    update_fields: list[str] = []

    for field_name, field_value in values.items():
        if not hasattr(config, field_name):
            continue

        current_value = getattr(config, field_name, None)
        if current_value == field_value:
            continue

        setattr(config, field_name, field_value)
        update_fields.append(field_name)

    if update_fields:
        config.save(update_fields=update_fields)


def _ensure_web_session_config(
    config,
    *,
    session_name: str,
    session_mode: str,
    force_enabled: bool = False,
) -> None:
    """
    توحيد الإعدادات الأساسية المطلوبة قبل استدعاء services.py.

    مهم:
    - Status العادي لا يفعّل الاتصال تلقائيًا.
    - إنشاء QR / Pairing / Disconnect يحتاج إعدادًا مفعّلًا ونشطًا.
    """
    clean_session_name = _safe_str(session_name, DEFAULT_SESSION_NAME)
    clean_session_mode = _safe_str(session_mode, DEFAULT_SESSION_MODE)

    if clean_session_mode not in ALLOWED_SESSION_MODES:
        clean_session_mode = DEFAULT_SESSION_MODE

    values = {
        "provider": WEB_SESSION_PROVIDER,
        "session_name": clean_session_name,
        "session_mode": clean_session_mode,
    }

    if force_enabled:
        values["is_enabled"] = True
        values["is_active"] = True

    _update_config_fields_if_needed(config, **values)


def _extract_error_message(session_data: dict, default_message: str) -> str:
    details = session_data.get("details")

    if isinstance(details, dict):
        details_message = (
            details.get("message")
            or details.get("error")
            or details.get("detail")
        )
    else:
        details_message = details

    return _safe_str(
        session_data.get("error_message")
        or session_data.get("message")
        or details_message
        or default_message,
        default_message,
    )


def _build_base_payload(config) -> dict:
    return {
        "configured": True,
        "is_enabled": _safe_bool(get_model_attr(config, "is_enabled", False), False),
        "is_active": _safe_bool(get_model_attr(config, "is_active", False), False),
        "provider": _safe_str(
            get_model_attr(config, "provider", WEB_SESSION_PROVIDER),
            WEB_SESSION_PROVIDER,
        ),
        "phone_number_id": _safe_str(get_model_attr(config, "phone_number_id", "")) or None,
        "last_check_at": _safe_iso(get_model_attr(config, "last_health_check_at", None)),
        "last_error_message": _safe_str(get_model_attr(config, "last_error_message", "")),
        "webhook_verified": _safe_bool(
            get_model_attr(config, "webhook_verified", False),
            False,
        ),
        "session_name": _safe_str(
            get_model_attr(config, "session_name", DEFAULT_SESSION_NAME),
            DEFAULT_SESSION_NAME,
        ),
        "session_mode": _safe_str(
            get_model_attr(config, "session_mode", DEFAULT_SESSION_MODE),
            DEFAULT_SESSION_MODE,
        ),
        "session_status": _safe_str(
            get_model_attr(config, "session_status", "disconnected"),
            "disconnected",
        ),
        "connected": False,
        "qr_code": _safe_str(get_model_attr(config, "session_qr_code", "")) or None,
        "pairing_code": _safe_str(get_model_attr(config, "session_pairing_code", "")) or None,
        "connected_phone": _safe_str(
            get_model_attr(config, "session_connected_phone", ""),
        ) or None,
        "last_connected_at": _safe_iso(
            get_model_attr(config, "session_last_connected_at", None),
        ),
        "device_label": _safe_str(get_model_attr(config, "session_device_label", "")) or None,
    }


def _merge_session_payload(base_payload: dict, session_data: dict) -> dict:
    payload = dict(base_payload)

    session_status = (
        session_data.get("session_status")
        or session_data.get("status")
        or payload["session_status"]
    )

    connected = bool(session_data.get("connected", False))

    payload.update(
        {
            "provider": session_data.get("provider") or payload["provider"],
            "session_name": session_data.get("session_name") or payload["session_name"],
            "connected": connected,
            "session_status": session_status,
            "qr_code": session_data.get("qr_code") or payload.get("qr_code"),
            "pairing_code": session_data.get("pairing_code") or payload.get("pairing_code"),
            "connected_phone": (
                session_data.get("connected_phone")
                or session_data.get("phone_number")
                or payload.get("connected_phone")
            ),
            "last_connected_at": (
                session_data.get("last_connected_at")
                or payload.get("last_connected_at")
            ),
            "device_label": (
                session_data.get("device_label")
                or session_data.get("device_name")
                or payload.get("device_label")
            ),
            "gateway_message": (
                session_data.get("error_message", "")
                or session_data.get("message", "")
                or ""
            ),
        }
    )

    return payload


def _build_session_action_payload(
    *,
    session_data: dict,
    session_name: str,
    session_mode: str,
    fallback_status: str,
) -> dict:
    return {
        "session_name": session_data.get("session_name") or session_name,
        "session_mode": session_data.get("session_mode") or session_mode,
        "session_status": (
            session_data.get("session_status")
            or session_data.get("status")
            or fallback_status
        ),
        "connected": bool(session_data.get("connected", False)),
        "qr_code": session_data.get("qr_code"),
        "pairing_code": session_data.get("pairing_code"),
        "connected_phone": (
            session_data.get("connected_phone")
            or session_data.get("phone_number")
        ),
        "device_label": (
            session_data.get("device_label")
            or session_data.get("device_name")
        ),
        "last_connected_at": session_data.get("last_connected_at"),
        "gateway_message": (
            session_data.get("error_message", "")
            or session_data.get("message", "")
            or ""
        ),
    }


# ============================================================
# 📡 Status API
# ============================================================
@login_required
@require_GET
def system_whatsapp_status(request):
    try:
        config = _get_config()

        _ensure_web_session_config(
            config,
            session_name=get_model_attr(config, "session_name", DEFAULT_SESSION_NAME)
            or DEFAULT_SESSION_NAME,
            session_mode=get_model_attr(config, "session_mode", DEFAULT_SESSION_MODE)
            or DEFAULT_SESSION_MODE,
            force_enabled=False,
        )

        base_payload = _build_base_payload(config)
        provider = base_payload["provider"]

        if provider != WEB_SESSION_PROVIDER:
            return json_ok(
                "System WhatsApp status loaded successfully",
                **base_payload,
            )

        if not base_payload["is_active"]:
            payload = dict(base_payload)
            payload["gateway_message"] = "WhatsApp is inactive"

            return json_ok(
                "System WhatsApp status loaded successfully",
                **payload,
            )

        if not base_payload["is_enabled"]:
            _update_config_fields_if_needed(config, is_enabled=True)
            base_payload = _build_base_payload(config)

        session_data = get_whatsapp_session_status(
            scope_type=ScopeType.SYSTEM,
        ) or {}

        payload = _merge_session_payload(base_payload, session_data)

        return json_ok(
            session_data.get("message") or "System WhatsApp status loaded successfully",
            **payload,
        )

    except Exception as exc:
        return json_server_error(
            "Failed to load system WhatsApp status",
            details=str(exc),
            session_status="failed",
            connected=False,
        )


# ============================================================
# 📲 Create QR Session
# ============================================================
@login_required
@require_POST
def system_whatsapp_session_create_qr(request):
    config = _get_config()

    try:
        body = read_json_body(request)
    except ValueError as exc:
        return json_bad_request(str(exc))

    session_name = _session_name_from_body_or_config(body, config)
    session_mode = "qr"

    _ensure_web_session_config(
        config,
        session_name=session_name,
        session_mode=session_mode,
        force_enabled=True,
    )

    try:
        session_data = create_whatsapp_qr_session(
            scope_type=ScopeType.SYSTEM,
        ) or {}
    except Exception as exc:
        return json_server_error(
            "Failed to create QR session",
            details=str(exc),
            session_name=session_name,
            session_mode=session_mode,
            session_status="failed",
            connected=False,
        )

    if not session_data.get("success"):
        return json_bad_request(
            _extract_error_message(session_data, "Failed to create QR session"),
            session_name=session_name,
            session_mode=session_mode,
            session_status=session_data.get("session_status") or "failed",
            connected=False,
            gateway_message=_extract_error_message(
                session_data,
                "Failed to create QR session",
            ),
        )

    return json_ok(
        session_data.get("message") or "QR session created successfully",
        **_build_session_action_payload(
            session_data=session_data,
            session_name=session_name,
            session_mode=session_mode,
            fallback_status="qr_pending",
        ),
    )


# ============================================================
# 🔢 Create Pairing Code Session
# ============================================================
@login_required
@require_POST
def system_whatsapp_session_create_pairing_code(request):
    config = _get_config()

    try:
        body = read_json_body(request)
    except ValueError as exc:
        return json_bad_request(str(exc))

    session_name = _session_name_from_body_or_config(body, config)
    session_mode = "pairing_code"
    phone_number = clean_phone(body.get("phone_number"))

    if not phone_number:
        return json_bad_request(
            "phone_number is required",
            session_name=session_name,
            session_mode=session_mode,
            session_status="failed",
            connected=False,
        )

    _ensure_web_session_config(
        config,
        session_name=session_name,
        session_mode=session_mode,
        force_enabled=True,
    )

    try:
        session_data = create_whatsapp_pairing_code_session(
            scope_type=ScopeType.SYSTEM,
            phone_number=phone_number,
        ) or {}
    except Exception as exc:
        return json_server_error(
            "Failed to create pairing code",
            details=str(exc),
            session_name=session_name,
            session_mode=session_mode,
            session_status="failed",
            connected=False,
        )

    if not session_data.get("success"):
        return json_bad_request(
            _extract_error_message(session_data, "Failed to create pairing code"),
            session_name=session_name,
            session_mode=session_mode,
            session_status=session_data.get("session_status") or "failed",
            connected=False,
            gateway_message=_extract_error_message(
                session_data,
                "Failed to create pairing code",
            ),
        )

    return json_ok(
        session_data.get("message") or "Pairing code created successfully",
        **_build_session_action_payload(
            session_data=session_data,
            session_name=session_name,
            session_mode=session_mode,
            fallback_status="pair_pending",
        ),
    )


# ============================================================
# 🔌 Disconnect Session
# ============================================================
@login_required
@require_POST
def system_whatsapp_session_disconnect(request):
    config = _get_config()

    try:
        body = read_json_body(request)
    except ValueError as exc:
        return json_bad_request(str(exc))

    session_name = _session_name_from_body_or_config(body, config)
    session_mode = _session_mode_from_body_or_config(body, config)

    _ensure_web_session_config(
        config,
        session_name=session_name,
        session_mode=session_mode,
        force_enabled=True,
    )

    try:
        session_data = disconnect_whatsapp_session(
            scope_type=ScopeType.SYSTEM,
        ) or {}
    except Exception as exc:
        return json_server_error(
            "Failed to disconnect session",
            details=str(exc),
            session_name=session_name,
            session_mode=session_mode,
            session_status="failed",
            connected=False,
        )

    if not session_data.get("success"):
        return json_bad_request(
            _extract_error_message(session_data, "Failed to disconnect session"),
            session_name=session_name,
            session_mode=session_mode,
            session_status=session_data.get("session_status") or "failed",
            connected=False,
            gateway_message=_extract_error_message(
                session_data,
                "Failed to disconnect session",
            ),
        )

    return json_ok(
        session_data.get("message") or "Session disconnected successfully",
        **_build_session_action_payload(
            session_data=session_data,
            session_name=session_name,
            session_mode=session_mode,
            fallback_status="disconnected",
        ),
    )