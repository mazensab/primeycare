# ============================================================
# 📂 accounting/management/commands/seed_chart_of_accounts.py
# 🧠 Primey Care | Seed Saudi Chart of Accounts
# ------------------------------------------------------------
# ✅ يزرع شجرة الحسابات المعتمدة داخل جدول Account
# ✅ مبني على الملفين العربي والإنجليزي المعتمدين
# ✅ Idempotent:
#    - يعيد التحديث عند وجود الحساب
#    - لا يكرر السجلات
# ✅ يدعم:
#    - الزرع العادي
#    - reset آمن
#    - force-reset لبيئة التطوير فقط
# ------------------------------------------------------------
# ملاحظات مهمة:
# - لا يسمح بحذف دليل الحسابات إذا كانت هناك قيود محاسبية
#   إلا عند استخدام --force-reset.
# - يحافظ على سلامة الشجرة:
#   parent موجود
#   نوع الحساب مطابق للأب
#   لا توجد أكواد مكررة داخل التعريف
# ============================================================

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounting.models import Account, AccountNature, AccountType, JournalEntryLine


# ============================================================
# 🧾 DTO
# ============================================================

@dataclass(frozen=True, slots=True)
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
# 🧩 الحسابات التشغيلية المطلوبة للنظام
# ============================================================

REQUIRED_OPERATIONAL_CODES = {
    "1103": "المدينون",
    "110101": "النقدية في الخزينة",
    "110201": "حساب البنك الجاري",
    "2105": "ضريبة القيمة المضافة المستحقة",
    "4101": "إيرادات المبيعات/ الخدمات",
    "5103": "عمولات البيع",
    "2102": "مصروفات مستحقة",
}


# ============================================================
# 🛠️ Helpers
# ============================================================

def build_description(name_en: str, extra_description: str = "") -> str:
    name_en = str(name_en or "").strip()
    extra_description = str(extra_description or "").strip()

    if extra_description and name_en:
        return f"EN: {name_en}\n{extra_description}"

    if name_en:
        return f"EN: {name_en}"

    return extra_description


def sort_rows_by_code_length(rows: List[AccountSeedRow]) -> List[AccountSeedRow]:
    return sorted(rows, key=lambda item: (len(item.code), item.code))


def get_seed_code_map() -> Dict[str, AccountSeedRow]:
    return {row.code: row for row in CHART_OF_ACCOUNTS}


def validate_chart_definition() -> None:
    """
    التحقق من سلامة تعريف شجرة الحسابات قبل الزرع.
    """
    seen_codes: set[str] = set()
    duplicated_codes: list[str] = []

    for row in CHART_OF_ACCOUNTS:
        code = str(row.code or "").strip()

        if not code:
            raise CommandError("يوجد حساب بدون كود داخل CHART_OF_ACCOUNTS.")

        if code in seen_codes:
            duplicated_codes.append(code)

        seen_codes.add(code)

        if not row.name_ar:
            raise CommandError(f"الحساب {code} لا يحتوي على اسم عربي.")

        if not row.account_type:
            raise CommandError(f"الحساب {code} لا يحتوي على نوع حساب.")

        if not row.nature:
            raise CommandError(f"الحساب {code} لا يحتوي على طبيعة حساب.")

    if duplicated_codes:
        raise CommandError(
            "توجد أكواد مكررة داخل شجرة الحسابات: "
            + ", ".join(sorted(set(duplicated_codes)))
        )

    code_map = get_seed_code_map()

    for row in CHART_OF_ACCOUNTS:
        if not row.parent_code:
            continue

        parent = code_map.get(row.parent_code)

        if not parent:
            raise CommandError(
                f"الحساب {row.code} مرتبط بحساب أب غير موجود داخل الشجرة: {row.parent_code}"
            )

        if parent.is_group is False:
            raise CommandError(
                f"الحساب الأب {parent.code} للحساب {row.code} يجب أن يكون حسابًا تجميعيًا."
            )

        if parent.account_type != row.account_type:
            raise CommandError(
                f"نوع الحساب {row.code} لا يطابق نوع الحساب الأب {parent.code}."
            )

    for code in REQUIRED_OPERATIONAL_CODES:
        if code not in code_map:
            raise CommandError(
                f"الحساب التشغيلي المطلوب غير موجود داخل الشجرة: {code}"
            )


def has_accounting_postings() -> bool:
    """
    هل توجد أسطر قيود مرتبطة بدليل الحسابات؟
    """
    return JournalEntryLine.objects.exists()


def safe_reset_accounts(*, force: bool = False) -> None:
    """
    Reset آمن لدليل الحسابات:
    1) يمنع الحذف إذا توجد قيود محاسبية.
    2) عند force يفك parent ثم يحذف.
    """
    if has_accounting_postings() and not force:
        raise CommandError(
            "لا يمكن تنفيذ --reset لأن هناك قيودًا محاسبية مرتبطة بدليل الحسابات. "
            "إذا كنت في بيئة تطوير وتريد الحذف القسري استخدم: --reset --force-reset"
        )

    Account.objects.update(parent=None)
    Account.objects.all().delete()


def account_fields_from_seed(row: AccountSeedRow) -> dict:
    return {
        "name": row.name_ar,
        "account_type": row.account_type,
        "nature": row.nature,
        "is_group": row.is_group,
        "is_active": row.is_active,
        "description": build_description(row.name_en, row.description),
    }


def update_account_from_seed(account: Account, row: AccountSeedRow) -> bool:
    """
    يرجع True إذا تم تعديل الحساب.
    """
    changed = False
    fields = account_fields_from_seed(row)

    for field_name, new_value in fields.items():
        if getattr(account, field_name) != new_value:
            setattr(account, field_name, new_value)
            changed = True

    if changed:
        account.full_clean()
        account.save()

    return changed


def ensure_operational_accounts_exist() -> list[str]:
    missing_codes: list[str] = []

    for code in REQUIRED_OPERATIONAL_CODES:
        if not Account.objects.filter(code=code, is_active=True, is_group=False).exists():
            missing_codes.append(code)

    return missing_codes


# ============================================================
# 🚀 Command
# ============================================================

class Command(BaseCommand):
    help = "زرع شجرة الحسابات المعتمدة داخل جدول Account"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="حذف دليل الحسابات الحالي ثم إعادة الزرع. يمنع تلقائيًا إذا توجد قيود.",
        )
        parser.add_argument(
            "--force-reset",
            action="store_true",
            help="حذف قسري لدليل الحسابات حتى لو توجد قيود. يستخدم للتطوير فقط.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        reset = options.get("reset", False)
        force_reset = options.get("force_reset", False)

        validate_chart_definition()

        if force_reset and not reset:
            raise CommandError("لا يمكن استخدام --force-reset بدون --reset.")

        if reset:
            if force_reset:
                self.stdout.write(
                    self.style.WARNING(
                        "تحذير: سيتم حذف دليل الحسابات الحالي بالقوة. استخدم هذا الخيار للتطوير فقط."
                    )
                )
            else:
                self.stdout.write(
                    self.style.WARNING("سيتم حذف دليل الحسابات الحالي إذا لم توجد قيود محاسبية.")
                )

            safe_reset_accounts(force=force_reset)

        self.stdout.write(self.style.NOTICE("بدء زرع شجرة الحسابات المعتمدة..."))

        created_count = 0
        updated_count = 0
        parent_updated_count = 0
        code_to_account: Dict[str, Account] = {}

        # ----------------------------------------------------
        # المرحلة الأولى: إنشاء/تحديث الحسابات بدون parent
        # ----------------------------------------------------
        for row in sort_rows_by_code_length(CHART_OF_ACCOUNTS):
            defaults = account_fields_from_seed(row)

            account, created = Account.objects.get_or_create(
                code=row.code,
                defaults=defaults,
            )

            if created:
                account.full_clean()
                account.save()
                created_count += 1
            else:
                if update_account_from_seed(account, row):
                    updated_count += 1

            code_to_account[row.code] = account

        # ----------------------------------------------------
        # المرحلة الثانية: ربط parent وتحديث level
        # ----------------------------------------------------
        for row in sort_rows_by_code_length(CHART_OF_ACCOUNTS):
            account = code_to_account[row.code]
            parent = code_to_account.get(row.parent_code) if row.parent_code else None

            expected_parent_id = parent.pk if parent else None
            expected_level = (parent.level + 1) if parent else 1

            changed = False

            if account.parent_id != expected_parent_id:
                account.parent = parent
                changed = True

            if account.level != expected_level:
                account.level = expected_level
                changed = True

            if changed:
                account.full_clean()
                account.save()
                parent_updated_count += 1

        # ----------------------------------------------------
        # تحقق نهائي من الحسابات التشغيلية
        # ----------------------------------------------------
        missing_operational_codes = ensure_operational_accounts_exist()

        if missing_operational_codes:
            raise CommandError(
                "تم الزرع لكن توجد حسابات تشغيلية مفقودة أو غير قابلة للترحيل: "
                + ", ".join(missing_operational_codes)
            )

        # ----------------------------------------------------
        # ملخص
        # ----------------------------------------------------
        total_accounts = Account.objects.count()

        self.stdout.write(self.style.SUCCESS("تم زرع شجرة الحسابات بنجاح."))
        self.stdout.write(f"إجمالي الحسابات الحالية: {total_accounts}")
        self.stdout.write(f"تم إنشاء: {created_count}")
        self.stdout.write(f"تم تحديث البيانات: {updated_count}")
        self.stdout.write(f"تم تحديث الربط الشجري/المستويات: {parent_updated_count}")

        self.stdout.write("")
        self.stdout.write(self.style.NOTICE("الحسابات التشغيلية المعتمدة حاليًا داخل Primey Care:"))

        for code, label in REQUIRED_OPERATIONAL_CODES.items():
            self.stdout.write(f"{code:<6} -> {label}")