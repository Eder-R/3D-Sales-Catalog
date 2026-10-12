"""Pricing data-access layer.

The business owns a pricing system (Flask + SQLAlchemy + Alembic + SQLite). To avoid
duplicating pricing rules, all displayed prices (and, when available, weight and print
time) are resolved through this gateway — the single source of truth for the storefront.

Sources, selected by PRICING_SOURCE:
- "admin"  (default): values stored on each product (set in the admin area).
- "legacy": values read, read-only, from the existing SQLite pricing database. A product
            not found there falls back to its admin values, so the storefront never breaks.

A catalog product is linked to a project by, in order of priority:
  1. pricing_ref  (explicit link chosen in the admin — "casar por código/vínculo")
  2. name         (product name == projetos.nome)
  3. code

Known schema it understands (custos_3D.db):
  configuracoes(valor_mao_obra_hora, custo_impressora_hora, margem_venda)
  materiais(id, nome, peso_comprado_g, preco_pago)
  projetos(id, nome, tempo_impressao_minutos, mao_obra_minutos, preco_venda)
  projeto_materiais(projeto_id, material_id, peso_usado_g)
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
_LABOR_CANDIDATES = ["mao_obra_minutos", "maodeobra_minutos", "mao_de_obra_minutos"]


def _norm(value) -> str:
    return str(value).strip().lower() if value is not None else ""


def _to_cents(raw, fmt: str = "decimal") -> Optional[int]:
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
        "cost_breakdown": None,
    }


class PricingSource(ABC):
    name = "base"

    @abstractmethod
    def resolve(self, product: dict) -> dict:
        raise NotImplementedError

    def list_projects(self) -> list:
        """All projects known to this source (empty unless a legacy DB is connected)."""
        return []


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

    def _load_config(self, conn) -> dict:
        cfg = {"labor_hour": 0.0, "printer_hour": 0.0, "margin": 0.0}
        if not self._has_table(conn, "configuracoes"):
            return cfg
        cols = self._columns(conn, "configuracoes")
        row = conn.execute(f'SELECT * FROM "configuracoes" LIMIT 1').fetchone()
        if not row:
            return cfg
        names = [d[0].lower() for d in conn.execute('SELECT * FROM "configuracoes" LIMIT 1').description]
        data = dict(zip(names, row))
        cfg["labor_hour"] = float(data.get("valor_mao_obra_hora") or 0)
        cfg["printer_hour"] = float(data.get("custo_impressora_hora") or 0)
        cfg["margin"] = float(data.get("margem_venda") or 0)
        return cfg

    def _load_materials(self, conn) -> dict:
        """material_id -> {name, cost_per_gram}."""
        out = {}
        if not self._has_table(conn, "materiais"):
            return out
        cols = self._columns(conn, "materiais")
        id_c = cols.get("id")
        nome_c = cols.get("nome") or cols.get("name")
        peso_c = cols.get("peso_comprado_g") or cols.get("peso_g")
        preco_c = cols.get("preco_pago") or cols.get("preco") or cols.get("preço")
        if not (id_c and peso_c and preco_c):
            return out
        for row in conn.execute(f'SELECT "{id_c}", "{nome_c or id_c}", "{peso_c}", "{preco_c}" FROM "materiais"'):
            mid, nome, peso, preco = row
            cpg = (float(preco) / float(peso)) if peso else 0.0
            out[mid] = {"name": nome, "cost_per_gram": cpg}
        return out

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
            labor_col = next((cols[c] for c in _LABOR_CANDIDATES if c in cols), None)
            id_col = cols.get("id")

            cfg = self._load_config(conn)
            materials = self._load_materials(conn)

            # weights + materials used per project
            weights = {}        # proj_id -> grams
            mats_used = {}       # proj_id -> [{name, grams, cost_cents}]
            if self._has_table(conn, "projeto_materiais"):
                jc = self._columns(conn, "projeto_materiais")
                pid_c = jc.get("projeto_id")
                mid_c = jc.get("material_id")
                peso_c = jc.get("peso_usado_g") or jc.get("peso_g") or jc.get("peso")
                if pid_c and peso_c:
                    sel = f'"{pid_c}", "{peso_c}"' + (f', "{mid_c}"' if mid_c else "")
                    for r in conn.execute(f'SELECT {sel} FROM projeto_materiais'):
                        pid = r[0]
                        grams = float(r[1] or 0)
                        weights[pid] = weights.get(pid, 0.0) + grams
                        mat = materials.get(r[2]) if (mid_c and len(r) > 2) else None
                        cost = grams * (mat["cost_per_gram"] if mat else 0.0)
                        mats_used.setdefault(pid, []).append({
                            "name": mat["name"] if mat else "Material",
                            "grams": round(grams, 2),
                            "cost_cents": _to_cents(cost, "decimal"),
                        })

            select = [key_col, price_col] + ([time_col] if time_col else []) \
                + ([labor_col] if labor_col else []) + ([id_col] if id_col else [])
            for row in conn.execute(f'SELECT {", ".join(chr(34)+c+chr(34) for c in select)} FROM "{table}"'):
                data = dict(zip(select, row))
                key = _norm(data[key_col])
                if not key:
                    continue
                pid = data.get(id_col) if id_col else None
                time_min = int(data[time_col]) if time_col and data.get(time_col) is not None else None
                labor_min = float(data[labor_col]) if labor_col and data.get(labor_col) is not None else 0.0
                weight = round(weights.get(pid, 0.0), 2) if pid in weights else None

                material_cents = sum((m["cost_cents"] or 0) for m in mats_used.get(pid, [])) or 0
                labor_cents = _to_cents((labor_min / 60.0) * cfg["labor_hour"], "decimal") or 0
                printer_cents = _to_cents(((time_min or 0) / 60.0) * cfg["printer_hour"], "decimal") or 0
                total_cost = material_cents + labor_cents + printer_cents
                price_cents = _to_cents(data[price_col], self.price_format)

                records[key] = {
                    "name": data[key_col],
                    "price_cents": price_cents,
                    "weight_grams": weight,
                    "print_time_minutes": time_min,
                    "cost_breakdown": {
                        "material_cents": material_cents,
                        "labor_cents": labor_cents,
                        "printer_cents": printer_cents,
                        "total_cost_cents": total_cost,
                        "margin_pct": cfg["margin"],
                        "sale_price_cents": price_cents,
                        "labor_minutes": labor_min,
                        "print_minutes": time_min,
                        "materials": mats_used.get(pid, []),
                    },
                }
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
        order = ["pricing_ref", "name", "code"] if self.match_field != "code" else ["pricing_ref", "code", "name"]
        for field in order:
            nk = _norm(product.get(field))
            if nk and nk in records:
                rec = records[nk]
                break

        result = admin_record(product)
        if rec:
            result["specs_source"] = "legacy"
            result["cost_breakdown"] = rec.get("cost_breakdown")
            if rec.get("price_cents") is not None:
                result["price_cents"] = rec["price_cents"]
                result["price_source"] = "legacy"
            if rec.get("weight_grams") is not None:
                result["weight_grams"] = rec["weight_grams"]
            if rec.get("print_time_minutes") is not None:
                result["print_time_minutes"] = rec["print_time_minutes"]
        return result

    def list_projects(self) -> list:
        recs = self._load()
        out = [{"key": k, **v} for k, v in recs.items()]
        out.sort(key=lambda x: (x.get("name") or "").lower())
        return out


_SOURCES = {"admin": AdminPricingSource, "legacy": LegacyPricingSource}


def get_pricing_source() -> PricingSource:
    key = os.environ.get("PRICING_SOURCE", "admin").strip().lower()
    return _SOURCES.get(key, AdminPricingSource)()
