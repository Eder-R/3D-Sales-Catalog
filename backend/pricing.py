"""Pricing data-access layer.

The business already owns a pricing system (Flask + SQLAlchemy + Alembic + SQLite
with fields Projeto, Peso, Tempo, Preço). To avoid duplicating pricing rules, all
displayed prices are resolved through this gateway, which is the single source of
truth for prices in the storefront.

Currently the "admin" source is active: the price stored on each product (set in the
admin area) is the authoritative value. The abstraction below is prepared so a future
"legacy" source can read prices directly from the existing SQLite pricing database
WITHOUT changing any route or frontend code — only an env flag (PRICING_SOURCE) and a
new PricingSource implementation are required.
"""
import os
from abc import ABC, abstractmethod
from typing import Optional


class PricingSource(ABC):
    name: str = "base"

    @abstractmethod
    def resolve_price_cents(self, product: dict) -> Optional[int]:
        """Return the authoritative price (in cents) for a product, or None."""
        raise NotImplementedError


class AdminPricingSource(PricingSource):
    """Source of truth = the price managed in the admin area and stored on the product."""

    name = "admin"

    def resolve_price_cents(self, product: dict) -> Optional[int]:
        return product.get("price_cents")


class LegacyPricingSource(PricingSource):
    """Placeholder for the existing Flask/SQLAlchemy/SQLite pricing system.

    NOT IMPLEMENTED YET. When enabled, this should look the product up in the legacy
    pricing database (e.g. by `code`/Projeto) and return the Preço computed there.
    Until implemented it falls back to the admin price so the storefront keeps working.
    """

    name = "legacy"

    def resolve_price_cents(self, product: dict) -> Optional[int]:
        # TODO: integrate with the external SQLite pricing database.
        return product.get("price_cents")


_SOURCES = {
    "admin": AdminPricingSource,
    "legacy": LegacyPricingSource,
}


def get_pricing_source() -> PricingSource:
    key = os.environ.get("PRICING_SOURCE", "admin").strip().lower()
    return _SOURCES.get(key, AdminPricingSource)()
