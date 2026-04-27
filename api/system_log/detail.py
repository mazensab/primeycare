# ============================================================
# 📂 api/system_log/detail.py
# Primey Care - System Log Detail API
# ============================================================

from __future__ import annotations

from django.views.decorators.http import require_GET

from . import ensure_authenticated, get_log_or_error, json_error, json_success, serialize_system_log


@require_GET
def system_log_detail_api(request, log_id: int):
    auth_error = ensure_authenticated(request)
    if auth_error:
        return auth_error

    try:
        log_item = get_log_or_error(log_id)
    except LookupError as exc:
        return json_error(str(exc), error="NOT_FOUND", status=404)

    return json_success(
        "System log detail loaded successfully",
        data=serialize_system_log(log_item),
    )