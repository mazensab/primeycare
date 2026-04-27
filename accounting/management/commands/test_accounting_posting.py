# ============================================================
# 📂 accounting/management/commands/test_accounting_posting.py
# 🧠 Primey Care | Test Accounting Posting
# ------------------------------------------------------------
# ✅ أمر اختباري عملي لاختبار:
#    - ترحيل الفاتورة
#    - ترحيل الدفعة
#    - حركة الخزينة من الدفعة
#    - ترحيل استحقاق عمولة المندوب
# ------------------------------------------------------------
# الاستخدام:
# python manage.py test_accounting_posting
# python manage.py test_accounting_posting --create-sample-data
# python manage.py test_accounting_posting --create-sample-data --reset-entries
# ============================================================

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounting.models import JournalEntry
from accounting.services import (
    post_agent_commission_accrual,
    post_invoice_issue,
    post_payment_receipt,
)
from agents.models import Agent, AgentCommission, AgentOrder, CommissionStatus, CommissionType
from customers.models import Customer
from invoices.models import Invoice, InvoiceStatus, InvoiceType
from order_items.models import FulfillmentStatus, OrderItem, OrderItemStatus
from orders.models import Order
from payments.models import Payment, PaymentMethod, PaymentProvider, PaymentStatus
from products.models import Product
from providers.models import Provider, ProviderStatus, ProviderType
from treasury.models import (
    TreasuryAccount,
    TreasuryAccountStatus,
    TreasuryAccountType,
    TreasuryTransaction,
)
from treasury.services import create_payment_receipt_transaction


# ============================================================
# 🛠️ Helpers عامة
# ============================================================

def money(value) -> Decimal:
    return Decimal(str(value or "0.00")).quantize(Decimal("0.01"))


def local_today():
    return timezone.localdate()


def current_dt():
    return timezone.now()


# ============================================================
# 🚀 Command
# ============================================================

class Command(BaseCommand):
    help = "اختبار عملي لطبقة posting services داخل Primey Care"

    def add_arguments(self, parser):
        parser.add_argument(
            "--create-sample-data",
            action="store_true",
            help="إنشاء بيانات اختبار تلقائية إذا لم تكن موجودة.",
        )
        parser.add_argument(
            "--reset-entries",
            action="store_true",
            help="حذف القيود والحركات التجريبية السابقة قبل الاختبار.",
        )

    def handle(self, *args, **options):
        create_sample_data = options.get("create_sample_data", False)
        reset_entries = options.get("reset_entries", False)

        try:
            with transaction.atomic():
                if reset_entries:
                    self._reset_test_postings()

                test_payload = self._prepare_test_data(
                    create_sample_data=create_sample_data
                )

                invoice = test_payload["invoice"]
                payment = test_payload["payment"]
                agent_commission = test_payload["agent_commission"]
                treasury_account = test_payload["treasury_account"]

                self.stdout.write(self.style.NOTICE("بدء اختبار ترحيل الفاتورة..."))
                invoice_entry = post_invoice_issue(invoice)
                self._print_entry("قيد الفاتورة", invoice_entry)

                self.stdout.write("")
                self.stdout.write(self.style.NOTICE("بدء اختبار ترحيل الدفعة..."))
                payment_entry = post_payment_receipt(payment)
                self._print_entry("قيد الدفعة", payment_entry)

                self.stdout.write("")
                self.stdout.write(self.style.NOTICE("بدء اختبار حركة الخزينة من الدفعة..."))
                treasury_txn = create_payment_receipt_transaction(
                    payment,
                    treasury_account=treasury_account,
                    auto_confirm=True,
                    post_to_accounting=False,
                )
                self._print_treasury_transaction(treasury_txn)

                self.stdout.write("")
                self.stdout.write(self.style.NOTICE("بدء اختبار ترحيل استحقاق عمولة المندوب..."))
                commission_entry = post_agent_commission_accrual(agent_commission)
                self._print_entry("قيد عمولة المندوب", commission_entry)

                self.stdout.write("")
                self.stdout.write(self.style.SUCCESS("تم اختبار posting services بنجاح."))

        except Exception as exc:
            raise ValidationError(f"فشل اختبار posting services: {exc}") from exc

    # ========================================================
    # 🔄 Reset
    # ========================================================

    def _reset_test_postings(self):
        self.stdout.write(self.style.WARNING("حذف القيود والحركات التجريبية السابقة..."))

        JournalEntry.objects.filter(
            entry_number__startswith="INV-",
            reference__startswith="INVOICE:",
        ).delete()

        JournalEntry.objects.filter(
            entry_number__startswith="PAY-",
            reference__startswith="PAYMENT:",
        ).delete()

        JournalEntry.objects.filter(
            entry_number__startswith="COM-",
            reference__startswith="AGENT_COMMISSION:",
        ).delete()

        TreasuryTransaction.objects.filter(
            transaction_number__startswith="TRX-PAY-"
        ).delete()

        TreasuryTransaction.objects.filter(
            transaction_number__startswith="TRX-COM-"
        ).delete()

    # ========================================================
    # 🧪 Prepare Test Data
    # ========================================================

    def _prepare_test_data(self, *, create_sample_data: bool):
        if create_sample_data:
            self.stdout.write(self.style.WARNING("إنشاء بيانات اختبار تلقائية..."))
            return self._create_sample_data()

        invoice = Invoice.objects.order_by("-id").first()
        payment = Payment.objects.order_by("-id").first()
        agent_commission = AgentCommission.objects.order_by("-id").first()
        treasury_account = TreasuryAccount.objects.filter(
            status=TreasuryAccountStatus.ACTIVE
        ).order_by("id").first()

        if invoice and payment and agent_commission and treasury_account:
            return {
                "invoice": invoice,
                "payment": payment,
                "agent_commission": agent_commission,
                "treasury_account": treasury_account,
            }

        raise ValidationError(
            "لا توجد بيانات كافية للاختبار. شغّل الأمر مع --create-sample-data."
        )

    # ========================================================
    # 🧩 Create Sample Data
    # ========================================================

    def _create_sample_data(self):
        customer = self._get_or_create_customer()
        product = self._get_or_create_product()
        provider = self._get_or_create_provider()
        order = self._get_or_create_order(customer, product)
        self._get_or_create_order_item(order, product, provider)
        invoice = self._get_or_create_invoice(order, customer)
        payment = self._get_or_create_payment(order, customer, invoice)
        agent = self._get_or_create_agent()
        agent_order = self._get_or_create_agent_order(order, customer, agent)
        agent_commission = self._get_or_create_agent_commission(
            agent_order, order, agent, payment
        )
        treasury_account = self._get_or_create_treasury_account()

        return {
            "invoice": invoice,
            "payment": payment,
            "agent_commission": agent_commission,
            "treasury_account": treasury_account,
        }

    # ========================================================
    # 👤 Customer
    # ========================================================

    def _get_or_create_customer(self):
        customer = Customer.objects.filter(
            phone_number="0500000001"
        ).first()

        if not customer:
            customer = Customer()

        customer.first_name = "عميل"
        customer.last_name = "تجريبي"
        customer.email = "test-customer@primeycare.local"
        customer.phone_number = "0500000001"
        customer.whatsapp_number = "0500000001"
        customer.alternative_phone_number = ""
        customer.customer_type = Customer.CustomerType.INDIVIDUAL
        customer.status = Customer.Status.ACTIVE
        customer.source = Customer.Source.ADMIN
        customer.city = "Madinah"
        customer.country = "Saudi Arabia"
        customer.nationality = "Saudi"
        customer.notes = "عميل تجريبي لاختبار الترحيل المحاسبي"
        customer.tags = "posting,test"
        customer.save()

        return customer

    # ========================================================
    # 📦 Product
    # ========================================================

    def _get_or_create_product(self):
        product = Product.objects.filter(
            code="PRD-POST-001"
        ).first()

        if not product:
            product = Product()

        product.code = "PRD-POST-001"
        product.name = "خدمة تجريبية للترحيل"
        product.product_type = Product.ProductType.SERVICE
        product.status = Product.Status.ACTIVE
        product.billing_type = Product.BillingType.ONE_TIME
        product.duration_value = 0
        product.duration_unit = Product.DurationUnit.NONE
        product.currency_code = "SAR"
        product.price = money("100.00")
        product.sale_price = money("100.00")
        product.cost_price = money("0.00")
        product.is_taxable = True
        product.tax_rate = money("15.00")
        product.is_public = True
        product.is_featured = False
        product.requires_approval = False
        product.allow_online_purchase = True
        product.short_description = "منتج تجريبي لاختبار الترحيل"
        product.description = "منتج/خدمة تجريبية لاختبار الفاتورة والدفعة والقيود."
        product.save()

        return product

    # ========================================================
    # 🏥 Provider
    # ========================================================

    def _get_or_create_provider(self):
        provider = Provider.objects.filter(code="PROV-POST-001").first()
        if not provider:
            provider = Provider()

        provider.code = "PROV-POST-001"
        provider.name = "جهة تجريبية للترحيل"
        provider.provider_type = ProviderType.PARTNER
        provider.status = ProviderStatus.ACTIVE
        provider.save()

        return provider

    # ========================================================
    # 🧾 Order
    # ========================================================

    def _get_or_create_order(self, customer, product):
        order = Order.objects.filter(
            order_number="ORD-POST-001"
        ).first()

        if not order:
            order = Order()

        order.order_number = "ORD-POST-001"
        order.customer = customer
        order.product = product
        order.status = Order.Status.PENDING
        order.source = Order.OrderSource.ADMIN
        order.fulfillment_status = Order.FulfillmentStatus.NOT_STARTED
        order.currency_code = "SAR"
        order.unit_price = money("100.00")
        order.quantity = 1
        order.discount_amount = money("0.00")
        order.tax_amount = money("15.00")
        order.amount_paid = money("0.00")
        order.customer_notes = "طلب تجريبي"
        order.internal_notes = "طلب تجريبي لاختبار posting services"
        order.save()

        return order

    # ========================================================
    # 🧩 Order Item
    # ========================================================

    def _get_or_create_order_item(self, order, product, provider):
        existing = order.items.filter(code="ORD-ITEM-POST-001").first()
        if existing:
            return existing

        item = OrderItem(
            order=order,
            product=product,
            provider=provider,
            title="عنصر طلب تجريبي للترحيل",
            code="ORD-ITEM-POST-001",
            quantity=1,
            unit_price=money("100.00"),
            discount_percentage=money("0.00"),
            discount_amount=money("0.00"),
            status=OrderItemStatus.PENDING,
            fulfillment_status=FulfillmentStatus.NOT_STARTED,
        )
        item.save()
        return item

    # ========================================================
    # 🧾 Invoice
    # ========================================================

    def _get_or_create_invoice(self, order, customer):
        invoice = Invoice.objects.filter(order=order).first()

        if not invoice:
            invoice = Invoice(order=order)

        invoice.customer = customer
        invoice.invoice_number = invoice.invoice_number or "INV-POST-001"
        invoice.invoice_type = InvoiceType.SALES
        invoice.status = InvoiceStatus.ISSUED
        invoice.issue_date = invoice.issue_date or local_today()
        invoice.due_date = invoice.due_date or local_today()
        invoice.tax_rate = money("15.00")
        invoice.currency = "SAR"
        invoice.notes = "فاتورة تجريبية لاختبار الترحيل"
        invoice.save()

        return invoice

    # ========================================================
    # 💳 Payment
    # ========================================================

    def _get_or_create_payment(self, order, customer, invoice):
        payment = Payment.objects.filter(
            payment_number="PAY-POST-001"
        ).first()

        if not payment:
            payment = Payment()

        payment.payment_number = "PAY-POST-001"
        payment.order = order
        payment.customer = customer
        payment.status = PaymentStatus.PAID
        payment.payment_method = PaymentMethod.CASH
        payment.provider = PaymentProvider.INTERNAL
        payment.amount = invoice.total_amount or money("115.00")
        payment.paid_amount = invoice.total_amount or money("115.00")
        payment.refunded_amount = money("0.00")
        payment.currency = "SAR"
        payment.paid_at = payment.paid_at or current_dt()
        payment.notes = "دفعة تجريبية لاختبار الترحيل"
        payment.save()

        return payment

    # ========================================================
    # 🧑‍💼 Agent
    # ========================================================

    def _get_or_create_agent(self):
        agent = Agent.objects.filter(agent_code="AGT-POST-001").first()
        if not agent:
            agent = Agent()

        agent.agent_code = "AGT-POST-001"
        agent.full_name = "مندوب تجريبي"
        agent.referral_code = "REF-POST-001"
        agent.status = "ACTIVE"
        agent.default_commission_type = CommissionType.PERCENTAGE
        agent.default_commission_value = money("10.00")
        agent.save()

        return agent

    # ========================================================
    # 🔗 Agent Order
    # ========================================================

    def _get_or_create_agent_order(self, order, customer, agent):
        agent_order = AgentOrder.objects.filter(order=order).first()

        if not agent_order:
            agent_order = AgentOrder(order=order)

        agent_order.agent = agent
        agent_order.customer = customer
        agent_order.commission_type = CommissionType.PERCENTAGE
        agent_order.commission_value = money("10.00")
        agent_order.sales_amount = money("100.00")
        agent_order.referral_code_used = agent.referral_code
        agent_order.save()

        return agent_order

    # ========================================================
    # 💸 Agent Commission
    # ========================================================

    def _get_or_create_agent_commission(self, agent_order, order, agent, payment):
        agent_commission = AgentCommission.objects.filter(
            agent_order=agent_order,
            order=order,
            agent=agent,
        ).first()

        if not agent_commission:
            agent_commission = AgentCommission(
                agent_order=agent_order,
                order=order,
                agent=agent,
            )

        agent_commission.payment = payment
        agent_commission.commission_status = CommissionStatus.EARNED
        agent_commission.base_amount = money("100.00")
        agent_commission.commission_amount = money("10.00")
        agent_commission.paid_amount = money("0.00")
        agent_commission.earned_at = agent_commission.earned_at or current_dt()
        agent_commission.notes = "عمولة تجريبية لاختبار الترحيل"
        agent_commission.save()

        return agent_commission

    # ========================================================
    # 💼 Treasury Account
    # ========================================================

    def _get_or_create_treasury_account(self):
        treasury_account = TreasuryAccount.objects.filter(
            status=TreasuryAccountStatus.ACTIVE,
            account_type=TreasuryAccountType.CASHBOX,
        ).order_by("id").first()

        if treasury_account:
            return treasury_account

        treasury_account = TreasuryAccount.objects.create(
            name="صندوق تجريبي للترحيل",
            code="CASH-POST-001",
            account_type=TreasuryAccountType.CASHBOX,
            status=TreasuryAccountStatus.ACTIVE,
            opening_balance=money("0.00"),
            current_balance=money("0.00"),
            currency="SAR",
        )
        return treasury_account

    # ========================================================
    # 🖨️ Output
    # ========================================================

    def _print_entry(self, title: str, entry: JournalEntry):
        self.stdout.write(self.style.SUCCESS(f"{title}: {entry.entry_number}"))
        self.stdout.write(f"التاريخ: {entry.entry_date}")
        self.stdout.write(f"المصدر: {entry.posting_source}")
        self.stdout.write(f"المرجع: {entry.reference}")
        self.stdout.write(f"إجمالي المدين: {entry.total_debit}")
        self.stdout.write(f"إجمالي الدائن: {entry.total_credit}")
        self.stdout.write("الأسطر:")

        for line in entry.lines.order_by("sort_order", "id"):
            self.stdout.write(
                f"  - [{line.account.code}] {line.account.name} | "
                f"مدين={line.debit_amount} | دائن={line.credit_amount}"
            )

    def _print_treasury_transaction(self, txn: TreasuryTransaction):
        self.stdout.write(self.style.SUCCESS(f"حركة الخزينة: {txn.transaction_number}"))
        self.stdout.write(f"النوع: {txn.transaction_type}")
        self.stdout.write(f"الحالة: {txn.status}")
        self.stdout.write(f"الحساب: {txn.treasury_account}")
        self.stdout.write(f"المبلغ: {txn.amount}")
        self.stdout.write(f"المرجع: {txn.reference}")
        self.stdout.write(f"مرجع القيد: {txn.journal_entry_reference or '-'}")