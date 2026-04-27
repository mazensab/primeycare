# ============================================================
# 📂 api/invoices/issue.py
# 🧠 Issue Invoice API — Primey Care
# ============================================================

from __future__ import annotations

import json
import logging
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from invoices.services import issue_invoice

logger = logging.getLogger(__name__)


def _json_error(message: str, status: int = 400) -> JsonResponse:
    return JsonResponse({"ok": False, "message": message}, status=status)


def _json_success(data: dict[str, Any], status: int = 200) -> JsonResponse:
    payload = {"ok": True}
    payload.update(data)
    return JsonResponse(payload, status=status)


def _resolve_invoice_model():
    for model_name in ["Invoice"]:
        try:
            return apps.get_model("invoices", model_name)
        except LookupError:
            continue
    raise LookupError("Invoice model was not found in invoices app.")


def _extract_company_id(request) -> int | None:
    raw_value = (
        request.GET.get("company_id")
        or request.headers.get("X-Company-Id")
        or request.session.get("active_company_id")
    )
    try:
        return int(raw_value) if raw_value else None
    except (TypeError, ValueError):
        return None


def _parse_json_body(request) -> dict[str, Any]:
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return {}


@login_required
@require_POST
def issue_invoice_api(request, invoice_id: int):
    try:
        Invoice = _resolve_invoice_model()
        company_id = _extract_company_id(request)
        body = _parse_json_body(request)

        queryset = Invoice.objects.all()
        model_fields = {field.name for field in Invoice._meta.fields}

        if company_id and "company" in model_fields:
            queryset = queryset.filter(company_id=company_id)

        invoice = queryset.filter(pk=invoice_id).first()
        if not invoice:
            return _json_error("الفاتورة غير موجودة.", status=404)

        auto_post_accounting = body.get("auto_post_accounting", True)

        result = issue_invoice(
            invoice=invoice,
            actor=request.user,
            auto_post_accounting=bool(auto_post_accounting),
        )

        return _json_success(
            {
                "message": "تم إصدار الفاتورة بنجاح.",
                "invoice": {
                    "id": result.invoice.pk,
                    "status_before": result.status_before,
                    "status_after": result.status_after,
                },
                "accounting": {
                    "requested": result.accounting_post_requested,
                    "dispatched": result.accounting_post_dispatched,
                    "message": result.accounting_post_message,
                },
            }
        )
    except Exception as exc:
        logger.exception("Failed to issue invoice %s: %s", invoice_id, exc)
        return _json_error("تعذر إصدار الفاتورة.", status=500)