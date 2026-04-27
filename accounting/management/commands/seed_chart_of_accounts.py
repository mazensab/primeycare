# ============================================================
# 📂 accounting/management/commands/seed_chart_of_accounts.py
# 🧠 Primey Care | Seed Saudi Chart of Accounts
# ------------------------------------------------------------
# ✅ يزرع شجرة الحسابات المعتمدة داخل جدول Account
# ✅ مبني على الملفين العربي والإنجليزي اللذين اعتمدهما المستخدم
# ✅ Idempotent:
#    - يعيد التحديث عند وجود الحساب
#    - لا يكرر السجلات
# ✅ يدعم:
#    - الزرع العادي
#    - reset آمن عبر فك parent أولًا ثم الحذف
# ============================================================

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

from django.core.management.base import BaseCommand
from django.db import transaction

from accounting.models import Account, AccountNature, AccountType


# ============================================================
# 🧾 DTO
# ============================================================

@dataclass
class AccountSeedRow:
    code: str
    name_ar: str
    name_en: str
    account_type: str
    nature: str
    parent_code: Optional[str]
    is_group: bool
    is_active: bool = True
    description: str = ""


# ============================================================
# 🧠 الشجرة الكاملة المعتمدة
# ============================================================

CHART_OF_ACCOUNTS: List[AccountSeedRow] = [
    # ========================================================
    # الأصول
    # ========================================================
    AccountSeedRow("1", "الأصول", "Assets", AccountType.ASSET, AccountNature.DEBIT, None, True),
    AccountSeedRow("11", "أصول متداولة", "Current Assets", AccountType.ASSET, AccountNature.DEBIT, "1", True),
    AccountSeedRow("1101", "النقد ومايعادله", "Cash and equivalents", AccountType.ASSET, AccountNature.DEBIT, "11", True, description="النقدية وما في حكمها"),
    AccountSeedRow("110101", "النقدية في الخزينة", "Cash on hand", AccountType.ASSET, AccountNature.DEBIT, "1101", False, description="النقدية في الخزينة"),
    AccountSeedRow("110102", "العهد النقدية", "Petty cash", AccountType.ASSET, AccountNature.DEBIT, "1101", False, description="العهد النقدية للموظفين بشكل مؤقت أو دائم لدفع مصروفات المنشأة"),
    AccountSeedRow("1102", "النقدية في البنك", "Cash in bank", AccountType.ASSET, AccountNature.DEBIT, "11", True, description="الحسابات البنكية"),
    AccountSeedRow("110201", "حساب البنك الجاري - اسم البنك", "Bank Current Account - Bank Name", AccountType.ASSET, AccountNature.DEBIT, "1102", False, description="حساب البنك الجاري"),
    AccountSeedRow("110202", "بنك تجريبي", "Test Bank", AccountType.ASSET, AccountNature.DEBIT, "1102", False, description="حساب بنكي تجريبي"),
    AccountSeedRow("1103", "المدينون", "Receivables", AccountType.ASSET, AccountNature.DEBIT, "11", False),
    AccountSeedRow("1104", "مصروفات مقدمة", "Prepaid Expenses", AccountType.ASSET, AccountNature.DEBIT, "11", True),
    AccountSeedRow("110401", "تأمين طبي مقدم", "Prepaid Medical Insurance", AccountType.ASSET, AccountNature.DEBIT, "1104", False),
    AccountSeedRow("110402", "إيجار مقدم", "Prepaid Rent", AccountType.ASSET, AccountNature.DEBIT, "1104", False),
    AccountSeedRow("1105", "مدفوعات مقدمة للموظفين", "Advance Payments to Employees", AccountType.ASSET, AccountNature.DEBIT, "11", False),
    AccountSeedRow("1106", "المخزون", "Inventory", AccountType.ASSET, AccountNature.DEBIT, "11", False),

    AccountSeedRow("12", "أصول غير متداولة", "Non-current Assets", AccountType.ASSET, AccountNature.DEBIT, "1", True),
    AccountSeedRow("1201", "عقارات وآلات ومعدات", "Property Plant and Equipment", AccountType.ASSET, AccountNature.DEBIT, "12", True),
    AccountSeedRow("120101", "الأراضي", "Land", AccountType.ASSET, AccountNature.DEBIT, "1201", False),
    AccountSeedRow("120102", "المباني", "Buildings", AccountType.ASSET, AccountNature.DEBIT, "1201", False),
    AccountSeedRow("120103", "المعدات", "Equipment", AccountType.ASSET, AccountNature.DEBIT, "1201", False),
    AccountSeedRow("120104", "أجهزة مكتبية وطابعات", "Office Equipment and Printers", AccountType.ASSET, AccountNature.DEBIT, "1201", False),
    AccountSeedRow("1202", "الأصول غير الملموسة", "Intangible Assets", AccountType.ASSET, AccountNature.DEBIT, "12", False),
    AccountSeedRow("1203", "العقارات الاستثمارية", "Investment Properties", AccountType.ASSET, AccountNature.DEBIT, "12", False),

    # ========================================================
    # الالتزامات
    # ========================================================
    AccountSeedRow("2", "الالتزامات", "Liabilities", AccountType.LIABILITY, AccountNature.CREDIT, None, True),
    AccountSeedRow("21", "الالتزامات المتداولة", "Current Liabilities", AccountType.LIABILITY, AccountNature.CREDIT, "2", True),
    AccountSeedRow("2101", "الدائنون", "Payables", AccountType.LIABILITY, AccountNature.CREDIT, "21", False),
    AccountSeedRow("2102", "مصروفات مستحقة", "Accrued Expenses", AccountType.LIABILITY, AccountNature.CREDIT, "21", False),
    AccountSeedRow("2103", "الرواتب المستحقة", "Accrued Salaries", AccountType.LIABILITY, AccountNature.CREDIT, "21", False),
    AccountSeedRow("2104", "قروض قصيرة الأجل", "Short-term Loans", AccountType.LIABILITY, AccountNature.CREDIT, "21", False),
    AccountSeedRow("2105", "ضريبة القيمة المضافة المستحقة", "VAT Payable", AccountType.LIABILITY, AccountNature.CREDIT, "21", False),
    AccountSeedRow("2106", "الضرائب المستحقة", "Taxes Payable", AccountType.LIABILITY, AccountNature.CREDIT, "21", False),
    AccountSeedRow("2107", "إيرادات غير مكتسبة", "Unearned Revenue", AccountType.LIABILITY, AccountNature.CREDIT, "21", False),
    AccountSeedRow("2108", "مستحقات المؤسسة العامة للتأمينات الاجتماعية", "GOSI Payable", AccountType.LIABILITY, AccountNature.CREDIT, "21", False),
    AccountSeedRow("2109", "مجمع الاستهلاك", "Accumulated Depreciation", AccountType.LIABILITY, AccountNature.CREDIT, "21", True),
    AccountSeedRow("210901", "مجمع استهلاك المباني", "Accumulated Depreciation - Buildings", AccountType.LIABILITY, AccountNature.CREDIT, "2109", False),
    AccountSeedRow("210902", "مجمع استهلاك المعدات", "Accumulated Depreciation - Equipment", AccountType.LIABILITY, AccountNature.CREDIT, "2109", False),
    AccountSeedRow("210903", "مجمع استهلاك أجهزة مكتبية وطابعات", "Accumulated Depreciation - Office Equipment and Printers", AccountType.LIABILITY, AccountNature.CREDIT, "2109", False),

    AccountSeedRow("22", "التزامات غير متداولة", "Non-current Liabilities", AccountType.LIABILITY, AccountNature.CREDIT, "2", True),
    AccountSeedRow("2201", "قروض طويلة أجل", "Long-term Loans", AccountType.LIABILITY, AccountNature.CREDIT, "22", False),
    AccountSeedRow("2202", "مخصص مكافأة نهاية الخدمة", "End of Service Benefit Provision", AccountType.LIABILITY, AccountNature.CREDIT, "22", False),

    # ========================================================
    # حقوق الملكية
    # ========================================================
    AccountSeedRow("3", "حقوق الملكية", "Equity", AccountType.EQUITY, AccountNature.CREDIT, None, True),
    AccountSeedRow("31", "رأس المال", "Capital", AccountType.EQUITY, AccountNature.CREDIT, "3", True),
    AccountSeedRow("3101", "رأس المال المسجل", "Registered Capital", AccountType.EQUITY, AccountNature.CREDIT, "31", False),
    AccountSeedRow("3102", "رأس المال الإضافي المدفوع", "Additional Paid-in Capital", AccountType.EQUITY, AccountNature.CREDIT, "31", False),
    AccountSeedRow("32", "حقوق ملكية أخرى", "Other Equity", AccountType.EQUITY, AccountNature.CREDIT, "3", True),
    AccountSeedRow("3201", "أرصدة افتتاحية", "Opening Balances", AccountType.EQUITY, AccountNature.CREDIT, "32", False),
    AccountSeedRow("33", "احتياطيات", "Reserves", AccountType.EQUITY, AccountNature.CREDIT, "3", True),
    AccountSeedRow("3301", "احتياطي نظامي", "Statutory Reserve", AccountType.EQUITY, AccountNature.CREDIT, "33", False),
    AccountSeedRow("3302", "احتياطي ترجمة عملات أجنبية", "Foreign Currency Translation Reserve", AccountType.EQUITY, AccountNature.CREDIT, "33", False),
    AccountSeedRow("34", "الأرباح المبقاة (أو الخسائر)", "Retained Earnings (or Losses)", AccountType.EQUITY, AccountNature.CREDIT, "3", True),
    AccountSeedRow("3401", "الأرباح والخسائر العاملة", "Current Year Profit and Loss", AccountType.EQUITY, AccountNature.CREDIT, "34", False),
    AccountSeedRow("3402", "الأرباح المبقاة (أو الخسائر)", "Retained Earnings (or Losses)", AccountType.EQUITY, AccountNature.CREDIT, "34", False),

    # ========================================================
    # الإيرادات
    # ========================================================
    AccountSeedRow("4", "الإيرادات", "Revenue", AccountType.REVENUE, AccountNature.CREDIT, None, True),
    AccountSeedRow("41", "الإيرادات التشغيلية", "Operating Revenue", AccountType.REVENUE, AccountNature.CREDIT, "4", True),
    AccountSeedRow("4101", "إيرادات المبيعات/ الخدمات", "Sales / Service Revenue", AccountType.REVENUE, AccountNature.CREDIT, "41", False),
    AccountSeedRow("42", "الإيرادات غير التشغيلية", "Non-operating Revenue", AccountType.REVENUE, AccountNature.CREDIT, "4", True),
    AccountSeedRow("4201", "إيرادات أخرى", "Other Revenue", AccountType.REVENUE, AccountNature.CREDIT, "42", False),

    # ========================================================
    # المصاريف
    # ========================================================
    AccountSeedRow("5", "المصاريف", "Expenses", AccountType.EXPENSE, AccountNature.DEBIT, None, True),
    AccountSeedRow("51", "التكاليف المباشرة", "Direct Costs", AccountType.EXPENSE, AccountNature.DEBIT, "5", True),
    AccountSeedRow("5101", "تكلفة البضاعة المباعة", "Cost of Goods Sold", AccountType.EXPENSE, AccountNature.DEBIT, "51", False),
    AccountSeedRow("5102", "رواتب وأجور", "Salaries and Wages", AccountType.EXPENSE, AccountNature.DEBIT, "51", False),
    AccountSeedRow("5103", "عمولات البيع", "Sales Commissions", AccountType.EXPENSE, AccountNature.DEBIT, "51", False),
    AccountSeedRow("5104", "شحن وتخليص جمركي", "Shipping and Customs Clearance", AccountType.EXPENSE, AccountNature.DEBIT, "51", False),

    AccountSeedRow("52", "التكاليف التشغيلية", "Operating Expenses", AccountType.EXPENSE, AccountNature.DEBIT, "5", True),
    AccountSeedRow("5201", "الرواتب والرسوم الإدارية", "Administrative Salaries and Fees", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5202", "تأمين طبي", "Medical Insurance", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5203", "مصاريف تسويقية ودعائية", "Marketing and Advertising Expenses", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5204", "مصاريف الإيجار", "Rent Expense", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5205", "عمولات وحوافز", "Commissions and Incentives", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5206", "تذاكر سفر", "Travel Tickets", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5207", "التأمينات الاجتماعية", "Social Insurance", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5208", "الرسوم الحكومية", "Government Fees", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5209", "رسوم واشتراكات", "Fees and Subscriptions", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5210", "مصاريف خدمات المكتب", "Office Service Expenses", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5211", "مصاريف مكتبية ومطبوعات", "Office Supplies and Printing", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5212", "مصاريف ضيافة", "Hospitality Expenses", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5213", "عمولات بنكية", "Bank Charges", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5214", "مصاريف أخرى", "Other Expenses", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5215", "مصاريف الإهلاك", "Depreciation Expense", AccountType.EXPENSE, AccountNature.DEBIT, "52", True),
    AccountSeedRow("521501", "مصروف إهلاك المباني", "Depreciation Expense - Buildings", AccountType.EXPENSE, AccountNature.DEBIT, "5215", False),
    AccountSeedRow("521502", "مصروف إهلاك المعدات", "Depreciation Expense - Equipment", AccountType.EXPENSE, AccountNature.DEBIT, "5215", False),
    AccountSeedRow("521503", "مصروف إهلاك أجهزة مكتبية وطابعات", "Depreciation Expense - Office Equipment and Printers", AccountType.EXPENSE, AccountNature.DEBIT, "5215", False),
    AccountSeedRow("5219", "مصروف نقل ومواصلات", "Transportation Expense", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),

    AccountSeedRow("53", "مصاريف غير التشغيلية", "Non-operating Expenses", AccountType.EXPENSE, AccountNature.DEBIT, "5", True),
    AccountSeedRow("5301", "الزكاة", "Zakat", AccountType.EXPENSE, AccountNature.DEBIT, "53", False),
    AccountSeedRow("5302", "الضرائب", "Taxes", AccountType.EXPENSE, AccountNature.DEBIT, "53", False),
    AccountSeedRow("5303", "ترجمة عملات أجنبية", "Foreign Currency Translation", AccountType.EXPENSE, AccountNature.DEBIT, "53", False),
    AccountSeedRow("5304", "فوائد", "Interest Expense", AccountType.EXPENSE, AccountNature.DEBIT, "53", False),
]


# ============================================================
# 🛠️ Helpers
# ============================================================

def build_description(name_en: str, extra_description: str = "") -> str:
    if extra_description and name_en:
        return f"EN: {name_en}\n{extra_description}"
    if name_en:
        return f"EN: {name_en}"
    return extra_description or ""


def sort_rows_by_code_length(rows: List[AccountSeedRow]) -> List[AccountSeedRow]:
    return sorted(rows, key=lambda item: (len(item.code), item.code))


def safe_reset_accounts() -> None:
    """
    Reset آمن لدليل الحسابات:
    1) فك parent
    2) حذف الحسابات
    """
    Account.objects.update(parent=None)
    Account.objects.all().delete()


# ============================================================
# 🚀 Command
# ============================================================

class Command(BaseCommand):
    help = "زرع شجرة الحسابات المعتمدة داخل جدول Account"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="حذف دليل الحسابات الحالي ثم إعادة الزرع",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        reset = options.get("reset", False)

        if reset:
            self.stdout.write(self.style.WARNING("سيتم حذف دليل الحسابات الحالي بالكامل..."))
            safe_reset_accounts()

        self.stdout.write(self.style.NOTICE("بدء زرع شجرة الحسابات المعتمدة..."))

        created_count = 0
        updated_count = 0
        code_to_account: Dict[str, Account] = {}

        # ----------------------------------------------------
        # المرحلة الأولى: إنشاء/تحديث الحسابات بدون parent
        # ----------------------------------------------------
        for row in sort_rows_by_code_length(CHART_OF_ACCOUNTS):
            account, created = Account.objects.get_or_create(
                code=row.code,
                defaults={
                    "name": row.name_ar,
                    "account_type": row.account_type,
                    "nature": row.nature,
                    "is_group": row.is_group,
                    "is_active": row.is_active,
                    "description": build_description(row.name_en, row.description),
                },
            )

            if created:
                created_count += 1
            else:
                changed = False

                if account.name != row.name_ar:
                    account.name = row.name_ar
                    changed = True

                if account.account_type != row.account_type:
                    account.account_type = row.account_type
                    changed = True

                if account.nature != row.nature:
                    account.nature = row.nature
                    changed = True

                if account.is_group != row.is_group:
                    account.is_group = row.is_group
                    changed = True

                if account.is_active != row.is_active:
                    account.is_active = row.is_active
                    changed = True

                new_description = build_description(row.name_en, row.description)
                if account.description != new_description:
                    account.description = new_description
                    changed = True

                if changed:
                    account.save()
                    updated_count += 1

            code_to_account[row.code] = account

        # ----------------------------------------------------
        # المرحلة الثانية: ربط parent وتحديث level
        # ----------------------------------------------------
        for row in sort_rows_by_code_length(CHART_OF_ACCOUNTS):
            account = code_to_account[row.code]
            parent = code_to_account.get(row.parent_code) if row.parent_code else None

            changed = False

            if account.parent_id != (parent.id if parent else None):
                account.parent = parent
                changed = True

            expected_level = (parent.level + 1) if parent else 1
            if account.level != expected_level:
                account.level = expected_level
                changed = True

            if changed:
                account.save()
                updated_count += 1

        # ----------------------------------------------------
        # ملخص
        # ----------------------------------------------------
        total_accounts = Account.objects.count()

        self.stdout.write(self.style.SUCCESS("تم زرع شجرة الحسابات بنجاح."))
        self.stdout.write(f"إجمالي الحسابات الحالية: {total_accounts}")
        self.stdout.write(f"تم إنشاء: {created_count}")
        self.stdout.write(f"تم تحديث: {updated_count}")

        self.stdout.write("")
        self.stdout.write(self.style.NOTICE("الحسابات التشغيلية المعتمدة حاليًا داخل Primey Care:"))
        self.stdout.write("1103   -> المدينون")
        self.stdout.write("110101 -> النقدية في الخزينة")
        self.stdout.write("110201 -> حساب البنك الجاري")
        self.stdout.write("2105   -> ضريبة القيمة المضافة المستحقة")
        self.stdout.write("4101   -> إيرادات المبيعات/ الخدمات")
        self.stdout.write("5103   -> عمولات البيع")
        self.stdout.write("2102   -> مصروفات مستحقة")