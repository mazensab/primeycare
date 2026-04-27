# ============================================================
# 📂 api/performance_center/detail.py
# Primey Care - Performance Center Detail API
# ============================================================

from __future__ import annotations

from django.views.decorators.http import require_GET

from . import (
    ensure_authenticated,
    get_object_or_error,
    json_error,
    json_success,
    resolve_resource_model,
    serialize_instance,
)


@require_GET
def performance_center_detail_api(request):
    auth_error = ensure_authenticated(request)
    if auth_error:
        return auth_error

    resource = (request.GET.get("resource") or "").strip().lower()
    object_id = request.GET.get("id")

    if not resource:
        return json_error("Query param 'resource' is required", error="RESOURCE_REQUIRED")
    if not object_id:
        return json_error("Query param 'id' is required", error="ID_REQUIRED")

    try:
        model = resolve_resource_model(resource)
        instance = get_object_or_error(model, object_id)
    except ValueError as exc:
        return json_error(str(exc), error="INVALID_RESOURCE")
    except LookupError as exc:
        return json_error(str(exc), error="NOT_FOUND", status=404)

    return json_success(
        "Performance center detail loaded successfully",
        data=serialize_instance(instance, include_nested=True),
    )