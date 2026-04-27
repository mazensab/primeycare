# ================================================================
# 📂 system_log/middleware.py
# 🛰️ Primey Care - System Log Sniffer Middleware
# ------------------------------------------------
# ✅ متوافق مع Primey Care
# ✅ بدون company_manager / CompanyUser
# ✅ يدعم company_reference من session / headers / request
# ✅ لا يكسر auth
# ✅ يدعم بث WebSocket لحظي
# ================================================================

from __future__ import annotations

import asyncio

from channels.layers import get_channel_layer
from django.utils.deprecation import MiddlewareMixin
from django.utils.timezone import now

from .models import SystemLog


class SystemLogSniffer(MiddlewareMixin):
    AUTH_EXCLUDED_PATHS = (
        "/auth/login",
        "/auth/logout",
        "/api/auth/login",
        "/api/auth/logout",
        "/api/auth/me",
        "/api/auth/whoami",
        "/api/auth/apiwhoami",
    )

    STATIC_EXCLUDED_PATHS = (
        "/admin/",
        "/static/",
        "/media/",
    )

    def process_request(self, request):
        request._start_time = now()

        if request.method == "GET":
            return None

        lowered_path = (request.path or "").lower()

        if lowered_path.startswith(self.AUTH_EXCLUDED_PATHS):
            return None

        if lowered_path.startswith(self.STATIC_EXCLUDED_PATHS):
            return None

        request._system_log_capture = True
        return None

    def process_exception(self, request, exception):
        if not hasattr(request, "_system_log_capture"):
            return None

        user = request.user if getattr(request, "user", None) and request.user.is_authenticated else None

        company_reference, company_name = self._resolve_company_context(request)
        log_item = SystemLog.objects.create(
            scope_type="COMPANY" if company_reference else "SYSTEM",
            company_reference=company_reference,
            company_name=company_name,
            user=user,
            module=self._resolve_module(request),
            action="exception",
            event_code="request_exception",
            severity="critical",
            message=str(exception),
            path=request.path or "",
            method=request.method or "",
            extra_data={
                "method": request.method,
                "path": request.path,
            },
        )

        self._broadcast(log_item)
        return None

    def process_response(self, request, response):
        if not hasattr(request, "_system_log_capture"):
            return response

        user = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
        company_reference, company_name = self._resolve_company_context(request)

        log_item = SystemLog.objects.create(
            scope_type="COMPANY" if company_reference else "SYSTEM",
            company_reference=company_reference,
            company_name=company_name,
            user=user,
            module=self._resolve_module(request),
            action=self._resolve_action(request.method),
            event_code="request_completed",
            severity="info",
            message=f"{request.method} → {request.path}",
            path=request.path or "",
            method=request.method or "",
            status_code=getattr(response, "status_code", None),
            extra_data={
                "method": request.method,
                "path": request.path,
                "status_code": getattr(response, "status_code", None),
            },
        )

        self._broadcast(log_item)
        return response

    # ============================================================
    # 🧩 Helpers
    # ============================================================

    def _resolve_company_context(self, request) -> tuple[str, str]:
        """
        نحاول استخراج company_reference من أكثر من مكان بدون ربط صلب
        مع موديولات خارجية.
        """
        session = getattr(request, "session", None)

        company_reference = ""
        company_name = ""

        if session:
            company_reference = (
                session.get("active_company_reference")
                or session.get("company_reference")
                or session.get("active_company_id")
                or session.get("company_id")
                or ""
            )
            company_name = (
                session.get("active_company_name")
                or session.get("company_name")
                or ""
            )

        if not company_reference:
            company_reference = (
                request.headers.get("X-Company-Reference", "")
                or request.headers.get("X-Company-Id", "")
                or ""
            )

        if not company_name:
            company_name = request.headers.get("X-Company-Name", "") or ""

        if not company_reference:
            company_reference = getattr(request, "company_reference", "") or ""

        if not company_name:
            company_name = getattr(request, "company_name", "") or ""

        return str(company_reference).strip(), str(company_name).strip()

    def _broadcast(self, log_item: SystemLog):
        try:
            layer = get_channel_layer()
            if not layer:
                return

            room_group_name = self._build_room_group_name(
                scope_type=log_item.scope_type,
                company_reference=log_item.company_reference,
            )

            asyncio.run(
                layer.group_send(
                    room_group_name,
                    {
                        "type": "stream_log",
                        "id": log_item.id,
                        "module": log_item.module,
                        "action": log_item.action,
                        "severity": log_item.severity,
                        "message": log_item.message,
                        "created_at": log_item.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                        "user": log_item.user.get_full_name() if log_item.user else "—",
                        "company_reference": log_item.company_reference,
                        "company_name": log_item.company_name,
                        "status_code": log_item.status_code,
                    },
                )
            )
        except Exception:
            pass

    def _build_room_group_name(self, *, scope_type: str, company_reference: str) -> str:
        if scope_type == "COMPANY" and company_reference:
            safe_ref = str(company_reference).replace(" ", "_")
            return f"system_log_company_{safe_ref}"
        return "system_log_system"

    def _resolve_module(self, request):
        try:
            return request.path.strip("/").split("/")[0] or "unknown"
        except Exception:
            return "unknown"

    def _resolve_action(self, method):
        return {
            "POST": "create/update",
            "PUT": "update",
            "PATCH": "patch",
            "DELETE": "delete",
        }.get(method, str(method or "").lower())