# ============================================================
# 📂 accounting/management/commands/test_accounting_posting.py
# 🧠 Primey Care | Test Accounting Posting
# ------------------------------------------------------------
# ✅ أمر اختباري عملي لاختبار:
#    - ترحيل الفاتورة
#    - ترحيل الدفعة
#    - حركة الخزينة من الدفعة
#    - ترحيل استحقاق عمولة المندوب
#    - ميزان المراجعة
#    - قائمة الدخل
#    - الميزانية العمومية
# ------------------------------------------------------------
# الاستخدام:
# python manage.py test_accounting_posting
# python manage.py test_accounting_posting --create-sample-data
# python manage.py test_accounting_posting --create-sample-data --seed-coa
# python manage.py test_accounting_posting --create-sample-data --reset-entries
# python manage.py test_accounting_posting --create-sample-data --seed-coa --reset-entries
# ============================================================

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounting.models import Account, JournalEntry, JournalEntryStatus
from accounting.services import (
    ACCOUNT_CODE_ACCOUNTS_RECEIVABLE,
    ACCOUNT_CODE_AGENT_COMMISSION_EXPENSE,
    ACCOUNT_CODE_AGENT_COMMISSION_PAYABLE,
    ACCOUNT_CODE_BANK,
    ACCOUNT_CODE_CASH_ON_HAND,
    ACCOUNT_CODE_OUTPUT_VAT,
    ACCOUNT_CODE_REVENUE,
    build_balance_sheet_payload,
    build_profit_and_loss_payload,
    build_trial_balance_payload,
    post_agent_commission_accrual,
    post_invoice_issue,
    post_payment_receipt,
)
from agents.models import (
    Agent,
    AgentCommission,
    AgentOrder,
    CommissionStatus,
    CommissionType,
)
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
# 🧩 ثوابت الاختبار
# ============================================================

TEST_CUSTOMER_PHONE = "0500000001"
TEST_CUSTOMER_EMAIL = "test-customer@primeycare.local"

TEST_PRODUCT_CODE = "PRD-POST-001"
TEST_PRODUCT_SLUG = "prd-post-001"

TEST_PROVIDER_CODE = "PROV-POST-001"
TEST_PROVIDER_SLUG = "prov-post-001"

TEST_ORDER_NUMBER = "ORD-POST-001"
TEST_ORDER_ITEM_CODE = "ORD-ITEM-POST-001"
TEST_INVOICE_NUMBER = "INV-POST-001"
TEST_PAYMENT_NUMBER = "PAY-POST-001"
TEST_AGENT_CODE = "AGT-POST-001"
TEST_AGENT_REFERRAL_CODE = "REF-POST-001"
TEST_TREASURY_ACCOUNT_CODE = "CASH-POST-001"

REQUIRED_ACCOUNT_CODES = {
    ACCOUNT_CODE_ACCOUNTS_RECEIVABLE: "المدينون",
    ACCOUNT_CODE_CASH_ON_HAND: "النقدية في الخزينة",
    ACCOUNT_CODE_BANK: "حساب البنك الجاري",
    ACCOUNT_CODE_REVENUE: "إيرادات المبيعات/ الخدمات",
    ACCOUNT_CODE_OUTPUT_VAT: "ضريبة القيمة المضافة المستحقة",
    ACCOUNT_CODE_AGENT_COMMISSION_EXPENSE: "عمولات البيع",
    ACCOUNT_CODE_AGENT_COMMISSION_PAYABLE: "مصروفات مستحقة",
}


# ============================================================
# 🛠️ Helpers عامة
# ============================================================

def money(value) -> Decimal:
    return Decimal(str(value or "0.00")).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


def local_today():
    return timezone.localdate()


def current_dt():
    return timezone.now()


def enum_value(value) -> str:
    raw = getattr(value, "value", value)
    return str(raw or "").strip()


def model_has_field(instance: Any, field_name: str) -> bool:
    """
    يتحقق من وجود حقل فعلي داخل موديل Django.
    مفيد لأن بعض الموديلات قد تختلف بين نسخة وأخرى.
    """
    try:
        instance._meta.get_field(field_name)
        return True
    except Exception:
        return False


def set_field_if_exists(instance: Any, field_name: str, value: Any) -> None:
    """
    يعيّن قيمة الحقل فقط إذا كان الحقل موجودًا فعليًا داخل الموديل.
    """
    if model_has_field(instance, field_name):
        setattr(instance, field_name, value)


def safe_save(instance: Any) -> Any:
    """
    حفظ موحد.
    بعض الموديلات لديها full_clean داخل save، لذلك لا نضيف full_clean هنا
    حتى لا نكرر التحقق أو نكسر منطق الموديل.
    """
    instance.save()
    return instance


# ============================================================
# 🚀 Command
# ============================================================

class Command(BaseCommand):
    help = "اختبار عملي لطبقة accounting posting services داخل Primey Care"

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
        parser.add_argument(
            "--seed-coa",
            action="store_true",
            help="تشغيل seed_chart_of_accounts قبل الاختبار.",
        )
        parser.add_argument(
            "--skip-treasury",
            action="store_true",
            help="تجاوز اختبار حركة الخزينة والاكتفاء بقيود المحاسبة.",
        )

    def handle(self, *args, **options):
        create_sample_data = options.get("create_sample_data", False)
        reset_entries = options.get("reset_entries", False)
        seed_coa = options.get("seed_coa", False)
        skip_treasury = options.get("skip_treasury", False)

        try:
            if seed_coa:
                self.stdout.write(self.style.NOTICE("زرع/تحديث شجرة الحسابات قبل الاختبار..."))
                call_command("seed_chart_of_accounts")

            self._validate_required_accounts()

            with transaction.atomic():
                if reset_entries:
                    self._reset_test_postings()

                test_payload = self._prepare_test_data(
                    create_sample_data=create_sample_data,
                )

                invoice = test_payload["invoice"]
                payment = test_payload["payment"]
                agent_commission = test_payload["agent_commission"]
                treasury_account = test_payload["treasury_account"]

                self.stdout.write("")
                self.stdout.write(self.style.NOTICE("بدء اختبار ترحيل الفاتورة..."))
                invoice_entry = post_invoice_issue(invoice)
                self._print_entry("قيد الفاتورة", invoice_entry)
                self._assert_entry_valid(invoice_entry)

                self.stdout.write("")
                self.stdout.write(self.style.NOTICE("بدء اختبار ترحيل الدفعة..."))
                payment_entry = post_payment_receipt(payment)
                self._print_entry("قيد الدفعة", payment_entry)
                self._assert_entry_valid(payment_entry)

                if not skip_treasury:
                    self.stdout.write("")
                    self.stdout.write(self.style.NOTICE("بدء اختبار حركة الخزينة من الدفعة..."))
                    treasury_txn = self._create_or_get_payment_treasury_transaction(
                        payment=payment,
                        treasury_account=treasury_account,
                    )
                    self._print_treasury_transaction(treasury_txn)

                self.stdout.write("")
                self.stdout.write(self.style.NOTICE("بدء اختبار ترحيل استحقاق عمولة المندوب..."))
                commission_entry = post_agent_commission_accrual(agent_commission)
                self._print_entry("قيد عمولة المندوب", commission_entry)
                self._assert_entry_valid(commission_entry)

                self.stdout.write("")
                self.stdout.write(self.style.NOTICE("بدء اختبار التقارير المالية..."))
                self._print_reports_summary()

                self.stdout.write("")
                self.stdout.write(self.style.SUCCESS("تم اختبار accounting posting services بنجاح."))

        except CommandError:
            raise
        except Exception as exc:
            raise CommandError(f"فشل اختبار accounting posting services: {exc}") from exc

    # ========================================================
    # ✅ Validations
    # ========================================================

    def _validate_required_accounts(self):
        self.stdout.write(self.style.NOTICE("التحقق من الحسابات التشغيلية المطلوبة..."))

        missing_codes = []

        for code, label in REQUIRED_ACCOUNT_CODES.items():
            exists = Account.objects.filter(
                code=code,
                is_active=True,
                is_group=False,
            ).exists()

            if not exists:
                missing_codes.append(f"{code} - {label}")

        if missing_codes:
            raise CommandError(
                "توجد حسابات تشغيلية مفقودة أو غير نشطة أو تجميعية.\n"
                "شغّل أولًا:\n"
                "python manage.py seed_chart_of_accounts\n"
                + "\n".join(missing_codes)
            )

        self.stdout.write(self.style.SUCCESS("الحسابات التشغيلية جاهزة."))

    def _assert_entry_valid(self, entry: JournalEntry):
        entry.refresh_from_db()

        if entry.status != JournalEntryStatus.POSTED:
            raise ValidationError(f"القيد {entry.entry_number} لم يتم ترحيله.")

        if entry.total_debit != entry.total_credit:
            raise ValidationError(f"القيد {entry.entry_number} غير متوازن.")

        if entry.total_debit <= money("0.00"):
            raise ValidationError(f"القيد {entry.entry_number} صفري.")

        if not entry.lines.exists():
            raise ValidationError(f"القيد {entry.entry_number} لا يحتوي على أسطر.")

    # ========================================================
    # 🔄 Reset
    # ========================================================

    def _reset_test_postings(self):
        self.stdout.write(self.style.WARNING("حذف القيود والحركات التجريبية السابقة..."))

        treasury_deleted = 0

        for qs in [
            TreasuryTransaction.objects.filter(transaction_number__startswith="TRX-PAY-"),
            TreasuryTransaction.objects.filter(transaction_number__startswith="TRX-COM-"),
            TreasuryTransaction.objects.filter(reference__icontains=TEST_PAYMENT_NUMBER),
            TreasuryTransaction.objects.filter(reference__icontains="PAYMENT:"),
        ]:
            deleted_count, _ = qs.delete()
            treasury_deleted += deleted_count

        entries_deleted = 0

        for qs in [
            JournalEntry.objects.filter(
                entry_number__startswith="INV-",
                reference__startswith="INVOICE:",
            ),
            JournalEntry.objects.filter(
                entry_number__startswith="PAY-",
                reference__startswith="PAYMENT:",
            ),
            JournalEntry.objects.filter(
                entry_number__startswith="COM-",
                reference__startswith="AGENT_COMMISSION:",
            ),
        ]:
            deleted_count, _ = qs.delete()
            entries_deleted += deleted_count

        self.stdout.write(f"تم حذف حركات خزينة: {treasury_deleted}")
        self.stdout.write(f"تم حذف قيود محاسبية: {entries_deleted}")

    # ========================================================
    # 🧪 Prepare Test Data
    # ========================================================

    def _prepare_test_data(self, *, create_sample_data: bool):
        if create_sample_data:
            self.stdout.write(self.style.WARNING("إنشاء/تحديث بيانات اختبار تلقائية..."))
            return self._create_sample_data()

        invoice = Invoice.objects.order_by("-id").first()
        payment = Payment.objects.order_by("-id").first()
        agent_commission = AgentCommission.objects.order_by("-id").first()
        treasury_account = TreasuryAccount.objects.filter(
            status=TreasuryAccountStatus.ACTIVE,
        ).order_by("id").first()

        if invoice and payment and agent_commission and treasury_account:
            return {
                "invoice": invoice,
                "payment": payment,
                "agent_commission": agent_commission,
                "treasury_account": treasury_account,
            }

        raise ValidationError(
            "لا توجد بيانات كافية للاختبار. "
            "شغّل الأمر مع: --create-sample-data"
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
            agent_order,
            order,
            agent,
            payment,
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
            phone_number=TEST_CUSTOMER_PHONE,
        ).first()

        if not customer:
            customer = Customer()

        customer.first_name = "عميل"
        customer.last_name = "تجريبي"
        customer.email = TEST_CUSTOMER_EMAIL
        customer.phone_number = TEST_CUSTOMER_PHONE
        customer.whatsapp_number = TEST_CUSTOMER_PHONE
        customer.alternative_phone_number = ""
        customer.customer_type = Customer.CustomerType.INDIVIDUAL
        customer.status = Customer.Status.ACTIVE
        customer.source = Customer.Source.ADMIN
        customer.city = "Madinah"
        customer.country = "Saudi Arabia"
        customer.nationality = "Saudi"
        customer.notes = "عميل تجريبي لاختبار الترحيل المحاسبي"
        customer.tags = "posting,test"

        return safe_save(customer)

    # ========================================================
    # 📦 Product
    # ========================================================

    def _get_or_create_product(self):
        product = Product.objects.filter(
            code=TEST_PRODUCT_CODE,
        ).first()

        if not product:
            product = Product()

        product.code = TEST_PRODUCT_CODE
        product.name = "خدمة تجريبية للترحيل"

        # مهم جدًا:
        # بعض إصدارات Product تطلب slug صالحًا ولا تقبل الاسم العربي كـ slug.
        set_field_if_exists(product, "slug", TEST_PRODUCT_SLUG)

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

        return safe_save(product)

    # ========================================================
    # 🏥 Provider
    # ========================================================

    def _get_or_create_provider(self):
        provider = Provider.objects.filter(
            code=TEST_PROVIDER_CODE,
        ).first()

        if not provider:
            provider = Provider()

        provider.code = TEST_PROVIDER_CODE
        provider.name = "جهة تجريبية للترحيل"

        # احتياطًا إذا كان Provider لديه slug في بعض النسخ.
        set_field_if_exists(provider, "slug", TEST_PROVIDER_SLUG)

        provider.provider_type = ProviderType.PARTNER
        provider.status = ProviderStatus.ACTIVE

        return safe_save(provider)

    # ========================================================
    # 🧾 Order
    # ========================================================

    def _get_or_create_order(self, customer, product):
        order = Order.objects.filter(
            order_number=TEST_ORDER_NUMBER,
        ).first()

        if not order:
            order = Order()

        order.order_number = TEST_ORDER_NUMBER
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

        return safe_save(order)

    # ========================================================
    # 🧩 Order Item
    # ========================================================

    def _get_or_create_order_item(self, order, product, provider):
        existing = order.items.filter(
            code=TEST_ORDER_ITEM_CODE,
        ).first()

        if existing:
            return existing

        item = OrderItem(
            order=order,
            product=product,
            provider=provider,
            title="عنصر طلب تجريبي للترحيل",
            code=TEST_ORDER_ITEM_CODE,
            quantity=1,
            unit_price=money("100.00"),
            discount_percentage=money("0.00"),
            discount_amount=money("0.00"),
            status=OrderItemStatus.PENDING,
            fulfillment_status=FulfillmentStatus.NOT_STARTED,
        )

        return safe_save(item)

    # ========================================================
    # 🧾 Invoice
    # ========================================================

    def _get_or_create_invoice(self, order, customer):
        invoice = Invoice.objects.filter(
            order=order,
        ).first()

        if not invoice:
            invoice = Invoice(order=order)

        invoice.customer = customer
        invoice.invoice_number = invoice.invoice_number or TEST_INVOICE_NUMBER
        invoice.invoice_type = InvoiceType.SALES
        invoice.status = InvoiceStatus.ISSUED
        invoice.issue_date = invoice.issue_date or local_today()
        invoice.due_date = invoice.due_date or local_today()
        invoice.tax_rate = money("15.00")
        invoice.currency = "SAR"
        invoice.notes = "فاتورة تجريبية لاختبار الترحيل"

        return safe_save(invoice)

    # ========================================================
    # 💳 Payment
    # ========================================================

    def _get_or_create_payment(self, order, customer, invoice):
        payment = Payment.objects.filter(
            payment_number=TEST_PAYMENT_NUMBER,
        ).first()

        if not payment:
            payment = Payment()

        invoice_total = money(getattr(invoice, "total_amount", None) or "115.00")

        payment.payment_number = TEST_PAYMENT_NUMBER
        payment.order = order
        payment.customer = customer
        payment.invoice = invoice
        payment.status = PaymentStatus.PAID
        payment.payment_method = PaymentMethod.CASH
        payment.provider = PaymentProvider.INTERNAL
        payment.amount = invoice_total
        payment.paid_amount = invoice_total
        payment.refunded_amount = money("0.00")
        payment.currency = "SAR"
        payment.paid_at = payment.paid_at or current_dt()
        payment.notes = "دفعة تجريبية لاختبار الترحيل"

        return safe_save(payment)

    # ========================================================
    # 🧑‍💼 Agent
    # ========================================================

    def _get_or_create_agent(self):
        agent = Agent.objects.filter(
            agent_code=TEST_AGENT_CODE,
        ).first()

        if not agent:
            agent = Agent()

        agent.agent_code = TEST_AGENT_CODE
        agent.full_name = "مندوب تجريبي"
        agent.referral_code = TEST_AGENT_REFERRAL_CODE
        agent.status = "ACTIVE"
        agent.default_commission_type = CommissionType.PERCENTAGE
        agent.default_commission_value = money("10.00")

        return safe_save(agent)

    # ========================================================
    # 🔗 Agent Order
    # ========================================================

    def _get_or_create_agent_order(self, order, customer, agent):
        agent_order = AgentOrder.objects.filter(
            order=order,
        ).first()

        if not agent_order:
            agent_order = AgentOrder(order=order)

        agent_order.agent = agent
        agent_order.customer = customer
        agent_order.commission_type = CommissionType.PERCENTAGE
        agent_order.commission_value = money("10.00")
        agent_order.sales_amount = money("100.00")
        agent_order.referral_code_used = agent.referral_code

        return safe_save(agent_order)

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

        return safe_save(agent_commission)

    # ========================================================
    # 💼 Treasury Account
    # ========================================================

    def _get_or_create_treasury_account(self):
        treasury_account = TreasuryAccount.objects.filter(
            code=TEST_TREASURY_ACCOUNT_CODE,
            status=TreasuryAccountStatus.ACTIVE,
            account_type=TreasuryAccountType.CASHBOX,
        ).first()

        if treasury_account:
            return treasury_account

        treasury_account = TreasuryAccount.objects.filter(
            status=TreasuryAccountStatus.ACTIVE,
            account_type=TreasuryAccountType.CASHBOX,
        ).order_by("id").first()

        if treasury_account:
            return treasury_account

        treasury_account = TreasuryAccount.objects.create(
            name="صندوق تجريبي للترحيل",
            code=TEST_TREASURY_ACCOUNT_CODE,
            account_type=TreasuryAccountType.CASHBOX,
            status=TreasuryAccountStatus.ACTIVE,
            opening_balance=money("0.00"),
            current_balance=money("0.00"),
            currency="SAR",
        )

        return treasury_account

    # ========================================================
    # 💼 Treasury Transaction
    # ========================================================

    def _create_or_get_payment_treasury_transaction(
        self,
        *,
        payment: Payment,
        treasury_account: TreasuryAccount,
    ):
        existing = TreasuryTransaction.objects.filter(
            reference__icontains=str(payment.payment_number),
        ).order_by("-id").first()

        if existing:
            return existing

        existing = TreasuryTransaction.objects.filter(
            reference=f"PAYMENT:{payment.pk}:TREASURY_RECEIPT",
        ).order_by("-id").first()

        if existing:
            return existing

        return create_payment_receipt_transaction(
            payment,
            treasury_account=treasury_account,
            auto_confirm=True,
            post_to_accounting=False,
        )

    # ========================================================
    # 📊 Reports
    # ========================================================

    def _print_reports_summary(self):
        trial_balance = build_trial_balance_payload()
        profit_loss = build_profit_and_loss_payload()
        balance_sheet = build_balance_sheet_payload()

        self.stdout.write(self.style.SUCCESS("ملخص ميزان المراجعة:"))
        self.stdout.write(f"  إجمالي المدين: {trial_balance.get('total_debit')}")
        self.stdout.write(f"  إجمالي الدائن: {trial_balance.get('total_credit')}")
        self.stdout.write(f"  متوازن: {trial_balance.get('is_balanced')}")

        self.stdout.write(self.style.SUCCESS("ملخص قائمة الدخل:"))
        self.stdout.write(
            f"  إجمالي الإيرادات: {profit_loss.get('revenue', {}).get('total_amount')}"
        )
        self.stdout.write(
            f"  إجمالي المصاريف: {profit_loss.get('expenses', {}).get('total_amount')}"
        )
        self.stdout.write(f"  صافي الربح: {profit_loss.get('net_profit')}")

        self.stdout.write(self.style.SUCCESS("ملخص الميزانية العمومية:"))
        self.stdout.write(
            f"  إجمالي الأصول: {balance_sheet.get('assets', {}).get('total_amount')}"
        )
        self.stdout.write(
            "  إجمالي الالتزامات وحقوق الملكية: "
            f"{balance_sheet.get('total_liabilities_and_equity')}"
        )
        self.stdout.write(f"  متوازنة: {balance_sheet.get('is_balanced')}")

    # ========================================================
    # 🖨️ Output
    # ========================================================

    def _print_entry(self, title: str, entry: JournalEntry):
        entry.refresh_from_db()

        self.stdout.write(self.style.SUCCESS(f"{title}: {entry.entry_number}"))
        self.stdout.write(f"التاريخ: {entry.entry_date}")
        self.stdout.write(f"المصدر: {entry.posting_source}")
        self.stdout.write(f"الحالة: {entry.status}")
        self.stdout.write(f"المرجع: {entry.reference}")
        self.stdout.write(f"إجمالي المدين: {entry.total_debit}")
        self.stdout.write(f"إجمالي الدائن: {entry.total_credit}")
        self.stdout.write("الأسطر:")

        for line in entry.lines.select_related("account").order_by("sort_order", "id"):
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