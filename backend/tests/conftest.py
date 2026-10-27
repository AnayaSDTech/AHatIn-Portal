import os

# Tests always use a throwaway database on the local MongoDB, never the one in .env, and never send email.
os.environ["MONGODB_URI"] = os.environ.get("TEST_MONGODB_URI", "mongodb://localhost:27017")
os.environ.setdefault("MONGODB_DB", "ahat_test")
os.environ["RESEND_API_KEY"] = ""
os.environ["SMTP_HOST"] = ""
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("RUN_BACKGROUND_JOBS", "false")
os.environ.setdefault("LOCAL_STORAGE_DIR", "var/test-uploads")

import pyotp  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app import db as dbmod  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import demo_totp_secret, seed  # noqa: E402


@pytest_asyncio.fixture(autouse=True)
async def fresh_data():
    dbmod._client = None  # a new client for each test's event loop
    await dbmod.client().drop_database(os.environ["MONGODB_DB"])
    await seed(keep_logins=False)
    yield


class Api:
    """A browser-like client: keeps cookies and sends the CSRF header."""

    def __init__(self, client: AsyncClient):
        self.c = client

    def _headers(self):
        token = self.c.cookies.get("ahat_csrf")
        return {"X-CSRF-Token": token} if token else {}

    async def get(self, path, **kw):
        return await self.c.get(f"/api/v1{path}", headers=self._headers(), **kw)

    async def post(self, path, json=None, **kw):
        return await self.c.post(f"/api/v1{path}", json=json if json is not None else {}, headers=self._headers(), **kw)

    async def put(self, path, json=None, **kw):
        return await self.c.put(f"/api/v1{path}", json=json if json is not None else {}, headers=self._headers(), **kw)

    async def patch(self, path, json=None, **kw):
        return await self.c.patch(f"/api/v1{path}", json=json, headers=self._headers(), **kw)

    async def delete(self, path, **kw):
        return await self.c.delete(f"/api/v1{path}", headers=self._headers(), **kw)

    async def student_login(self, email="demo.student@ahatin.example"):
        r = await self.post("/auth/otp/request", {"email": email})
        assert r.status_code == 200, r.text
        r = await self.post("/auth/otp/verify", {"email": email, "code": r.json()["demoCode"]})
        assert r.status_code == 200, r.text
        return r.json()["user"]

    async def staff_login(self, email="demo.counsellor@ahatin.example", password="Staff@1234"):
        r = await self.post("/auth/staff/login", {"email": email, "password": password})
        assert r.status_code == 200, r.text
        code = pyotp.TOTP(demo_totp_secret(email)).now()
        r = await self.post("/auth/staff/verify", {"challenge_id": r.json()["challengeId"], "code": code})
        assert r.status_code == 200, r.text
        return r.json()["user"]


@pytest_asyncio.fixture
async def make_api():
    clients = []

    async def factory() -> Api:
        c = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
        clients.append(c)
        return Api(c)

    yield factory
    for c in clients:
        await c.aclose()


@pytest.fixture
def anyio_backend():
    return "asyncio"
