# ============================================================
# 📂 order_items/models.py
# 🧠 Primey Care | Order Items Module V2.2
# ------------------------------------------------------------
# ✅ هذا الموديول يمثل العناصر التشغيلية الفعلية داخل الطلب
# ✅ Order هو رأس الطلب
# ✅ OrderItem هو سطر التنفيذ/الخدمة/البطاقة/البرنامج
# ✅ يربط الطلب مع:
#    - المنتج
#    - عرض المنتج داخل العقد ContractProduct
#    - الخدمة التشغيلية
#    - الجهة المقدمة
#    - العقد المرجعي
# ✅ يحتفظ بلقطة سعرية وقت إنشاء الطلب
# ✅ يحتفظ بلقطة العرض المختار وقت إنشاء الطلب
# ✅ يحتفظ بلقطة تشغيلية للمنتج ومقدم الخدمة والعقد
# ✅ يدعم الموافقات والتنفيذ وجدولة الخدمة
# ✅ لا يكرر منطق التوصيل الرئيسي الموجود في Order
# ✅ جاهز لاحقًا للربط مع:
#    - الموافقات
#    - التنفيذ
#    - المطالبات
#    - الفوترة
#    - السداد
# ------------------------------------------------------------
# القاعدة المعتمدة:
# - Product = كتالوج ثابت
# - ContractProduct = عرض/سعر/خصم المنتج حسب مقدم الخدمة والعقد
# - OrderItem يحفظ Snapshot ولا يتأثر بتغيير العرض لاحقًا
# ============================================================

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from contracts.models import Contract, ContractProduct
from orders.models import Order
from products.models import Product
from providers.models import Provider
from service_items.models import ContractServiceItem


# ============================================================
# 🧩 Choices
# ============================================================

class OrderItemStatus(models.TextChoices):
    PENDING = "PENDING", "قيد الانتظار"
    APPROVAL_PENDING = "APPROVAL_PENDING", "بانتظار الموافقة"
    APPROVED = "APPROVED", "تمت الموافقة"
    REJECTED = "REJECTED", "مرفوض"
    SCHEDULED = "SCHEDULED", "مجدول"
    IN_PROGRESS = "IN_PROGRESS", "قيد التنفيذ"
    COMPLETED = "COMPLETED", "مكتمل"
    CANCELLED = "CANCELLED", "ملغي"


class FulfillmentStatus(models.TextChoices):
    NOT_STARTED = "NOT_STARTED", "لم يبدأ"
    PARTIAL = "PARTIAL", "منفذ جزئيًا"
    COMPLETED = "COMPLETED", "منفذ بالكامل"
    FAILED = "FAILED", "فشل التنفيذ"
    CANCELLED = "CANCELLED", "تم الإلغاء"


class OrderItemKind(models.TextChoices):
    PRODUCT = "PRODUCT", "منتج"
    CARD = "CARD", "بطاقة"
    PROGRAM = "PROGRAM", "برنامج"
    SERVICE = "SERVICE", "خدمة"
    SUBSCRIPTION = "SUBSCRIPTION", "اشتراك"
    OTHER = "OTHER", "أخرى"


class OrderItemOfferSource(models.TextChoices):
    NONE = "NONE", "بدون عرض"
    PRODUCT = "PRODUCT", "عرض المنتج"
    CONTRACT_PRODUCT = "CONTRACT_PRODUCT", "عرض مقدم الخدمة"
    MANUAL = "MANUAL", "يدوي"


# ============================================================
# 🧾 Order Item
# ============================================================

class OrderItem(models.Model):
    # ========================================================
    # 🔗 الربط الأساسي
    # ========================================================
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="الطلب",
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="order_items",
        verbose_name="المنتج",
    )

    provider = models.ForeignKey(
        Provider,
        on_delete=models.PROTECT,
        related_name="order_items",
        null=True,
        blank=True,
        verbose_name="الجهة المقدمة",
    )

    contract = models.ForeignKey(
        Contract,
        on_delete=models.PROTECT,
        related_name="order_items",
        null=True,
        blank=True,
        verbose_name="العقد المرجعي",
    )

    contract_product = models.ForeignKey(
        ContractProduct,
        on_delete=models.PROTECT,
        related_name="order_items",
        null=True,
        blank=True,
        verbose_name="عرض المنتج داخل العقد",
        help_text="العرض/السعر المختار من عقد مقدم الخدمة.",
    )

    service_item = models.ForeignKey(
        ContractServiceItem,
        on_delete=models.PROTECT,
        related_name="order_items",
        null=True,
        blank=True,
        verbose_name="الخدمة التشغيلية",
    )

    # ========================================================
    # 🆔 بيانات العنصر
    # ========================================================
    item_kind = models.CharField(
        max_length=30,
        choices=OrderItemKind.choices,
        default=OrderItemKind.PRODUCT,
        db_index=True,
        verbose_name="نوع العنصر",
    )

    title = models.CharField(
        max_length=255,
        verbose_name="عنوان العنصر",
        help_text="اسم واضح لما تم طلبه فعليًا",
    )

    code = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        verbose_name="كود العنصر",
        help_text="كود داخلي أو مرجعي اختياري",
    )

    fulfillment_reference = models.CharField(
        max_length=120,
        blank=True,
        db_index=True,
        verbose_name="مرجع التنفيذ",
        help_text="رقم بطاقة أو مرجع خدمة أو رقم موافقة اختياري.",
    )

    status = models.CharField(
        max_length=30,
        choices=OrderItemStatus.choices,
        default=OrderItemStatus.PENDING,
        db_index=True,
        verbose_name="حالة العنصر",
    )

    fulfillment_status = models.CharField(
        max_length=30,
        choices=FulfillmentStatus.choices,
        default=FulfillmentStatus.NOT_STARTED,
        db_index=True,
        verbose_name="حالة التنفيذ",
    )

    # ========================================================
    # 🧾 Snapshot تشغيلي
    # ========================================================
    product_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="اسم المنتج وقت الطلب",
    )

    product_type = models.CharField(
        max_length=50,
        blank=True,
        db_index=True,
        verbose_name="نوع المنتج وقت الطلب",
    )

    provider_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="اسم الجهة وقت الطلب",
    )

    contract_number = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        verbose_name="رقم العقد وقت الطلب",
    )

    currency_code = models.CharField(
        max_length=10,
        default="SAR",
        db_index=True,
        verbose_name="العملة",
    )

    # ========================================================
    # 🎯 Snapshot العرض
    # ========================================================
    offer_source = models.CharField(
        max_length=30,
        choices=OrderItemOfferSource.choices,
        default=OrderItemOfferSource.NONE,
        db_index=True,
        verbose_name="مصدر العرض",
    )

    offer_title = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="عنوان العرض وقت الطلب",
    )

    offer_badge = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="وسم العرض وقت الطلب",
    )

    # ========================================================
    # 🔢 الكمية
    # ========================================================
    quantity = models.PositiveIntegerField(
        default=1,
        verbose_name="الكمية",
    )

    # ========================================================
    # 💰 اللقطة السعرية وقت الطلب
    # ========================================================
    unit_price_before_discount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="سعر الوحدة قبل الخصم",
    )

    unit_discount_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="نسبة خصم الوحدة",
    )

    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="سعر الوحدة بعد الخصم",
        help_text="السعر النهائي للوحدة بعد الخصم. أبقي الاسم unit_price للتوافق.",
    )

    discount_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="نسبة الخصم",
        help_text="حقل توافق قديم، تتم مزامنته مع unit_discount_percentage.",
    )

    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="قيمة الخصم على الوحدة",
        help_text="قيمة خصم ثابتة على الوحدة الواحدة.",
    )

    net_unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="صافي سعر الوحدة",
    )

    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="الإجمالي النهائي",
    )

    # ========================================================
    # ✅ الموافقات والتنفيذ
    # ========================================================
    requires_approval = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="يتطلب موافقة",
    )

    approval_notes = models.TextField(
        blank=True,
        verbose_name="ملاحظات الموافقة",
    )

    execution_notes = models.TextField(
        blank=True,
        verbose_name="ملاحظات التنفيذ",
    )

    internal_notes = models.TextField(
        blank=True,
        verbose_name="ملاحظات داخلية",
    )

    # ========================================================
    # 📅 تواريخ تشغيلية
    # ========================================================
    scheduled_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="موعد التنفيذ",
    )

    approval_requested_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاريخ طلب الموافقة",
    )

    approved_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاريخ الموافقة",
    )

    rejected_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاريخ الرفض",
    )

    started_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاريخ بدء التنفيذ",
    )

    fulfilled_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاريخ الإكمال",
    )

    cancelled_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاريخ الإلغاء",
    )

    # ========================================================
    # 🕒 التتبع
    # ========================================================
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="تاريخ الإنشاء",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="آخر تحديث",
    )

    class Meta:
        db_table = "order_items"
        verbose_name = "عنصر طلب"
        verbose_name_plural = "عناصر الطلبات"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["order"]),
            models.Index(fields=["product"]),
            models.Index(fields=["provider"]),
            models.Index(fields=["contract"]),
            models.Index(fields=["contract_product"]),
            models.Index(fields=["service_item"]),
            models.Index(fields=["item_kind"]),
            models.Index(fields=["status"]),
            models.Index(fields=["fulfillment_status"]),
            models.Index(fields=["requires_approval"]),
            models.Index(fields=["scheduled_at"]),
            models.Index(fields=["approval_requested_at"]),
            models.Index(fields=["approved_at"]),
            models.Index(fields=["fulfilled_at"]),
            models.Index(fields=["cancelled_at"]),
            models.Index(fields=["currency_code"]),
            models.Index(fields=["product_type"]),
            models.Index(fields=["offer_source"]),
            models.Index(fields=["code"]),
            models.Index(fields=["fulfillment_reference"]),
        ]

    def __str__(self) -> str:
        return f"{self.title} - Order #{self.order_id}"

    # ========================================================
    # 🔹 Properties
    # ========================================================
    @property
    def line_total_before_discount(self) -> Decimal:
        return self._money(self.unit_price_before_discount) * Decimal(self.quantity or 1)

    @property
    def line_total_after_discount(self) -> Decimal:
        return self._money(self.net_unit_price) * Decimal(self.quantity or 1)

    @property
    def has_offer(self) -> bool:
        return bool(self.contract_product_id)

    @property
    def offer_id(self) -> int | None:
        return self.contract_product_id

    @property
    def is_completed(self) -> bool:
        return self.status == OrderItemStatus.COMPLETED

    @property
    def is_cancelled(self) -> bool:
        return self.status == OrderItemStatus.CANCELLED

    @property
    def is_fulfilled(self) -> bool:
        return self.fulfillment_status == FulfillmentStatus.COMPLETED

    @property
    def is_rejected(self) -> bool:
        return self.status == OrderItemStatus.REJECTED

    @property
    def needs_approval(self) -> bool:
        return self.requires_approval and self.status == OrderItemStatus.APPROVAL_PENDING

    # ========================================================
    # 🔹 Helpers
    # ========================================================
    def _money(self, value) -> Decimal:
        try:
            parsed = Decimal(str(value or "0.00")).quantize(
                Decimal("0.01"),
                rounding=ROUND_HALF_UP,
            )
        except Exception:
            parsed = Decimal("0.00")

        if parsed < Decimal("0.00"):
            return Decimal("0.00")

        return parsed

    def _percent(self, value) -> Decimal:
        parsed = self._money(value)

        if parsed > Decimal("100.00"):
            return Decimal("100.00")

        return parsed

    def _normalize_strings(self) -> None:
        self.title = (self.title or "").strip()
        self.code = (self.code or "").strip()
        self.fulfillment_reference = (self.fulfillment_reference or "").strip()
        self.product_name = (self.product_name or "").strip()
        self.product_type = (self.product_type or "").strip()
        self.provider_name = (self.provider_name or "").strip()
        self.contract_number = (self.contract_number or "").strip()
        self.currency_code = (self.currency_code or "SAR").strip().upper()
        self.offer_title = (self.offer_title or "").strip()
        self.offer_badge = (self.offer_badge or "").strip()
        self.approval_notes = (self.approval_notes or "").strip()
        self.execution_notes = (self.execution_notes or "").strip()
        self.internal_notes = (self.internal_notes or "").strip()

    def _resolve_item_kind_from_product(self) -> str:
        product_type = (self.product_type or "").strip().lower()

        if product_type in {"card", "cards", "membership", "membership_card"}:
            return OrderItemKind.CARD

        if product_type in {"program", "programs", "medical_program"}:
            return OrderItemKind.PROGRAM

        if product_type in {"service", "services", "medical_service"}:
            return OrderItemKind.SERVICE

        if product_type in {"subscription", "subscriptions", "plan", "plans"}:
            return OrderItemKind.SUBSCRIPTION

        return OrderItemKind.PRODUCT

    def _sync_from_order(self) -> None:
        if not self.order_id:
            return

        if not self.product_id and getattr(self.order, "product_id", None):
            self.product = self.order.product

        if not self.contract_product_id and getattr(self.order, "contract_product_id", None):
            self.contract_product = self.order.contract_product

        if not self.contract_id and getattr(self.order, "contract_id", None):
            self.contract = self.order.contract

        if not self.provider_id and getattr(self.order, "provider_id", None):
            self.provider = self.order.provider

        if self.offer_source == OrderItemOfferSource.NONE and getattr(self.order, "offer_source", ""):
            order_offer_source = str(self.order.offer_source or "").strip().lower()

            if order_offer_source == "contract_product":
                self.offer_source = OrderItemOfferSource.CONTRACT_PRODUCT
            elif order_offer_source == "product":
                self.offer_source = OrderItemOfferSource.PRODUCT
            elif order_offer_source == "manual":
                self.offer_source = OrderItemOfferSource.MANUAL

        if not self.offer_title and getattr(self.order, "offer_title", ""):
            self.offer_title = self.order.offer_title

        if not self.offer_badge and getattr(self.order, "offer_badge", ""):
            self.offer_badge = self.order.offer_badge

    def _sync_from_relations(self) -> None:
        self._sync_from_order()

        if self.contract and not self.provider:
            self.provider = self.contract.provider

        if self.contract_product:
            if not self.contract:
                self.contract = self.contract_product.contract

            if not self.product:
                self.product = self.contract_product.product

            if self.contract and not self.provider:
                self.provider = self.contract.provider

            if self.offer_source == OrderItemOfferSource.NONE:
                self.offer_source = OrderItemOfferSource.CONTRACT_PRODUCT

        if self.service_item:
            if not self.contract:
                self.contract = self.service_item.contract

            if not self.contract_product and getattr(self.service_item, "contract_product_id", None):
                self.contract_product = self.service_item.contract_product

            if self.contract and not self.provider:
                self.provider = self.contract.provider

            if self.requires_approval is False and getattr(self.service_item, "requires_approval", False):
                self.requires_approval = True

    def _sync_snapshots(self) -> None:
        if self.product_id:
            self.product_name = (
                getattr(self.product, "name", None)
                or getattr(self.product, "title", None)
                or self.product_name
                or ""
            )
            self.product_type = (
                getattr(self.product, "product_type", None)
                or getattr(self.product, "type", None)
                or self.product_type
                or ""
            )

            if self.item_kind == OrderItemKind.PRODUCT:
                self.item_kind = self._resolve_item_kind_from_product()

            if not self.title:
                self.title = self.offer_title or self.product_name or f"Product #{self.product_id}"

            if not self.code:
                self.code = (
                    getattr(self.product, "code", None)
                    or getattr(self.product, "sku", None)
                    or ""
                )

            self.currency_code = (
                getattr(self.product, "currency_code", None)
                or getattr(self.product, "currency", None)
                or self.currency_code
                or "SAR"
            )

        if self.provider_id:
            self.provider_name = (
                getattr(self.provider, "name", None)
                or getattr(self.provider, "name_ar", None)
                or getattr(self.provider, "name_en", None)
                or getattr(self.provider, "display_name", None)
                or getattr(self.provider, "provider_name", None)
                or self.provider_name
                or ""
            )

        if self.contract_id:
            self.contract_number = (
                getattr(self.contract, "contract_number", None)
                or getattr(self.contract, "number", None)
                or self.contract_number
                or ""
            )

        if self.contract_product_id:
            self.offer_title = (
                getattr(self.contract_product, "offer_title", None)
                or self.offer_title
                or self.product_name
                or ""
            )
            self.offer_badge = (
                getattr(self.contract_product, "offer_badge", None)
                or self.offer_badge
                or ""
            )

            if not self.title:
                self.title = self.offer_title or self.product_name or f"Offer #{self.contract_product_id}"

    def _sync_pricing_from_offer_or_product(self) -> None:
        if self.contract_product_id:
            before = (
                getattr(self.contract_product, "effective_price_before_discount", None)
                or getattr(self.contract_product, "price_before_discount", None)
            )
            after = (
                getattr(self.contract_product, "effective_price_after_discount", None)
                or getattr(self.contract_product, "price_after_discount", None)
                or getattr(self.contract_product, "special_price", None)
            )
            discount = getattr(self.contract_product, "discount_percentage", None)

            if before is not None and self.unit_price_before_discount <= Decimal("0.00"):
                self.unit_price_before_discount = self._money(before)

            if after is not None and self.unit_price <= Decimal("0.00"):
                self.unit_price = self._money(after)

            if discount is not None and self.unit_discount_percentage <= Decimal("0.00"):
                self.unit_discount_percentage = self._percent(discount)

            if self.offer_source == OrderItemOfferSource.NONE:
                self.offer_source = OrderItemOfferSource.CONTRACT_PRODUCT

        elif self.product_id:
            before = (
                getattr(self.product, "price_before_discount", None)
                or getattr(self.product, "price", None)
            )
            after = (
                getattr(self.product, "price_after_discount", None)
                or getattr(self.product, "effective_price", None)
                or getattr(self.product, "sale_price", None)
                or getattr(self.product, "price", None)
            )
            discount = getattr(self.product, "discount_percentage", None)

            if before is not None and self.unit_price_before_discount <= Decimal("0.00"):
                self.unit_price_before_discount = self._money(before)

            if after is not None and self.unit_price <= Decimal("0.00"):
                self.unit_price = self._money(after)

            if discount is not None and self.unit_discount_percentage <= Decimal("0.00"):
                self.unit_discount_percentage = self._percent(discount)

            if self.offer_source == OrderItemOfferSource.NONE and self.unit_discount_percentage > Decimal("0.00"):
                self.offer_source = OrderItemOfferSource.PRODUCT

        if self.unit_price_before_discount <= Decimal("0.00") and self.unit_price > Decimal("0.00"):
            self.unit_price_before_discount = self.unit_price

        if self.discount_percentage <= Decimal("0.00") and self.unit_discount_percentage > Decimal("0.00"):
            self.discount_percentage = self.unit_discount_percentage

        if self.unit_discount_percentage <= Decimal("0.00") and self.discount_percentage > Decimal("0.00"):
            self.unit_discount_percentage = self.discount_percentage

    def _sync_operational_timestamps(self) -> None:
        now = timezone.now()

        if self.status == OrderItemStatus.APPROVAL_PENDING and not self.approval_requested_at:
            self.approval_requested_at = now

        if self.status == OrderItemStatus.APPROVED and not self.approved_at:
            self.approved_at = now

        if self.status == OrderItemStatus.REJECTED and not self.rejected_at:
            self.rejected_at = now

        if self.status == OrderItemStatus.IN_PROGRESS and not self.started_at:
            self.started_at = now

        if self.status == OrderItemStatus.COMPLETED and not self.fulfilled_at:
            self.fulfilled_at = now

        if self.status == OrderItemStatus.CANCELLED and not self.cancelled_at:
            self.cancelled_at = now

        if self.fulfillment_status == FulfillmentStatus.COMPLETED and not self.fulfilled_at:
            self.fulfilled_at = now

        if self.fulfillment_status == FulfillmentStatus.CANCELLED and not self.cancelled_at:
            self.cancelled_at = now

    def _recalculate_totals(self) -> None:
        quantity = Decimal(self.quantity or 1)
        unit_price_before_discount = self._money(self.unit_price_before_discount)
        unit_price = self._money(self.unit_price)
        unit_discount_percentage = self._percent(self.unit_discount_percentage)
        discount_percentage = self._percent(self.discount_percentage)
        discount_amount = self._money(self.discount_amount)

        if unit_discount_percentage <= Decimal("0.00") and discount_percentage > Decimal("0.00"):
            unit_discount_percentage = discount_percentage

        if discount_percentage <= Decimal("0.00") and unit_discount_percentage > Decimal("0.00"):
            discount_percentage = unit_discount_percentage

        if unit_price <= Decimal("0.00") and unit_price_before_discount > Decimal("0.00"):
            percentage_discount_value = (unit_price_before_discount * unit_discount_percentage) / Decimal("100.00")
            unit_price = unit_price_before_discount - percentage_discount_value - discount_amount

        if unit_price < Decimal("0.00"):
            unit_price = Decimal("0.00")

        net_unit = unit_price

        if net_unit < Decimal("0.00"):
            net_unit = Decimal("0.00")

        total = net_unit * quantity

        self.unit_price_before_discount = unit_price_before_discount
        self.unit_discount_percentage = unit_discount_percentage
        self.discount_percentage = discount_percentage
        self.discount_amount = discount_amount
        self.unit_price = self._money(unit_price)
        self.net_unit_price = self._money(net_unit)
        self.total_amount = self._money(total)

    # ========================================================
    # 🔹 Validation
    # ========================================================
    def clean(self) -> None:
        super().clean()

        self._normalize_strings()
        self._sync_from_relations()
        self._sync_snapshots()
        self._sync_pricing_from_offer_or_product()
        self._recalculate_totals()
        self._sync_operational_timestamps()

        if not self.order_id:
            raise ValidationError({"order": "الطلب مطلوب."})

        if not self.product_id:
            raise ValidationError({"product": "المنتج مطلوب."})

        if not self.title:
            raise ValidationError({"title": "عنوان العنصر مطلوب."})

        if self.quantity < 1:
            raise ValidationError({"quantity": "الكمية يجب أن تكون أكبر من أو تساوي 1."})

        if self.unit_discount_percentage < Decimal("0.00") or self.unit_discount_percentage > Decimal("100.00"):
            raise ValidationError(
                {"unit_discount_percentage": "نسبة خصم الوحدة يجب أن تكون بين 0 و 100."}
            )

        if self.discount_percentage < Decimal("0.00") or self.discount_percentage > Decimal("100.00"):
            raise ValidationError(
                {"discount_percentage": "نسبة الخصم يجب أن تكون بين 0 و 100."}
            )

        for field_name in [
            "unit_price_before_discount",
            "unit_price",
            "discount_amount",
            "net_unit_price",
            "total_amount",
        ]:
            value = getattr(self, field_name)
            if value is not None and value < Decimal("0.00"):
                raise ValidationError({field_name: "القيمة لا يمكن أن تكون سالبة."})

        if (
            self.unit_price_before_discount > Decimal("0.00")
            and self.unit_price > self.unit_price_before_discount
        ):
            raise ValidationError(
                {"unit_price": "سعر الوحدة بعد الخصم لا يمكن أن يكون أكبر من سعر الوحدة قبل الخصم."}
            )

        if self.contract and self.provider and self.contract.provider_id != self.provider_id:
            raise ValidationError(
                {"contract": "العقد المحدد لا ينتمي إلى الجهة المقدمة المختارة."}
            )

        if (
            self.contract_product
            and self.contract
            and self.contract_product.contract_id != self.contract_id
        ):
            raise ValidationError(
                {"contract_product": "عرض المنتج داخل العقد لا ينتمي إلى نفس العقد المحدد."}
            )

        if (
            self.contract_product
            and self.product
            and self.contract_product.product_id != self.product_id
        ):
            raise ValidationError(
                {"contract_product": "عرض المنتج داخل العقد لا يطابق المنتج المحدد في العنصر."}
            )

        if (
            self.contract_product
            and self.provider
            and self.contract_product.contract
            and self.contract_product.contract.provider_id != self.provider_id
        ):
            raise ValidationError(
                {"provider": "عرض المنتج داخل العقد مرتبط بجهة مختلفة عن الجهة المحددة."}
            )

        if self.service_item:
            if self.contract and self.service_item.contract_id != self.contract_id:
                raise ValidationError(
                    {"service_item": "الخدمة لا تنتمي إلى نفس العقد المحدد."}
                )

            if (
                self.contract_product
                and self.service_item.contract_product_id
                and self.service_item.contract_product_id != self.contract_product_id
            ):
                raise ValidationError(
                    {"service_item": "الخدمة لا تنتمي إلى عرض المنتج داخل العقد المحدد."}
                )

            if self.provider and self.service_item.contract.provider_id != self.provider_id:
                raise ValidationError(
                    {"provider": "الخدمة المختارة مرتبطة بجهة مختلفة عن الجهة المحددة."}
                )

        if self.status == OrderItemStatus.APPROVAL_PENDING and not self.requires_approval:
            self.requires_approval = True

        if self.status == OrderItemStatus.REJECTED and not self.approval_notes:
            raise ValidationError({"approval_notes": "ملاحظات الرفض مطلوبة عند رفض العنصر."})

        if self.status == OrderItemStatus.COMPLETED and self.fulfillment_status not in {
            FulfillmentStatus.PARTIAL,
            FulfillmentStatus.COMPLETED,
        }:
            self.fulfillment_status = FulfillmentStatus.COMPLETED

        if self.fulfillment_status == FulfillmentStatus.COMPLETED and self.status not in {
            OrderItemStatus.COMPLETED,
            OrderItemStatus.IN_PROGRESS,
            OrderItemStatus.APPROVED,
        }:
            self.status = OrderItemStatus.COMPLETED

        if self.status == OrderItemStatus.CANCELLED:
            self.fulfillment_status = FulfillmentStatus.CANCELLED

    # ========================================================
    # 🔹 Save
    # ========================================================
    def save(self, *args, **kwargs):
        self._normalize_strings()
        self._sync_from_relations()
        self._sync_snapshots()
        self._sync_pricing_from_offer_or_product()
        self._recalculate_totals()
        self._sync_operational_timestamps()
        self.full_clean()
        super().save(*args, **kwargs)