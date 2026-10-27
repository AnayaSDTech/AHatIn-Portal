"""Development file storage behind signed URLs (production uses presigned S3 URLs instead)."""

from fastapi import APIRouter, Request, Response

from app.config import get_settings
from app.core.errors import ApiError
from app.services import storage

router = APIRouter(prefix="/files", tags=["files"])


@router.put("/upload/{token}", status_code=204)
async def upload(token: str, request: Request):
    data = storage.read_token(token, "up")
    if not data or get_settings().storage_backend != "local":
        raise ApiError(403, "This upload link has expired. Please try again.")
    if request.headers.get("content-type", "").split(";")[0] != data["ct"]:
        raise ApiError(400, "The file type doesn't match.")
    body = b""
    async for chunk in request.stream():
        body += chunk
        if len(body) > min(data["size"], get_settings().max_upload_bytes):
            raise ApiError(413, "Files must be 10 MB or smaller.")
    storage.write_local(data["key"], body)
    return Response(status_code=204)


@router.get("/download/{token}")
async def download(token: str):
    data = storage.read_token(token, "down")
    if not data or get_settings().storage_backend != "local":
        raise ApiError(403, "This link has expired. Open the document again.")
    try:
        content = storage.read_local(data["key"])
    except FileNotFoundError:
        raise ApiError(404, "File not found.") from None
    return Response(
        content,
        media_type=data["ct"],
        headers={"Content-Disposition": "inline", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"},
    )
