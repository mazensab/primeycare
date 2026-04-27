# ============================================================
# 📂 whatsapp_center/template_builder.py
# Primey Care - WhatsApp Template Builder
# ============================================================
# ✅ يدعم:
# - {full_name}
# - {{full_name}}
# - بناء header / body / footer
# - fallback آمن عند غياب المفاتيح
# - دمج النص النهائي بشكل موحد
# ============================================================

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


# ============================================================
# 📦 Built Message
# ============================================================
@dataclass
class BuiltWhatsAppMessage:
    header_text: str = ""
    body_text: str = ""
    footer_text: str = ""

    @property
    def full_text(self) -> str:
        parts = [
            (self.header_text or "").strip(),
            (self.body_text or "").strip(),
            (self.footer_text or "").strip(),
        ]
        return "\n\n".join(part for part in parts if part).strip()


# ============================================================
# 🧩 Placeholder Pattern
# ============================================================
# يدعم:
# {full_name}
# {{full_name}}
_PLACEHOLDER_PATTERN = re.compile(
    r"\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}|\{([a-zA-Z_][a-zA-Z0-9_]*)\}"
)


# ============================================================
# 🧠 Helpers
# ============================================================
def _normalize_context(context: dict[str, Any] | None) -> dict[str, Any]:
    if not context:
        return {}

    normalized: dict[str, Any] = {}
    for key, value in context.items():
        normalized[str(key)] = value
    return normalized


def _stringify_value(value: Any) -> str:
    if value is None:
        return ""

    if isinstance(value, bool):
        return "نعم" if value else "لا"

    if isinstance(value, (list, tuple, set)):
        return ", ".join(str(item) for item in value if item is not None)

    return str(value)


def _safe_format(text: str, context: dict[str, Any] | None) -> str:
    """
    تنسيق آمن للنصوص.

    يدعم الصيغتين:
    - {key}
    - {{key}}

    وإذا كان المفتاح غير موجود يتركه كما هو بدون كسر الرسالة.
    """
    if not text:
        return ""

    safe_context = _normalize_context(context)
    if not safe_context:
        return text

    def replace_match(match: re.Match[str]) -> str:
        key = match.group(1) or match.group(2)

        if not key:
            return match.group(0)

        if key not in safe_context:
            return match.group(0)

        return _stringify_value(safe_context.get(key))

    try:
        return _PLACEHOLDER_PATTERN.sub(replace_match, text)
    except Exception:
        return text


def _clean_text(value: str) -> str:
    if not value:
        return ""
    return value.strip()


# ============================================================
# 🏗️ Core Builder
# ============================================================
def build_message_from_template(template, context: dict[str, Any] | None) -> BuiltWhatsAppMessage:
    """
    بناء الرسالة النهائية من القالب + context.
    """
    return BuiltWhatsAppMessage(
        header_text=_clean_text(_safe_format(getattr(template, "header_text", ""), context)),
        body_text=_clean_text(_safe_format(getattr(template, "body_text", ""), context)),
        footer_text=_clean_text(_safe_format(getattr(template, "footer_text", ""), context)),
    )


# ============================================================
# 🏗️ Direct Text Builder
# ============================================================
def build_message_from_text(
    *,
    body_text: str,
    context: dict[str, Any] | None = None,
    header_text: str = "",
    footer_text: str = "",
) -> BuiltWhatsAppMessage:
    """
    بناء رسالة مباشرة بدون الحاجة إلى Template model.
    """
    return BuiltWhatsAppMessage(
        header_text=_clean_text(_safe_format(header_text, context)),
        body_text=_clean_text(_safe_format(body_text, context)),
        footer_text=_clean_text(_safe_format(footer_text, context)),
    )


# ============================================================
# 🧾 Render Final Text
# ============================================================
def render_built_message_text(message: BuiltWhatsAppMessage) -> str:
    """
    إرجاع النص النهائي الكامل الجاهز للإرسال.
    """
    if not isinstance(message, BuiltWhatsAppMessage):
        return ""

    return message.full_text