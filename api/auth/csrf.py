# ===============================================================
# 📂 الملف: api/auth/csrf.py
# 🧭 Primey Care — Auth CSRF API
# ---------------------------------------------------------------
# ✅ Bootstrap CSRF cookie for frontend apps
# ✅ Public endpoint
# ✅ Safe for SPA / Next.js / mobile-web flows
# ===============================================================

from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET


@require_GET
@ensure_csrf_cookie
@never_cache
def csrf_bootstrap_api(request):
    response = JsonResponse(
        {
            "success": True,
            "message": "CSRF cookie initialized successfully.",
        },
        status=200,
    )
    response["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response["Pragma"] = "no-cache"
    response["Expires"] = "0"
    return response