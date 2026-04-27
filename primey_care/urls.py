from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path


def home(request):
    return HttpResponse(
        """
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
        min-height:100vh;background:linear-gradient(135deg,#f8fafc,#e2e8f0);
        font-family:Arial,sans-serif;text-align:center;padding:24px;">
            <h1 style="font-size:42px;color:#0f172a;margin-bottom:12px;">Primey Care Backend</h1>
            <p style="font-size:18px;color:#334155;margin-bottom:20px;">
                المشروع يعمل بنواة أولية نظيفة.
            </p>
            <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
                <a href="/admin/" style="padding:12px 24px;border-radius:12px;
                background:#0f172a;color:#fff;text-decoration:none;">
                    دخول لوحة الإدارة
                </a>
                <a href="/api/" style="padding:12px 24px;border-radius:12px;
                background:#e2e8f0;color:#0f172a;text-decoration:none;">
                    API Bootstrap
                </a>
            </div>
        </div>
        """
    )


def healthz(request):
    return HttpResponse("ok", content_type="text/plain")


urlpatterns = [
    path("", home, name="home"),
    path("healthz/", healthz, name="healthz"),
    path("api/", include("api.urls")),
    path("admin/", admin.site.urls),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)