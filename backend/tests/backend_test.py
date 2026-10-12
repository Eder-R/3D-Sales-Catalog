"""Backend API tests for Forja 3D storefront."""
import io
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://loja-3d-pla.preview.emergentagent.com"
API = f"{BASE_URL}/api"

ADMIN_USER = "admin"
ADMIN_PASS = "Impressao3D@2026"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------- Auth ----------------
class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["token_type"] == "bearer"
        assert d["username"] == ADMIN_USER
        assert isinstance(d["access_token"], str) and len(d["access_token"]) > 10

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "wrong"}, timeout=30)
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 401

    def test_me_with_token(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["username"] == ADMIN_USER


# ---------------- Admin auth gates ----------------
class TestAdminGates:
    @pytest.mark.parametrize("method,path", [
        ("GET", "/admin/products"),
        ("POST", "/admin/products"),
        ("GET", "/admin/quotes"),
        ("POST", "/admin/upload"),
    ])
    def test_requires_auth(self, method, path):
        r = requests.request(method, f"{API}{path}", json={}, timeout=30)
        assert r.status_code == 401, f"{method} {path} -> {r.status_code}"


# ---------------- Products CRUD ----------------
class TestProducts:
    created_id = None

    def test_create_product_published(self, auth_headers):
        payload = {
            "code": "TEST-CUBE-01",
            "name": "TEST Cubo Benchy",
            "description": "Peça de teste automatizado",
            "category": "Decoração",
            "weight_grams": 25.5,
            "print_time_minutes": 60,
            "material": "PLA",
            "dimensions": "5x5x5 cm",
            "images": [],
            "price_cents": 4990,
            "colors": ["Preto", "Branco"],
            "status": "published",
            "available": True,
        }
        r = requests.post(f"{API}/admin/products", json=payload, headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == payload["name"]
        assert d["price_cents"] == 4990
        assert d["price_source"] == "admin"
        assert d["status"] == "published"
        assert "_id" not in d
        TestProducts.created_id = d["id"]

    def test_public_list_shows_published(self):
        r = requests.get(f"{API}/products", timeout=30)
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert TestProducts.created_id in ids
        p = next(p for p in r.json() if p["id"] == TestProducts.created_id)
        assert p["price_source"] == "admin"
        assert p["price_cents"] == 4990

    def test_public_get_product(self):
        r = requests.get(f"{API}/products/{TestProducts.created_id}", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == TestProducts.created_id
        assert d["price_source"] == "admin"

    def test_search_by_code(self):
        r = requests.get(f"{API}/products", params={"search": "TEST-CUBE"}, timeout=30)
        assert r.status_code == 200
        assert any(p["id"] == TestProducts.created_id for p in r.json())

    def test_category_filter(self):
        r = requests.get(f"{API}/products", params={"category": "Decoração"}, timeout=30)
        assert r.status_code == 200
        assert any(p["id"] == TestProducts.created_id for p in r.json())

    def test_sort_price_asc(self):
        r = requests.get(f"{API}/products", params={"sort": "price_asc"}, timeout=30)
        assert r.status_code == 200
        prices = [p["price_cents"] for p in r.json() if p.get("price_cents") is not None]
        assert prices == sorted(prices)

    def test_categories_endpoint(self):
        r = requests.get(f"{API}/categories", timeout=30)
        assert r.status_code == 200
        assert "Decoração" in r.json()

    def test_update_product_draft_hides_from_public(self, auth_headers):
        r = requests.put(
            f"{API}/admin/products/{TestProducts.created_id}",
            json={"status": "draft"},
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "draft"
        # Public get should 404
        r2 = requests.get(f"{API}/products/{TestProducts.created_id}", timeout=30)
        assert r2.status_code == 404

    def test_update_archive_hides(self, auth_headers):
        r = requests.put(
            f"{API}/admin/products/{TestProducts.created_id}",
            json={"status": "archived"},
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200
        r2 = requests.get(f"{API}/products", timeout=30)
        assert all(p["id"] != TestProducts.created_id for p in r2.json())

    def test_admin_list_shows_all_statuses(self, auth_headers):
        r = requests.get(f"{API}/admin/products", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert TestProducts.created_id in ids

    def test_delete_product(self, auth_headers):
        r = requests.delete(f"{API}/admin/products/{TestProducts.created_id}", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["deleted"] is True
        # Verify
        r2 = requests.delete(f"{API}/admin/products/{TestProducts.created_id}", headers=auth_headers, timeout=30)
        assert r2.status_code == 404


# ---------------- Upload ----------------
# tiny valid PNG (1x1)
PNG_BYTES = bytes.fromhex(
    "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4"
    "890000000D49444154789C636060000000000500010D0A2DB40000000049454E44AE426082"
)


class TestUpload:
    def test_quote_reference_upload(self):
        files = {"file": ("ref.png", io.BytesIO(PNG_BYTES), "image/png")}
        r = requests.post(f"{API}/upload/quote-reference", files=files, timeout=60)
        assert r.status_code == 200, r.text
        assert "path" in r.json()
        # Serve back
        path = r.json()["path"]
        r2 = requests.get(f"{API}/files/{path}", timeout=30)
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/")

    def test_admin_upload_requires_auth(self):
        files = {"file": ("x.png", io.BytesIO(PNG_BYTES), "image/png")}
        r = requests.post(f"{API}/admin/upload", files=files, timeout=60)
        assert r.status_code == 401

    def test_admin_upload_success(self, auth_headers):
        files = {"file": ("prod.png", io.BytesIO(PNG_BYTES), "image/png")}
        r = requests.post(f"{API}/admin/upload", files=files, headers=auth_headers, timeout=60)
        assert r.status_code == 200
        assert "path" in r.json()

    def test_upload_invalid_format(self, auth_headers):
        files = {"file": ("bad.txt", io.BytesIO(b"hello"), "text/plain")}
        r = requests.post(f"{API}/admin/upload", files=files, headers=auth_headers, timeout=60)
        assert r.status_code == 400


# ---------------- Quotes ----------------
class TestQuotes:
    created_id = None

    def test_create_quote(self):
        payload = {
            "name": "TEST Visitante",
            "email": "test@example.com",
            "phone": "+55 11 99999-9999",
            "description": "Preciso de uma peça customizada",
            "quantity": 3,
        }
        r = requests.post(f"{API}/quotes", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "new"
        assert d["name"] == payload["name"]
        TestQuotes.created_id = d["id"]

    def test_admin_list_quote(self, auth_headers):
        r = requests.get(f"{API}/admin/quotes", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        ids = [q["id"] for q in r.json()]
        assert TestQuotes.created_id in ids

    def test_admin_update_quote_status(self, auth_headers):
        r = requests.patch(
            f"{API}/admin/quotes/{TestQuotes.created_id}/status",
            json={"status": "in_review"},
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200
        # Verify
        r2 = requests.get(f"{API}/admin/quotes", headers=auth_headers, timeout=30)
        q = next(q for q in r2.json() if q["id"] == TestQuotes.created_id)
        assert q["status"] == "in_review"
