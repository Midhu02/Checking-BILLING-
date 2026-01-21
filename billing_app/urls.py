from django.urls import path
from . import views

urlpatterns = [
    path('', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('billing/', views.billing_page, name='billing'),
    path('inventory/', views.inventory_page, name='inventory'),
    path('invoice/', views.invoice_page, name='invoice'),
    path('service/', views.service_page, name='service'),
    path('reports/', views.reports_page, name='reports'),

    path('proforma-invoice/', views.proforma_invoice_page, name='proforma_invoice'),


    
    # API Endpoints
    path('api/products/', views.product_list, name='product_list'),
    path('api/categories/', views.category_list, name='category_list'),
    path('api/categories/create/', views.create_category, name='create_category'),
    path('api/products/create/', views.create_product, name='create_product'),
    path('api/products/<int:pk>/', views.update_product, name='update_product'),
    path('api/products/<int:pk>/delete/', views.delete_product, name='delete_product'),
    path('api/bills/create/', views.create_bill, name='create_bill'),
    path('api/bills/', views.bill_list, name='bill_list'),
    path('api/services/create/', views.create_service, name='create_service'),
    path('api/services/', views.service_list, name='service_list'),
    path('api/reports/', views.reports_data, name='reports_data'),
    path('api/proforma/create/', views.create_proforma, name='create_proforma'),
    path('api/proforma/', views.proforma_list, name='proforma_list'),
]