"""Pydantic models for the 3D printing storefront.

Public identifiers use a uuid `id` field; MongoDB `_id` is never returned.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Literal

from pydantic import BaseModel, Field, EmailStr


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


ProductStatus = Literal["draft", "published", "archived"]


class ProductBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    category: str = Field(default="", max_length=120)
    weight_grams: Optional[float] = Field(default=None, ge=0)
    print_time_minutes: Optional[int] = Field(default=None, ge=0)
    material: str = Field(default="PLA", max_length=120)
    dimensions: str = Field(default="", max_length=200)
    images: List[str] = Field(default_factory=list)
    price_cents: Optional[int] = Field(default=None, ge=0)
    colors: List[str] = Field(default_factory=list)
    status: ProductStatus = "draft"
    available: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1, max_length=64)
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    category: Optional[str] = Field(default=None, max_length=120)
    weight_grams: Optional[float] = Field(default=None, ge=0)
    print_time_minutes: Optional[int] = Field(default=None, ge=0)
    material: Optional[str] = Field(default=None, max_length=120)
    dimensions: Optional[str] = Field(default=None, max_length=200)
    images: Optional[List[str]] = None
    price_cents: Optional[int] = Field(default=None, ge=0)
    colors: Optional[List[str]] = None
    status: Optional[ProductStatus] = None
    available: Optional[bool] = None


class Product(ProductBase):
    id: str = Field(default_factory=_new_id)
    price_source: str = "admin"
    created_at: str = Field(default_factory=_now_iso)
    updated_at: str = Field(default_factory=_now_iso)


QuoteStatus = Literal["new", "in_review", "answered", "archived"]


class QuoteCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    phone: str = Field(default="", max_length=40)
    description: str = Field(..., min_length=1, max_length=5000)
    quantity: int = Field(..., ge=1, le=100000)
    reference_image: Optional[str] = None


class Quote(QuoteCreate):
    id: str = Field(default_factory=_new_id)
    status: QuoteStatus = "new"
    created_at: str = Field(default_factory=_now_iso)


class QuoteStatusUpdate(BaseModel):
    status: QuoteStatus


class LoginRequest(BaseModel):
    username: str
    password: str
