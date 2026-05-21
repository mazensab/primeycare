# ============================================================
# 📂 api/contracts/list.py
# 🧠 Primey Care | Contracts API List/Create V2
# ------------------------------------------------------------
# ✅ List Contracts
# ✅ Create Contract
# ✅ Filters + Pagination
# ✅ Lightweight Summary
# ✅ ContractProduct Offers Support
# ✅ Authenticated Access
# ✅ إنشاء حساب دخول اختياري لمقدم الخدمة عند إنشاء العقد
# ------------------------------------------------------------
# القاعدة المعتمدة:
# - Product = كتالوج ثابت
# - Provider = كيان مقدم الخدمة في الشبكة
# - Contract = بداية العلاقة الرسمية مع مقدم الخدمة
# - Provider.user = حساب دخول رئيسي اختياري ينشأ عند العقد
# - ContractProduct = عرض/سعر/خصم المنتج حسب مقدم الخدمة والعقد
# ============================================================

from __future__ import annotations

import logging
from typing import Any

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods

from contracts.models import Contract, ContractProduct, ContractStatus
from contracts.services import (
    apply_contract_filters,
    create_contract,
    paginate_queryset,
    parse_int,
    parse_json_body,
    serialize_contract,
)

logger = logging.getLogger(__name__)


# ============================================================
# 🔹 JSON Helpers
# ============================================================

def _json_error(message: str, status: int = 400, *, errors=None) -> JsonResponse:
    payload = {
        "ok": False,
        "success": False,
        "message": message,
    }

    if errors is not None:
        payload["errors"] = errors

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _json_success(data: dict[str, Any], status: int = 200) -> JsonResponse:
    payload = {
        "ok": True,
        "success": True,
    }
    payload.update(data)

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _validation_errors(exc: ValidationError):
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return exc.messages

    return [str(exc)]


# ============================================================
# 🔹 Safe Helpers
# ============================================================

def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _clean_email(value: Any) -> str:
    return _clean_text(value).lower()


def _parse_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return bool(value)

    normalized = str(value).strip().lower()

    if normalized in {"1", "true", "yes", "y", "on", "نعم", "صح"}:
        return True

    if normalized in {"0", "false", "no", "n", "off", "لا", "خطأ"}:
        return False

    return default


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _ensure_authenticated(request):
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return None, _json_error("Authentication required.", 401)

    return request.user, None


def _user_has_any_permission(user, permissions: tuple[str, ...]) -> bool:
    if getattr(user, "is_superuser", False):
        return True

    profile = getattr(user, "profile", None) or getattr(user, "userprofile", None)
    role = str(getattr(profile, "role", "") or "").lower() if profile else ""
    user_type = str(getattr(profile, "user_type", "") or "").upper() if profile else ""

    if role == "system_admin" or user_type in {"SUPER_ADMIN", "SYSTEM_ADMIN"}:
        return True

    for permission in permissions:
        try:
            if user.has_perm(permission):
                return True
        except Exception:
            continue

    for attr in ("permission_codes", "permissions", "profile_permissions"):
        value = getattr(profile, attr, None) if profile else None

        if not value:
            continue

        if isinstance(value, dict):
            codes = value.get("codes", [])
            if any(code in permissions for code in codes):
                return True

        if isinstance(value, (list, tuple, set)):
            if any(code in permissions for code in value):
                return True

        manager = getattr(value, "all", None)
        if callable(manager):
            for item in value.all():
                code = getattr(item, "code", None) or getattr(item, "codename", None)
                if code in permissions:
                    return True

    return False


def _ensure_permission(user, permissions: tuple[str, ...]):
    if _user_has_any_permission(user, permissions):
        return None

    return _json_error(
        "You do not have permission to perform this action.",
        403,
        errors={"required_permissions": list(permissions)},
    )


def _contracts_queryset():
    return (
        Contract.objects
        .select_related(
            "provider",
            "provider__user",
        )
        .prefetch_related(
            "contract_products",
            "contract_products__product",
            "contract_products__product__category",
        )
        .all()
    )


def _model_has_field(model_or_instance: Any, field_name: str) -> bool:
    try:
        model_or_instance._meta.get_field(field_name)
        return True
    except Exception:
        return False


def _save_provider_user_link(provider: Any, user: Any) -> None:
    if not provider or not user:
        return

    provider.user = user

    update_fields = ["user"]

    if _model_has_field(provider, "updated_at"):
        update_fields.append("updated_at")

    provider.save(update_fields=update_fields)


# ============================================================
# 🔹 Summary
# ============================================================

def _build_contracts_summary() -> dict:
    status_counts = {
        item["status"]: item["total"]
        for item in Contract.objects.values("status").annotate(total=Count("id"))
    }

    return {
        "total_contracts": Contract.objects.count(),
        "active_contracts": status_counts.get(ContractStatus.ACTIVE, 0),
        "draft_contracts": status_counts.get(ContractStatus.DRAFT, 0),
        "suspended_contracts": status_counts.get(ContractStatus.SUSPENDED, 0),
        "expired_contracts": status_counts.get(ContractStatus.EXPIRED, 0),
        "terminated_contracts": status_counts.get(ContractStatus.TERMINATED, 0),

        "contracts_with_products": (
            Contract.objects
            .filter(contract_products__isnull=False)
            .distinct()
            .count()
        ),
        "providers_with_contracts": (
            Contract.objects
            .values("provider_id")
            .distinct()
            .count()
        ),
        "providers_with_login_users": (
            Contract.objects
            .filter(provider__user__isnull=False)
            .values("provider_id")
            .distinct()
            .count()
        ),
        "providers_without_login_users": max(
            0,
            (
                Contract.objects.values("provider_id").distinct().count()
                - Contract.objects
                .filter(provider__user__isnull=False)
                .values("provider_id")
                .distinct()
                .count()
            ),
        ),

        "total_contract_products": ContractProduct.objects.count(),
        "active_contract_products": ContractProduct.objects.filter(is_active=True).count(),
        "featured_contract_offers": ContractProduct.objects.filter(is_featured=True).count(),
        "landing_contract_offers": ContractProduct.objects.filter(show_on_landing=True).count(),
        "mobile_contract_offers": ContractProduct.objects.filter(show_on_mobile=True).count(),
        "offers_page_contract_offers": ContractProduct.objects.filter(show_on_offers=True).count(),
        "distinct_products_in_contracts": (
            ContractProduct.objects
            .values("product_id")
            .distinct()
            .count()
        ),
    }


# ============================================================
# 🔐 Provider Login User Helpers
# ============================================================

def _serialize_login_user(user: Any | None) -> dict[str, Any] | None:
    if not user:
        return None

    full_name = ""
    try:
        full_name = (user.get_full_name() or "").strip()
    except Exception:
        full_name = ""

    return {
        "id": getattr(user, "pk", None),
        "username": getattr(user, "username", "") or "",
        "email": getattr(user, "email", "") or "",
        "first_name": getattr(user, "first_name", "") or "",
        "last_name": getattr(user, "last_name", "") or "",
        "full_name": full_name,
        "is_active": bool(getattr(user, "is_active", False)),
        "is_staff": bool(getattr(user, "is_staff", False)),
        "is_superuser": bool(getattr(user, "is_superuser", False)),
        "last_login": _iso_datetime(getattr(user, "last_login", None)),
        "date_joined": _iso_datetime(getattr(user, "date_joined", None)),
    }


def _provider_name(provider: Any) -> str:
    if not provider:
        return ""

    return (
        _clean_text(getattr(provider, "name_ar", ""))
        or _clean_text(getattr(provider, "name", ""))
        or _clean_text(getattr(provider, "name_en", ""))
        or str(provider)
    )


def _serialize_provider_login_summary(provider: Any | None) -> dict[str, Any] | None:
    if not provider:
        return None

    user = getattr(provider, "user", None)

    return {
        "id": getattr(provider, "pk", None),
        "name": _provider_name(provider),
        "name_ar": getattr(provider, "name_ar", "") or "",
        "name_en": getattr(provider, "name_en", "") or "",
        "code": getattr(provider, "code", "") or "",
        "email": getattr(provider, "email", "") or "",
        "phone": (
            getattr(provider, "phone", "")
            or getattr(provider, "mobile", "")
            or ""
        ),
        "user_id": getattr(provider, "user_id", None),
        "has_login_user": bool(getattr(provider, "user_id", None)),
        "login_user": _serialize_login_user(user),
    }


def _build_provider_login_payload(contract: Contract, payload: dict[str, Any]) -> dict[str, Any]:
    provider = getattr(contract, "provider", None)
    provider_name = _provider_name(provider)

    contact_name = (
        _clean_text(payload.get("provider_login_display_name"))
        or _clean_text(payload.get("provider_login_name"))
        or _clean_text(payload.get("login_display_name"))
        or _clean_text(payload.get("contact_name"))
        or _clean_text(payload.get("provider_contact_name"))
        or _clean_text(getattr(contract, "provider_contact_name", ""))
        or _clean_text(getattr(provider, "contact_person", ""))
        or provider_name
    )

    contact_email = (
        _clean_email(payload.get("provider_login_email"))
        or _clean_email(payload.get("login_email"))
        or _clean_email(payload.get("provider_contact_email"))
        or _clean_email(getattr(contract, "provider_contact_email", ""))
        or _clean_email(getattr(provider, "email", ""))
    )

    contact_phone = (
        _clean_text(payload.get("provider_login_phone"))
        or _clean_text(payload.get("provider_login_phone_number"))
        or _clean_text(payload.get("login_phone"))
        or _clean_text(payload.get("provider_contact_phone"))
        or _clean_text(getattr(contract, "provider_contact_phone", ""))
        or _clean_text(getattr(provider, "mobile", ""))
        or _clean_text(getattr(provider, "phone", ""))
    )

    return {
        "username": (
            _clean_text(payload.get("provider_login_username"))
            or _clean_text(payload.get("login_username"))
            or ""
        ) or None,
        "email": contact_email or None,
        "password": (
            payload.get("provider_login_password")
            or payload.get("login_password")
            or None
        ),
        "display_name": contact_name or provider_name or None,
        "phone_number": contact_phone or None,
        "whatsapp_number": (
            _clean_text(payload.get("provider_login_whatsapp"))
            or _clean_text(payload.get("provider_login_whatsapp_number"))
            or _clean_text(payload.get("login_whatsapp"))
            or contact_phone
            or None
        ),
    }


def _update_provider_profile_context(*, user: Any, provider: Any) -> Any | None:
    profile = getattr(user, "profile", None) or getattr(user, "userprofile", None)

    if profile is None:
        return None

    extra_data = getattr(profile, "extra_data", None)
    if not isinstance(extra_data, dict):
        extra_data = {}

    extra_data["provider_id"] = provider.pk
    extra_data["provider"] = provider.pk
    extra_data["entity_type"] = "provider"
    extra_data["entity_id"] = provider.pk

    update_fields: list[str] = []

    if hasattr(profile, "extra_data"):
        profile.extra_data = extra_data
        update_fields.append("extra_data")

    if hasattr(profile, "user_type"):
        profile.user_type = "PROVIDER"
        update_fields.append("user_type")

    if hasattr(profile, "role"):
        profile.role = "provider_admin"
        update_fields.append("role")

    if hasattr(profile, "display_name"):
        provider_name = _provider_name(provider)
        if provider_name and not getattr(profile, "display_name", ""):
            profile.display_name = provider_name
            update_fields.append("display_name")

    if hasattr(profile, "phone_number"):
        phone = (
            getattr(provider, "mobile", "")
            or getattr(provider, "phone", "")
            or ""
        )
        if phone and not getattr(profile, "phone_number", ""):
            profile.phone_number = phone
            update_fields.append("phone_number")

    if hasattr(profile, "alternate_email"):
        email = getattr(provider, "email", "") or ""
        if email and not getattr(profile, "alternate_email", ""):
            profile.alternate_email = email
            update_fields.append("alternate_email")

    if hasattr(profile, "updated_at"):
        update_fields.append("updated_at")

    if update_fields:
        profile.save(update_fields=sorted(set(update_fields)))

    return profile


def _create_provider_user_with_auth_center(
    *,
    provider: Any,
    login_payload: dict[str, Any],
    actor: Any,
):
    """
    يحاول أولًا استخدام create_provider_user إن كانت موجودة.
    وإذا لم تكن موجودة يستخدم create_actor_user لأنها أصبحت المصدر العام لدينا.
    """

    try:
        from auth_center.services import create_provider_user
    except Exception:
        create_provider_user = None

    if callable(create_provider_user):
        create_kwargs: dict[str, Any] = {
            "provider_id": provider.pk,
            "email": login_payload["email"],
            "display_name": login_payload["display_name"],
            "phone_number": login_payload["phone_number"],
            "whatsapp_number": login_payload["whatsapp_number"],
        }

        if login_payload.get("username"):
            create_kwargs["username"] = login_payload["username"]

        if login_payload.get("password"):
            create_kwargs["password"] = login_payload["password"]

        try:
            return create_provider_user(**create_kwargs)
        except TypeError:
            # توافق آمن إذا كانت خدمة auth_center الحالية لا تقبل username/password بعد.
            create_kwargs.pop("username", None)
            create_kwargs.pop("password", None)
            return create_provider_user(**create_kwargs)

    try:
        from auth_center.services import create_actor_user
    except Exception as exc:
        raise ValidationError(
            {
                "provider_login_user": [
                    "تعذر تحميل خدمة إنشاء مستخدم مقدم الخدمة."
                ]
            }
        ) from exc

    return create_actor_user(
        user_type="PROVIDER",
        role="provider_admin",
        email=login_payload.get("email"),
        username=login_payload.get("username"),
        password=login_payload.get("password"),
        display_name=login_payload.get("display_name"),
        phone_number=login_payload.get("phone_number"),
        whatsapp_number=login_payload.get("whatsapp_number"),
        provider_id=provider.pk,
        entity_type="provider",
        entity_id=provider.pk,
        is_active=True,
        create_group=True,
        update_existing=True,
        extra_data={
            "provider_id": provider.pk,
            "provider": provider.pk,
            "entity_type": "provider",
            "entity_id": provider.pk,
            "source": "contracts_create_provider_login_user",
            "created_by_id": getattr(actor, "pk", None),
        },
        tags=["provider", "provider_admin"],
    )


@transaction.atomic
def _create_provider_login_user_for_contract(
    *,
    contract: Contract,
    payload: dict[str, Any],
    actor: Any,
) -> dict[str, Any]:
    provider = getattr(contract, "provider", None)

    if not provider:
        raise ValidationError({"provider": ["لا يوجد مقدم خدمة مرتبط بهذا العقد."]})

    if getattr(provider, "user_id", None):
        return {
            "created": False,
            "linked": False,
            "message": "مقدم الخدمة لديه حساب دخول مرتبط مسبقًا.",
            "user": provider.user,
            "profile": (
                getattr(provider.user, "profile", None)
                or getattr(provider.user, "userprofile", None)
            ),
            "temporary_password": None,
        }

    login_payload = _build_provider_login_payload(contract, payload)

    if not (
        login_payload.get("email")
        or login_payload.get("username")
        or login_payload.get("phone_number")
    ):
        raise ValidationError(
            {
                "provider_login_user": [
                    "لإنشاء حساب دخول لمقدم الخدمة، يجب توفر بريد إلكتروني أو اسم مستخدم أو رقم جوال."
                ]
            }
        )

    auth_result = _create_provider_user_with_auth_center(
        provider=provider,
        login_payload=login_payload,
        actor=actor,
    )

    user = getattr(auth_result, "user", None)

    if not user:
        raise ValidationError(
            {
                "provider_login_user": [
                    "لم تُرجع خدمة إنشاء مستخدم مقدم الخدمة مستخدمًا صالحًا."
                ]
            }
        )

    _save_provider_user_link(provider, user)

    provider.refresh_from_db()

    profile = (
        getattr(auth_result, "profile", None)
        or _update_provider_profile_context(
            user=user,
            provider=provider,
        )
    )

    return {
        "created": bool(getattr(auth_result, "created", False)),
        "linked": True,
        "message": "تم إنشاء وربط حساب دخول مقدم الخدمة بنجاح.",
        "user": user,
        "profile": profile,
        "temporary_password": getattr(auth_result, "temporary_password", None),
    }


def _should_create_provider_login_user(payload: dict[str, Any]) -> bool:
    return _parse_bool(
        payload.get("create_provider_login_user")
        or payload.get("create_provider_user")
        or payload.get("create_login_user_for_provider")
        or payload.get("create_provider_account"),
        default=False,
    )


def _enrich_contract_payload(
    *,
    contract: Contract,
    provider_login_result: dict[str, Any] | None = None,
) -> dict[str, Any]:
    serialized_contract = serialize_contract(contract)

    provider = getattr(contract, "provider", None)
    provider_user = getattr(provider, "user", None) if provider else None
    provider_payload = _serialize_provider_login_summary(provider)

    if isinstance(serialized_contract, dict):
        current_provider = serialized_contract.get("provider")

        if isinstance(current_provider, dict) and provider_payload:
            serialized_contract["provider"] = {
                **current_provider,
                **provider_payload,
            }
        elif provider_payload:
            serialized_contract["provider"] = provider_payload

        serialized_contract["provider_id"] = getattr(provider, "pk", None) if provider else None
        serialized_contract["provider_user_id"] = getattr(provider, "user_id", None) if provider else None
        serialized_contract["has_provider_login_user"] = bool(provider_user)
        serialized_contract["provider_login_user"] = _serialize_login_user(provider_user)

    response_payload: dict[str, Any] = {
        "contract": serialized_contract,
        "item": serialized_contract,
        "provider": provider_payload,
        "has_provider_login_user": bool(provider_user),
        "provider_login_user": _serialize_login_user(provider_user),
    }

    if provider_login_result is not None:
        response_payload["provider_login_user_created"] = provider_login_result.get("created", False)
        response_payload["provider_login_user_linked"] = provider_login_result.get("linked", False)
        response_payload["provider_login_message"] = provider_login_result.get("message", "")
        response_payload["temporary_password"] = provider_login_result.get("temporary_password")

    response_payload["data"] = {
        "contract": serialized_contract,
        "provider": provider_payload,
        "has_provider_login_user": response_payload["has_provider_login_user"],
        "provider_login_user": response_payload["provider_login_user"],
        "provider_login_user_created": response_payload.get("provider_login_user_created", False),
        "provider_login_user_linked": response_payload.get("provider_login_user_linked", False),
        "provider_login_message": response_payload.get("provider_login_message", ""),
        "temporary_password": response_payload.get("temporary_password"),
    }

    return response_payload


# ============================================================
# 🔹 Contracts API
# ============================================================

@csrf_protect
@require_http_methods(["GET", "POST"])
def contracts_api(request):
    user, auth_error = _ensure_authenticated(request)

    if auth_error:
        return auth_error

    if request.method == "GET":
        permission_error = _ensure_permission(
            user,
            (
                "contracts.view_contract",
                "contracts.list_contract",
                "contracts.manage_contracts",
                "view_contract",
                "list_contract",
                "manage_contracts",
            ),
        )

        if permission_error:
            return permission_error

        queryset = _contracts_queryset()
        queryset = apply_contract_filters(queryset, request.GET)

        page = parse_int(request.GET.get("page"), 1) or 1
        page_size = parse_int(request.GET.get("page_size"), 20) or 20

        paginated = paginate_queryset(
            queryset,
            page=page,
            page_size=page_size,
        )

        results = [
            _enrich_contract_payload(contract=item).get("contract")
            for item in paginated["items"]
        ]

        return _json_success(
            {
                "message": "Contracts loaded successfully.",
                "summary": _build_contracts_summary(),
                "results": results,
                "contracts": results,
                "pagination": paginated["pagination"],
                "data": {
                    "summary": _build_contracts_summary(),
                    "results": results,
                    "contracts": results,
                    "pagination": paginated["pagination"],
                },
            },
            status=200,
        )

    permission_error = _ensure_permission(
        user,
        (
            "contracts.add_contract",
            "contracts.create_contract",
            "contracts.manage_contracts",
            "add_contract",
            "create_contract",
            "manage_contracts",
        ),
    )

    if permission_error:
        return permission_error

    try:
        payload = parse_json_body(request)
        create_provider_login_user = _should_create_provider_login_user(payload)

        provider_login_result: dict[str, Any] | None = None

        with transaction.atomic():
            contract = create_contract(payload=payload)

            contract = _contracts_queryset().get(pk=contract.pk)

            if create_provider_login_user:
                provider_login_result = _create_provider_login_user_for_contract(
                    contract=contract,
                    payload=payload,
                    actor=user,
                )

                contract = _contracts_queryset().get(pk=contract.pk)

        enriched_payload = _enrich_contract_payload(
            contract=contract,
            provider_login_result=provider_login_result,
        )

        response_payload: dict[str, Any] = {
            "message": (
                "Contract and provider login user created successfully."
                if create_provider_login_user and enriched_payload.get("has_provider_login_user")
                else "Contract created successfully."
            ),
            "create_provider_login_user": create_provider_login_user,
            **enriched_payload,
        }

        response_payload["data"]["create_provider_login_user"] = create_provider_login_user

        return _json_success(response_payload, status=201)

    except ValidationError as exc:
        return _json_error(
            "Validation failed while creating contract.",
            400,
            errors=_validation_errors(exc),
        )

    except Exception as exc:
        logger.exception("Failed to create contract: %s", exc)

        return _json_error(
            "Unexpected error while creating contract.",
            500,
        )