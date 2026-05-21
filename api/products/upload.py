# ============================================================
# 📂 api/products/upload.py
# 🧭 Primey Care — Products Image Upload API V2.7
# ------------------------------------------------------------
# ✅ Upload product thumbnail image
# ✅ Upload product general marketing image
# ✅ Provider-aware Google Drive upload for legacy products only
# ✅ General product Google Drive upload fallback
# ✅ Lazy Google Drive import to avoid breaking runserver
# ✅ Unified response: ok / success / data / product / upload
# ------------------------------------------------------------
# القاعدة المعتمدة:
# - Product = كتالوج ثابت.
# - هذه API ترفع صور المنتج العامة فقط:
#   thumbnail / marketing
# - صورة عرض مقدم الخدمة المختلفة حسب العقد تكون في ContractProduct.
# - عروض مقدمي الخدمة تعرض من /api/offers/.
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from products.models import Product
from products.services import serialize_product


logger = logging.getLogger(__name__)


# ============================================================
# 🔹 Constants
# ============================================================

MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
}

ALLOWED_IMAGE_TYPES = {
    "thumbnail",
    "marketing",
}


# ============================================================
# 🔹 JSON Helpers
# ============================================================

def _decimal_to_string(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

    if isinstance(value, dict):
        return {key: _decimal_to_string(val) for key, val in value.items()}

    if isinstance(value, list):
        return [_decimal_to_string(item) for item in value]

    if isinstance(value, tuple):
        return tuple(_decimal_to_string(item) for item in value)

    return value


def _json_error(
    message: str,
    status: int = 400,
    *,
    errors: Any = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": False,
        "success": False,
        "message": message,
    }

    if errors is not None:
        payload["errors"] = _decimal_to_string(errors)

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _json_success(
    data: dict[str, Any],
    *,
    message: str = "تم تنفيذ العملية بنجاح.",
    status: int = 200,
    extra: dict[str, Any] | None = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": True,
        "success": True,
        "message": message,
        "data": _decimal_to_string(data),
    }

    if extra:
        payload.update(_decimal_to_string(extra))

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


# ============================================================
# 🔹 Internal Helpers
# ============================================================

def _ensure_authenticated(request):
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return None, _json_error("Authentication required.", 401)

    return request.user, None


def _validation_errors(exc: ValidationError):
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return exc.messages

    return [str(exc)]


def _normalize_text(value: Any, default: str = "") -> str:
    if value is None:
        return default

    value_str = str(value).strip()

    if value_str.lower() in {"none", "null", "nan"}:
        return default

    return value_str


def _get_uploaded_file(request):
    return (
        request.FILES.get("file")
        or request.FILES.get("image")
        or request.FILES.get("upload")
        or request.FILES.get("product_image")
    )


def _get_image_type(request) -> str:
    image_type = (
        request.POST.get("image_type")
        or request.POST.get("type")
        or request.GET.get("image_type")
        or request.GET.get("type")
        or "marketing"
    )

    image_type = _normalize_text(image_type, "marketing").lower()

    if image_type not in ALLOWED_IMAGE_TYPES:
        raise ValidationError(
            {
                "image_type": (
                    "Invalid image_type. Allowed values: "
                    f"{sorted(ALLOWED_IMAGE_TYPES)}"
                )
            }
        )

    return image_type


def _validate_image_file(file_obj) -> None:
    if not file_obj:
        raise ValidationError({"file": "Image file is required."})

    content_type = _normalize_text(getattr(file_obj, "content_type", ""))

    if content_type.lower() not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise ValidationError(
            {
                "file": (
                    "Invalid image type. Allowed types: "
                    "JPEG, PNG, WEBP, GIF."
                )
            }
        )

    size = getattr(file_obj, "size", 0) or 0

    if size > MAX_IMAGE_SIZE_BYTES:
        raise ValidationError(
            {
                "file": "Image file size must not exceed 10MB."
            }
        )


def _get_google_drive_helpers():
    """
    مهم:
    لا نستورد services.google_drive أعلى الملف حتى لا يتعطل runserver
    إذا كانت مكتبات Google غير مثبتة.
    """

    try:
        from services.google_drive import (
            DEFAULT_ROOT_FOLDER_ID,
            get_drive_service,
            get_or_create_folder,
            upload_file_to_folder,
            upload_provider_file,
        )
    except ModuleNotFoundError as exc:
        if exc.name and exc.name.startswith("google"):
            raise RuntimeError(
                "Google Drive dependencies are not installed. "
                "Install google-auth and google-api-python-client packages."
            ) from exc

        raise

    return {
        "DEFAULT_ROOT_FOLDER_ID": DEFAULT_ROOT_FOLDER_ID,
        "get_drive_service": get_drive_service,
        "get_or_create_folder": get_or_create_folder,
        "upload_file_to_folder": upload_file_to_folder,
        "upload_provider_file": upload_provider_file,
    }


def _general_products_folder() -> dict[str, Any]:
    helpers = _get_google_drive_helpers()

    default_root_folder_id = helpers["DEFAULT_ROOT_FOLDER_ID"]

    if not default_root_folder_id:
        raise ValueError("GOOGLE_DRIVE_FOLDER_ID is not configured in settings.")

    service = helpers["get_drive_service"]()

    folder_id = helpers["get_or_create_folder"](
        service=service,
        name="Products",
        parent_id=default_root_folder_id,
    )

    return {
        "service": service,
        "folder_id": folder_id,
        "upload_file_to_folder": helpers["upload_file_to_folder"],
    }


def _upload_product_image(
    *,
    product: Product,
    file_obj,
    filename: str,
    content_type: str,
) -> dict[str, str]:
    helpers = _get_google_drive_helpers()

    # توافق قديم فقط:
    # إذا كان المنتج مربوطًا بمقدم خدمة من بيانات قديمة، نحافظ على نفس سلوك الرفع.
    # التطوير الجديد لا يربط Product بمقدم الخدمة مباشرة.
    if product.provider_id:
        return helpers["upload_provider_file"](
            provider=product.provider,
            file_obj=file_obj,
            filename=filename,
            content_type=content_type,
            file_type="product_image",
        )

    folder = _general_products_folder()

    return folder["upload_file_to_folder"](
        service=folder["service"],
        file_obj=file_obj,
        filename=filename,
        content_type=content_type,
        folder_id=folder["folder_id"],
        make_public=True,
    )


def _build_filename(
    *,
    product: Product,
    image_type: str,
    original_filename: str,
) -> str:
    product_code = _normalize_text(product.code, f"product-{product.id}")
    product_name = _normalize_text(product.name, f"Product {product.id}")
    original_filename = _normalize_text(original_filename, "product-image")

    return f"{product_code} - {product_name} - {image_type} - {original_filename}"


def _update_product_image_fields(
    *,
    product: Product,
    image_type: str,
    upload_result: dict[str, str],
    alt_text: str,
) -> Product:
    file_url = (
        upload_result.get("file_url")
        or upload_result.get("url")
        or ""
    )
    drive_file_id = (
        upload_result.get("drive_file_id")
        or upload_result.get("file_id")
        or ""
    )
    view_url = (
        upload_result.get("view_url")
        or upload_result.get("drive_file_view_url")
        or ""
    )
    folder_id = (
        upload_result.get("drive_folder_id")
        or upload_result.get("folder_id")
        or ""
    )
    folder_url = (
        upload_result.get("drive_folder_url")
        or upload_result.get("folder_url")
        or ""
    )

    update_fields: list[str] = []

    if image_type == "thumbnail":
        product.thumbnail_image_url = file_url
        product.thumbnail_image_drive_file_id = drive_file_id
        product.thumbnail_image_drive_view_url = view_url
        product.thumbnail_image_folder_id = folder_id
        product.thumbnail_image_folder_url = folder_url

        update_fields.extend(
            [
                "thumbnail_image_url",
                "thumbnail_image_drive_file_id",
                "thumbnail_image_drive_view_url",
                "thumbnail_image_folder_id",
                "thumbnail_image_folder_url",
            ]
        )

        if alt_text:
            product.thumbnail_image_alt_text = alt_text
            update_fields.append("thumbnail_image_alt_text")

    if image_type == "marketing":
        product.marketing_image_url = file_url
        product.marketing_image_drive_file_id = drive_file_id
        product.marketing_image_drive_view_url = view_url
        product.marketing_image_folder_id = folder_id
        product.marketing_image_folder_url = folder_url

        update_fields.extend(
            [
                "marketing_image_url",
                "marketing_image_drive_file_id",
                "marketing_image_drive_view_url",
                "marketing_image_folder_id",
                "marketing_image_folder_url",
            ]
        )

        if alt_text:
            product.marketing_image_alt_text = alt_text
            update_fields.append("marketing_image_alt_text")

    update_fields.append("updated_at")

    product.full_clean()
    product.save(update_fields=list(dict.fromkeys(update_fields)))

    return product


def _product_queryset():
    return (
        Product.objects
        .select_related("category", "provider")
        .prefetch_related(
            "benefits",
            "pricing_tiers",
            "service_items",
        )
    )


def _enhance_product_payload(product: Product, payload: dict[str, Any]) -> dict[str, Any]:
    enhanced = dict(payload or {})

    enhanced.update(
        {
            "id": product.id,
            "product_id": product.id,
            "code": product.code,
            "name": product.name,
            "slug": product.slug,
            "product_type": product.product_type,
            "category_id": product.category_id,
            "status": product.status,
            "currency_code": product.currency_code,
            "thumbnail_image_url": product.thumbnail_image_url,
            "thumbnail_image_drive_file_id": product.thumbnail_image_drive_file_id,
            "thumbnail_image_drive_view_url": product.thumbnail_image_drive_view_url,
            "thumbnail_image_folder_id": product.thumbnail_image_folder_id,
            "thumbnail_image_folder_url": product.thumbnail_image_folder_url,
            "thumbnail_image_alt_text": product.thumbnail_image_alt_text,
            "marketing_image_url": product.marketing_image_url,
            "marketing_image_drive_file_id": product.marketing_image_drive_file_id,
            "marketing_image_drive_view_url": product.marketing_image_drive_view_url,
            "marketing_image_folder_id": product.marketing_image_folder_id,
            "marketing_image_folder_url": product.marketing_image_folder_url,
            "marketing_image_alt_text": product.marketing_image_alt_text,
            "has_thumbnail_image": product.has_thumbnail_image,
            "has_marketing_image": product.has_marketing_image,
            "is_catalog_product": product.is_catalog_product,
            "is_provider_product": product.is_provider_product,
            "legacy_provider_id": product.provider_id,
            "offers_endpoint": "/api/offers/",
            "provider_offers_endpoint": f"/api/offers/?product_id={product.id}",
        }
    )

    if hasattr(product, "catalog_payload"):
        enhanced["catalog_payload"] = product.catalog_payload

    if hasattr(product, "checkout_payload"):
        enhanced["checkout_payload"] = product.checkout_payload

    if product.requires_provider:
        enhanced["checkout_source"] = "offers"
        enhanced["checkout_note"] = "Use /api/offers/ with product_id to select provider-specific offer."
    else:
        enhanced["checkout_source"] = "product"

    return enhanced


def _serialize_product_payload(product: Product) -> dict[str, Any]:
    return _enhance_product_payload(
        product=product,
        payload=serialize_product(product),
    )


# ============================================================
# 🔹 Product Image Upload API
# ============================================================

@require_http_methods(["POST"])
def product_image_upload_api(request, product_id: int):
    user, auth_error = _ensure_authenticated(request)

    if auth_error:
        return auth_error

    product = get_object_or_404(
        _product_queryset(),
        pk=product_id,
    )

    try:
        file_obj = _get_uploaded_file(request)
        image_type = _get_image_type(request)

        _validate_image_file(file_obj)

        alt_text = _normalize_text(
            request.POST.get("alt_text")
            or request.POST.get("image_alt_text")
            or ""
        )

        filename = _build_filename(
            product=product,
            image_type=image_type,
            original_filename=getattr(file_obj, "name", "product-image"),
        )

        content_type = _normalize_text(
            getattr(file_obj, "content_type", ""),
            "application/octet-stream",
        )

        upload_result = _upload_product_image(
            product=product,
            file_obj=file_obj,
            filename=filename,
            content_type=content_type,
        )

        product = _update_product_image_fields(
            product=product,
            image_type=image_type,
            upload_result=upload_result,
            alt_text=alt_text,
        )

        product = _product_queryset().get(pk=product.pk)
        serialized = _serialize_product_payload(product)

        return _json_success(
            {
                "product": serialized,
                "upload": upload_result,
                "image_type": image_type,
            },
            message="Product image uploaded successfully.",
            extra={
                # توافق خلفي مع الفرونت الحالي
                "data": serialized,
                "product": serialized,
                "upload": upload_result,
                "image_type": image_type,
            },
        )

    except ValidationError as exc:
        return _json_error(
            "Validation failed while uploading product image.",
            400,
            errors=_validation_errors(exc),
        )

    except RuntimeError as exc:
        logger.exception(
            "Product image upload dependency error for product %s: %s",
            product_id,
            exc,
        )

        return _json_error(
            str(exc),
            500,
        )

    except Exception as exc:
        logger.exception(
            "Failed to upload product image for product %s: %s",
            product_id,
            exc,
        )

        return _json_error(
            "Unexpected error while uploading product image.",
            500,
        )