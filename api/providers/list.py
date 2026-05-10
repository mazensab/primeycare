# ============================================================
# 📂 api/providers/list.py
# 🧠 Primey Care | Providers API List/Create
# ------------------------------------------------------------
# ✅ List providers
# ✅ Create provider
# ✅ Public/filtered operational list
# ✅ Summary stats for frontend dashboards/lists
# ✅ Supports imported medical network fields through services
# ✅ Supports Arabic/English provider names
# ✅ Supports CR / tax number / logo / image / Google Drive fields
# ✅ Adds orders_count per provider when an Order relation exists
# ✅ Adds total_orders to summary
# ✅ Supports ordering by most orders and new provider fields
# ============================================================

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

from django.core.exceptions import FieldError, ValidationError
from django.db.models import Count, IntegerField, Q, QuerySet, Sum, Value
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from providers.models import Provider, ProviderStatus, ProviderType
from providers.services import (
    apply_provider_filters,
    create_provider,
    paginate_queryset,
    parse_int,
    parse_json_body,
    serialize_provider,
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


def _safe_count(queryset: QuerySet[Provider], **filters) -> int:
    try:
        return queryset.filter(**filters).count()
    except Exception:
        return 0


def _safe_filter_count(queryset: QuerySet[Provider], condition: Q) -> int:
    try:
        return queryset.filter(condition).count()
    except Exception:
        return 0


def _safe_exclude_count(queryset: QuerySet[Provider], **filters) -> int:
    try:
        return queryset.exclude(**filters).count()
    except Exception:
        return 0


# ============================================================
# 🔹 Orders Relation Helpers
# ============================================================

@lru_cache(maxsize=1)
def _get_orders_reverse_relation_name() -> str:
    """
    Detect the reverse relation from Provider to Order safely.

    This avoids hard-coding related_name because different builds may use:
    - provider.orders
    - provider.order_set
    - another custom related_name

    If no relation exists, the API returns orders_count = 0 safely.
    """

    try:
        for relation in Provider._meta.related_objects:
            related_model = relation.related_model
            related_app = getattr(related_model._meta, "app_label", "")
            related_model_name = getattr(related_model._meta, "model_name", "")

            if related_app == "orders" or related_model_name == "order":
                accessor_name = relation.get_accessor_name()
                if accessor_name:
                    return accessor_name
    except Exception as exc:
        logger.warning("Unable to detect provider orders relation: %s", exc)

    return ""


def annotate_provider_orders_count(queryset: QuerySet[Provider]) -> QuerySet[Provider]:
    """
    Add orders_count annotation if an orders relation exists.
    Falls back to 0 without failing the providers API.
    """

    relation_name = _get_orders_reverse_relation_name()

    if not relation_name:
        return queryset.annotate(
            orders_count=Value(0, output_field=IntegerField()),
        )

    try:
        return queryset.annotate(
            orders_count=Count(relation_name, distinct=True),
        )
    except FieldError as exc:
        logger.warning("Unable to annotate orders_count using relation %s: %s", relation_name, exc)

        return queryset.annotate(
            orders_count=Value(0, output_field=IntegerField()),
        )


def _safe_total_orders(queryset: QuerySet[Provider]) -> int:
    try:
        result = queryset.aggregate(total_orders=Sum("orders_count"))
        return int(result.get("total_orders") or 0)
    except Exception:
        return 0


# ============================================================
# 🔹 Extra Filters / Ordering
# ============================================================

def _apply_manual_source_filter(queryset: QuerySet[Provider], params) -> QuerySet[Provider]:
    """
    Extra compatibility for frontend filters.

    Existing apply_provider_filters may already handle import_source.
    This keeps manual/imported filtering safe for both old and new frontend payloads.
    """

    source = str(params.get("source", "") or "").strip().lower()
    import_source = str(params.get("import_source", "") or "").strip()

    if source == "manual":
        return queryset.filter(import_source="")

    if source == "imported":
        return queryset.exclude(import_source="")

    if import_source:
        return queryset.filter(import_source=import_source)

    return queryset


def _apply_provider_identity_filters(queryset: QuerySet[Provider], params) -> QuerySet[Provider]:
    """
    Optional filters for provider identity and document readiness.

    Supported:
    - has_commercial_registration=true/false
    - has_tax_number=true/false
    - has_logo=true/false
    - has_image=true/false
    - has_drive_folder=true/false

    Notes:
    - apply_provider_filters in services.py already supports some of these.
    - This function keeps the API safe if an older services.py is loaded.
    """

    def parse_bool_param(value):
        value_str = str(value or "").strip().lower()

        if value_str in {"1", "true", "yes", "on", "نعم"}:
            return True

        if value_str in {"0", "false", "no", "off", "لا"}:
            return False

        return None

    has_commercial_registration = parse_bool_param(params.get("has_commercial_registration"))
    has_tax_number = parse_bool_param(params.get("has_tax_number"))
    has_logo = parse_bool_param(params.get("has_logo"))
    has_image = parse_bool_param(params.get("has_image"))
    has_drive_folder = parse_bool_param(params.get("has_drive_folder"))

    if has_commercial_registration is True:
        queryset = queryset.exclude(commercial_registration="")

    if has_commercial_registration is False:
        queryset = queryset.filter(commercial_registration="")

    if has_tax_number is True:
        queryset = queryset.exclude(tax_number="")

    if has_tax_number is False:
        queryset = queryset.filter(tax_number="")

    if has_logo is True:
        queryset = queryset.filter(Q(logo_url__gt="") | Q(logo_drive_file_id__gt=""))

    if has_logo is False:
        queryset = queryset.filter(logo_url="", logo_drive_file_id="")

    if has_image is True:
        queryset = queryset.filter(Q(image_url__gt="") | Q(image_drive_file_id__gt=""))

    if has_image is False:
        queryset = queryset.filter(image_url="", image_drive_file_id="")

    if has_drive_folder is True:
        queryset = queryset.exclude(drive_folder_id="")

    if has_drive_folder is False:
        queryset = queryset.filter(drive_folder_id="")

    return queryset


def _apply_provider_ordering(queryset: QuerySet[Provider], params) -> QuerySet[Provider]:
    """
    Safe ordering for provider list.

    Supported values:
    - sort=most_orders
    - ordering=-orders_count
    - order_by=-orders_count
    - ordering=name / -name
    - ordering=name_ar / -name_ar
    - ordering=name_en / -name_en
    - ordering=city / -city
    - ordering=region / -region
    - ordering=created_at / -created_at
    """

    requested_ordering = (
        str(params.get("ordering", "") or "").strip()
        or str(params.get("order_by", "") or "").strip()
    )
    requested_sort = str(params.get("sort", "") or "").strip().lower()

    if requested_sort == "most_orders":
        return queryset.order_by("-orders_count", "name", "id")

    if requested_sort == "newest":
        return queryset.order_by("-created_at", "-id")

    if requested_sort == "oldest":
        return queryset.order_by("created_at", "id")

    if requested_sort == "name":
        return queryset.order_by("name", "id")

    if requested_sort == "arabic_name":
        return queryset.order_by("name_ar", "name", "id")

    if requested_sort == "english_name":
        return queryset.order_by("name_en", "name", "id")

    allowed_ordering = {
        "name",
        "-name",
        "name_ar",
        "-name_ar",
        "name_en",
        "-name_en",
        "code",
        "-code",
        "commercial_registration",
        "-commercial_registration",
        "tax_number",
        "-tax_number",
        "city",
        "-city",
        "region",
        "-region",
        "area",
        "-area",
        "status",
        "-status",
        "provider_type",
        "-provider_type",
        "source_category",
        "-source_category",
        "import_source",
        "-import_source",
        "created_at",
        "-created_at",
        "updated_at",
        "-updated_at",
        "orders_count",
        "-orders_count",
    }

    if requested_ordering in allowed_ordering:
        return queryset.order_by(requested_ordering, "id")

    return queryset.order_by("-created_at", "-id")


# ============================================================
# 🔹 Serialization / Summary
# ============================================================

def serialize_provider_with_orders(provider: Provider) -> dict[str, Any]:
    """
    Preserve the current serializer output and add count fields needed by frontend.
    """

    data = serialize_provider(provider)
    orders_count = int(getattr(provider, "orders_count", 0) or 0)

    data["orders_count"] = orders_count
    data["order_count"] = orders_count
    data["total_orders"] = orders_count

    return data


def build_providers_summary(queryset: QuerySet[Provider]) -> dict[str, Any]:
    """
    Build lightweight summary for provider dashboard/list pages.

    Notes:
    - Uses the already-filtered queryset.
    - Keeps old response shape intact by adding summary only.
    - Includes imported medical network counters.
    - Includes total_orders when orders relation exists.
    - Includes identity/document readiness counters.
    """

    total_providers = queryset.count()
    imported_providers = _safe_exclude_count(queryset, import_source="")

    providers_with_logo = _safe_filter_count(
        queryset,
        Q(logo_url__gt="") | Q(logo_drive_file_id__gt=""),
    )
    providers_with_image = _safe_filter_count(
        queryset,
        Q(image_url__gt="") | Q(image_drive_file_id__gt=""),
    )
    providers_with_drive_folder = _safe_exclude_count(queryset, drive_folder_id="")
    providers_with_commercial_registration = _safe_exclude_count(queryset, commercial_registration="")
    providers_with_tax_number = _safe_exclude_count(queryset, tax_number="")

    return {
        "total_providers": total_providers,
        "active_providers": _safe_count(queryset, status=ProviderStatus.ACTIVE),
        "inactive_providers": _safe_count(queryset, status=ProviderStatus.INACTIVE),
        "suspended_providers": _safe_count(queryset, status=ProviderStatus.SUSPENDED),
        "draft_providers": _safe_count(queryset, status=ProviderStatus.DRAFT),
        "hospitals_count": _safe_count(queryset, provider_type=ProviderType.HOSPITAL),
        "medical_centers_count": _safe_count(
            queryset,
            provider_type=ProviderType.MEDICAL_CENTER,
        ),
        "pharmacies_count": _safe_count(queryset, provider_type=ProviderType.PHARMACY),
        "labs_count": _safe_count(queryset, provider_type=ProviderType.LAB),
        "clinics_count": _safe_count(queryset, provider_type=ProviderType.CLINIC),
        "partners_count": _safe_count(queryset, provider_type=ProviderType.PARTNER),
        "others_count": _safe_count(queryset, provider_type=ProviderType.OTHER),
        "featured_providers": _safe_count(queryset, is_featured=True),
        "imported_providers": imported_providers,
        "manual_providers": max(0, total_providers - imported_providers),
        "total_orders": _safe_total_orders(queryset),

        # New identity/readiness summary.
        "providers_with_logo": providers_with_logo,
        "providers_without_logo": max(0, total_providers - providers_with_logo),
        "providers_with_image": providers_with_image,
        "providers_without_image": max(0, total_providers - providers_with_image),
        "providers_with_drive_folder": providers_with_drive_folder,
        "providers_without_drive_folder": max(0, total_providers - providers_with_drive_folder),
        "providers_with_commercial_registration": providers_with_commercial_registration,
        "providers_without_commercial_registration": max(
            0,
            total_providers - providers_with_commercial_registration,
        ),
        "providers_with_tax_number": providers_with_tax_number,
        "providers_without_tax_number": max(0, total_providers - providers_with_tax_number),
    }


# ============================================================
# 🔹 Providers API
# ============================================================

@require_http_methods(["GET", "POST"])
def providers_api(request):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "GET":
        queryset = Provider.objects.all()
        queryset = apply_provider_filters(queryset, request.GET)
        queryset = _apply_manual_source_filter(queryset, request.GET)
        queryset = _apply_provider_identity_filters(queryset, request.GET)
        queryset = annotate_provider_orders_count(queryset)
        queryset = _apply_provider_ordering(queryset, request.GET)

        page = parse_int(request.GET.get("page"), 1) or 1
        page_size = parse_int(request.GET.get("page_size"), 20) or 20

        summary = build_providers_summary(queryset)
        paginated = paginate_queryset(queryset, page=page, page_size=page_size)

        return JsonResponse(
            {
                "ok": True,
                "message": "Providers loaded successfully.",
                "results": [
                    serialize_provider_with_orders(item)
                    for item in paginated["items"]
                ],
                "pagination": paginated["pagination"],
                "summary": summary,
            },
            status=200,
        )

    try:
        payload = parse_json_body(request)
        provider = create_provider(payload=payload)

        return JsonResponse(
            {
                "ok": True,
                "message": "Provider created successfully.",
                "data": serialize_provider(provider),
            },
            status=201,
        )

    except ValidationError as exc:
        return _json_error(
            "Validation failed while creating provider.",
            400,
            errors=exc.messages,
        )

    except Exception as exc:
        logger.exception("Failed to create provider: %s", exc)
        return _json_error("Unexpected error while creating provider.", 500)


# ============================================================
# 🔹 Active Providers API
# ============================================================

@require_http_methods(["GET"])
def active_providers_api(request):
    queryset = Provider.objects.filter(status=ProviderStatus.ACTIVE)
    queryset = apply_provider_filters(queryset, request.GET)
    queryset = _apply_manual_source_filter(queryset, request.GET)
    queryset = _apply_provider_identity_filters(queryset, request.GET)
    queryset = annotate_provider_orders_count(queryset)
    queryset = _apply_provider_ordering(queryset, request.GET)

    page = parse_int(request.GET.get("page"), 1) or 1
    page_size = parse_int(request.GET.get("page_size"), 20) or 20

    summary = build_providers_summary(queryset)
    paginated = paginate_queryset(queryset, page=page, page_size=page_size)

    return JsonResponse(
        {
            "ok": True,
            "message": "Active providers loaded successfully.",
            "results": [
                serialize_provider_with_orders(item)
                for item in paginated["items"]
            ],
            "pagination": paginated["pagination"],
            "summary": summary,
        },
        status=200,
    )