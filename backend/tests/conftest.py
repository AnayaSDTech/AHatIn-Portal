import io
import os

# Tests always use a throwaway database on the local MongoDB, never the one in .env, and never send email.
os.environ["MONGODB_URI"] = os.environ.get("TEST_MONGODB_URI", "mongodb://localhost:27017")
os.environ.setdefault("MONGODB_DB", "ahat_test")
os.environ["RESEND_API_KEY"] = ""
os.environ["SMTP_HOST"] = ""
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("RUN_BACKGROUND_JOBS", "false")
# Document storage: an in-memory stand-in for the bucket (FakeBucket below), never the real one.
os.environ["S3_BUCKET"] = "test-bucket"
os.environ["S3_ACCESS_KEY_ID"] = "test"
os.environ["S3_SECRET_ACCESS_KEY"] = "test"
os.environ["S3_ENDPOINT"] = "https://bucket.test"

import pyotp  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app import db as dbmod  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import demo_totp_secret, seed  # noqa: E402
from app.services import storage  # noqa: E402


class FakeBucket:
    """The few S3 calls the portal makes, kept in memory. Presigned URLs are https://bucket.test/<key>?op=…;
    tests act as the browser with put_url() / get_url()."""

    def __init__(self):
        self.objects: dict[str, bytes] = {}

    def generate_presigned_url(self, op, Params, ExpiresIn):  # noqa: N803 - boto3's names
        return f"https://bucket.test/{Params['Key']}?op={op}&expires={ExpiresIn}"

    def put_object(self, Bucket, Key, Body, **_):  # noqa: N803
        self.objects[Key] = Body

    def head_object(self, Bucket, Key):  # noqa: N803
        if Key not in self.objects:
            raise KeyError(Key)
        return {"ContentLength": len(self.objects[Key])}

    def get_object(self, Bucket, Key, Range=None):  # noqa: N803
        data = self.objects[Key]
        if Range:
            start, end = Range.removeprefix("bytes=").split("-")
            data = data[int(start) : int(end) + 1]
        return {"Body": io.BytesIO(data)}

    def delete_object(self, Bucket, Key):  # noqa: N803
        self.objects.pop(Key, None)

    @staticmethod
    def key(url: str) -> str:
        return url.removeprefix("https://bucket.test/").split("?")[0]

    def put_url(self, url: str, data: bytes) -> None:
        """What the browser does with an upload URL."""
        self.objects[self.key(url)] = data

    def get_url(self, url: str) -> bytes | None:
        """What the browser gets from a download URL."""
        return self.objects.get(self.key(url))


@pytest.fixture(autouse=True)
def bucket(monkeypatch) -> FakeBucket:
    fake = FakeBucket()
    monkeypatch.setattr(storage, "_s3", lambda: fake)
    return fake


@pytest_asyncio.fixture(autouse=True)
async def fresh_data(bucket):
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

    async def student_login(self, email="demo.student@ahatin.example", password="Student@1234"):
        r = await self.post("/auth/login", {"email": email, "password": password})
        assert r.status_code == 200 and "user" in r.json(), r.text
        return r.json()["user"]

    async def register_student(self, name, email, mobile, password="Welcome123"):
        """Registers, then verifies the email with the emailed code (shown on screen for test emails): signed in."""
        r = await self.post("/auth/register", {"name": name, "email": email, "mobile": mobile, "password": password, "consent": True})
        assert r.status_code == 200, r.text
        r = await self.post("/auth/verify-email", {"email": email, "code": r.json()["demoCode"]})
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
