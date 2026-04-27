# ============================================================
# 📂 service_items/services.py
# 🧠 Primey Care | Service Items Services
# ------------------------------------------------------------
# ✅ Parsing / Validation / Serialization
# ✅ Filtering / Pagination
# ✅ Create / Update Contract Service Item
# ============================================================

from __future__ import annotations

import json
from decimal import Decimal, InvalidOperation
from typing import Any

from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.db.models import Q, QuerySet

from contracts.models import Contract, ContractProduct
from service_items.models import (
    ContractServiceItem,
    CoverageType,
    ServiceItemStatus,
)


# ============================================================
# 🔹 JSON Helpers
# ============================================================

def parse_json_body(request) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        return json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValidationError(f"Invalid JSON body: {exc}")


# ============================================================
# 🔹 Primitive Helpers
# ============================================================

def normalize_text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def parse_bool(value: Any, default: bool | None = None) -> bool | None:
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return bool(value)

    value_str = str(value).strip().lower()

    if value_str in {"1", "true", "yes", "on"}:
        return True
    if value_str in {"0", "false", "no", "off"}:
        return False

    return default


def parse_int(value: Any, default: int | None = None) -> int | None:
    if value in (None, ""):
        return default

    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def parse_decimal(value: Any, default: Decimal | None = None) -> Decimal | None:
    if value in (None, ""):
        return default

    try:
        return Decimal(str(value).strip())
    except (InvalidOperation, AttributeError, TypeError, ValueError):
        raise ValidationError(f"Invalid decimal value: {value}")


# ============================================================
# 🔹 Pagination
# ============================================================

def paginate_queryset(queryset: QuerySet, page: int = 1, page_size: int = 20) -> dict[str, Any]:
    safe_page = max(page or 1, 1)
    safe_page_size = min(max(page_size or 20, 1), 100)

    paginator = Paginator(queryset, safe_page_size)
    current_page = paginator.get_page(safe_page)

    return {
        "items": list(current_page.object_list),
        "pagination": {
            "page": current_page.number,
            "page_size": safe_page_size,
            "total_pages": paginator.num_pages,
            "total_items": paginator.count,
            "has_next": current_page.has_next(),
            "has_previous": current_page.has_previous(),
        },
    }


# ============================================================
# 🔹 Filters
# ============================================================

def apply_service_item_filters(queryset: QuerySet[ContractServiceItem], params) -> QuerySet[ContractServiceItem]:
    q = normalize_text(params.get("q"))
    status = normalize_text(params.get("status"))
    coverage_type = normalize_text(params.get("coverage_type"))
    contract_id = parse_int(params.get("contract_id"))
    contract_product_id = parse_int(params.get("contract_product_id"))
    requires_approval = parse_bool(params.get("requires_approval"))
    is_featured = parse_bool(params.get("is_featured"))

    if q:
        queryset = queryset.filter(
            Q(name__icontains=q)
            | Q(code__icontains=q)
            | Q(short_description__icontains=q)
            | Q(description__icontains=q)
            | Q(execution_notes__icontains=q)
            | Q(coverage_notes__icontains=q)
            | Q(contract__title__icontains=q)
            | Q(contract__contract_number__icontains=q)
            | Q(contract__provider__name__icontains=q)
            | Q(contract_product__product__name__icontains=q)
            | Q(contract_product__product__code__icontains=q)
        )

    if status:
        queryset = queryset.filter(status=status)

    if coverage_type:
        queryset = queryset.filter(coverage_type=coverage_type)

    if contract_id:
        queryset = queryset.filter(contract_id=contract_id)

    if contract_product_id:
        queryset = queryset.filter(contract_product_id=contract_product_id)

    if requires_approval is not None:
        queryset = queryset.filter(requires_approval=requires_approval)

    if is_featured is not None:
        queryset = queryset.filter(is_featured=is_featured)

    return queryset


# ============================================================
# 🔹 Validation Helpers
# ============================================================

def _validate_status(value: str) -> str:
    allowed = {choice for choice, _ in ServiceItemStatus.choices}
    if value not in allowed:
        raise ValidationError(f"Invalid status. Allowed values: {sorted(allowed)}")
    return value


def _validate_coverage_type(value: str) -> str:
    allowed = {choice for choice, _ in CoverageType.choices}
    if value not in allowed:
        raise ValidationError(f"Invalid coverage_type. Allowed values: {sorted(allowed)}")
    return value


def _resolve_contract(contract_id: Any) -> Contract:
    if contract_id in (None, "", 0, "0"):
        raise ValidationError("Contract is required.")

    try:
        return Contract.objects.get(pk=int(contract_id))
    except (Contract.DoesNotExist, TypeError, ValueError):
        raise ValidationError("Selected contract does not exist.")


def _resolve_contract_product(contract_product_id: Any, *, contract: Contract | None = None) -> ContractProduct | None:
    if contract_product_id in (None, "", 0, "0"):
        return None

    try:
        item = ContractProduct.objects.select_related("contract", "product").get(pk=int(contract_product_id))
    except (ContractProduct.DoesNotExist, TypeError, ValueError):
        raise ValidationError("Selected contract product does not exist.")

    if contract and item.contract_id != contract.id:
        raise ValidationError("Selected contract product does not belong to the selected contract.")

    return item


def _validate_unique_service_code(code: str, *, contract_id: int, exclude_id: int | None = None) -> None:
    queryset = ContractServiceItem.objects.filter(contract_id=contract_id, code__iexact=code)

    if exclude_id:
        queryset = queryset.exclude(pk=exclude_id)

    if queryset.exists():
        raise ValidationError("A service item with this code already exists in the selected contract.")


# ============================================================
# 🔹 Serialization
# ============================================================

def serialize_service_item(obj: ContractServiceItem) -> dict[str, Any]:
    return {
        "id": obj.id,
        "contract_id": obj.contract_id,
        "contract": {
            "id": obj.contract.id,
            "title": obj.contract.title,
            "contract_number": obj.contract.contract_number,
            "status": obj.contract.status,
            "provider_id": obj.contract.provider_id,
            "provider_name": obj.contract.provider.name if obj.contract.provider_id else None,
        } if obj.contract_id else None,
        "contract_product_id": obj.contract_product_id,
        "contract_product": {
            "id": obj.contract_product.id,
            "product_id": obj.contract_product.product_id,
            "product_name": obj.contract_product.product.name if obj.contract_product.product_id else None,
            "product_code": obj.contract_product.product.code if obj.contract_product.product_id else None,
            "special_price": str(obj.contract_product.special_price) if obj.contract_product.special_price is not None else None,
            "discount_percentage": str(obj.contract_product.discount_percentage),
            "is_active": obj.contract_product.is_active,
        } if obj.contract_product_id else None,
        "name": obj.name,
        "code": obj.code,
        "status": obj.status,
        "coverage_type": obj.coverage_type,
        "short_description": obj.short_description,
        "description": obj.description,
        "execution_notes": obj.execution_notes,
        "coverage_notes": obj.coverage_notes,
        "base_price": str(obj.base_price) if obj.base_price is not None else None,
        "special_price": str(obj.special_price) if obj.special_price is not None else None,
        "discount_percentage": str(obj.discount_percentage),
        "requires_approval": obj.requires_approval,
        "max_usage_per_customer": obj.max_usage_per_customer,
        "validity_days": obj.validity_days,
        "is_featured": obj.is_featured,
        "sort_order": obj.sort_order,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }


# ============================================================
# 🔹 Create / Update
# ============================================================

def create_service_item(*, payload: dict[str, Any]) -> ContractServiceItem:
    contract = _resolve_contract(payload.get("contract_id"))
    contract_product = _resolve_contract_product(payload.get("contract_product_id"), contract=contract)

    name = normalize_text(payload.get("name"))
    code = normalize_text(payload.get("code")).upper()
    status = normalize_text(payload.get("status")) or ServiceItemStatus.ACTIVE
    coverage_type = normalize_text(payload.get("coverage_type")) or CoverageType.INCLUDED

    if not name:
        raise ValidationError("Service item name is required.")

    if not code:
        raise ValidationError("Service item code is required.")

    status = _validate_status(status)
    coverage_type = _validate_coverage_type(coverage_type)
    _validate_unique_service_code(code, contract_id=contract.id)

    item = ContractServiceItem(
        contract=contract,
        contract_product=contract_product,
        name=name,
        code=code,
        status=status,
        coverage_type=coverage_type,
        short_description=normalize_text(payload.get("short_description")),
        description=normalize_text(payload.get("description")),
        execution_notes=normalize_text(payload.get("execution_notes")),
        coverage_notes=normalize_text(payload.get("coverage_notes")),
        base_price=parse_decimal(payload.get("base_price")),
        special_price=parse_decimal(payload.get("special_price")),
        discount_percentage=parse_decimal(payload.get("discount_percentage"), Decimal("0")) or Decimal("0"),
        requires_approval=parse_bool(payload.get("requires_approval"), False) or False,
        max_usage_per_customer=parse_int(payload.get("max_usage_per_customer")),
        validity_days=parse_int(payload.get("validity_days")),
        is_featured=parse_bool(payload.get("is_featured"), False) or False,
        sort_order=parse_int(payload.get("sort_order"), 0) or 0,
    )

    item.full_clean()
    item.save()
    return item


def update_service_item(*, instance: ContractServiceItem, payload: dict[str, Any]) -> ContractServiceItem:
    if "contract_id" in payload:
        instance.contract = _resolve_contract(payload.get("contract_id"))

    if "contract_product_id" in payload:
        instance.contract_product = _resolve_contract_product(
            payload.get("contract_product_id"),
            contract=instance.contract,
        )

    if "name" in payload:
        instance.name = normalize_text(payload.get("name"))

    if "code" in payload:
        instance.code = normalize_text(payload.get("code")).upper()

    if "status" in payload:
        instance.status = normalize_text(payload.get("status"))

    if "coverage_type" in payload:
        instance.coverage_type = normalize_text(payload.get("coverage_type"))

    if "short_description" in payload:
        instance.short_description = normalize_text(payload.get("short_description"))

    if "description" in payload:
        instance.description = normalize_text(payload.get("description"))

    if "execution_notes" in payload:
        instance.execution_notes = normalize_text(payload.get("execution_notes"))

    if "coverage_notes" in payload:
        instance.coverage_notes = normalize_text(payload.get("coverage_notes"))

    if "base_price" in payload:
        instance.base_price = parse_decimal(payload.get("base_price"))

    if "special_price" in payload:
        instance.special_price = parse_decimal(payload.get("special_price"))

    if "discount_percentage" in payload:
        instance.discount_percentage = parse_decimal(payload.get("discount_percentage"), Decimal("0")) or Decimal("0")

    if "requires_approval" in payload:
        instance.requires_approval = parse_bool(payload.get("requires_approval"), instance.requires_approval)

    if "max_usage_per_customer" in payload:
        instance.max_usage_per_customer = parse_int(payload.get("max_usage_per_customer"))

    if "validity_days" in payload:
        instance.validity_days = parse_int(payload.get("validity_days"))

    if "is_featured" in payload:
        instance.is_featured = parse_bool(payload.get("is_featured"), instance.is_featured)

    if "sort_order" in payload:
        instance.sort_order = parse_int(payload.get("sort_order"), 0) or 0

    if not instance.name:
        raise ValidationError("Service item name is required.")

    if not instance.code:
        raise ValidationError("Service item code is required.")

    instance.status = _validate_status(instance.status)
    instance.coverage_type = _validate_coverage_type(instance.coverage_type)
    _validate_unique_service_code(instance.code, contract_id=instance.contract_id, exclude_id=instance.id)

    instance.full_clean()
    instance.save()
    return instance