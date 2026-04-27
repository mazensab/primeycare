# ============================================================
# 📂 whatsapp_center/utils.py
# 🧠 Primey Care - WhatsApp Utilities V1 Core
# ============================================================

from __future__ import annotations

import re
from typing import Optional


# ============================================================
# 🌍 Defaults
# ============================================================
DEFAULT_COUNTRY_CODE = "966"
PHONE_REGEX = re.compile(r"^\+[1-9]\d{7,14}$")


# ============================================================
# 🔧 Text Helpers
# ============================================================
def safe_text(value: Optional[object]) -> str:
    """
    إرجاع نص آمن دائمًا.
    """
    if value is None:
        return ""
    return str(value).strip()


def is_blank(value: Optional[object]) -> bool:
    """
    فحص هل القيمة فارغة بعد التنظيف.
    """
    return safe_text(value) == ""


# ============================================================
# 📱 Phone Helpers
# ============================================================
def _digits_only(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def _normalize_country_code(default_country_code: str = DEFAULT_COUNTRY_CODE) -> str:
    normalized = _digits_only(default_country_code)
    return normalized or DEFAULT_COUNTRY_CODE


def _looks_like_international_without_plus(digits: str) -> bool:
    """
    مثال:
    14155552671
    966555555555
    """
    return bool(digits) and len(digits) >= 8 and not digits.startswith("0")


def _normalize_saudi_local_number(digits: str, country_code: str) -> str:
    """
    دعم الأنماط السعودية الشائعة:
    - 05xxxxxxxx
    - 5xxxxxxxx
    - 9665xxxxxxxx
    """
    if country_code != "966":
        return ""

    if digits.startswith("05") and len(digits) == 10:
        return f"+966{digits[1:]}"

    if digits.startswith("5") and len(digits) == 9:
        return f"+966{digits}"

    if digits.startswith("966") and len(digits) == 12:
        return f"+{digits}"

    return ""


def _looks_like_valid_local_number(digits: str, country_code: str) -> bool:
    """
    قبل fallback المحلي، نتحقق أن الرقم المحلي فعلاً بطول منطقي.
    هذا يمنع قبول أرقام قصيرة مثل:
    055555
    """
    if not digits:
        return False

    if country_code == "966":
        # السعودية:
        # 05xxxxxxxx => 10 digits
        # 5xxxxxxxx  => 9 digits
        if digits.startswith("05"):
            return len(digits) == 10
        if digits.startswith("5"):
            return len(digits) == 9
        return False

    # لبقية الدول: fallback محافظ
    local_digits = digits.lstrip("0")
    return len(local_digits) >= 8


def normalize_phone_number(
    phone: str,
    default_country_code: str = DEFAULT_COUNTRY_CODE,
) -> str:
    """
    تنظيف وتوحيد رقم الجوال بصيغة دولية.

    يدعم:
    - +9665XXXXXXXX
    - 009665XXXXXXXX
    - 9665XXXXXXXX
    - 05XXXXXXXX
    - 5XXXXXXXX

    المخرجات النهائية دائمًا بصيغة:
    +<country_code><number>
    """
    raw = safe_text(phone)
    if not raw:
        return ""

    country_code = _normalize_country_code(default_country_code=default_country_code)

    # --------------------------------------------------------
    # 1) تنظيف أولي مع الإبقاء على +
    # --------------------------------------------------------
    cleaned = re.sub(r"[^\d+]", "", raw)
    if not cleaned:
        return ""

    # --------------------------------------------------------
    # 2) تحويل 00XXXXXXXX إلى +XXXXXXXX
    # --------------------------------------------------------
    if cleaned.startswith("00"):
        cleaned = f"+{cleaned[2:]}"

    # --------------------------------------------------------
    # 3) لو يبدأ بـ +
    # --------------------------------------------------------
    if cleaned.startswith("+"):
        digits = _digits_only(cleaned)
        if not digits:
            return ""

        normalized = f"+{digits}"
        return normalized if PHONE_REGEX.match(normalized) else ""

    digits = _digits_only(cleaned)
    if not digits:
        return ""

    # --------------------------------------------------------
    # 4) الأنماط السعودية المحلية
    # --------------------------------------------------------
    saudi_normalized = _normalize_saudi_local_number(digits, country_code)
    if saudi_normalized and PHONE_REGEX.match(saudi_normalized):
        return saudi_normalized

    # --------------------------------------------------------
    # 5) رقم دولي بدون +
    # --------------------------------------------------------
    if _looks_like_international_without_plus(digits):
        normalized = f"+{digits}"
        if PHONE_REGEX.match(normalized):
            return normalized

    # --------------------------------------------------------
    # 6) fallback محلي محافظ
    # --------------------------------------------------------
    if _looks_like_valid_local_number(digits, country_code):
        local_digits = digits.lstrip("0")
        if local_digits:
            normalized = f"+{country_code}{local_digits}"
            if PHONE_REGEX.match(normalized):
                return normalized

    return ""


def is_valid_phone_number(
    phone: str,
    default_country_code: str = DEFAULT_COUNTRY_CODE,
) -> bool:
    """
    تحقق من صيغة الرقم بعد التطبيع.
    """
    normalized = normalize_phone_number(
        phone,
        default_country_code=default_country_code,
    )
    return bool(PHONE_REGEX.match(normalized))


def are_same_phone_number(
    first_phone: str,
    second_phone: str,
    default_country_code: str = DEFAULT_COUNTRY_CODE,
) -> bool:
    """
    مقارنة رقمين بعد التطبيع.
    """
    first_normalized = normalize_phone_number(
        first_phone,
        default_country_code=default_country_code,
    )
    second_normalized = normalize_phone_number(
        second_phone,
        default_country_code=default_country_code,
    )

    if not first_normalized or not second_normalized:
        return False

    return first_normalized == second_normalized