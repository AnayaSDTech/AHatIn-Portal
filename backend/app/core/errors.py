import logging
import uuid
from contextvars import ContextVar

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("ahat")
trace_id_var: ContextVar[str] = ContextVar("trace_id", default="")


class ApiError(Exception):
    """A handled error, returned as {detail, errors, trace_id} (the format the frontend parses)."""

    def __init__(self, status: int, detail: str, errors: dict[str, str] | None = None, headers: dict[str, str] | None = None):
        super().__init__(detail)
        self.status = status
        self.detail = detail
        self.errors = errors or {}
        self.headers = headers or {}


def not_found(what: str = "Not found.") -> ApiError:
    return ApiError(404, what)


def bad_request(detail: str, field: str | None = None) -> ApiError:
    return ApiError(400, detail, {field: detail} if field else None)


def _body(detail: str, errors: dict[str, str] | list[dict[str, str]] | None = None) -> dict:
    if isinstance(errors, dict):
        errors = [{"field": k, "message": v} for k, v in errors.items()]
    return {"detail": detail, "errors": errors or [], "trace_id": trace_id_var.get()}


# Friendlier messages for common validation failures (same wording as the frontend forms).
FIELD_MESSAGES = {
    "email": "Enter a valid email address, like name@example.com.",
    "mobile": "Enter a valid 10-digit Indian mobile number.",
    "name": "Enter your full name.",
    "code": "Enter the 6-digit code.",
}


def install(app: FastAPI) -> None:
    @app.middleware("http")
    async def trace(request: Request, call_next):
        tid = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        token = trace_id_var.set(tid)
        try:
            response = await call_next(request)
        finally:
            trace_id_var.reset(token)
        response.headers["X-Trace-Id"] = tid
        return response

    @app.exception_handler(ApiError)
    async def api_error(_: Request, exc: ApiError):
        return JSONResponse(_body(exc.detail, exc.errors), status_code=exc.status, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        errors: list[dict[str, str]] = []
        for e in exc.errors():
            loc = [str(p) for p in e.get("loc", []) if p not in ("body", "query", "path")]
            field = loc[-1] if loc else "form"
            msg = e.get("msg", "Invalid value.")
            if msg.startswith("Value error, "):
                msg = msg[len("Value error, ") :]
            elif field in FIELD_MESSAGES:
                msg = FIELD_MESSAGES[field]
            errors.append({"field": field, "message": msg})
        detail = errors[0]["message"] if errors else "Please check the form."
        return JSONResponse(_body(detail, errors), status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException):
        return JSONResponse(_body(str(exc.detail)), status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def unexpected(_: Request, exc: Exception):
        log.exception("Unhandled error (trace %s)", trace_id_var.get())
        return JSONResponse(_body("Something went wrong. Please try again."), status_code=500)
