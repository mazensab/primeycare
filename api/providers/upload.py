# ============================================================
# 📂 api/providers/upload.py
# 🧠 Primey Care | Provider Upload API
# ------------------------------------------------------------
# ✅ رفع شعار مقدم الخدمة
# ✅ رفع صورة مقدم الخدمة
# ✅ رفع ملفات السجل التجاري والرقم الضريبي
# ✅ رفع صور المنتجات وملفات العقود والمرفقات
# ✅ إنشاء ProviderDocument بعد الرفع
# ✅ تحديث logo_url / image_url تلقائيًا عند رفع الشعار أو الصورة
# ✅ ربط رسمي مع services.google_drive
# ============================================================

from __future__ import annotations

import importlib
import logging
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from providers.models import Provider, ProviderDocumentType
from providers.services import (
    create_provider_document,
    serialize_provider,
    update_provider_main_file_from_document,
)

logger = logging.getLogger(__name__)


# ============================================================
# 🔹 Upload Rules
# ============================================================

MAX_UPLOAD_SIZE_MB = int(getattr(settings, "PROVIDER_UPLOAD_MAX_SIZE_MB", 20))
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024

ALLOWED_CONTENT_TYPES = {
    # Images
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",

    # PDF
    "application/pdf",

    # Word
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    # Excel
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
}

IMAGE_ONLY_TYPES = {
    ProviderDocumentType.LOGO,
    ProviderDocumentType.IMAGE,
    ProviderDocumentType.PRODUCT_IMAGE,
}


# ============================================================
# 🔹 Helpers
# ============================================================

def _json_error(message: str, status: int = 400, *, errors=None) -> JsonResponse:
    payload: dict[str, Any] = {
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


def _normalize_text(value: Any, default: str = "") -> str:
    if value is None:
        return default

    value_str = str(value).strip()

    if value_str.lower() in {"none", "null", "nan"}:
        return default

    return value_str


def _validate_file_type(value: str) -> str:
    file_type = _normalize_text(value) or ProviderDocumentType.OTHER

    allowed = {choice for choice, _label in ProviderDocumentType.choices}

    if file_type not in allowed:
        raise ValidationError(f"Invalid file_type. Allowed values: {sorted(allowed)}")

    return file_type


def _safe_filename(filename: str) -> str:
    original = Path(_normalize_text(filename) or "provider-file").name
    stem = Path(original).stem.strip() or "provider-file"
    suffix = Path(original).suffix.lower()

    # Keep file name readable while removing risky characters.
    safe_stem = "".join(
        char if char.isalnum() or char in {"-", "_", ".", " "} else "-"
        for char in stem
    )
    safe_stem = "-".join(safe_stem.split())
    safe_stem = safe_stem[:120] or "provider-file"

    return f"{safe_stem}{suffix}"


def _build_drive_filename(*, provider: Provider, file_type: str, original_filename: str) -> str:
    safe_original = _safe_filename(original_filename)
    provider_code = _safe_filename(provider.code or f"provider-{provider.id}")
    return f"{provider_code}-{file_type}-{safe_original}"


def _validate_uploaded_file(*, uploaded_file, file_type: str) -> None:
    if not uploaded_file:
        raise ValidationError("File is required. Please upload it using the 'file' field.")

    filename = _normalize_text(getattr(uploaded_file, "name", ""))
    suffix = Path(filename).suffix.lower()
    content_type = _normalize_text(getattr(uploaded_file, "content_type", ""))
    size = int(getattr(uploaded_file, "size", 0) or 0)

    if size <= 0:
        raise ValidationError("Uploaded file is empty.")

    if size > MAX_UPLOAD_SIZE_BYTES:
        raise ValidationError(f"File size exceeds the allowed limit of {MAX_UPLOAD_SIZE_MB} MB.")

    if suffix not in ALLOWED_EXTENSIONS:
        raise ValidationError(f"Unsupported file extension '{suffix}'.")

    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationError(f"Unsupported content type '{content_type}'.")

    if file_type in IMAGE_ONLY_TYPES and not content_type.startswith("image/"):
        raise ValidationError("This file type requires an image file.")


def _load_google_drive_module():
    """
    Lazy-load Google Drive service so Django check does not fail if the
    final service file path is adjusted later.

    Current official Primey Care path:
    - services.google_drive
    """

    candidates = (
        "services.google_drive",
        "google_drive",
        "api.google_drive",
        "core.google_drive",
        "integrations.google_drive",
        "primey_care.google_drive",
        "providers.google_drive",
    )

    last_error: Exception | None = None

    for module_name in candidates:
        try:
            return importlib.import_module(module_name)
        except Exception as exc:
            last_error = exc

    raise RuntimeError(f"Google Drive service module was not found. Last error: {last_error}")


def _extract_upload_result(result: Any) -> dict[str, str]:
    """
    Accept multiple Google Drive service return shapes.

    Supported:
    - "https://..."
    - {"url": "...", "file_id": "...", "folder_id": "..."}
    - {"file_url": "...", "drive_file_id": "...", "drive_folder_id": "..."}
    """

    if isinstance(result, str):
        return {
            "file_url": result,
            "drive_file_id": "",
            "drive_folder_id": "",
            "drive_folder_url": "",
            "provider_folder_id": "",
            "provider_folder_url": "",
        }

    if isinstance(result, dict):
        file_url = (
            result.get("file_url")
            or result.get("url")
            or result.get("webContentLink")
            or result.get("webViewLink")
            or ""
        )
        drive_file_id = (
            result.get("drive_file_id")
            or result.get("file_id")
            or result.get("id")
            or ""
        )
        drive_folder_id = (
            result.get("drive_folder_id")
            or result.get("folder_id")
            or result.get("parent_id")
            or ""
        )
        drive_folder_url = (
            result.get("drive_folder_url")
            or result.get("folder_url")
            or ""
        )
        provider_folder_id = (
            result.get("provider_folder_id")
            or result.get("provider_drive_folder_id")
            or ""
        )
        provider_folder_url = (
            result.get("provider_folder_url")
            or result.get("provider_drive_folder_url")
            or ""
        )

        return {
            "file_url": str(file_url or ""),
            "drive_file_id": str(drive_file_id or ""),
            "drive_folder_id": str(drive_folder_id or ""),
            "drive_folder_url": str(drive_folder_url or ""),
            "provider_folder_id": str(provider_folder_id or ""),
            "provider_folder_url": str(provider_folder_url or ""),
        }

    return {
        "file_url": "",
        "drive_file_id": "",
        "drive_folder_id": "",
        "drive_folder_url": "",
        "provider_folder_id": "",
        "provider_folder_url": "",
    }


def _upload_to_google_drive(*, provider: Provider, uploaded_file, file_type: str, filename: str) -> dict[str, str]:
    """
    Upload adapter.

    This supports:
    - services.google_drive.upload_provider_file
    - services.google_drive.upload_file_to_provider_folder
    - legacy upload_file(file_obj, filename, content_type)
    """

    drive_module = _load_google_drive_module()

    content_type = _normalize_text(getattr(uploaded_file, "content_type", "")) or "application/octet-stream"

    provider_folder_name = f"{provider.code} - {provider.name_ar or provider.name or provider.name_en or provider.id}"

    # Preferred provider-aware function.
    if hasattr(drive_module, "upload_provider_file"):
        result = drive_module.upload_provider_file(
            provider=provider,
            file_obj=uploaded_file,
            filename=filename,
            content_type=content_type,
            file_type=file_type,
            folder_name=provider_folder_name,
        )
        return _extract_upload_result(result)

    # Alternative provider-aware function.
    if hasattr(drive_module, "upload_file_to_provider_folder"):
        result = drive_module.upload_file_to_provider_folder(
            provider=provider,
            file_obj=uploaded_file,
            filename=filename,
            content_type=content_type,
            file_type=file_type,
            folder_name=provider_folder_name,
        )
        return _extract_upload_result(result)

    # Legacy simple function.
    if hasattr(drive_module, "upload_file"):
        result = drive_module.upload_file(
            uploaded_file,
            filename,
            content_type,
        )
        return _extract_upload_result(result)

    raise RuntimeError("Google Drive service does not expose a supported upload function.")


def _sync_provider_drive_folder(*, provider: Provider, upload_data: dict[str, str]) -> Provider:
    update_fields: list[str] = []

    provider_folder_id = _normalize_text(upload_data.get("provider_folder_id"))
    provider_folder_url = _normalize_text(upload_data.get("provider_folder_url"))

    # Important:
    # - provider.drive_folder_id يجب أن يحفظ مجلد مقدم الخدمة الرئيسي
    # - document.drive_folder_id يحفظ المجلد الفرعي الذي رفع فيه الملف
    if provider_folder_id and not provider.drive_folder_id:
        provider.drive_folder_id = provider_folder_id
        update_fields.append("drive_folder_id")

    if provider_folder_url and not provider.drive_folder_url:
        provider.drive_folder_url = provider_folder_url
        update_fields.append("drive_folder_url")

    # Fallback عند استخدام خدمة قديمة لا ترجع provider_folder_id.
    drive_folder_id = _normalize_text(upload_data.get("drive_folder_id"))
    drive_folder_url = _normalize_text(upload_data.get("drive_folder_url"))

    if not provider.drive_folder_id and drive_folder_id:
        provider.drive_folder_id = drive_folder_id
        update_fields.append("drive_folder_id")

    if not provider.drive_folder_url and drive_folder_url:
        provider.drive_folder_url = drive_folder_url
        update_fields.append("drive_folder_url")

    if update_fields:
        update_fields.append("updated_at")
        provider.save(update_fields=list(dict.fromkeys(update_fields)))

    return provider


# ============================================================
# 🔹 Provider Upload API
# ============================================================

@require_http_methods(["POST"])
def provider_upload_api(request, provider_id: int):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    provider = get_object_or_404(Provider, pk=provider_id)

    try:
        uploaded_file = request.FILES.get("file")
        file_type = _validate_file_type(request.POST.get("file_type"))
        title = _normalize_text(request.POST.get("title"))
        description = _normalize_text(request.POST.get("description"))
        is_primary = str(request.POST.get("is_primary", "")).strip().lower() in {
            "1",
            "true",
            "yes",
            "on",
            "نعم",
        }

        # Logo and main image should always behave as primary.
        if file_type in {ProviderDocumentType.LOGO, ProviderDocumentType.IMAGE}:
            is_primary = True

        _validate_uploaded_file(uploaded_file=uploaded_file, file_type=file_type)

        original_filename = _safe_filename(getattr(uploaded_file, "name", "provider-file"))
        drive_filename = _build_drive_filename(
            provider=provider,
            file_type=file_type,
            original_filename=original_filename,
        )

        upload_data = _upload_to_google_drive(
            provider=provider,
            uploaded_file=uploaded_file,
            file_type=file_type,
            filename=drive_filename,
        )

        file_url = _normalize_text(upload_data.get("file_url"))
        if not file_url:
            raise ValidationError("Google Drive upload did not return a file URL.")

        provider = _sync_provider_drive_folder(provider=provider, upload_data=upload_data)

        document = create_provider_document(
            provider=provider,
            file_type=file_type,
            file_url=file_url,
            drive_file_id=_normalize_text(upload_data.get("drive_file_id")),
            drive_folder_id=_normalize_text(upload_data.get("drive_folder_id")) or provider.drive_folder_id,
            title=title or original_filename,
            description=description,
            original_filename=original_filename,
            content_type=_normalize_text(getattr(uploaded_file, "content_type", "")),
            size_bytes=int(getattr(uploaded_file, "size", 0) or 0),
            uploaded_by=user,
            is_primary=is_primary,
        )

        if is_primary:
            provider = update_provider_main_file_from_document(
                provider=provider,
                document=document,
            )

        provider = Provider.objects.prefetch_related("documents", "documents__uploaded_by").get(pk=provider.pk)

        return JsonResponse(
            {
                "ok": True,
                "message": "Provider file uploaded successfully.",
                "data": {
                    "provider": serialize_provider(provider, include_documents=True),
                    "document": {
                        "id": document.id,
                        "file_type": document.file_type,
                        "title": document.title,
                        "file_url": document.file_url,
                        "drive_file_id": document.drive_file_id,
                        "drive_folder_id": document.drive_folder_id,
                        "original_filename": document.original_filename,
                        "content_type": document.content_type,
                        "size_bytes": document.size_bytes,
                        "is_primary": document.is_primary,
                        "created_at": document.created_at.isoformat() if document.created_at else None,
                    },
                },
            },
            status=201,
        )

    except ValidationError as exc:
        return _json_error(
            "Validation failed while uploading provider file.",
            400,
            errors=exc.messages,
        )

    except Exception as exc:
        logger.exception("Failed to upload provider file for provider %s: %s", provider_id, exc)
        return _json_error("Unexpected error while uploading provider file.", 500)