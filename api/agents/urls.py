# ============================================================
# 📂 api/agents/urls.py
# 🧠 Primey Care | Agents API URLs V7
# ------------------------------------------------------------
# ✅ Agents endpoints
# ✅ Create agent endpoint
# ✅ Agent detail endpoint
# ✅ Agent statement alias endpoint
# ✅ Broker options/list endpoint for agent create + brokers pages
# ✅ Broker create endpoint
# ✅ Broker detail endpoint
# ✅ Commissions endpoints
# ✅ Commission approval endpoint
# ------------------------------------------------------------
# ملاحظات:
# - تفاصيل المندوب وكشف الحساب موجودة داخل agent_detail_api.
# - يمكن جلب كشف حساب المندوب عبر:
#   /api/agents/<agent_id>/?include_statement=1
# - أو:
#   /api/agents/<agent_id>/statement/?include_statement=1
#
# - صفحة إنشاء المندوب تستخدم:
#   GET  /api/agents/brokers/
#   POST /api/agents/create/
#
# - إدارة الوسطاء تستخدم:
#   GET  /api/agents/brokers/
#   GET  /api/agents/brokers/list/
#   GET  /api/agents/brokers/options/
#   POST /api/agents/brokers/create/
#   GET  /api/agents/brokers/<broker_id>/
# ============================================================

from __future__ import annotations

from typing import Any

from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import JsonResponse
from django.urls import path
from django.views.decorators.http import require_GET

from agents.models import Broker
from auth_center.permissions import PermissionCodes, any_permission_required

from .approve import approve_commission_api
from .broker_create import create_broker_api
from .broker_detail import broker_detail_api
from .create import create_agent_api
from .detail import agent_detail_api, commission_detail_api
from .list import agent_list_api, commission_list_api


app_name = "api_agents"


# ============================================================
# Safe Helpers
# ============================================================

def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _int_param(value: Any, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
        return max(minimum, min(parsed, maximum))
    except (TypeError, ValueError):
        return default


def _date_iso(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _broker_display_name(broker: Broker) -> str:
    return (
        getattr(broker, "name", None)
        or getattr(broker, "full_name", None)
        or getattr(broker, "display_name", None)
        or getattr(broker, "broker_name", None)
        or str(broker)
    )


def _broker_code(broker: Broker) -> str:
    return (
        getattr(broker, "broker_code", None)
        or getattr(broker, "code", None)
        or f"BRK-{broker.pk}"
    )


def _broker_phone(broker: Broker) -> str:
    return (
        getattr(broker, "phone", None)
        or getattr(broker, "phone_number", None)
        or getattr(broker, "mobile", None)
        or ""
    )


def _broker_email(broker: Broker) -> str:
    return getattr(broker, "email", None) or ""


def _broker_status(broker: Broker) -> str:
    return getattr(broker, "status", None) or ""


def _broker_referral_code(broker: Broker) -> str:
    return (
        getattr(broker, "referral_code", None)
        or getattr(broker, "ref_code", None)
        or ""
    )


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
        "username": getattr(user, "username", ""),
        "email": getattr(user, "email", ""),
        "first_name": getattr(user, "first_name", ""),
        "last_name": getattr(user, "last_name", ""),
        "full_name": full_name,
        "is_active": bool(getattr(user, "is_active", False)),
        "is_staff": bool(getattr(user, "is_staff", False)),
        "is_superuser": bool(getattr(user, "is_superuser", False)),
        "last_login": _date_iso(getattr(user, "last_login", None)),
        "date_joined": _date_iso(getattr(user, "date_joined", None)),
    }


def _serialize_broker_option(broker: Broker) -> dict[str, Any]:
    name = _broker_display_name(broker)
    code = _broker_code(broker)
    referral_code = _broker_referral_code(broker)
    phone = _broker_phone(broker)
    email = _broker_email(broker)
    status = _broker_status(broker)
    user = getattr(broker, "user", None)

    return {
        "id": broker.pk,
        "name": name,
        "full_name": name,
        "broker_name": name,

        "broker_code": code,
        "code": code,
        "referral_code": referral_code,

        "phone": phone,
        "phone_number": phone,
        "email": email,
        "status": status,

        "city": getattr(broker, "city", "") or "",
        "address": getattr(broker, "address", "") or "",

        "default_commission_type": getattr(broker, "default_commission_type", "") or "",
        "default_commission_value": str(
            getattr(broker, "default_commission_value", "0.00") or "0.00"
        ),
        "revenue_recognition_mode": getattr(broker, "revenue_recognition_mode", "") or "",
        "settlement_mode": getattr(broker, "settlement_mode", "") or "",

        "bank_name": getattr(broker, "bank_name", "") or "",
        "bank_account_name": getattr(broker, "bank_account_name", "") or "",
        "iban": getattr(broker, "iban", "") or "",
        "notes": getattr(broker, "notes", "") or "",

        "user_id": getattr(broker, "user_id", None),
        "has_login_user": bool(getattr(broker, "user_id", None)),
        "login_user": _serialize_login_user(user),

        "created_at": (
            broker.created_at.isoformat()
            if getattr(broker, "created_at", None)
            else None
        ),
        "updated_at": (
            broker.updated_at.isoformat()
            if getattr(broker, "updated_at", None)
            else None
        ),

        "label": f"{name} · {code}" if code else name,
        "value": broker.pk,
    }


# ============================================================
# Broker Options/List API
# ============================================================

@login_required
@require_GET
@any_permission_required(
    (
        PermissionCodes.BROKERS_VIEW,
        PermissionCodes.AGENTS_VIEW,
    )
)
def broker_options_api(request):
    """
    Endpoint used by:
    - primey_frontend/app/system/agents/create/page.tsx
    - primey_frontend/app/system/brokers/page.tsx

    Returns brokers for searchable selector/list:
    GET /api/agents/brokers/?search=...&page_size=100
    """

    search = _clean_text(request.GET.get("search") or request.GET.get("q"))
    page_size = _int_param(
        request.GET.get("page_size") or request.GET.get("limit"),
        default=100,
        minimum=1,
        maximum=500,
    )

    queryset = Broker.objects.select_related("user").all()

    search_query = Q()

    if search:
        search_query |= Q(pk__icontains=search)

        for field_name in [
            "name",
            "full_name",
            "display_name",
            "broker_name",
            "broker_code",
            "code",
            "referral_code",
            "ref_code",
            "phone",
            "phone_number",
            "mobile",
            "email",
            "city",
        ]:
            try:
                Broker._meta.get_field(field_name)
                search_query |= Q(**{f"{field_name}__icontains": search})
            except Exception:
                continue

        try:
            Broker._meta.get_field("user")
            search_query |= Q(user__username__icontains=search)
            search_query |= Q(user__email__icontains=search)
            search_query |= Q(user__first_name__icontains=search)
            search_query |= Q(user__last_name__icontains=search)
        except Exception:
            pass

        queryset = queryset.filter(search_query)

    status = _clean_text(request.GET.get("status")).upper()
    if status:
        try:
            Broker._meta.get_field("status")
            queryset = queryset.filter(status=status)
        except Exception:
            pass

    has_login_user = _clean_text(request.GET.get("has_login_user")).lower()
    if has_login_user in {"1", "true", "yes", "y", "on"}:
        queryset = queryset.filter(user__isnull=False)
    elif has_login_user in {"0", "false", "no", "n", "off"}:
        queryset = queryset.filter(user__isnull=True)

    try:
        Broker._meta.get_field("name")
        queryset = queryset.order_by("name", "id")
    except Exception:
        try:
            Broker._meta.get_field("broker_code")
            queryset = queryset.order_by("broker_code", "id")
        except Exception:
            queryset = queryset.order_by("id")

    total_count = queryset.count()
    items = [_serialize_broker_option(broker) for broker in queryset[:page_size]]

    return JsonResponse(
        {
            "ok": True,
            "success": True,
            "message": "تم جلب الوسطاء بنجاح.",
            "count": total_count,
            "returned_count": len(items),
            "results": items,
            "items": items,
            "brokers": items,
            "filters": {
                "search": search,
                "status": status,
                "has_login_user": request.GET.get("has_login_user") or "",
                "page_size": page_size,
            },
            "data": {
                "count": total_count,
                "returned_count": len(items),
                "results": items,
                "items": items,
                "brokers": items,
            },
        },
        json_dumps_params={"ensure_ascii": False},
    )


urlpatterns = [
    # ========================================================
    # 👥 Agents
    # ========================================================
    path(
        "",
        agent_list_api,
        name="list",
    ),
    path(
        "create/",
        create_agent_api,
        name="create",
    ),

    # ========================================================
    # 🤝 Brokers
    # --------------------------------------------------------
    # مهم أن تكون مسارات brokers قبل <int:agent_id>/
    # حتى لا يفسرها Django كـ agent_id.
    # كذلك create قبل <int:broker_id>/ حتى لا يحدث تعارض.
    # ========================================================
    path(
        "brokers/",
        broker_options_api,
        name="brokers-options",
    ),
    path(
        "brokers/list/",
        broker_options_api,
        name="brokers-list",
    ),
    path(
        "brokers/options/",
        broker_options_api,
        name="brokers-options-alias",
    ),
    path(
        "brokers/create/",
        create_broker_api,
        name="brokers-create",
    ),
    path(
        "brokers/<int:broker_id>/",
        broker_detail_api,
        name="brokers-detail",
    ),

    # ========================================================
    # 💰 Commissions
    # --------------------------------------------------------
    # وضعناها قبل <int:agent_id>/ كتنظيم أوضح، رغم أن Django
    # لن يخلط كلمة commissions مع int.
    # ========================================================
    path(
        "commissions/",
        commission_list_api,
        name="commissions-list",
    ),
    path(
        "commissions/<int:commission_id>/",
        commission_detail_api,
        name="commissions-detail",
    ),
    path(
        "commissions/<int:commission_id>/approve/",
        approve_commission_api,
        name="commissions-approve",
    ),

    # ========================================================
    # 👤 Agent Detail
    # ========================================================
    path(
        "<int:agent_id>/",
        agent_detail_api,
        name="detail",
    ),

    # ========================================================
    # 🧾 Agent Statement Alias
    # ========================================================
    path(
        "<int:agent_id>/statement/",
        agent_detail_api,
        name="statement",
    ),
]