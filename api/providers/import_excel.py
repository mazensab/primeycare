# ============================================================
# 📂 api/providers/import_excel.py
# 🧠 Primey Care | Providers Excel Import API
# ------------------------------------------------------------
# ✅ Import providers / centers from Excel
# ✅ Supports dry_run before saving
# ✅ Uses upsert logic through providers.services
# ✅ Prevents duplicates using import_key
# ✅ Returns clear import summary
# ============================================================

from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from providers.services import (
    import_providers_from_excel,
    parse_bool,
)

logger = logging.getLogger(__name__)


# ============================================================
# 🔹 Helpers
# ============================================================

def _json_error(message: str, status: int = 400, *, errors=None) -> JsonResponse:
    payload = {
        "ok": False,
        "message": message,
    }

    if errors is not None:
        payload["errors"] = errors

    return JsonResponse(payload, status=status)


def _ensure_authenticated(request):
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return None, _json_error("Authentication required.", 401)

    return request.user, None


def _get_uploaded_file(request):
    uploaded_file = request.FILES.get("file")

    if not uploaded_file:
        raise ValidationError("Excel file is required. Please upload it using the 'file' field.")

    return uploaded_file


# ============================================================
# 🔹 Providers Excel Import API
# ============================================================

@require_http_methods(["POST"])
def import_providers_excel_api(request):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    try:
        uploaded_file = _get_uploaded_file(request)

        dry_run = parse_bool(request.POST.get("dry_run"), False) or False
        sheet_name = request.POST.get("sheet_name") or None

        result = import_providers_from_excel(
            uploaded_file=uploaded_file,
            sheet_name=sheet_name,
            dry_run=dry_run,
        )

        return JsonResponse(
            {
                "ok": True,
                "message": (
                    "Providers Excel file checked successfully."
                    if dry_run
                    else "Providers imported successfully."
                ),
                "data": result,
            },
            status=200,
        )

    except ValidationError as exc:
        return _json_error(
            "Validation failed while importing providers Excel file.",
            400,
            errors=exc.messages,
        )

    except Exception as exc:
        logger.exception("Unexpected error while importing providers Excel file: %s", exc)
        return _json_error(
            "Unexpected error while importing providers Excel file.",
            500,
        )