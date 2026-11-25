"""Root URL configuration – delegates all API routes to the tickets app."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("tickets.urls")),
]
