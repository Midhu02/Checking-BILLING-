from rest_framework import serializers
from django.db import transaction
from decimal import Decimal
from .models import (
    Category,
    Product,
    Bill,
    BillItem,
    Service,
    ProformaInvoice,
    ProformaItem
)


# ==========================
# CATEGORY
# ==========================
class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = "__all__"


# ==========================
# PRODUCT
# ==========================
class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = "__all__"


# ==========================
# BILL ITEM
# ==========================
class BillItemCreateSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(required=True)
    quantity = serializers.IntegerField(required=True, min_value=1)


class BillItemSerializer(serializers.ModelSerializer):
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(),
        source="product",
        write_only=True
    )
    product = ProductSerializer(read_only=True)

    class Meta:
        model = BillItem
        fields = [
            "id",
            "product",
            "product_id",
            "quantity",
            "price",
            "total",
        ]
        read_only_fields = ["price", "total"]


# ==========================
# BILL (INVOICE)
# ==========================
class BillSerializer(serializers.ModelSerializer):
    items = BillItemCreateSerializer(many=True, write_only=True)
    created_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Bill
        fields = [
            "id",
            "invoice_no",
            "customer_name",
            "customer_phone",
            "items",
            "subtotal",
            "gst_amount",
            "grand_total",
            "created_by",
            "created_at"
        ]
        read_only_fields = [
            "id",
            "invoice_no",
            "subtotal",
            "gst_amount",
            "grand_total",
            "created_by",
            "created_at"
        ]

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        request = self.context.get("request")

        if not items_data:
            raise serializers.ValidationError({"items": "At least one item is required"})

        with transaction.atomic():
            # Create bill with initial values
            bill = Bill.objects.create(
                customer_name=validated_data.get("customer_name"),
                customer_phone=validated_data.get("customer_phone", ""),
                created_by=request.user if request else None,
                subtotal=Decimal("0"),
                gst_amount=Decimal("0"),
                grand_total=Decimal("0")
            )

            subtotal = Decimal("0")
            gst_total = Decimal("0")

            for idx, item_data in enumerate(items_data):
                # Get product from product_id
                product_id = item_data.get("product_id")
                if not product_id:
                    raise serializers.ValidationError({
                        "items": f"Item {idx + 1}: product_id is required"
                    })
                
                try:
                    product = Product.objects.get(id=product_id)
                except Product.DoesNotExist:
                    raise serializers.ValidationError({
                        "items": f"Item {idx + 1}: Product with id {product_id} does not exist"
                    })
                
                quantity = int(item_data.get("quantity", 1))
                if quantity <= 0:
                    raise serializers.ValidationError({
                        "items": f"Item {idx + 1}: Quantity must be greater than 0"
                    })

                price = Decimal(str(product.selling_price))
                total = price * quantity
                gst_percentage = Decimal(str(product.gst_percentage))
                gst_amount = (total * gst_percentage) / Decimal("100")

                BillItem.objects.create(
                    bill=bill,
                    product=product,
                    quantity=quantity,
                    price=price,
                    total=total,
                )

                subtotal += total
                gst_total += gst_amount

            # Update bill with calculated totals
            bill.subtotal = subtotal
            bill.gst_amount = gst_total
            bill.grand_total = subtotal + gst_total
            bill.save()

            return bill

    def to_representation(self, instance):
        """Override to return full item details with product info on read"""
        ret = super().to_representation(instance)
        # Replace items with full BillItemSerializer that includes product details
        ret['items'] = BillItemSerializer(instance.items.all(), many=True).data
        return ret


# ==========================
# SERVICE
# ==========================
class ServiceSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Service
        fields = "__all__"
        read_only_fields = ["service_id", "service_invoice_no", "created_by"]

    def create(self, validated_data):
        request = self.context.get("request")
        return Service.objects.create(
            created_by=request.user if request else None,
            **validated_data
        )


# ==========================
# PROFORMA ITEM
# ==========================
class ProformaItemSerializer(serializers.ModelSerializer):
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(),
        source="product",
        write_only=True
    )
    product = ProductSerializer(read_only=True)

    class Meta:
        model = ProformaItem
        fields = [
            "id",
            "product",
            "product_id",
            "quantity",
            "price",
            "total",
        ]
        read_only_fields = ["price", "total"]


# ==========================
# PROFORMA INVOICE
# ==========================
class ProformaInvoiceSerializer(serializers.ModelSerializer):
    items = ProformaItemSerializer(many=True)
    created_by = serializers.StringRelatedField(read_only=True)
    related_bill = BillSerializer(read_only=True, allow_null=True)

    class Meta:
        model = ProformaInvoice
        fields = "__all__"
        read_only_fields = [
            "proforma_no",
            "subtotal",
            "gst_amount",
            "grand_total",
            "created_by",
            "related_bill",
        ]

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        request = self.context.get("request")

        with transaction.atomic():
            proforma = ProformaInvoice.objects.create(
                created_by=request.user if request else None,
                **validated_data
            )

            subtotal = 0
            gst_total = 0

            for item_data in items_data:
                product = item_data["product"]
                quantity = item_data["quantity"]

                price = product.selling_price
                total = price * quantity
                gst_amount = (total * product.gst_percentage) / 100

                ProformaItem.objects.create(
                    proforma=proforma,
                    product=product,
                    quantity=quantity,
                    price=price,
                    total=total,
                )

                subtotal += total
                gst_total += gst_amount

            proforma.subtotal = subtotal
            proforma.gst_amount = gst_total
            proforma.grand_total = subtotal + gst_total
            proforma.save()

        return proforma
