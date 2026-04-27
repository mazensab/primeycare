# ============================================================
# 📂 api/system_log/__init__.py
# Primey Care - System Log API Helpers
# ============================================================

from __future__ import annotations

import json
from typing import Any

from django.http import JsonResponse

from system_log.models import SystemLog


def ensure_authenticated(request):
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return JsonResponse(
            {
                "ok": False,
                "message": "Unauthorized",
                "error": "AUTHENTICATION_REQUIRED",
            },
            status=401,
        )
    return None


def parse_json_body(request) -> dict[str, Any]:
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid JSON body") from exc


def json_success(
    message: str,
    data: Any | None = None,
    *,
    status: int = 200,
    meta: dict[str, Any] | None = None,
    **extra,
):
    payload = {
        "ok": True,
        "message": message,
        "data": data,
    }
    if meta is not None:
        payload["meta"] = meta
    payload.update(extra)
    return JsonResponse(payload, status=status)


def json_error(
    message: str,
    *,
    error: str = "BAD_REQUEST",
    status: int = 400,
    details: Any | None = None,
    **extra,
):
    payload = {
        "ok": False,
        "message": message,
        "error": error,
    }
    if details is not None:
        payload["details"] = details
    payload.update(extra)
    return JsonResponse(payload, status=status)


def clean_text(value) -> str:
    return str(value or "").strip()


def to_int(value, field_name: str, min_value: int | None = None):
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"'{field_name}' must be an integer")
    if min_value is not None and number < min_value:
        raise ValueError(f"'{field_name}' must be >= {min_value}")
    return number


def get_log_or_error(log_id):
    try:
        return SystemLog.objects.get(pk=log_id)
    except SystemLog.DoesNotExist:
        raise LookupError(f"SystemLog with id={log_id} was not found")


def serialize_system_log(obj: SystemLog):
    return {
        "id": obj.id,
        "scope_type": obj.scope_type,
        "company_reference": obj.company_reference,
        "company_name": obj.company_name,
        "user_id": obj.user_id,
        "user_name": (
            obj.user.get_full_name().strip()
            if obj.user and hasattr(obj.user, "get_full_name") and obj.user.get_full_name().strip()
            else (getattr(obj.user, "username", "") if obj.user else "")
        ),
        "module": obj.module,
        "action": obj.action,
        "event_code": obj.event_code,
        "severity": obj.severity,
        "message": obj.message,
        "path": obj.path,
        "method": obj.method,
        "status_code": obj.status_code,
        "ip_address": obj.ip_address,
        "extra_data": obj.extra_data or {},
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
    }