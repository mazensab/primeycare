# ============================================================
# 📂 api/system_log/delete.py
# Primey Care - System Log Delete API
# ============================================================

from __future__ import annotations

from django.db import transaction
from django.views.decorators.http import require_http_methods

from system_log.models import SystemLog

from . import (
    ensure_authenticated,
    get_log_or_error,
    json_error,
    json_success,
    parse_json_body,
    serialize_system_log,
)


@require_http_methods(["DELETE", "POST"])
@transaction.atomic
def system_log_delete_api(request, log_id: int | None = None):
    auth_error = ensure_authenticated(request)
    if auth_error:
        return auth_error

    try:
        if log_id is not None:
            log_item = get_log_or_error(log_id)
            deleted_snapshot = serialize_system_log(log_item)
            log_item.delete()

            return json_success(
                "System log deleted successfully",
                data=deleted_snapshot,
            )

        payload = parse_json_body(request)
        delete_mode = (payload.get("mode") or "").strip().lower()

        if delete_mode == "bulk":
            ids = payload.get("ids") or []
            if not isinstance(ids, list) or not ids:
                return json_error(
                    "Field 'ids' must be a non-empty list",
                    error="INVALID_IDS",
                )

            queryset = SystemLog.objects.filter(id__in=ids)
            deleted_items = [serialize_system_log(item) for item in queryset.select_related("user")]
            deleted_count, _ = queryset.delete()

            return json_success(
                "System logs deleted successfully",
                data={
                    "deleted_count": deleted_count,
                    "deleted_items": deleted_items,
                },
            )

        return json_error(
            "Invalid delete request. Pass log_id in URL or use mode='bulk' with ids list.",
            error="INVALID_DELETE_REQUEST",
        )

    except LookupError as exc:
        return json_error(str(exc), error="NOT_FOUND", status=404)
    except ValueError as exc:
        return json_error(str(exc), error="VALIDATION_ERROR")
    except Exception as exc:
        return json_error(
            "Failed to delete system log",
            error="DELETE_FAILED",
            status=500,
            details=str(exc),
        )