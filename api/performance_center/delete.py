# ============================================================
# 📂 api/performance_center/delete.py
# Primey Care - Performance Center Delete API
# ============================================================

from __future__ import annotations

from django.db import transaction
from django.views.decorators.http import require_http_methods

from . import (
    ensure_authenticated,
    get_object_or_error,
    json_error,
    json_success,
    parse_json_body,
    resolve_resource_model,
    serialize_instance,
)


@require_http_methods(["DELETE", "POST"])
@transaction.atomic
def performance_center_delete_api(request):
    auth_error = ensure_authenticated(request)
    if auth_error:
        return auth_error

    try:
        payload = parse_json_body(request)
        resource = (payload.get("resource") or "").strip().lower()
        object_id = payload.get("id")

        if not resource:
            return json_error("Field 'resource' is required", error="RESOURCE_REQUIRED")
        if object_id in (None, ""):
            return json_error("Field 'id' is required", error="ID_REQUIRED")

        model = resolve_resource_model(resource)
        instance = get_object_or_error(model, object_id)
        deleted_snapshot = serialize_instance(instance)

        instance.delete()

        return json_success(
            "Performance center record deleted successfully",
            data={
                "resource": resource,
                "deleted": deleted_snapshot,
            },
        )

    except ValueError as exc:
        return json_error(str(exc), error="VALIDATION_ERROR")
    except LookupError as exc:
        return json_error(str(exc), error="NOT_FOUND", status=404)
    except Exception as exc:
        return json_error(
            "Failed to delete performance center record",
            error="DELETE_FAILED",
            status=500,
            details=str(exc),
        )