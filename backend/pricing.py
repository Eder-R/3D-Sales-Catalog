"""Pricing data-access layer.

The business already owns a pricing system (Flask + SQLAlchemy + Alembic + SQLite
with fields Projeto, Peso, Tempo, Preço). To avoid duplicating pricing rules, all
displayed prices are resolved through this gateway, which is the single source of
truth for prices in the storefront.

Two sources are available, selected by the PRICING_SOURCE env var:

- "admin"  (default): the price stored on each product (set in the admin area).
- "legacy": prices are read directly, read-only, from the existing SQLite pricing
            database. If a product is not found there, it falls back to the admin
            price so the storefront never breaks.

Switching sources requires NO route or frontend change — only env vars + restart.

Legacy connector configuration (env vars, all optional; sensible auto-detection):
  PRICING_SOURCE        admin | legacy            (default: admin)
  PRICING_DB_PATH       path to the .db file      (default: backend/pricing_data/pricing.db)
  PRICING_TABLE         table name                (default: auto-detected)
  PRICING_KEY_COLUMN    column holding Projeto    (default: auto-detected)
  PRICING_PRICE_COLUMN  column holding Preço      (default: auto-detected)
  PRICING_MATCH_FIELD   catalog field to match: code | name (default: code, then name)
  PRICING_PRICE_FORMAT  decimal | cents | text    (default: decimal)
"""
import os
import re
import sqlite3
import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

DEFAULT_DB_PATH = str(Path(__file__).parent / "pricing_data" / "pricing.db")

_KEY_CANDIDATES = ["code", "codigo", "código", "projeto", "project", "nome", "name"]
_PRICE_CANDIDATES = ["preco", "preço", "price", "valor_venda", "preco_venda", "valor"]


def _norm(value) -> str:
    return str(value).strip().lower() if value is not None else ""


def _price_to_cents(raw, fmt: str) -> Optional[int]:
    if raw is None:
        return None
    try:
        if fmt == "cents":
            return int(round(float(raw)))
        if fmt == "text" or isinstance(raw, str):
            s = re.sub(r"[^\d,.-]", "", str(raw))
            if "," in s:  # Brazilian format: 1.234,56
                s = s.replace(".", "").replace(",", ".")
            if s in ("", "-", "."):
                return None
            return int(round(float(s) * 100))
        # decimal (reais)
        return int(round(float(raw) * 100))
    except (ValueError, TypeError):
        return None


class PricingSource(ABC):
    name = "base"

    @abstractmethod
    def resolve(self, product: dict) -> Tuple[Optional[int], str]:
        """Return (price_cents, origin) for a product."""
        raise NotImplementedError


class AdminPricingSource(PricingSource):
    name = "admin"

    def resolve(self, product: dict) -> Tuple[Optional[int], str]:
        return product.get("price_cents"), "admin"


class LegacyPricingSource(PricingSource):
    """Reads prices from the existing read-only SQLite pricing database."""

    name = "legacy"
    _cache_mtime = None
    _price_map: dict = {}

    def __init__(self):
        self.db_path = os.environ.get("PRICING_DB_PATH", DEFAULT_DB_PATH)
        self.match_field = os.environ.get("PRICING_MATCH_FIELD", "code").strip().lower()
        self.price_format = os.environ.get("PRICING_PRICE_FORMAT", "decimal").strip().lower()

    # ---- schema detection ----
    def _detect(self, conn) -> Optional[Tuple[str, str, str]]:
        table = os.environ.get("PRICING_TABLE")
        key_col = os.environ.get("PRICING_KEY_COLUMN")
        price_col = os.environ.get("PRICING_PRICE_COLUMN")
        if table and key_col and price_col:
            return table, key_col, price_col

        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        for t in tables:
            if t.startswith("sqlite_") or t == "alembic_version":
                continue
            cols = [row[1] for row in conn.execute(f'PRAGMA table_info("{t}")').fetchall()]
            lower = {c.lower(): c for c in cols}
            k = key_col or next((lower[c] for c in _KEY_CANDIDATES if c in lower), None)
            p = price_col or next((lower[c] for c in _PRICE_CANDIDATES if c in lower), None)
            if k and p:
                return t, k, p
        return None

    def _load_map(self) -> dict:
        if not os.path.exists(self.db_path):
            return {}
        mtime = os.path.getmtime(self.db_path)
        if LegacyPricingSource._cache_mtime == mtime:
            return LegacyPricingSource._price_map
        price_map: dict = {}
        try:
            conn = sqlite3.connect(f"file:{self.db_path}?mode=ro", uri=True)
            detected = self._detect(conn)
            if not detected:
                logger.warning("Pricing DB present but no usable table/columns detected.")
            else:
                table, key_col, price_col = detected
                for row in conn.execute(f'SELECT "{key_col}", "{price_col}" FROM "{table}"'):
                    key = _norm(row[0])
                    if key:
                        price_map[key] = _price_to_cents(row[1], self.price_format)
            conn.close()
        except sqlite3.Error as e:
            logger.error(f"Pricing DB read error: {e}")
            return LegacyPricingSource._price_map
        LegacyPricingSource._cache_mtime = mtime
        LegacyPricingSource._price_map = price_map
        logger.info(f"Loaded {len(price_map)} prices from legacy pricing DB.")
        return price_map

    def resolve(self, product: dict) -> Tuple[Optional[int], str]:
        price_map = self._load_map()
        if price_map:
            keys = []
            if self.match_field == "name":
                keys = [product.get("name"), product.get("code")]
            else:
                keys = [product.get("code"), product.get("name")]
            for k in keys:
                nk = _norm(k)
                if nk and nk in price_map and price_map[nk] is not None:
                    return price_map[nk], "legacy"
        # fallback to admin price so the storefront keeps working
        return product.get("price_cents"), "admin"


_SOURCES = {"admin": AdminPricingSource, "legacy": LegacyPricingSource}


def get_pricing_source() -> PricingSource:
    key = os.environ.get("PRICING_SOURCE", "admin").strip().lower()
    return _SOURCES.get(key, AdminPricingSource)()
