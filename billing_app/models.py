from django.db import models, transaction
from django.contrib.auth.models import User
from django.utils import timezone
import uuid


# ==========================
# CATEGORY
# ==========================
class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


# ==========================
# PRODUCT
# ==========================
class Product(models.Model):
    name = models.CharField(max_length=200)
    imei = models.CharField(max_length=50, blank=True, null=True)
    selling_price = models.DecimalField(max_digits=12, decimal_places=2)
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2)
    gst_percentage = models.FloatField(default=0)
    category = models.CharField(max_length=100, blank=True, null=True)
    stock = models.PositiveIntegerField(default=0)
    agency_name = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} (Stock: {self.stock})"


# ==========================
# BILL (INVOICE)
# ==========================
class Bill(models.Model):
    invoice_no = models.CharField(max_length=20, unique=True, editable=False)
    customer_name = models.CharField(max_length=200)
    customer_phone = models.CharField(max_length=15)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='bills')
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.invoice_no:
            self.invoice_no = f"INV-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.invoice_no} - {self.customer_name}"


# ==========================
# BILL ITEMS (ONE → MANY)
# ==========================
class BillItem(models.Model):
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=12, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    def save(self, *args, **kwargs):
        if self.pk is None:
            if self.product.stock < self.quantity:
                raise ValueError(f"Insufficient stock for {self.product.name}")

            # Atomic stock deduction
            with transaction.atomic():
                self.product.stock -= self.quantity
                self.product.save()
                super().save(*args, **kwargs)
        else:
            super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name} x {self.quantity}"


# ==========================
# SERVICE
# ==========================
class Service(models.Model):
    service_id = models.CharField(max_length=20, unique=True, editable=False)
    service_invoice_no = models.CharField(max_length=20, unique=True, editable=False, null=True, blank=True)
    customer_name = models.CharField(max_length=200)
    customer_phone = models.CharField(max_length=15)
    service_type = models.CharField(max_length=200)
    service_price = models.DecimalField(max_digits=12, decimal_places=2)
    issue = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='services')
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.service_id:
            self.service_id = f"SVC-{uuid.uuid4().hex[:8].upper()}"
        if not self.service_invoice_no:
            self.service_invoice_no = f"SIN-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.service_id} - {self.customer_name}"


# ==========================
# PROFORMA INVOICE
# ==========================
class ProformaInvoice(models.Model):
    proforma_no = models.CharField(max_length=20, unique=True, editable=False)

    # Buyer
    customer_name = models.CharField(max_length=200)
    customer_phone = models.CharField(max_length=15, blank=True)
    billing_address = models.TextField(blank=True)
    delivery_address = models.TextField(blank=True)

    # Dates
    issue_date = models.DateField(default=timezone.now)
    valid_until = models.DateField(null=True, blank=True)

    # Commercial
    currency = models.CharField(max_length=10, default="INR")
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    shipping_charge = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    insurance_charge = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    gst_amount = models.DecimalField(max_digits=12, decimal_places=2)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2)

    # Trade
    incoterms = models.CharField(max_length=50, blank=True)
    country_of_origin = models.CharField(max_length=100, blank=True)
    port_of_loading = models.CharField(max_length=100, blank=True)

    # Payment
    payment_terms = models.CharField(max_length=200, blank=True)
    bank_name = models.CharField(max_length=200, blank=True)
    account_number = models.CharField(max_length=50, blank=True)
    ifsc_swift = models.CharField(max_length=50, blank=True)

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    related_bill = models.ForeignKey(Bill, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.proforma_no:
            self.proforma_no = f"PF-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)


class ProformaItem(models.Model):
    proforma = models.ForeignKey(ProformaInvoice, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    hsn_sac = models.CharField(max_length=20, blank=True)
    quantity = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=12, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)

class ReturnInvoice(models.Model):
    invoice = models.ForeignKey(
        'Bill',
        on_delete=models.CASCADE,
        related_name='returns'
    )
    product_name = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField()
    return_type = models.CharField(
        max_length=20,
        choices=[('refund', 'Refund'), ('replace', 'Replacement')]
    )
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Return - {self.invoice.invoice_no}"
