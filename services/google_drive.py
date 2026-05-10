# ============================================================
# 📂 services/google_drive.py
# 🧠 Primey Care | Google Drive Service
# ------------------------------------------------------------
# ✅ Google Drive service account integration
# ✅ رفع ملفات عامة داخل المجلد الرئيسي
# ✅ إنشاء مجلد مستقل لكل مقدم خدمة
# ✅ إنشاء مجلدات فرعية داخل مجلد مقدم الخدمة
# ✅ رفع شعار / صورة / منتجات / عقود / مستندات مقدم الخدمة
# ✅ إرجاع file_url + drive_file_id + drive_folder_id + drive_folder_url
# ✅ متوافق مع upload_file القديم
# ============================================================

from __future__ import annotations

import os
import re
import tempfile
from pathlib import Path
from typing import Any

from django.conf import settings

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload


# ============================================================
# 🔹 Google Drive Settings
# ============================================================

SCOPES = ["https://www.googleapis.com/auth/drive"]

DEFAULT_ROOT_FOLDER_ID = getattr(settings, "GOOGLE_DRIVE_FOLDER_ID", "")

PROVIDER_SUBFOLDERS = {
    "logo": "Logo",
    "image": "Images",
    "product_image": "Products",
    "contract_file": "Contracts",
    "commercial_registration": "Commercial Registration",
    "tax_certificate": "Tax Certificates",
    "license": "Licenses",
    "other": "Documents",
}


# ============================================================
# 🔹 Drive Service
# ============================================================

def get_drive_service():
    credentials = service_account.Credentials.from_service_account_file(
        settings.GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE,
        scopes=SCOPES,
    )

    service = build(
        "drive",
        "v3",
        credentials=credentials,
        cache_discovery=False,
    )

    return service


# ============================================================
# 🔹 Helpers
# ============================================================

def normalize_text(value: Any, default: str = "") -> str:
    if value is None:
        return default

    value_str = str(value).strip()

    if value_str.lower() in {"none", "null", "nan"}:
        return default

    return value_str


def safe_drive_name(value: Any, default: str = "Primey File") -> str:
    name = normalize_text(value, default)

    # Google Drive يسمح بالعربي، لكن نزيل الرموز الخطرة والفواصل المزعجة.
    name = name.replace("/", "-").replace("\\", "-")
    name = re.sub(r"[\r\n\t]+", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    name = name[:180]

    return name or default


def safe_filename(filename: str) -> str:
    original = Path(normalize_text(filename, "file")).name
    stem = Path(original).stem.strip() or "file"
    suffix = Path(original).suffix.lower()

    stem = stem.replace("/", "-").replace("\\", "-")
    stem = re.sub(r"[\r\n\t]+", " ", stem)
    stem = re.sub(r"\s+", " ", stem).strip()
    stem = stem[:140] or "file"

    return f"{stem}{suffix}"


def drive_folder_url(folder_id: str) -> str:
    folder_id = normalize_text(folder_id)
    if not folder_id:
        return ""

    return f"https://drive.google.com/drive/folders/{folder_id}"


def drive_file_url(file_id: str) -> str:
    file_id = normalize_text(file_id)
    if not file_id:
        return ""

    return f"https://drive.google.com/uc?id={file_id}"


def drive_file_view_url(file_id: str) -> str:
    file_id = normalize_text(file_id)
    if not file_id:
        return ""

    return f"https://drive.google.com/file/d/{file_id}/view"


def escape_drive_query(value: str) -> str:
    return normalize_text(value).replace("\\", "\\\\").replace("'", "\\'")


def file_chunks_to_tempfile(file_obj) -> str:
    temp_file = tempfile.NamedTemporaryFile(delete=False)

    try:
        if hasattr(file_obj, "chunks"):
            for chunk in file_obj.chunks():
                temp_file.write(chunk)
        else:
            temp_file.write(file_obj.read())

        temp_file.flush()
        return temp_file.name

    finally:
        temp_file.close()


def make_file_public(service, file_id: str) -> None:
    if not file_id:
        return

    service.permissions().create(
        fileId=file_id,
        body={
            "type": "anyone",
            "role": "reader",
        },
        supportsAllDrives=True,
    ).execute()


# ============================================================
# 🔹 Folder Helpers
# ============================================================

def find_folder(
    *,
    service,
    name: str,
    parent_id: str,
) -> str:
    folder_name = escape_drive_query(name)
    parent_id = escape_drive_query(parent_id)

    query = (
        "mimeType='application/vnd.google-apps.folder' "
        f"and name='{folder_name}' "
        f"and '{parent_id}' in parents "
        "and trashed=false"
    )

    result = service.files().list(
        q=query,
        spaces="drive",
        fields="files(id, name)",
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
        pageSize=1,
    ).execute()

    files = result.get("files", [])
    if not files:
        return ""

    return files[0].get("id", "")


def create_folder(
    *,
    service,
    name: str,
    parent_id: str,
) -> str:
    metadata = {
        "name": safe_drive_name(name, "Primey Folder"),
        "mimeType": "application/vnd.google-apps.folder",
    }

    if parent_id:
        metadata["parents"] = [parent_id]

    folder = service.files().create(
        body=metadata,
        fields="id",
        supportsAllDrives=True,
    ).execute()

    return folder.get("id", "")


def get_or_create_folder(
    *,
    service,
    name: str,
    parent_id: str,
) -> str:
    if not parent_id:
        raise ValueError("Google Drive parent folder id is required.")

    safe_name = safe_drive_name(name, "Primey Folder")

    existing_id = find_folder(
        service=service,
        name=safe_name,
        parent_id=parent_id,
    )

    if existing_id:
        return existing_id

    return create_folder(
        service=service,
        name=safe_name,
        parent_id=parent_id,
    )


def build_provider_folder_name(*, provider) -> str:
    provider_code = normalize_text(getattr(provider, "code", ""))
    provider_name = (
        normalize_text(getattr(provider, "name_ar", ""))
        or normalize_text(getattr(provider, "name", ""))
        or normalize_text(getattr(provider, "name_en", ""))
        or f"Provider {getattr(provider, 'id', '')}"
    )

    if provider_code:
        return safe_drive_name(f"{provider_code} - {provider_name}", "Provider Folder")

    return safe_drive_name(provider_name, "Provider Folder")


def get_or_create_provider_folder(*, service, provider) -> dict[str, str]:
    root_folder_id = DEFAULT_ROOT_FOLDER_ID

    if not root_folder_id:
        raise ValueError("GOOGLE_DRIVE_FOLDER_ID is not configured in settings.")

    existing_provider_folder_id = normalize_text(getattr(provider, "drive_folder_id", ""))

    if existing_provider_folder_id:
        return {
            "folder_id": existing_provider_folder_id,
            "folder_url": drive_folder_url(existing_provider_folder_id),
        }

    folder_name = build_provider_folder_name(provider=provider)

    folder_id = get_or_create_folder(
        service=service,
        name=folder_name,
        parent_id=root_folder_id,
    )

    folder_url = drive_folder_url(folder_id)

    # نحفظ المجلد في قاعدة البيانات إذا كان provider موديل Django.
    if folder_id and hasattr(provider, "save"):
        update_fields = []

        if not normalize_text(getattr(provider, "drive_folder_id", "")):
            provider.drive_folder_id = folder_id
            update_fields.append("drive_folder_id")

        if not normalize_text(getattr(provider, "drive_folder_url", "")):
            provider.drive_folder_url = folder_url
            update_fields.append("drive_folder_url")

        if update_fields:
            update_fields.append("updated_at")
            provider.save(update_fields=list(dict.fromkeys(update_fields)))

    return {
        "folder_id": folder_id,
        "folder_url": folder_url,
    }


def get_provider_subfolder(
    *,
    service,
    provider_folder_id: str,
    file_type: str,
) -> dict[str, str]:
    subfolder_name = PROVIDER_SUBFOLDERS.get(
        normalize_text(file_type),
        PROVIDER_SUBFOLDERS["other"],
    )

    subfolder_id = get_or_create_folder(
        service=service,
        name=subfolder_name,
        parent_id=provider_folder_id,
    )

    return {
        "folder_id": subfolder_id,
        "folder_url": drive_folder_url(subfolder_id),
    }


# ============================================================
# 🔹 Upload Core
# ============================================================

def upload_file_to_folder(
    *,
    service,
    file_obj,
    filename: str,
    content_type: str,
    folder_id: str,
    make_public: bool = True,
) -> dict[str, str]:
    if not folder_id:
        raise ValueError("Google Drive folder id is required.")

    temp_file_path = file_chunks_to_tempfile(file_obj)

    try:
        safe_name = safe_filename(filename)

        media = MediaFileUpload(
            temp_file_path,
            mimetype=content_type or "application/octet-stream",
            resumable=True,
        )

        uploaded = service.files().create(
            body={
                "name": safe_name,
                "parents": [folder_id],
            },
            media_body=media,
            fields="id, name, webViewLink, webContentLink",
            supportsAllDrives=True,
        ).execute()

        file_id = uploaded.get("id", "")

        if make_public:
            make_file_public(service, file_id)

        return {
            "file_id": file_id,
            "drive_file_id": file_id,
            "name": uploaded.get("name", safe_name),
            "url": drive_file_url(file_id),
            "file_url": drive_file_url(file_id),
            "view_url": uploaded.get("webViewLink") or drive_file_view_url(file_id),
            "drive_folder_id": folder_id,
            "folder_id": folder_id,
            "drive_folder_url": drive_folder_url(folder_id),
            "folder_url": drive_folder_url(folder_id),
        }

    finally:
        try:
            os.unlink(temp_file_path)
        except FileNotFoundError:
            pass


# ============================================================
# 🔹 Backward Compatible Upload
# ============================================================

def upload_file(file_obj, filename, content_type):
    """
    الدالة القديمة للتوافق مع أي جزء سابق في النظام.

    ترفع الملف داخل GOOGLE_DRIVE_FOLDER_ID مباشرة،
    لكن الآن تستخدم اسم الملف الصحيح بدل shell_test.txt.
    """

    service = get_drive_service()

    result = upload_file_to_folder(
        service=service,
        file_obj=file_obj,
        filename=filename,
        content_type=content_type,
        folder_id=DEFAULT_ROOT_FOLDER_ID,
        make_public=True,
    )

    return result["file_url"]


# ============================================================
# 🔹 Provider-Aware Upload
# ============================================================

def upload_provider_file(
    *,
    provider,
    file_obj,
    filename: str,
    content_type: str,
    file_type: str = "other",
    folder_name: str = "",
) -> dict[str, str]:
    """
    يرفع ملف خاص بمقدم الخدمة داخل:
    GOOGLE_DRIVE_FOLDER_ID / Provider Folder / Subfolder

    أمثلة:
    - شعار مقدم الخدمة:
      Root / PV-XXXX - Provider Name / Logo

    - صورة مقدم الخدمة:
      Root / PV-XXXX - Provider Name / Images

    - صورة منتج:
      Root / PV-XXXX - Provider Name / Products

    - ملف عقد:
      Root / PV-XXXX - Provider Name / Contracts
    """

    service = get_drive_service()

    provider_folder = get_or_create_provider_folder(
        service=service,
        provider=provider,
    )

    provider_folder_id = provider_folder["folder_id"]

    subfolder = get_provider_subfolder(
        service=service,
        provider_folder_id=provider_folder_id,
        file_type=file_type,
    )

    result = upload_file_to_folder(
        service=service,
        file_obj=file_obj,
        filename=filename,
        content_type=content_type,
        folder_id=subfolder["folder_id"],
        make_public=True,
    )

    result["provider_folder_id"] = provider_folder_id
    result["provider_folder_url"] = provider_folder["folder_url"]
    result["drive_folder_id"] = subfolder["folder_id"]
    result["folder_id"] = subfolder["folder_id"]
    result["drive_folder_url"] = subfolder["folder_url"]
    result["folder_url"] = subfolder["folder_url"]

    return result


def upload_file_to_provider_folder(
    *,
    provider,
    file_obj,
    filename: str,
    content_type: str,
    file_type: str = "other",
    folder_name: str = "",
) -> dict[str, str]:
    """
    Alias للتوافق مع upload.py.
    """

    return upload_provider_file(
        provider=provider,
        file_obj=file_obj,
        filename=filename,
        content_type=content_type,
        file_type=file_type,
        folder_name=folder_name,
    )