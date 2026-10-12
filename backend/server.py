import os
import uuid
import logging
from pathlib import Path

from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from models import (
    ProductCreate,
    ProductUpdate,
    Product,
    QuoteCreate,
    Quote,
    QuoteStatusUpdate,
    LoginRequest,
)
from auth import (
    require_admin,
    create_access_token,
    verify_password,
    ensure_admin_seed,
)
from storage import init_storage, put_object, get_object, APP_NAME, MIME_TYPES
from pricing import get_pricing_source

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Forja 3D API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

PUBLIC_PROJECTION = {"_id": 0}
MAX_IMAGE_BYTES = 8 * 1024 * 1024


def _apply_price(product: dict) -> dict:
    source = get_pricing_source()
    product = {k: v for k, v in product.items() if k != "_id"}
    product["price_cents"] = source.resolve_price_cents(product)
    product["price_source"] = source.name
    return product


# ---------------- Auth ----------------
@api_router.post("/auth/login")
async def login(payload: LoginRequest):
    admin = await db.admins.find_one({"username": payload.username})
    if not admin or not verify_password(payload.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")
    token = create_access_token(payload.username)
    return {"access_token": token, "token_type": "bearer", "username": payload.username}


@api_router.get("/auth/me")
async def me(admin: dict = Depends(require_admin)):
    return admin


# ---------------- Public catalog ----------------
@api_router.get("/products")
async def list_products(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    sort: str = Query(default="newest"),
):
    query: dict = {"status": "published"}
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"code": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.products.find(query, PUBLIC_PROJECTION).to_list(1000)
    docs = [_apply_price(d) for d in docs]

    sort_map = {
        "name_asc": lambda d: d.get("name", "").lower(),
        "name_desc": lambda d: d.get("name", "").lower(),
        "price_asc": lambda d: d.get("price_cents") if d.get("price_cents") is not None else 10**12,
        "price_desc": lambda d: d.get("price_cents") if d.get("price_cents") is not None else -1,
        "newest": lambda d: d.get("created_at", ""),
    }
    reverse = sort in ("name_desc", "price_desc", "newest")
    docs.sort(key=sort_map.get(sort, sort_map["newest"]), reverse=reverse)
    return docs


@api_router.get("/categories")
async def list_categories():
    cats = await db.products.distinct("category", {"status": "published"})
    return sorted([c for c in cats if c])


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    doc = await db.products.find_one({"id": product_id, "status": "published"}, PUBLIC_PROJECTION)
    if not doc:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return _apply_price(doc)


# ---------------- Admin products ----------------
@api_router.get("/admin/products")
async def admin_list_products(admin: dict = Depends(require_admin)):
    docs = await db.products.find({}, PUBLIC_PROJECTION).sort("created_at", -1).to_list(1000)
    return docs


@api_router.post("/admin/products", response_model=Product)
async def admin_create_product(payload: ProductCreate, admin: dict = Depends(require_admin)):
    product = Product(**payload.model_dump())
    product.price_source = get_pricing_source().name
    await db.products.insert_one(product.model_dump())
    return product


@api_router.put("/admin/products/{product_id}", response_model=Product)
async def admin_update_product(product_id: str, payload: ProductUpdate, admin: dict = Depends(require_admin)):
    existing = await db.products.find_one({"id": product_id}, PUBLIC_PROJECTION)
    if not existing:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    from models import _now_iso

    updates["updated_at"] = _now_iso()
    await db.products.update_one({"id": product_id}, {"$set": updates})
    doc = await db.products.find_one({"id": product_id}, PUBLIC_PROJECTION)
    return doc


@api_router.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, admin: dict = Depends(require_admin)):
    res = await db.products.delete_one({"id": product_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return {"deleted": True}


# ---------------- Quotes ----------------
@api_router.post("/quotes", response_model=Quote)
async def create_quote(payload: QuoteCreate):
    quote = Quote(**payload.model_dump())
    await db.quotes.insert_one(quote.model_dump())
    return quote


@api_router.get("/admin/quotes")
async def admin_list_quotes(admin: dict = Depends(require_admin)):
    docs = await db.quotes.find({}, PUBLIC_PROJECTION).sort("created_at", -1).to_list(1000)
    return docs


@api_router.patch("/admin/quotes/{quote_id}/status")
async def admin_update_quote_status(quote_id: str, payload: QuoteStatusUpdate, admin: dict = Depends(require_admin)):
    res = await db.quotes.update_one({"id": quote_id}, {"$set": {"status": payload.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return {"updated": True}


# ---------------- File upload / serve ----------------
async def _save_upload(file: UploadFile, folder: str) -> dict:
    ext = (file.filename or "").split(".")[-1].lower() if "." in (file.filename or "") else ""
    if ext not in MIME_TYPES:
        raise HTTPException(status_code=400, detail="Formato de imagem inválido. Use JPG, PNG, GIF ou WEBP.")
    data = await file.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Imagem muito grande (máx. 8MB).")
    path = f"{APP_NAME}/{folder}/{uuid.uuid4()}.{ext}"
    content_type = MIME_TYPES[ext]
    result = put_object(path, data, content_type)
    await db.files.insert_one(
        {
            "id": str(uuid.uuid4()),
            "storage_path": result["path"],
            "original_filename": file.filename,
            "content_type": content_type,
            "size": result.get("size", len(data)),
            "is_deleted": False,
        }
    )
    return {"path": result["path"]}


@api_router.post("/admin/upload")
async def admin_upload(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    return await _save_upload(file, "products")


@api_router.post("/upload/quote-reference")
async def upload_quote_reference(file: UploadFile = File(...)):
    return await _save_upload(file, "quotes")


@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    data, content_type = get_object(path)
    return Response(content=data, media_type=record.get("content_type", content_type))


@api_router.get("/")
async def root():
    return {"message": "Forja 3D API", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await ensure_admin_seed(db)
    await db.products.create_index("id")
    await db.products.create_index("status")
    await db.quotes.create_index("id")
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:  # noqa
        logger.error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
