# ============================================================
# 📂 accounting/management/commands/seed_chart_of_accounts.py
# 🧠 Primey Care | Seed Saudi Chart of Accounts V3.2
# ------------------------------------------------------------
# ✅ يزرع شجرة الحسابات المعتمدة داخل جدول Account
# ✅ يحدّث الاسم العربي والإنجليزي والحقول التشغيلية
# ✅ يجهز ضريبة القيمة المضافة الافتراضية
# ✅ يجهز إعدادات المحاسبة العامة
# ✅ يجهز قواعد التوجيه المحاسبي الأساسية
# ✅ يدعم الدورة المالية الجديدة:
#    - عهدة COD للمندوب
#    - عهدة COD للوسيط
#    - مستحقات المندوب
#    - مستحقات الوسيط
#    - عمولة البيع
#    - قيمة التوصيل
#    - حصة النظام
#    - تسويات الخزينة
# ✅ Idempotent:
#    - يعيد التحديث عند وجود الحساب
#    - لا يكرر السجلات
# ============================================================

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Dict, List, Optional

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounting.models import (
    Account,
    AccountNature,
    AccountType,
    AccountingAccountPurpose,
    AccountingRoutingRule,
    AccountingRoutingSource,
    AccountingSettings,
    JournalEntryLine,
    TaxDirection,
    TaxRate,
    TaxType,
)


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
    allow_manual_posting: bool = True
    is_system: bool = False
    description: str = ""
    purpose: str = AccountingAccountPurpose.OTHER


@dataclass(frozen=True, slots=True)
class RoutingSeedRow:
    source: str
    purpose: str
    account_code: str
    description: str = ""


# ============================================================
# 🧠 الشجرة المعتمدة Primey Care Finance Core
# ============================================================

CHART_OF_ACCOUNTS: List[AccountSeedRow] = [
    # ========================================================
    # 1 الأصول
    # ========================================================
    AccountSeedRow("1", "الأصول", "Assets", AccountType.ASSET, AccountNature.DEBIT, None, True, is_system=True),
    AccountSeedRow("11", "الأصول المتداولة", "Current Assets", AccountType.ASSET, AccountNature.DEBIT, "1", True, is_system=True),

    AccountSeedRow("1101", "النقد وما في حكمه", "Cash and Cash Equivalents", AccountType.ASSET, AccountNature.DEBIT, "11", True, is_system=True),
    AccountSeedRow("110101", "النقدية في الخزينة", "Cash on Hand", AccountType.ASSET, AccountNature.DEBIT, "1101", False, is_system=True, description="حساب الصناديق النقدية الرئيسي", purpose=AccountingAccountPurpose.CASH),
    AccountSeedRow("110102", "العهد النقدية", "Petty Cash", AccountType.ASSET, AccountNature.DEBIT, "1101", False, is_system=True),
    AccountSeedRow("110103", "محافظ إلكترونية", "Digital Wallets", AccountType.ASSET, AccountNature.DEBIT, "1101", False, is_system=True),

    AccountSeedRow("1102", "النقدية في البنوك", "Cash at Banks", AccountType.ASSET, AccountNature.DEBIT, "11", True, is_system=True),
    AccountSeedRow("110201", "حساب البنك الجاري", "Current Bank Account", AccountType.ASSET, AccountNature.DEBIT, "1102", False, is_system=True, purpose=AccountingAccountPurpose.BANK),
    AccountSeedRow("110202", "حساب بنكي آخر", "Other Bank Account", AccountType.ASSET, AccountNature.DEBIT, "1102", False),

    AccountSeedRow("1103", "الذمم المدينة - العملاء", "Accounts Receivable - Customers", AccountType.ASSET, AccountNature.DEBIT, "11", False, is_system=True, purpose=AccountingAccountPurpose.ACCOUNTS_RECEIVABLE),

    AccountSeedRow("1104", "تسويات بوابات الدفع", "Payment Gateway Clearing", AccountType.ASSET, AccountNature.DEBIT, "11", True, is_system=True),
    AccountSeedRow("110401", "تسوية ميسر", "Moyasar Clearing", AccountType.ASSET, AccountNature.DEBIT, "1104", False, is_system=True),
    AccountSeedRow("110402", "تسوية تاب", "Tap Clearing", AccountType.ASSET, AccountNature.DEBIT, "1104", False, is_system=True),
    AccountSeedRow("110403", "تسوية تمارا", "Tamara Clearing", AccountType.ASSET, AccountNature.DEBIT, "1104", False, is_system=True),
    AccountSeedRow("110404", "تسوية تابي", "Tabby Clearing", AccountType.ASSET, AccountNature.DEBIT, "1104", False, is_system=True),

    AccountSeedRow("1105", "مصروفات مقدمة", "Prepaid Expenses", AccountType.ASSET, AccountNature.DEBIT, "11", True),
    AccountSeedRow("110501", "تأمين طبي مقدم", "Prepaid Medical Insurance", AccountType.ASSET, AccountNature.DEBIT, "1105", False),
    AccountSeedRow("110502", "إيجار مقدم", "Prepaid Rent", AccountType.ASSET, AccountNature.DEBIT, "1105", False),
    AccountSeedRow("110503", "اشتراكات مقدمة", "Prepaid Subscriptions", AccountType.ASSET, AccountNature.DEBIT, "1105", False),

    AccountSeedRow("1106", "مدفوعات مقدمة للموظفين", "Employee Advances", AccountType.ASSET, AccountNature.DEBIT, "11", False),
    AccountSeedRow("1107", "مدفوعات مقدمة للمزودين", "Provider Advances", AccountType.ASSET, AccountNature.DEBIT, "11", False),
    AccountSeedRow("1108", "المخزون", "Inventory", AccountType.ASSET, AccountNature.DEBIT, "11", False),

    AccountSeedRow("1109", "العهد التشغيلية", "Operational Custodies", AccountType.ASSET, AccountNature.DEBIT, "11", True, is_system=True),
    AccountSeedRow("110901", "عهدة المندوبين", "Agent Custody", AccountType.ASSET, AccountNature.DEBIT, "1109", False, is_system=True, description="مبالغ COD المحصلة بواسطة المندوبين ولم تورد بعد", purpose=AccountingAccountPurpose.AGENT_CUSTODY),
    AccountSeedRow("110902", "عهدة الوسطاء", "Broker Custody", AccountType.ASSET, AccountNature.DEBIT, "1109", False, is_system=True, description="مبالغ COD أو عهد تشغيلية على الوسطاء ولم تورد بعد", purpose=AccountingAccountPurpose.BROKER_CUSTODY),

    AccountSeedRow("12", "الأصول غير المتداولة", "Non-current Assets", AccountType.ASSET, AccountNature.DEBIT, "1", True),
    AccountSeedRow("1201", "العقارات والآلات والمعدات", "Property, Plant and Equipment", AccountType.ASSET, AccountNature.DEBIT, "12", True),
    AccountSeedRow("120101", "الأراضي", "Land", AccountType.ASSET, AccountNature.DEBIT, "1201", False),
    AccountSeedRow("120102", "المباني", "Buildings", AccountType.ASSET, AccountNature.DEBIT, "1201", False),
    AccountSeedRow("120103", "المعدات", "Equipment", AccountType.ASSET, AccountNature.DEBIT, "1201", False),
    AccountSeedRow("120104", "أجهزة مكتبية وطابعات", "Office Equipment and Printers", AccountType.ASSET, AccountNature.DEBIT, "1201", False),
    AccountSeedRow("120105", "أجهزة حاسب وبرمجيات", "Computers and Software", AccountType.ASSET, AccountNature.DEBIT, "1201", False),
    AccountSeedRow("1202", "الأصول غير الملموسة", "Intangible Assets", AccountType.ASSET, AccountNature.DEBIT, "12", False),

    # ========================================================
    # 2 الالتزامات
    # ========================================================
    AccountSeedRow("2", "الالتزامات", "Liabilities", AccountType.LIABILITY, AccountNature.CREDIT, None, True, is_system=True),
    AccountSeedRow("21", "الالتزامات المتداولة", "Current Liabilities", AccountType.LIABILITY, AccountNature.CREDIT, "2", True, is_system=True),

    AccountSeedRow("2101", "الذمم الدائنة - الموردون", "Accounts Payable - Suppliers", AccountType.LIABILITY, AccountNature.CREDIT, "21", False, purpose=AccountingAccountPurpose.ACCOUNTS_PAYABLE),
    AccountSeedRow("2102", "مصروفات مستحقة", "Accrued Expenses", AccountType.LIABILITY, AccountNature.CREDIT, "21", False, is_system=True),
    AccountSeedRow("2103", "رواتب مستحقة", "Accrued Salaries", AccountType.LIABILITY, AccountNature.CREDIT, "21", False),
    AccountSeedRow("2104", "قروض قصيرة الأجل", "Short-term Loans", AccountType.LIABILITY, AccountNature.CREDIT, "21", False),

    AccountSeedRow("2105", "ضريبة القيمة المضافة المستحقة", "VAT Payable", AccountType.LIABILITY, AccountNature.CREDIT, "21", False, is_system=True, purpose=AccountingAccountPurpose.VAT_PAYABLE),
    AccountSeedRow("210501", "ضريبة مخرجات", "Output VAT", AccountType.LIABILITY, AccountNature.CREDIT, "21", False, is_system=True, purpose=AccountingAccountPurpose.OUTPUT_VAT),
    AccountSeedRow("210502", "ضريبة مدخلات", "Input VAT", AccountType.LIABILITY, AccountNature.CREDIT, "21", False, is_system=True, purpose=AccountingAccountPurpose.INPUT_VAT),

    AccountSeedRow("2106", "ضرائب ورسوم مستحقة", "Taxes and Fees Payable", AccountType.LIABILITY, AccountNature.CREDIT, "21", False),
    AccountSeedRow("2107", "إيرادات غير مكتسبة", "Unearned Revenue", AccountType.LIABILITY, AccountNature.CREDIT, "21", False, is_system=True),
    AccountSeedRow("2108", "مستحقات التأمينات الاجتماعية", "GOSI Payable", AccountType.LIABILITY, AccountNature.CREDIT, "21", False),

    AccountSeedRow("2110", "مستحقات المندوبين", "Agent Payables", AccountType.LIABILITY, AccountNature.CREDIT, "21", False, is_system=True, description="مستحقات عمولات وقيم توصيل المندوبين", purpose=AccountingAccountPurpose.AGENT_COMMISSION_PAYABLE),
    AccountSeedRow("2111", "مستحقات مزودي الخدمة", "Provider Payables", AccountType.LIABILITY, AccountNature.CREDIT, "21", False, is_system=True, purpose=AccountingAccountPurpose.PROVIDER_PAYABLE),
    AccountSeedRow("2112", "مستحقات بوابات الدفع", "Gateway Payables", AccountType.LIABILITY, AccountNature.CREDIT, "21", False, is_system=True),
    AccountSeedRow("2113", "مستحقات الوسطاء", "Broker Payables", AccountType.LIABILITY, AccountNature.CREDIT, "21", False, is_system=True, description="مستحقات الوسطاء والوكلاء", purpose=AccountingAccountPurpose.BROKER_COMMISSION_PAYABLE),

    AccountSeedRow("2120", "مجمع الإهلاك", "Accumulated Depreciation", AccountType.LIABILITY, AccountNature.CREDIT, "21", True),
    AccountSeedRow("212001", "مجمع إهلاك المباني", "Accumulated Depreciation - Buildings", AccountType.LIABILITY, AccountNature.CREDIT, "2120", False),
    AccountSeedRow("212002", "مجمع إهلاك المعدات", "Accumulated Depreciation - Equipment", AccountType.LIABILITY, AccountNature.CREDIT, "2120", False),
    AccountSeedRow("212003", "مجمع إهلاك أجهزة مكتبية وطابعات", "Accumulated Depreciation - Office Equipment", AccountType.LIABILITY, AccountNature.CREDIT, "2120", False),

    AccountSeedRow("22", "الالتزامات غير المتداولة", "Non-current Liabilities", AccountType.LIABILITY, AccountNature.CREDIT, "2", True),
    AccountSeedRow("2201", "قروض طويلة الأجل", "Long-term Loans", AccountType.LIABILITY, AccountNature.CREDIT, "22", False),
    AccountSeedRow("2202", "مخصص مكافأة نهاية الخدمة", "End of Service Benefit Provision", AccountType.LIABILITY, AccountNature.CREDIT, "22", False),

    # ========================================================
    # 3 حقوق الملكية
    # ========================================================
    AccountSeedRow("3", "حقوق الملكية", "Equity", AccountType.EQUITY, AccountNature.CREDIT, None, True, is_system=True),
    AccountSeedRow("31", "رأس المال", "Capital", AccountType.EQUITY, AccountNature.CREDIT, "3", True),
    AccountSeedRow("3101", "رأس المال المسجل", "Registered Capital", AccountType.EQUITY, AccountNature.CREDIT, "31", False),
    AccountSeedRow("3102", "رأس المال الإضافي المدفوع", "Additional Paid-in Capital", AccountType.EQUITY, AccountNature.CREDIT, "31", False),

    AccountSeedRow("32", "حقوق ملكية أخرى", "Other Equity", AccountType.EQUITY, AccountNature.CREDIT, "3", True),
    AccountSeedRow("3201", "أرصدة افتتاحية", "Opening Balances Equity", AccountType.EQUITY, AccountNature.CREDIT, "32", False, is_system=True, purpose=AccountingAccountPurpose.OPENING_EQUITY),

    AccountSeedRow("33", "احتياطيات", "Reserves", AccountType.EQUITY, AccountNature.CREDIT, "3", True),
    AccountSeedRow("3301", "احتياطي نظامي", "Statutory Reserve", AccountType.EQUITY, AccountNature.CREDIT, "33", False),

    AccountSeedRow("34", "الأرباح المبقاة", "Retained Earnings", AccountType.EQUITY, AccountNature.CREDIT, "3", True, is_system=True),
    AccountSeedRow("3401", "أرباح وخسائر العام الحالي", "Current Year Profit and Loss", AccountType.EQUITY, AccountNature.CREDIT, "34", False, is_system=True),
    AccountSeedRow("3402", "الأرباح المبقاة أو الخسائر المرحلة", "Retained Earnings or Accumulated Losses", AccountType.EQUITY, AccountNature.CREDIT, "34", False, is_system=True),

    # ========================================================
    # 4 الإيرادات
    # ========================================================
    AccountSeedRow("4", "الإيرادات", "Revenue", AccountType.REVENUE, AccountNature.CREDIT, None, True, is_system=True),
    AccountSeedRow("41", "الإيرادات التشغيلية", "Operating Revenue", AccountType.REVENUE, AccountNature.CREDIT, "4", True, is_system=True),
    AccountSeedRow("4101", "إيرادات المبيعات والخدمات", "Sales and Service Revenue", AccountType.REVENUE, AccountNature.CREDIT, "41", False, is_system=True, purpose=AccountingAccountPurpose.SALES_REVENUE),
    AccountSeedRow("410101", "إيرادات البطاقات", "Cards Revenue", AccountType.REVENUE, AccountNature.CREDIT, "41", False, is_system=True, purpose=AccountingAccountPurpose.SALES_REVENUE),
    AccountSeedRow("410102", "إيرادات البرامج", "Programs Revenue", AccountType.REVENUE, AccountNature.CREDIT, "41", False, is_system=True, purpose=AccountingAccountPurpose.SALES_REVENUE),
    AccountSeedRow("410103", "إيرادات الخدمات", "Services Revenue", AccountType.REVENUE, AccountNature.CREDIT, "41", False, is_system=True, purpose=AccountingAccountPurpose.SALES_REVENUE),
    AccountSeedRow("410104", "إيرادات الاشتراكات", "Subscriptions Revenue", AccountType.REVENUE, AccountNature.CREDIT, "41", False, is_system=True, purpose=AccountingAccountPurpose.SALES_REVENUE),
    AccountSeedRow("4102", "إيراد حصة النظام", "Platform Share Revenue", AccountType.REVENUE, AccountNature.CREDIT, "41", False, is_system=True, description="حصة Primey Care أو النظام من الطلبات والمنتجات", purpose=AccountingAccountPurpose.PLATFORM_SHARE_REVENUE),

    AccountSeedRow("42", "إيرادات غير تشغيلية", "Non-operating Revenue", AccountType.REVENUE, AccountNature.CREDIT, "4", True),
    AccountSeedRow("4201", "إيرادات أخرى", "Other Revenue", AccountType.REVENUE, AccountNature.CREDIT, "42", False, purpose=AccountingAccountPurpose.OTHER_REVENUE),
    AccountSeedRow("4202", "فروقات تقريب دائنة", "Rounding Gains", AccountType.REVENUE, AccountNature.CREDIT, "42", False, purpose=AccountingAccountPurpose.ROUNDING),

    # ========================================================
    # 5 المصاريف
    # ========================================================
    AccountSeedRow("5", "المصاريف", "Expenses", AccountType.EXPENSE, AccountNature.DEBIT, None, True, is_system=True),
    AccountSeedRow("51", "التكاليف المباشرة", "Direct Costs", AccountType.EXPENSE, AccountNature.DEBIT, "5", True, is_system=True),
    AccountSeedRow("5101", "تكلفة الخدمات المقدمة", "Cost of Services", AccountType.EXPENSE, AccountNature.DEBIT, "51", False, is_system=True, purpose=AccountingAccountPurpose.COST_OF_SALES),
    AccountSeedRow("5102", "تكلفة مزودي الخدمة", "Provider Service Cost", AccountType.EXPENSE, AccountNature.DEBIT, "51", False, is_system=True, purpose=AccountingAccountPurpose.PROVIDER_CONTRACT_COMMISSION_EXPENSE),
    AccountSeedRow("5103", "عمولات البيع", "Sales Commissions", AccountType.EXPENSE, AccountNature.DEBIT, "51", False, is_system=True, purpose=AccountingAccountPurpose.AGENT_COMMISSION_EXPENSE),
    AccountSeedRow("5104", "تكلفة التوصيل", "Delivery Cost", AccountType.EXPENSE, AccountNature.DEBIT, "51", False, is_system=True, purpose=AccountingAccountPurpose.AGENT_DELIVERY_EXPENSE),
    AccountSeedRow("5105", "عمولات الوسطاء", "Broker Commissions", AccountType.EXPENSE, AccountNature.DEBIT, "51", False, is_system=True, purpose=AccountingAccountPurpose.BROKER_COMMISSION_EXPENSE),

    AccountSeedRow("52", "المصاريف التشغيلية", "Operating Expenses", AccountType.EXPENSE, AccountNature.DEBIT, "5", True),
    AccountSeedRow("5201", "الرواتب والرسوم الإدارية", "Administrative Salaries and Fees", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5202", "تأمين طبي", "Medical Insurance", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5203", "مصروفات تسويقية ودعائية", "Marketing and Advertising Expenses", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5204", "مصروفات الإيجار", "Rent Expense", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5205", "عمولات وحوافز", "Commissions and Incentives", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5206", "تذاكر سفر", "Travel Tickets", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5207", "التأمينات الاجتماعية", "Social Insurance", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5208", "الرسوم الحكومية", "Government Fees", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5209", "رسوم واشتراكات", "Fees and Subscriptions", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5210", "مصروفات خدمات المكتب", "Office Service Expenses", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5211", "مصروفات مكتبية ومطبوعات", "Office Supplies and Printing", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5212", "مصروفات ضيافة", "Hospitality Expenses", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),
    AccountSeedRow("5213", "رسوم بنكية", "Bank Charges", AccountType.EXPENSE, AccountNature.DEBIT, "52", False, is_system=True),
    AccountSeedRow("5214", "رسوم بوابات الدفع", "Payment Gateway Fees", AccountType.EXPENSE, AccountNature.DEBIT, "52", False, is_system=True, purpose=AccountingAccountPurpose.GATEWAY_FEES),
    AccountSeedRow("5215", "مصروفات أخرى", "Other Expenses", AccountType.EXPENSE, AccountNature.DEBIT, "52", False, purpose=AccountingAccountPurpose.EXPENSE),
    AccountSeedRow("5216", "فروقات تقريب مدينة", "Rounding Losses", AccountType.EXPENSE, AccountNature.DEBIT, "52", False, purpose=AccountingAccountPurpose.ROUNDING),
    AccountSeedRow("5217", "مصروفات الإهلاك", "Depreciation Expense", AccountType.EXPENSE, AccountNature.DEBIT, "52", True),
    AccountSeedRow("521701", "مصروف إهلاك المباني", "Depreciation Expense - Buildings", AccountType.EXPENSE, AccountNature.DEBIT, "5217", False),
    AccountSeedRow("521702", "مصروف إهلاك المعدات", "Depreciation Expense - Equipment", AccountType.EXPENSE, AccountNature.DEBIT, "5217", False),
    AccountSeedRow("521703", "مصروف إهلاك أجهزة مكتبية وطابعات", "Depreciation Expense - Office Equipment", AccountType.EXPENSE, AccountNature.DEBIT, "5217", False),
    AccountSeedRow("5219", "مصروف نقل ومواصلات", "Transportation Expense", AccountType.EXPENSE, AccountNature.DEBIT, "52", False),

    AccountSeedRow("53", "مصاريف غير تشغيلية", "Non-operating Expenses", AccountType.EXPENSE, AccountNature.DEBIT, "5", True),
    AccountSeedRow("5301", "الزكاة", "Zakat", AccountType.EXPENSE, AccountNature.DEBIT, "53", False),
    AccountSeedRow("5302", "الضرائب", "Taxes", AccountType.EXPENSE, AccountNature.DEBIT, "53", False),
    AccountSeedRow("5303", "فروقات عملة", "Foreign Currency Differences", AccountType.EXPENSE, AccountNature.DEBIT, "53", False),
    AccountSeedRow("5304", "فوائد", "Interest Expense", AccountType.EXPENSE, AccountNature.DEBIT, "53", False),
]


# ============================================================
# 🧩 الحسابات التشغيلية المطلوبة للنظام
# ============================================================

REQUIRED_OPERATIONAL_CODES = {
    "1103": "الذمم المدينة - العملاء",
    "110101": "النقدية في الخزينة",
    "110201": "حساب البنك الجاري",
    "110401": "تسوية ميسر",
    "110402": "تسوية تاب",
    "110403": "تسوية تمارا",
    "110404": "تسوية تابي",
    "110901": "عهدة المندوبين",
    "110902": "عهدة الوسطاء",
    "2105": "ضريبة القيمة المضافة المستحقة",
    "210501": "ضريبة مخرجات",
    "210502": "ضريبة مدخلات",
    "2110": "مستحقات المندوبين",
    "2111": "مستحقات مزودي الخدمة",
    "2113": "مستحقات الوسطاء",
    "4101": "إيرادات المبيعات والخدمات",
    "410101": "إيرادات البطاقات",
    "410102": "إيرادات البرامج",
    "410103": "إيرادات الخدمات",
    "410104": "إيرادات الاشتراكات",
    "4102": "إيراد حصة النظام",
    "4201": "إيرادات أخرى",
    "5101": "تكلفة الخدمات المقدمة",
    "5102": "تكلفة مزودي الخدمة",
    "5103": "عمولات البيع",
    "5104": "تكلفة التوصيل",
    "5105": "عمولات الوسطاء",
    "5213": "رسوم بنكية",
    "5214": "رسوم بوابات الدفع",
    "3201": "أرصدة افتتاحية",
}


# ============================================================
# 🧭 قواعد التوجيه المحاسبي الافتراضية
# ============================================================

DEFAULT_ROUTING_RULES: List[RoutingSeedRow] = [
    RoutingSeedRow(AccountingRoutingSource.SALES_INVOICE, AccountingAccountPurpose.ACCOUNTS_RECEIVABLE, "1103", "إثبات ذمم العميل عند إصدار الفاتورة"),
    RoutingSeedRow(AccountingRoutingSource.SALES_INVOICE, AccountingAccountPurpose.SALES_REVENUE, "4101", "إثبات إيرادات المبيعات والخدمات"),
    RoutingSeedRow(AccountingRoutingSource.SALES_INVOICE, AccountingAccountPurpose.OUTPUT_VAT, "210501", "إثبات ضريبة المخرجات"),

    RoutingSeedRow(AccountingRoutingSource.PAYMENT_RECEIPT, AccountingAccountPurpose.CASH, "110101", "تحصيل نقدي"),
    RoutingSeedRow(AccountingRoutingSource.PAYMENT_RECEIPT, AccountingAccountPurpose.BANK, "110201", "تحصيل بنكي"),
    RoutingSeedRow(AccountingRoutingSource.PAYMENT_RECEIPT, AccountingAccountPurpose.ACCOUNTS_RECEIVABLE, "1103", "تسوية ذمم العميل عند التحصيل"),
    RoutingSeedRow(AccountingRoutingSource.PAYMENT_RECEIPT, AccountingAccountPurpose.GATEWAY_FEES, "5214", "رسوم بوابات الدفع"),

    RoutingSeedRow(AccountingRoutingSource.AGENT_COMMISSION, AccountingAccountPurpose.AGENT_COMMISSION_EXPENSE, "5103", "مصروف عمولة مندوب"),
    RoutingSeedRow(AccountingRoutingSource.AGENT_COMMISSION, AccountingAccountPurpose.AGENT_COMMISSION_PAYABLE, "2110", "استحقاق عمولة مندوب"),

    RoutingSeedRow(AccountingRoutingSource.AGENT_EARNING, AccountingAccountPurpose.AGENT_COMMISSION_EXPENSE, "5103", "مصروف استحقاق مندوب"),
    RoutingSeedRow(AccountingRoutingSource.AGENT_EARNING, AccountingAccountPurpose.AGENT_COMMISSION_PAYABLE, "2110", "مستحقات مندوب"),

    RoutingSeedRow(AccountingRoutingSource.AGENT_DELIVERY_FEE, AccountingAccountPurpose.AGENT_DELIVERY_EXPENSE, "5104", "مصروف قيمة توصيل مندوب"),
    RoutingSeedRow(AccountingRoutingSource.AGENT_DELIVERY_FEE, AccountingAccountPurpose.AGENT_COMMISSION_PAYABLE, "2110", "مستحقات قيمة توصيل مندوب"),

    RoutingSeedRow(AccountingRoutingSource.AGENT_COD_CUSTODY, AccountingAccountPurpose.AGENT_CUSTODY, "110901", "إثبات عهدة COD على المندوب"),
    RoutingSeedRow(AccountingRoutingSource.AGENT_COD_CUSTODY, AccountingAccountPurpose.ACCOUNTS_RECEIVABLE, "1103", "تخفيض ذمم العميل مقابل تحصيل COD"),

    RoutingSeedRow(AccountingRoutingSource.AGENT_SETTLEMENT, AccountingAccountPurpose.AGENT_CUSTODY, "110901", "تسوية عهدة مندوب"),
    RoutingSeedRow(AccountingRoutingSource.AGENT_SETTLEMENT, AccountingAccountPurpose.AGENT_COMMISSION_PAYABLE, "2110", "تسوية مستحقات مندوب"),

    RoutingSeedRow(AccountingRoutingSource.BROKER_COMMISSION, AccountingAccountPurpose.BROKER_COMMISSION_EXPENSE, "5105", "مصروف عمولة وسيط"),
    RoutingSeedRow(AccountingRoutingSource.BROKER_COMMISSION, AccountingAccountPurpose.BROKER_COMMISSION_PAYABLE, "2113", "استحقاق عمولة وسيط"),

    RoutingSeedRow(AccountingRoutingSource.BROKER_EARNING, AccountingAccountPurpose.BROKER_COMMISSION_EXPENSE, "5105", "مصروف استحقاق وسيط"),
    RoutingSeedRow(AccountingRoutingSource.BROKER_EARNING, AccountingAccountPurpose.BROKER_COMMISSION_PAYABLE, "2113", "مستحقات وسيط"),

    RoutingSeedRow(AccountingRoutingSource.BROKER_COD_CUSTODY, AccountingAccountPurpose.BROKER_CUSTODY, "110902", "إثبات عهدة COD على الوسيط"),
    RoutingSeedRow(AccountingRoutingSource.BROKER_COD_CUSTODY, AccountingAccountPurpose.ACCOUNTS_RECEIVABLE, "1103", "تخفيض ذمم العميل مقابل تحصيل COD بواسطة وسيط"),

    RoutingSeedRow(AccountingRoutingSource.BROKER_SETTLEMENT, AccountingAccountPurpose.BROKER_CUSTODY, "110902", "تسوية عهدة وسيط"),
    RoutingSeedRow(AccountingRoutingSource.BROKER_SETTLEMENT, AccountingAccountPurpose.BROKER_COMMISSION_PAYABLE, "2113", "تسوية مستحقات وسيط"),

    RoutingSeedRow(AccountingRoutingSource.PLATFORM_SHARE, AccountingAccountPurpose.PLATFORM_SHARE_REVENUE, "4102", "إثبات حصة النظام"),

    RoutingSeedRow(AccountingRoutingSource.TREASURY_EXPENSE, AccountingAccountPurpose.EXPENSE, "5215", "مصروف خزينة افتراضي"),
    RoutingSeedRow(AccountingRoutingSource.TREASURY_INCOME, AccountingAccountPurpose.OTHER_REVENUE, "4201", "إيراد آخر افتراضي"),
    RoutingSeedRow(AccountingRoutingSource.TREASURY_MANUAL_RECEIPT, AccountingAccountPurpose.CASH, "110101", "سند قبض يدوي"),
    RoutingSeedRow(AccountingRoutingSource.TREASURY_MANUAL_PAYMENT, AccountingAccountPurpose.EXPENSE, "5215", "سند صرف يدوي"),

    RoutingSeedRow(AccountingRoutingSource.OPENING_BALANCE, AccountingAccountPurpose.OPENING_EQUITY, "3201", "أرصدة افتتاحية"),
]


# ============================================================
# 🛠️ Helpers
# ============================================================

def build_description(extra_description: str = "") -> str:
    return str(extra_description or "").strip()


def sort_rows_by_code_length(rows: List[AccountSeedRow]) -> List[AccountSeedRow]:
    return sorted(rows, key=lambda item: (len(item.code), item.code))


def get_seed_code_map() -> Dict[str, AccountSeedRow]:
    return {row.code: row for row in CHART_OF_ACCOUNTS}


def validate_chart_definition() -> None:
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

        if not row.name_en:
            raise CommandError(f"الحساب {code} لا يحتوي على اسم إنجليزي.")

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

    for rule in DEFAULT_ROUTING_RULES:
        if rule.account_code not in code_map:
            raise CommandError(
                f"قاعدة التوجيه تشير إلى حساب غير موجود داخل الشجرة: {rule.account_code}"
            )


def has_accounting_postings() -> bool:
    return JournalEntryLine.objects.exists()


def safe_reset_accounts(*, force: bool = False) -> None:
    if has_accounting_postings() and not force:
        raise CommandError(
            "لا يمكن تنفيذ --reset لأن هناك قيودًا محاسبية مرتبطة بدليل الحسابات. "
            "إذا كنت في بيئة تطوير وتريد الحذف القسري استخدم: --reset --force-reset"
        )

    AccountingRoutingRule.objects.all().delete()
    AccountingSettings.objects.update(default_tax_rate=None)
    TaxRate.objects.all().delete()

    Account.objects.update(parent=None)
    Account.objects.all().delete()


def account_fields_from_seed(row: AccountSeedRow) -> dict:
    return {
        "name": row.name_ar,
        "name_en": row.name_en,
        "account_type": row.account_type,
        "nature": row.nature,
        "purpose": row.purpose,
        "is_group": row.is_group,
        "is_active": row.is_active,
        "allow_manual_posting": bool(row.allow_manual_posting and not row.is_group),
        "is_system": row.is_system,
        "currency": "SAR",
        "description": build_description(row.description),
    }


def update_account_from_seed(account: Account, row: AccountSeedRow) -> bool:
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


def get_account(code: str) -> Account:
    try:
        account = Account.objects.get(code=code)
    except Account.DoesNotExist as exc:
        raise CommandError(f"الحساب المطلوب غير موجود: {code}") from exc

    if not account.is_active or account.is_group:
        raise CommandError(f"الحساب غير قابل للتوجيه أو الترحيل: {code} - {account.name}")

    return account


def seed_default_tax_rate() -> TaxRate:
    output_vat_account = get_account("210501")
    input_vat_account = get_account("210502")

    tax_rate, _ = TaxRate.objects.update_or_create(
        code="VAT15",
        defaults={
            "name": "ضريبة القيمة المضافة 15%",
            "tax_type": TaxType.VAT,
            "direction": TaxDirection.OUTPUT,
            "rate": Decimal("15.0000"),
            "sales_account": output_vat_account,
            "purchase_account": input_vat_account,
            "is_active": True,
            "is_default": True,
            "description": "ضريبة القيمة المضافة الافتراضية في المملكة العربية السعودية",
        },
    )

    return tax_rate


def seed_accounting_settings(default_tax_rate: TaxRate) -> AccountingSettings:
    settings_obj = AccountingSettings.get_solo()
    settings_obj.default_currency = "SAR"
    settings_obj.default_tax_rate = default_tax_rate
    settings_obj.auto_post_invoices = True
    settings_obj.auto_post_payments = True
    settings_obj.auto_post_treasury = False
    settings_obj.auto_post_cod_custody = True
    settings_obj.auto_post_agent_earnings = True
    settings_obj.auto_post_broker_earnings = True
    settings_obj.auto_post_agent_settlements = True
    settings_obj.auto_post_broker_settlements = True
    settings_obj.require_period_for_posting = False
    settings_obj.allow_posting_without_cost_center = True
    settings_obj.save()
    return settings_obj


def seed_default_routing_rules(default_tax_rate: TaxRate) -> tuple[int, int]:
    created_count = 0
    updated_count = 0

    for row in DEFAULT_ROUTING_RULES:
        account = get_account(row.account_code)

        rule, created = AccountingRoutingRule.objects.update_or_create(
            source=row.source,
            purpose=row.purpose,
            account=account,
            tax_rate=default_tax_rate if row.purpose in {
                AccountingAccountPurpose.OUTPUT_VAT,
                AccountingAccountPurpose.INPUT_VAT,
                AccountingAccountPurpose.VAT_PAYABLE,
            } else None,
            cost_center=None,
            defaults={
                "is_active": True,
                "priority": 100,
                "description": row.description,
                "metadata": {"seeded_by": "seed_chart_of_accounts"},
            },
        )

        if created:
            created_count += 1
        else:
            updated_count += 1
            rule.full_clean()
            rule.save()

    return created_count, updated_count


# ============================================================
# 🚀 Command
# ============================================================

class Command(BaseCommand):
    help = "زرع شجرة الحسابات المعتمدة داخل جدول Account وتجهيز إعدادات Finance Core"

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
        parser.add_argument(
            "--skip-routing",
            action="store_true",
            help="زرع الحسابات فقط بدون الضريبة والإعدادات وقواعد التوجيه.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        reset = options.get("reset", False)
        force_reset = options.get("force_reset", False)
        skip_routing = options.get("skip_routing", False)

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

        missing_operational_codes = ensure_operational_accounts_exist()

        if missing_operational_codes:
            raise CommandError(
                "تم الزرع لكن توجد حسابات تشغيلية مفقودة أو غير قابلة للترحيل: "
                + ", ".join(missing_operational_codes)
            )

        tax_created_label = "تم التجاوز"
        settings_label = "تم التجاوز"
        routing_created_count = 0
        routing_updated_count = 0

        if not skip_routing:
            default_tax_rate = seed_default_tax_rate()
            seed_accounting_settings(default_tax_rate)
            routing_created_count, routing_updated_count = seed_default_routing_rules(default_tax_rate)
            tax_created_label = f"{default_tax_rate.code} - {default_tax_rate.name}"
            settings_label = "تم تجهيز إعدادات المحاسبة العامة"

        total_accounts = Account.objects.count()

        self.stdout.write(self.style.SUCCESS("تم زرع شجرة الحسابات بنجاح."))
        self.stdout.write(f"إجمالي الحسابات الحالية: {total_accounts}")
        self.stdout.write(f"تم إنشاء الحسابات: {created_count}")
        self.stdout.write(f"تم تحديث بيانات الحسابات: {updated_count}")
        self.stdout.write(f"تم تحديث الربط الشجري/المستويات: {parent_updated_count}")
        self.stdout.write(f"الضريبة الافتراضية: {tax_created_label}")
        self.stdout.write(f"الإعدادات العامة: {settings_label}")
        self.stdout.write(f"قواعد التوجيه المنشأة: {routing_created_count}")
        self.stdout.write(f"قواعد التوجيه المحدثة: {routing_updated_count}")

        self.stdout.write("")
        self.stdout.write(self.style.NOTICE("الحسابات التشغيلية المعتمدة داخل Primey Care:"))

        for code, label in REQUIRED_OPERATIONAL_CODES.items():
            self.stdout.write(f"{code:<8} -> {label}")