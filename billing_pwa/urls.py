from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.views.static import serve
from django.conf import settings

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('billing_app.urls')),
    
    
    # Serve sw.js from root
    path('sw.js', serve, {'document_root': settings.BASE_DIR, 'path': 'sw.js'}),
    
    # Also serve manifest if it's in root
    path('manifest.json', serve, {'document_root': settings.BASE_DIR, 'path': 'manifest.json'}),
]