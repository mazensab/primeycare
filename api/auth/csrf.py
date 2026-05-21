# ===============================================================
# 📂 الملف: api/auth/csrf.py
# 🧭 Primey Care — Auth CSRF API
# 🚀 الإصدار: Primey Care CSRF API V2.0
# ---------------------------------------------------------------
# ✅ Bootstrap CSRF cookie for frontend apps
# ✅ Public endpoint
# ✅ Safe for SPA / Next.js / mobile-web flows
# ✅ Returns normalized frontend payload
# ===============================================================

from __future__ import annotations

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET


@require_GET
@ensure_csrf_cookie
@never_cache
def csrf_bootstrap_api(request):
    csrf_cookie_name = getattr(settings, "CSRF_COOKIE_NAME", "csrftoken")

    payload = {
        "ok": True,
        "success": True,
        "message": "CSRF cookie initialized successfully.",
        "authenticated": bool(
            getattr(request, "user", None)
            and request.user.is_authenticated
        ),
        "workspace": None,
        "dashboard_path": None,
        "redirect_to": None,
        "csrf": {
            "cookie_name": csrf_cookie_name,
            "initialized": True,
        },
        "data": {
            "authenticated": bool(
                getattr(request, "user", None)
                and request.user.is_authenticated
            ),
            "workspace": None,
            "dashboard_path": None,
            "redirect_to": None,
            "csrf": {
                "cookie_name": csrf_cookie_name,
                "initialized": True,
            },
        },
    }

    response = JsonResponse(
        payload,
        status=200,
        json_dumps_params={"ensure_ascii": False},
    )

    response["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response["Pragma"] = "no-cache"
    response["Expires"] = "0"

    return response