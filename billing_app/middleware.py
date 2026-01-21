# billing_app/middleware.py – FINAL SAFE VERSION

from django.shortcuts import redirect
from django.contrib import messages

class LoginRequiredMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Normalize path: remove trailing slash for matching
        path = request.path_info.rstrip('/')

        # Skip public paths
        if path in ['', '/login', '/logout'] or \
           path.startswith(('/static', '/admin', '/media')):
            return self.get_response(request)

        # Must be authenticated
        if not request.user.is_authenticated:
            return redirect('login')

        # Admin-only prefixes (without trailing slash)
        admin_prefixes = [
            '/inventory',
            '/invoice',
            '/reports',
        ]

        # Match either exact or prefix + possible subpath
        is_admin_path = any(
            path == prefix or path.startswith(prefix + '/')
            for prefix in admin_prefixes
        )

        if is_admin_path and not (request.user.is_staff or request.user.is_superuser):
            messages.error(request, "This page is for administrators only.")
            return redirect('billing')

        return self.get_response(request)