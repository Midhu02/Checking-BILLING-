from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.db import models
from datetime import datetime
from django.db.models import ProtectedError, Sum
from django.utils.dateparse import parse_date


from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Category, Product, Bill, Service, ProformaInvoice
from .serializers import (
    CategorySerializer,
    ProductSerializer,
    BillSerializer,
    ServiceSerializer,
    ProformaInvoiceSerializer
)
from .permissions import IsAdminUser, IsStaffOrAdminUser


# ==========================
# AUTH VIEWS
# ==========================
def login_view(request):
    if request.user.is_authenticated:
        return redirect('billing')

    if request.method == 'POST':
        user = authenticate(
            request,
            username=request.POST.get('username'),
            password=request.POST.get('password')
        )
        if user:
            login(request, user)
            return redirect('billing')

        messages.error(request, 'Invalid username or password')

    return render(request, 'login.html')


def logout_view(request):
    logout(request)
    return redirect('login')


# ==========================
# PAGE RENDERS
# ==========================
@login_required
def billing_page(request):
    return render(request, 'billing.html')


@login_required
def inventory_page(request):
    return render(request, 'inventory.html')


@login_required
def invoice_page(request):
    return render(request, 'invoice.html')


@login_required
def service_page(request):
    return render(request, 'service.html')


@login_required
def reports_page(request):
    return render(request, 'reports.html')


@login_required
def proforma_invoice_page(request):
    if not request.user.is_superuser:
        messages.error(request, "Only administrators can create proforma invoices.")
        return redirect('billing')
    return render(request, 'proforma_invoice.html')


# ==========================
# CATEGORY APIs
# ==========================
@api_view(['GET'])
def category_list(request):
    categories = Category.objects.all()
    serializer = CategorySerializer(categories, many=True)
    return Response(serializer.data)


@api_view(['POST'])
def create_category(request):
    serializer = CategorySerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# ==========================
# PRODUCT APIs
# ==========================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def product_list(request):
    qs = Product.objects.all().order_by('-created_at')
    serializer = ProductSerializer(qs, many=True)
    return Response({'results': serializer.data})


@api_view(['POST'])
@permission_classes([IsAdminUser])
def create_product(request):
    data = request.data.copy()
    cat_name = data.pop('category', None)
    if cat_name:
        category, _ = Category.objects.get_or_create(name=cat_name)
        data['category'] = category.name  # Store the category name, not ID
    serializer = ProductSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)


@api_view(['PUT'])
@permission_classes([IsAdminUser])
def update_product(request, pk):
    try:
        product = Product.objects.get(pk=pk)
    except Product.DoesNotExist:
        return Response({'error': 'Product not found'}, status=404)

    data = request.data.copy()
    cat_name = data.pop('category', None)
    if cat_name:
        category, _ = Category.objects.get_or_create(name=cat_name)
        data['category'] = category.name  # Store the category name, not ID
    
    serializer = ProductSerializer(product, data=data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=400)


from django.db.models import ProtectedError

@api_view(['DELETE'])
@permission_classes([IsAdminUser])
def delete_product(request, pk):
    try:
        product = Product.objects.get(pk=pk)
        product.delete()
        return Response({'message': 'Product deleted successfully'}, status=200)
    
    except Product.DoesNotExist:
        return Response({'error': 'Product not found'}, status=404)
    
    except ProtectedError:
        return Response({
            'error': 'Cannot delete this product',
            'message': 'This product is used in one or more bills or proforma invoices. '
                      'Please remove it from all invoices first.'
        }, status=400)
    
    except Exception as e:
        return Response({
            'error': 'Unexpected error during deletion',
            'details': str(e)
        }, status=500)


# ==========================
# BILLING APIs
# ==========================
@api_view(['POST'])
@permission_classes([IsStaffOrAdminUser])
def create_bill(request):
    serializer = BillSerializer(
        data=request.data,
        context={'request': request}
    )
    if serializer.is_valid():
        bill = serializer.save()
        return Response({
            'invoice_no': bill.invoice_no,
            'grand_total': bill.grand_total
        }, status=201)
    return Response(serializer.errors, status=400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def bill_list(request):
    qs = Bill.objects.all().order_by('-created_at')
    serializer = BillSerializer(qs, many=True)
    return Response({'results': serializer.data})


# ==========================
# SERVICE APIs
# ==========================
@api_view(['POST'])
@permission_classes([IsStaffOrAdminUser])
def create_service(request):
    serializer = ServiceSerializer(
        data=request.data,
        context={'request': request}
    )
    if serializer.is_valid():
        service = serializer.save()
        return Response({
            'service_id': service.service_id,
            'service_invoice_no': service.service_invoice_no
        }, status=201)
    return Response(serializer.errors, status=400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def service_list(request):
    qs = Service.objects.all().order_by('-created_at')
    serializer = ServiceSerializer(qs, many=True)
    return Response({'results': serializer.data})


# ==========================
# REPORTS (ADMIN ONLY)
# ==========================
@api_view(['GET'])
@permission_classes([IsStaffOrAdminUser])
def reports_data(request):
    today = datetime.now().date()

    start_raw = request.GET.get('start')
    end_raw = request.GET.get('end')
    
    start_date = parse_date(start_raw) if start_raw else None
    end_date = parse_date(end_raw) if end_raw else None


    bill_qs = Bill.objects.all()
    service_qs = Service.objects.all()

    # 🔹 Apply date filter if provided
    if start_date and end_date:
        bill_qs = bill_qs.filter(created_at__date__range=[start_date, end_date])
        service_qs = service_qs.filter(created_at__date__range=[start_date, end_date])

    # 🔹 Aggregations
    total_sales = bill_qs.aggregate(total=Sum('grand_total'))['total'] or 0
    service_income = service_qs.aggregate(total=Sum('service_price'))['total'] or 0

    today = timezone.now().date()

    # --- Bills ---
    daily_bill_sales = Bill.objects.filter(
        created_at__date=today
    ).aggregate(total=Sum('grand_total'))['total'] or 0
    
    monthly_bill_sales = Bill.objects.filter(
        created_at__date__gte=today.replace(day=1)
    ).aggregate(total=Sum('grand_total'))['total'] or 0
    
    # --- Services ---
    daily_service_income = Service.objects.filter(
        created_at__date=today
    ).aggregate(total=Sum('service_price'))['total'] or 0
    
    monthly_service_income = Service.objects.filter(
        created_at__date__gte=today.replace(day=1)
    ).aggregate(total=Sum('service_price'))['total'] or 0


    return Response({
        'total_sales': float(total_sales),
        'service_income': float(service_income),
        'daily_sales': float(daily_bill_sales + daily_service_income),
        'monthly_sales': float(monthly_bill_sales + monthly_service_income),
        'total_revenue': float(total_sales + service_income),
    })

# ==========================
# PROFORMA APIs (ADMIN)
# ==========================
@api_view(['POST'])
@permission_classes([IsAdminUser])
def create_proforma(request):
    serializer = ProformaInvoiceSerializer(
        data=request.data,
        context={'request': request}
    )
    if serializer.is_valid():
        proforma = serializer.save()
        return Response({
            'proforma_no': proforma.proforma_no
        }, status=201)

    return Response(serializer.errors, status=400)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def proforma_list(request):
    """List all proforma invoices with their corresponding bills if created"""
    qs = ProformaInvoice.objects.all().order_by('-created_at')
    serializer = ProformaInvoiceSerializer(qs, many=True)
    return Response({'results': serializer.data})
