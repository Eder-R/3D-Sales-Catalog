"""Pricing data-access layer.

The business owns a pricing system (Flask + SQLAlchemy + Alembic + SQLite). To avoid
duplicating pricing rules, all displayed prices (and, when available, weight and print
time) are resolved through this gateway — the single source of truth for the storefront.

Sources, selected by PRICING_SOURCE:
- "admin"  (default): values stored on each product (set in the admin area).
- "legacy": values read, read-only, from the existing SQLite pricing database. A product
            not found there falls back to its admin values, so the storefront never breaks.

Switching sources needs NO route or frontend change — only env vars + restart.

Legacy connector (env vars, all optional; schema is auto-detected):
  PRICING_SOURCE        admin | legacy            (default: admin)
  PRICING_DB_PATH       path to the .db file      (default: backend/pricing_data/pricing.db)
  PRICING_TABLE         projects table name       (default: auto-detected)
  PRICING_KEY_COLUMN    column with the project   (default: auto-detected, e.g. "nome")
  PRICING_PRICE_COLUMN  column with the price     (default: auto-detected, e.g. "preco_venda")
  PRICING_MATCH_FIELD   catalog field to match: name | code (default: name, then code)
  PRICING_PRICE_FORMAT  decimal | cents | text    (default: decimal)

Known schema it understands (custos_3D.db):
  projetos(id, nome, tempo_impressao_minutos, mao_obra_minutos, preco_venda)
  projeto_materiais(projeto_id, material_id, peso_usado_g)   -> weight = SUM(peso_usado_g)
"""
import os
import re
import sqlite3
import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DEFAULT_DB_PATH = str(Path(__file__).parent / "pricing_data" / "pricing.db")

_KEY_CANDIDATES = ["code", "codigo", "código", "projeto", "project", "nome", "name"]
_PRICE_CANDIDATES = ["preco_venda", "preco", "preço", "price", "valor_venda", "valor"]
_TIME_CANDIDATES = ["tempo_impressao_minutos", "tempo_minutos", "tempo"]


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
            if "," in s:
                s = s.replace(".", "").replace(",", ".")
            if s in ("", "-", "."):
                return None
            return int(round(float(s) * 100))
        return int(round(float(raw) * 100))
    except (ValueError, TypeError):
        return None


def admin_record(product: dict) -> dict:
    return {
        "price_cents": product.get("price_cents"),
        "price_source": "admin",
        "weight_grams": product.get("weight_grams"),
        "print_time_minutes": product.get("print_time_minutes"),
        "specs_source": "admin",
    }


class PricingSource(ABC):
    name = "base"

    @abstractmethod
    def resolve(self, product: dict) -> dict:
        """Return {price_cents, price_source, weight_grams, print_time_minutes, specs_source}."""
        raise NotImplementedError


class AdminPricingSource(PricingSource):
    name = "admin"

    def resolve(self, product: dict) -> dict:
        return admin_record(product)


class LegacyPricingSource(PricingSource):
    name = "legacy"
    _cache_mtime = None
    _records: dict = {}

    def __init__(self):
        self.db_path = os.environ.get("PRICING_DB_PATH", DEFAULT_DB_PATH)
        self.match_field = os.environ.get("PRICING_MATCH_FIELD", "name").strip().lower()
        self.price_format = os.environ.get("PRICING_PRICE_FORMAT", "decimal").strip().lower()

    @staticmethod
    def _columns(conn, table) -> dict:
        return {row[1].lower(): row[1] for row in conn.execute(f'PRAGMA table_info("{table}")').fetchall()}

    @staticmethod
    def _has_table(conn, table) -> bool:
        return conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
        ).fetchone() is not None

    def _detect(self, conn):
        table = os.environ.get("PRICING_TABLE")
        key_col = os.environ.get("PRICING_KEY_COLUMN")
        price_col = os.environ.get("PRICING_PRICE_COLUMN")
        if table and key_col and price_col:
            return table, key_col, price_col
        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        # prefer a table literally named like "projetos"/"projects"
        tables.sort(key=lambda t: 0 if t.lower() in ("projetos", "projects", "projeto") else 1)
        for t in tables:
            if t.startswith("sqlite_") or t == "alembic_version":
                continue
            cols = self._columns(conn, t)
            k = key_col or next((cols[c] for c in _KEY_CANDIDATES if c in cols), None)
            p = price_col or next((cols[c] for c in _PRICE_CANDIDATES if c in cols), None)
            if k and p:
                return t, k, p
        return None

    def _load(self) -> dict:
        if not os.path.exists(self.db_path):
            return {}
        mtime = os.path.getmtime(self.db_path)
        if LegacyPricingSource._cache_mtime == mtime:
            return LegacyPricingSource._records
        records: dict = {}
        try:
            conn = sqlite3.connect(f"file:{self.db_path}?mode=ro", uri=True)
            detected = self._detect(conn)
            if not detected:
                logger.warning("Pricing DB present but no usable project/price table detected.")
                conn.close()
                return LegacyPricingSource._records
            table, key_col, price_col = detected
            cols = self._columns(conn, table)
            time_col = next((cols[c] for c in _TIME_CANDIDATES if c in cols), None)
            id_col = cols.get("id")

            select = [key_col, price_col] + ([time_col] if time_col else []) + ([id_col] if id_col else [])
            id_to_key = {}
            for row in conn.execute(f'SELECT {", ".join(chr(34)+c+chr(34) for c in select)} FROM "{table}"'):
                data = dict(zip(select, row))
                key = _norm(data[key_col])
                if not key:
                    continue
                records[key] = {
                    "price_cents": _price_to_cents(data[price_col], self.price_format),
                    "print_time_minutes": int(data[time_col]) if time_col and data.get(time_col) is not None else None,
                    "weight_grams": None,
                }
                if id_col and data.get(id_col) is not None:
                    id_to_key[data[id_col]] = key

            # weight = SUM(peso_usado_g) per project, via the join table
            if id_to_key and self._has_table(conn, "projeto_materiais"):
                jcols = self._columns(conn, "projeto_materiais")
                pid = jcols.get("projeto_id")
                peso = jcols.get("peso_usado_g") or jcols.get("peso_g") or jcols.get("peso")
                if pid and peso:
                    for proj_id, total in conn.execute(
                        f'SELECT "{pid}", SUM("{peso}") FROM projeto_materiais GROUP BY "{pid}"'
                    ):
                        k = id_to_key.get(proj_id)
                        if k and k in records and total is not None:
                            records[k]["weight_grams"] = round(float(total), 2)
            conn.close()
        except sqlite3.Error as e:
            logger.error(f"Pricing DB read error: {e}")
            return LegacyPricingSource._records

        LegacyPricingSource._cache_mtime = mtime
        LegacyPricingSource._records = records
        logger.info(f"Loaded {len(records)} projects from legacy pricing DB ({self.db_path}).")
        return records

    def resolve(self, product: dict) -> dict:
        records = self._load()
        rec = None
        order = ["name", "code"] if self.match_field == "name" else ["code", "name"]
        for field in order:
            nk = _norm(product.get(field))
            if nk and nk in records:
                rec = records[nk]
                break

        result = admin_record(product)
        if rec:
            result["specs_source"] = "legacy"
            if rec.get("price_cents") is not None:
                result["price_cents"] = rec["price_cents"]
                result["price_source"] = "legacy"
            if rec.get("weight_grams") is not None:
                result["weight_grams"] = rec["weight_grams"]
            if rec.get("print_time_minutes") is not None:
                result["print_time_minutes"] = rec["print_time_minutes"]
        return result


_SOURCES = {"admin": AdminPricingSource, "legacy": LegacyPricingSource}


def get_pricing_source() -> PricingSource:
    key = os.environ.get("PRICING_SOURCE", "admin").strip().lower()
    return _SOURCES.get(key, AdminPricingSource)()
