from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.views.static import serve
import os

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("api.urls")),
]

# Serve the frontend (index.html, app.js, style.css) so you can run one
# server for everything, same as the Express version does.
FRONTEND_DIR = os.path.join(settings.BASE_DIR.parent, "frontend")


def frontend_index(request):
    from django.http import FileResponse
    return FileResponse(open(os.path.join(FRONTEND_DIR, "index.html"), "rb"))


urlpatterns += [
    path("", frontend_index),
    path("<path:path>", serve, {"document_root": FRONTEND_DIR}),
]
