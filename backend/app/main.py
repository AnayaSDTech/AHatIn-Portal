"""AHat portal API.

    uvicorn app.main:app --reload            # development
    python -m app.worker                      # background jobs (production, if RUN_BACKGROUND_JOBS=false)
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_settings
from app.core import errors
from app.core.auth import csrf_middleware
from app.db import client, ensure_indexes
from app.routers import admin, auth, messages, public, schedule, staff, students

settings = get_settings()
logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.check_production()
    await ensure_indexes()
    tasks: list[asyncio.Task] = []
    if settings.run_background_jobs:
        from app import worker

        worker.start(tasks)
    yield
    for t in tasks:
        t.cancel()
    client().close()


app = FastAPI(
    title="AHat Portal API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.is_dev else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if settings.is_dev else None,
)


class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("X-Frame-Options", "DENY")
        if request.url.path.startswith("/api/"):
            response.headers.setdefault("Cache-Control", "no-store")
        if settings.cookie_secure:
            response.headers.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
        return response


csrf_middleware(app)
errors.install(app)
app.add_middleware(SecurityHeaders)
if settings.allowed_origins:
    # When the website is on another address than the API (ahat.in → api.ahat.in).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-CSRF-Token"],
    )

api = APIRouter(prefix="/api/v1")
for r in (auth.router, public.router, students.router, schedule.router, messages.router, staff.router, admin.router):
    api.include_router(r)
app.include_router(api)


@app.get("/api/health", include_in_schema=False)
async def health():
    await client().admin.command("ping")
    return {"status": "ok"}
