# ===============================================================
# 📂 الملف: api/auth/logout.py
# 🧭 Primey Care — Auth Logout API
# ---------------------------------------------------------------
# ✅ Session-based logout
# ✅ Deactivates current ActiveUserSession
# ✅ CSRF protected
# ===============================================================

from __future__ import annotations

from django.contrib.auth import logout
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

from auth_center.models import ActiveUserSession


@require_POST
@csrf_protect
def logout_api(request):
    session_key = request.session.session_key

    if request.user.is_authenticated and session_key:
        session = ActiveUserSession.objects.filter(
            session_key=session_key,
            user=request.user,
            is_active=True,
        ).first()
        if session:
            session.mark_logged_out()

    logout(request)

    try:
        request.session.flush()
    except Exception:
        pass

    response = JsonResponse(
        {
            "success": True,
            "message": "Logout successful.",
        },
        status=200,
    )

    response.delete_cookie("sessionid", path="/", samesite="Lax")
    response.delete_cookie("csrftoken", path="/", samesite="Lax")
    return response