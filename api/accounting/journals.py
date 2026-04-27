# ============================================================
# 📂 api/accounting/journals.py
# 🧠 Journal Entries List API — Primey Care V1.2
# ------------------------------------------------------------
# ✅ قائمة القيود اليومية
# ✅ يدعم:
#    - date_from
#    - date_to
#    - posting_source
#    - status
#    - reference
#    - external_reference
#    - page
#    - page_size
#    - ordering
# ✅ Excel Export:
#    - Journals Excel
# ✅ يرجع:
#    - قائمة القيود
#    - الإجماليات
#    - حالة التوازن
#    - بيانات التصفح pagination
# ------------------------------------------------------------

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from io import BytesIO
from typing import Any

from django.core.paginator import EmptyPage, Paginator
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

from accounting.models import JournalEntry


logger = logging.getLogger(__name__)


# ============================================================
# 🔧 Helpers
# ============================================================

DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 200

ALLOWED_ORDERING = {
    "entry_date": "entry_date",
    "-entry_date": "-entry_date",
    "id": "id",
    "-id": "-id",
    "entry_number": "entry_number",
    "-entry_number": "-entry_number",
    "created_at": "created_at",
    "-created_at": "-created_at",
    "posted_at": "posted_at",
    "-posted_at": "-posted_at",
    "total_debit": "total_debit",
    "-total_debit": "-total_debit",
    "total_credit": "total_credit",
    "-total_credit": "-total_credit",
}


def _money(value: Decimal | int | float | str | None) -> Decimal:
    amount = Decimal(str(value or "0.00"))
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _decimal_to_string(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)

    if isinstance(value, dict):
        return {key: _decimal_to_string(val) for key, val in value.items()}

    if isinstance(value, list):
        return [_decimal_to_string(item) for item in value]

    if isinstance(value, tuple):
        return tuple(_decimal_to_string(item) for item in value)

    return value


def _parse_date(value: str | None, field_name: str) -> date | None:
    if not value:
        return None

    raw_value = str(value).strip()
    try:
        return date.fromisoformat(raw_value)
    except ValueError as exc:
        raise ValueError(
            f"قيمة {field_name} غير صحيحة. استخدم الصيغة YYYY-MM-DD."
        ) from exc


def _parse_positive_int(
    value: str | None,
    field_name: str,
    *,
    default: int,
    min_value: int = 1,
    max_value: int | None = None,
) -> int:
    if value in {None, ""}:
        parsed = default
    else:
        raw_value = str(value).strip()
        try:
            parsed = int(raw_value)
        except ValueError as exc:
            raise ValueError(f"قيمة {field_name} يجب أن تكون رقمًا صحيحًا.") from exc

    if parsed < min_value:
        raise ValueError(f"قيمة {field_name} يجب أن تكون أكبر أو تساوي {min_value}.")

    if max_value is not None and parsed > max_value:
        raise ValueError(f"قيمة {field_name} يجب ألا تتجاوز {max_value}.")

    return parsed


def _parse_ordering(value: str | None, default: str = "-entry_date") -> str:
    raw_value = (value or "").strip() or default
    if raw_value not in ALLOWED_ORDERING:
        allowed = ", ".join(ALLOWED_ORDERING.keys())
        raise ValueError(f"قيمة ordering غير مدعومة. القيم المسموحة: {allowed}")
    return ALLOWED_ORDERING[raw_value]


def _validate_date_range(date_from: date | None, date_to: date | None) -> None:
    if date_from and date_to and date_from > date_to:
        raise ValueError("لا يمكن أن يكون date_from أكبر من date_to.")


def _error_response(message: str, status: int = 400, extra: dict | None = None) -> JsonResponse:
    payload = {
        "ok": False,
        "message": message,
    }
    if extra:
        payload.update(extra)

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _success_response(data: dict[str, Any]) -> JsonResponse:
    return JsonResponse(
        {
            "ok": True,
            "data": _decimal_to_string(data),
        },
        status=200,
        json_dumps_params={"ensure_ascii": False},
    )


def _safe_attr(obj: Any, attr_name: str, default: Any = None) -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _safe_sheet_title(title: str) -> str:
    invalid_chars = ['\\', '/', '*', '[', ']', ':', '?']
    clean = title
    for char in invalid_chars:
        clean = clean.replace(char, "-")
    return clean[:31]


def _auto_fit_columns(ws) -> None:
    for column_cells in ws.columns:
        first_real_cell = None
        max_length = 0

        for cell in column_cells:
            if hasattr(cell, "column_letter"):
                first_real_cell = cell
                break

        if first_real_cell is None:
            continue

        column_letter = first_real_cell.column_letter

        for cell in column_cells:
            try:
                cell_length = len(str(cell.value or ""))
                if cell_length > max_length:
                    max_length = cell_length
            except Exception:
                continue

        ws.column_dimensions[column_letter].width = min(max(max_length + 2, 12), 40)


def _apply_header_style(cell) -> None:
    cell.font = Font(bold=True)
    cell.fill = PatternFill(fill_type="solid", fgColor="D9EAF7")
    cell.alignment = Alignment(horizontal="center", vertical="center")


def _add_meta_rows(ws, title: str, meta_rows: list[tuple[str, Any]]) -> int:
    ws.append([title])
    ws["A1"].font = Font(bold=True, size=14)
    ws["A1"].alignment = Alignment(horizontal="center")
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=6)

    current_row = 3
    for label, value in meta_rows:
        ws.cell(row=current_row, column=1, value=label)
        ws.cell(row=current_row, column=2, value=str(value) if value is not None else "")
        ws.cell(row=current_row, column=1).font = Font(bold=True)
        current_row += 1

    return current_row + 1


def _build_excel_response(workbook: Workbook, filename: str) -> HttpResponse:
    output = BytesIO()
    workbook.save(output)
    output.seek(0)

    response = HttpResponse(
        output.read(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def _serialize_journal_entry(entry: JournalEntry) -> dict[str, Any]:
    total_debit = _money(_safe_attr(entry, "total_debit", "0.00"))
    total_credit = _money(_safe_attr(entry, "total_credit", "0.00"))

    return {
        "id": entry.id,
        "entry_number": _safe_attr(entry, "entry_number", None),
        "entry_date": (
            _safe_attr(entry, "entry_date", None).isoformat()
            if _safe_attr(entry, "entry_date", None)
            else None
        ),
        "status": _safe_attr(entry, "status", None),
        "posting_source": _safe_attr(entry, "posting_source", None),
        "reference": _safe_attr(entry, "reference", None),
        "external_reference": _safe_attr(entry, "external_reference", None),
        "description": _safe_attr(entry, "description", None),
        "notes": _safe_attr(entry, "notes", None),
        "currency": _safe_attr(entry, "currency", "SAR"),
        "total_debit": total_debit,
        "total_credit": total_credit,
        "is_balanced": total_debit == total_credit,
        "posted_at": (
            _safe_attr(entry, "posted_at", None).isoformat()
            if _safe_attr(entry, "posted_at", None)
            else None
        ),
        "created_at": (
            _safe_attr(entry, "created_at", None).isoformat()
            if _safe_attr(entry, "created_at", None)
            else None
        ),
        "updated_at": (
            _safe_attr(entry, "updated_at", None).isoformat()
            if _safe_attr(entry, "updated_at", None)
            else None
        ),
    }


def _build_journals_queryset(request):
    date_from = _parse_date(request.GET.get("date_from"), "date_from")
    date_to = _parse_date(request.GET.get("date_to"), "date_to")
    _validate_date_range(date_from, date_to)

    posting_source = (request.GET.get("posting_source") or "").strip()
    status = (request.GET.get("status") or "").strip()
    reference = (request.GET.get("reference") or "").strip()
    external_reference = (request.GET.get("external_reference") or "").strip()

    qs = JournalEntry.objects.all()

    if date_from:
        qs = qs.filter(entry_date__gte=date_from)

    if date_to:
        qs = qs.filter(entry_date__lte=date_to)

    if posting_source:
        qs = qs.filter(posting_source=posting_source)

    if status:
        qs = qs.filter(status=status)

    if reference:
        qs = qs.filter(reference__icontains=reference)

    if external_reference:
        qs = qs.filter(external_reference__icontains=external_reference)

    return {
        "qs": qs,
        "date_from": date_from,
        "date_to": date_to,
        "posting_source": posting_source,
        "status": status,
        "reference": reference,
        "external_reference": external_reference,
    }


def _build_journals_excel(entries: list[JournalEntry], filters: dict[str, Any], summary: dict[str, Any]) -> HttpResponse:
    workbook = Workbook()
    ws = workbook.active
    ws.title = _safe_sheet_title("Journals")

    start_row = _add_meta_rows(
        ws,
        "Journal Entries",
        [
            ("Date From", filters.get("date_from")),
            ("Date To", filters.get("date_to")),
            ("Posting Source", filters.get("posting_source")),
            ("Status", filters.get("status")),
            ("Reference", filters.get("reference")),
            ("External Reference", filters.get("external_reference")),
            ("Total Entries", summary.get("total_entries")),
            ("Total Debit", summary.get("total_debit")),
            ("Total Credit", summary.get("total_credit")),
            ("Balanced Entries", summary.get("balanced_entries_count")),
            ("Unbalanced Entries", summary.get("unbalanced_entries_count")),
        ],
    )

    headers = [
        "ID",
        "Entry Number",
        "Entry Date",
        "Status",
        "Posting Source",
        "Reference",
        "External Reference",
        "Description",
        "Notes",
        "Currency",
        "Total Debit",
        "Total Credit",
        "Is Balanced",
        "Posted At",
        "Created At",
        "Updated At",
    ]

    for col_index, header in enumerate(headers, start=1):
        cell = ws.cell(row=start_row, column=col_index, value=header)
        _apply_header_style(cell)

    current_row = start_row + 1
    for entry in entries:
        row = _serialize_journal_entry(entry)
        ws.cell(row=current_row, column=1, value=row.get("id"))
        ws.cell(row=current_row, column=2, value=row.get("entry_number"))
        ws.cell(row=current_row, column=3, value=row.get("entry_date"))
        ws.cell(row=current_row, column=4, value=row.get("status"))
        ws.cell(row=current_row, column=5, value=row.get("posting_source"))
        ws.cell(row=current_row, column=6, value=row.get("reference"))
        ws.cell(row=current_row, column=7, value=row.get("external_reference"))
        ws.cell(row=current_row, column=8, value=row.get("description"))
        ws.cell(row=current_row, column=9, value=row.get("notes"))
        ws.cell(row=current_row, column=10, value=row.get("currency"))
        ws.cell(row=current_row, column=11, value=float(row.get("total_debit", 0) or 0))
        ws.cell(row=current_row, column=12, value=float(row.get("total_credit", 0) or 0))
        ws.cell(row=current_row, column=13, value=str(row.get("is_balanced")))
        ws.cell(row=current_row, column=14, value=row.get("posted_at"))
        ws.cell(row=current_row, column=15, value=row.get("created_at"))
        ws.cell(row=current_row, column=16, value=row.get("updated_at"))
        current_row += 1

    _auto_fit_columns(ws)
    return _build_excel_response(workbook, "journals.xlsx")


# ============================================================
# 📘 Journal Entries List API
# ============================================================

@require_GET
def accounting_journal_entries_api(request):
    """
    قائمة القيود اليومية.
    """
    try:
        query_data = _build_journals_queryset(request)
        qs = query_data["qs"]

        page = _parse_positive_int(
            request.GET.get("page"),
            "page",
            default=DEFAULT_PAGE,
            min_value=1,
        )
        page_size = _parse_positive_int(
            request.GET.get("page_size"),
            "page_size",
            default=DEFAULT_PAGE_SIZE,
            min_value=1,
            max_value=MAX_PAGE_SIZE,
        )
        ordering = _parse_ordering(request.GET.get("ordering"), default="-entry_date")

        qs = qs.order_by(ordering, "-id" if ordering != "-id" else "entry_date")
        entries_all = list(qs)

        total_entries = len(entries_all)
        total_debit = _money(
            sum((_money(_safe_attr(item, "total_debit", "0.00")) for item in entries_all), Decimal("0.00"))
        )
        total_credit = _money(
            sum((_money(_safe_attr(item, "total_credit", "0.00")) for item in entries_all), Decimal("0.00"))
        )
        balanced_entries_count = sum(
            1
            for item in entries_all
            if _money(_safe_attr(item, "total_debit", "0.00"))
            == _money(_safe_attr(item, "total_credit", "0.00"))
        )

        paginator = Paginator(entries_all, page_size)
        try:
            page_obj = paginator.page(page)
        except EmptyPage:
            raise ValueError("رقم الصفحة المطلوب خارج النطاق.")

        payload = {
            "filters": {
                "date_from": query_data["date_from"].isoformat() if query_data["date_from"] else None,
                "date_to": query_data["date_to"].isoformat() if query_data["date_to"] else None,
                "posting_source": query_data["posting_source"] or None,
                "status": query_data["status"] or None,
                "reference": query_data["reference"] or None,
                "external_reference": query_data["external_reference"] or None,
                "ordering": ordering,
            },
            "summary": {
                "total_entries": total_entries,
                "total_debit": total_debit,
                "total_credit": total_credit,
                "balanced_entries_count": balanced_entries_count,
                "unbalanced_entries_count": total_entries - balanced_entries_count,
                "is_balanced_total": total_debit == total_credit,
            },
            "pagination": {
                "page": page_obj.number,
                "page_size": page_size,
                "total_pages": paginator.num_pages,
                "total_items": paginator.count,
                "has_next": page_obj.has_next(),
                "has_previous": page_obj.has_previous(),
                "next_page": page_obj.next_page_number() if page_obj.has_next() else None,
                "previous_page": page_obj.previous_page_number() if page_obj.has_previous() else None,
            },
            "results": [_serialize_journal_entry(entry) for entry in page_obj.object_list],
        }

        return _success_response(payload)

    except ValueError as exc:
        return _error_response(str(exc), status=400)

    except Exception as exc:
        logger.exception("Failed to load journal entries list: %s", exc)
        return _error_response(
            "تعذر تحميل قائمة القيود اليومية.",
            status=500,
        )


@require_GET
def accounting_journal_entries_excel_api(request):
    """
    تصدير القيود اليومية إلى Excel.
    """
    try:
        query_data = _build_journals_queryset(request)
        ordering = _parse_ordering(request.GET.get("ordering"), default="-entry_date")

        qs = query_data["qs"].order_by(ordering, "-id" if ordering != "-id" else "entry_date")
        entries_all = list(qs)

        total_entries = len(entries_all)
        total_debit = _money(
            sum((_money(_safe_attr(item, "total_debit", "0.00")) for item in entries_all), Decimal("0.00"))
        )
        total_credit = _money(
            sum((_money(_safe_attr(item, "total_credit", "0.00")) for item in entries_all), Decimal("0.00"))
        )
        balanced_entries_count = sum(
            1
            for item in entries_all
            if _money(_safe_attr(item, "total_debit", "0.00"))
            == _money(_safe_attr(item, "total_credit", "0.00"))
        )

        filters = {
            "date_from": query_data["date_from"].isoformat() if query_data["date_from"] else None,
            "date_to": query_data["date_to"].isoformat() if query_data["date_to"] else None,
            "posting_source": query_data["posting_source"] or None,
            "status": query_data["status"] or None,
            "reference": query_data["reference"] or None,
            "external_reference": query_data["external_reference"] or None,
            "ordering": ordering,
        }
        summary = {
            "total_entries": total_entries,
            "total_debit": total_debit,
            "total_credit": total_credit,
            "balanced_entries_count": balanced_entries_count,
            "unbalanced_entries_count": total_entries - balanced_entries_count,
            "is_balanced_total": total_debit == total_credit,
        }

        return _build_journals_excel(entries_all, filters, summary)

    except ValueError as exc:
        return _error_response(str(exc), status=400)

    except Exception as exc:
        logger.exception("Failed to export journal entries excel: %s", exc)
        return _error_response(
            "تعذر تصدير القيود اليومية إلى Excel.",
            status=500,
        )