# ============================================================
# 📂 contracts/services.py
# 🧠 Primey Care | Contracts Services
# ------------------------------------------------------------
# ✅ Parsing / Validation / Serialization
# ✅ Filtering / Pagination
# ✅ Create / Update Contract
# ✅ Nested Contract Products Sync
# ============================================================

from __future__ import annotations

import json
from decimal import Decimal, InvalidOperation
from typing import Any

from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Q, QuerySet

from contracts.models import Contract, ContractProduct, ContractStatus, PricingModel
from products.models import Product
from providers.models import Provider


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
# 🔹 Query Helpers
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


def apply_contract_filters(queryset: QuerySet[Contract], params) -> QuerySet[Contract]:
    q = normalize_text(params.get("q"))
    status = normalize_text(params.get("status"))
    pricing_model = normalize_text(params.get("pricing_model"))
    provider_id = parse_int(params.get("provider_id"))
    product_id = parse_int(params.get("product_id"))

    if q:
        queryset = queryset.filter(
            Q(title__icontains=q)
            | Q(contract_number__icontains=q)
            | Q(provider__name__icontains=q)
            | Q(provider_contact_name__icontains=q)
            | Q(provider_contact_phone__icontains=q)
            | Q(provider_contact_email__icontains=q)
            | Q(notes__icontains=q)
            | Q(terms_and_conditions__icontains=q)
        )

    if status:
        queryset = queryset.filter(status=status)

    if pricing_model:
        queryset = queryset.filter(pricing_model=pricing_model)

    if provider_id:
        queryset = queryset.filter(provider_id=provider_id)

    if product_id:
        queryset = queryset.filter(contract_products__product_id=product_id)

    return queryset.distinct()


# ============================================================
# 🔹 Validation Helpers
# ============================================================

def _validate_status(value: str) -> str:
    allowed = {choice for choice, _ in ContractStatus.choices}
    if value not in allowed:
        raise ValidationError(f"Invalid status. Allowed values: {sorted(allowed)}")
    return value


def _validate_pricing_model(value: str) -> str:
    allowed = {choice for choice, _ in PricingModel.choices}
    if value not in allowed:
        raise ValidationError(f"Invalid pricing_model. Allowed values: {sorted(allowed)}")
    return value


def _resolve_provider(provider_id: Any) -> Provider:
    if provider_id in (None, "", 0, "0"):
        raise ValidationError("Provider is required.")

    try:
        return Provider.objects.get(pk=int(provider_id))
    except (Provider.DoesNotExist, TypeError, ValueError):
        raise ValidationError("Selected provider does not exist.")


def _resolve_product(product_id: Any) -> Product:
    if product_id in (None, "", 0, "0"):
        raise ValidationError("Product is required.")

    try:
        return Product.objects.get(pk=int(product_id))
    except (Product.DoesNotExist, TypeError, ValueError):
        raise ValidationError("Selected product does not exist.")


def _validate_unique_contract_number(contract_number: str, *, exclude_id: int | None = None) -> None:
    queryset = Contract.objects.filter(contract_number__iexact=contract_number)
    if exclude_id:
        queryset = queryset.exclude(pk=exclude_id)

    if queryset.exists():
        raise ValidationError("A contract with this contract number already exists.")


# ============================================================
# 🔹 Serialization
# ============================================================

def serialize_contract_product(obj: ContractProduct) -> dict[str, Any]:
    return {
        "id": obj.id,
        "contract_id": obj.contract_id,
        "product_id": obj.product_id,
        "product": {
            "id": obj.product.id,
            "name": obj.product.name,
            "code": obj.product.code,
            "slug": obj.product.slug,
            "product_type": obj.product.product_type,
            "status": obj.product.status,
            "price": str(obj.product.price),
            "sale_price": str(obj.product.sale_price) if obj.product.sale_price is not None else None,
            "effective_price": str(obj.product.effective_price),
        } if obj.product_id else None,
        "is_active": obj.is_active,
        "special_price": str(obj.special_price) if obj.special_price is not None else None,
        "discount_percentage": str(obj.discount_percentage),
        "coverage_notes": obj.coverage_notes,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }


def serialize_contract(obj: Contract, include_products: bool = True) -> dict[str, Any]:
    data = {
        "id": obj.id,
        "provider_id": obj.provider_id,
        "provider": {
            "id": obj.provider.id,
            "name": obj.provider.name,
            "code": obj.provider.code,
            "provider_type": obj.provider.provider_type,
            "status": obj.provider.status,
        } if obj.provider_id else None,
        "title": obj.title,
        "contract_number": obj.contract_number,
        "status": obj.status,
        "start_date": obj.start_date.isoformat() if obj.start_date else None,
        "end_date": obj.end_date.isoformat() if obj.end_date else None,
        "signed_at": obj.signed_at.isoformat() if obj.signed_at else None,
        "provider_contact_name": obj.provider_contact_name,
        "provider_contact_phone": obj.provider_contact_phone,
        "provider_contact_email": obj.provider_contact_email,
        "pricing_model": obj.pricing_model,
        "discount_percentage": str(obj.discount_percentage),
        "notes": obj.notes,
        "terms_and_conditions": obj.terms_and_conditions,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }

    if include_products:
        data["contract_products"] = [
            serialize_contract_product(item)
            for item in obj.contract_products.all().order_by("-created_at", "-id")
        ]

    return data


# ============================================================
# 🔹 Create / Update Contract
# ============================================================

def create_contract(*, payload: dict[str, Any]) -> Contract:
    provider = _resolve_provider(payload.get("provider_id"))
    title = normalize_text(payload.get("title"))
    contract_number = normalize_text(payload.get("contract_number"))
    status = normalize_text(payload.get("status")) or ContractStatus.DRAFT
    pricing_model = normalize_text(payload.get("pricing_model")) or PricingModel.CUSTOM
    discount_percentage = parse_decimal(payload.get("discount_percentage"), Decimal("0")) or Decimal("0")

    if not title:
        raise ValidationError("Contract title is required.")

    if not contract_number:
        raise ValidationError("Contract number is required.")

    status = _validate_status(status)
    pricing_model = _validate_pricing_model(pricing_model)
    _validate_unique_contract_number(contract_number)

    contract = Contract(
        provider=provider,
        title=title,
        contract_number=contract_number,
        status=status,
        start_date=payload.get("start_date") or None,
        end_date=payload.get("end_date") or None,
        signed_at=payload.get("signed_at") or None,
        provider_contact_name=normalize_text(payload.get("provider_contact_name")),
        provider_contact_phone=normalize_text(payload.get("provider_contact_phone")),
        provider_contact_email=normalize_text(payload.get("provider_contact_email")),
        pricing_model=pricing_model,
        discount_percentage=discount_percentage,
        notes=normalize_text(payload.get("notes")),
        terms_and_conditions=normalize_text(payload.get("terms_and_conditions")),
    )

    with transaction.atomic():
        contract.full_clean()
        contract.save()

        if "contract_products" in payload:
            sync_contract_products(
                contract=contract,
                items=payload.get("contract_products") or [],
            )

    return contract


def update_contract(*, instance: Contract, payload: dict[str, Any]) -> Contract:
    if "provider_id" in payload:
        instance.provider = _resolve_provider(payload.get("provider_id"))

    if "title" in payload:
        instance.title = normalize_text(payload.get("title"))

    if "contract_number" in payload:
        instance.contract_number = normalize_text(payload.get("contract_number"))

    if "status" in payload:
        instance.status = normalize_text(payload.get("status"))

    if "start_date" in payload:
        instance.start_date = payload.get("start_date") or None

    if "end_date" in payload:
        instance.end_date = payload.get("end_date") or None

    if "signed_at" in payload:
        instance.signed_at = payload.get("signed_at") or None

    if "provider_contact_name" in payload:
        instance.provider_contact_name = normalize_text(payload.get("provider_contact_name"))

    if "provider_contact_phone" in payload:
        instance.provider_contact_phone = normalize_text(payload.get("provider_contact_phone"))

    if "provider_contact_email" in payload:
        instance.provider_contact_email = normalize_text(payload.get("provider_contact_email"))

    if "pricing_model" in payload:
        instance.pricing_model = normalize_text(payload.get("pricing_model"))

    if "discount_percentage" in payload:
        instance.discount_percentage = parse_decimal(payload.get("discount_percentage"), Decimal("0")) or Decimal("0")

    if "notes" in payload:
        instance.notes = normalize_text(payload.get("notes"))

    if "terms_and_conditions" in payload:
        instance.terms_and_conditions = normalize_text(payload.get("terms_and_conditions"))

    if not instance.title:
        raise ValidationError("Contract title is required.")

    if not instance.contract_number:
        raise ValidationError("Contract number is required.")

    instance.status = _validate_status(instance.status)
    instance.pricing_model = _validate_pricing_model(instance.pricing_model)
    _validate_unique_contract_number(instance.contract_number, exclude_id=instance.id)

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        if "contract_products" in payload:
            sync_contract_products(
                contract=instance,
                items=payload.get("contract_products") or [],
            )

    return instance


# ============================================================
# 🔹 Nested Sync — Contract Products
# ============================================================

def sync_contract_products(*, contract: Contract, items: list[dict[str, Any]]) -> None:
    if not isinstance(items, list):
        raise ValidationError("contract_products must be a list.")

    existing_map = {
        item.id: item
        for item in contract.contract_products.select_related("product").all()
    }
    keep_ids: list[int] = []

    for raw in items:
        if not isinstance(raw, dict):
            raise ValidationError("Each contract product must be an object.")

        contract_product_id = raw.get("id")
        product = _resolve_product(raw.get("product_id"))
        is_active = parse_bool(raw.get("is_active"), True)
        special_price = parse_decimal(raw.get("special_price"))
        discount_percentage = parse_decimal(raw.get("discount_percentage"), Decimal("0")) or Decimal("0")
        coverage_notes = normalize_text(raw.get("coverage_notes"))
        marked_delete = parse_bool(raw.get("delete"), False) or False

        if discount_percentage < Decimal("0") or discount_percentage > Decimal("100"):
            raise ValidationError("Contract product discount_percentage must be between 0 and 100.")

        if special_price is not None and special_price < Decimal("0"):
            raise ValidationError("Contract product special_price cannot be negative.")

        if contract_product_id:
            try:
                contract_product_id = int(contract_product_id)
            except (TypeError, ValueError):
                raise ValidationError("Invalid contract product id.")

            item = existing_map.get(contract_product_id)
            if not item:
                raise ValidationError(f"Contract product id {contract_product_id} does not belong to this contract.")

            if marked_delete:
                item.delete()
                continue

            duplicate_qs = ContractProduct.objects.filter(
                contract=contract,
                product=product,
            ).exclude(pk=item.pk)

            if duplicate_qs.exists():
                raise ValidationError("This product is already linked to the contract.")

            item.product = product
            item.is_active = True if is_active is None else is_active
            item.special_price = special_price
            item.discount_percentage = discount_percentage
            item.coverage_notes = coverage_notes
            item.full_clean()
            item.save()
            keep_ids.append(item.id)
            continue

        if marked_delete:
            continue

        if ContractProduct.objects.filter(contract=contract, product=product).exists():
            raise ValidationError("This product is already linked to the contract.")

        item = ContractProduct.objects.create(
            contract=contract,
            product=product,
            is_active=True if is_active is None else is_active,
            special_price=special_price,
            discount_percentage=discount_percentage,
            coverage_notes=coverage_notes,
        )
        item.full_clean()
        item.save()
        keep_ids.append(item.id)