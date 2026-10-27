"""Document storage in a private S3-compatible bucket (Backblaze B2 in use). Files never pass through the API:
the browser uploads to, and downloads from, short-lived presigned URLs."""

import asyncio
import socket
import struct

from app.config import get_settings
from app.core.errors import ApiError

ALLOWED_TYPES = {"application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png"}
MAGIC = {"application/pdf": [b"%PDF"], "image/png": [b"\x89PNG"], "image/jpeg": [b"\xff\xd8\xff"]}


def object_key(student_id: str, document_id: str, upload_id: str, content_type: str) -> str:
    return f"students/{student_id}/documents/{document_id}/{upload_id}.{ALLOWED_TYPES[content_type]}"


def matches_magic(content_type: str, head: bytes) -> bool:
    return any(head.startswith(m) for m in MAGIC.get(content_type, []))


def is_configured() -> bool:
    s = get_settings()
    return bool(s.s3_bucket and s.s3_access_key_id and s.s3_secret_access_key)


def _s3():
    import boto3
    from botocore.config import Config

    s = get_settings()
    if not is_configured():
        raise ApiError(503, "Document storage isn't set up yet. Please try again later.")
    return boto3.client(
        "s3",
        endpoint_url=s.s3_endpoint or None,
        region_name=s.s3_region,
        aws_access_key_id=s.s3_access_key_id,
        aws_secret_access_key=s.s3_secret_access_key,
        config=Config(signature_version="s3v4"),  # Backblaze B2 and other S3-compatible stores only accept SigV4
    )


def upload_url(key: str, content_type: str, size: int) -> dict:
    url = _s3().generate_presigned_url(
        "put_object",
        Params={"Bucket": get_settings().s3_bucket, "Key": key, "ContentType": content_type, "ContentLength": size, "ServerSideEncryption": "AES256"},
        ExpiresIn=600,
    )
    return {"url": url, "method": "PUT", "headers": {"Content-Type": content_type, "x-amz-server-side-encryption": "AES256"}}


def download_url(key: str, content_type: str, filename: str, inline: bool = True) -> str:
    disposition = f'{"inline" if inline else "attachment"}; filename="{filename}"'
    return _s3().generate_presigned_url(
        "get_object",
        Params={"Bucket": get_settings().s3_bucket, "Key": key, "ResponseContentDisposition": disposition, "ResponseContentType": content_type},
        ExpiresIn=300,
    )


async def put(key: str, data: bytes, content_type: str) -> None:
    """Stores a file from the server itself (e.g. the demo documents)."""
    await asyncio.to_thread(
        lambda: _s3().put_object(Bucket=get_settings().s3_bucket, Key=key, Body=data, ContentType=content_type, ServerSideEncryption="AES256")
    )


async def head(key: str, nbytes: int = 8) -> tuple[int, bytes] | None:
    """Size and first bytes of a stored object (None if it doesn't exist)."""
    bucket = get_settings().s3_bucket

    def _get():
        c = _s3()
        try:
            meta = c.head_object(Bucket=bucket, Key=key)
        except Exception:  # noqa: BLE001 - missing object or no access
            return None
        body = c.get_object(Bucket=bucket, Key=key, Range=f"bytes=0-{nbytes - 1}")["Body"].read()
        return meta["ContentLength"], body

    return await asyncio.to_thread(_get)


async def read_all(key: str) -> bytes:
    return await asyncio.to_thread(lambda: _s3().get_object(Bucket=get_settings().s3_bucket, Key=key)["Body"].read())


async def delete(key: str) -> None:
    await asyncio.to_thread(lambda: _s3().delete_object(Bucket=get_settings().s3_bucket, Key=key))


# ---------------------------------------------------------------- malware scanning


async def scan(key: str) -> str:
    """Returns 'clean' or 'infected'. Without a ClamAV host (development) every file is treated as clean."""
    s = get_settings()
    if not s.clamav_host:
        return "clean"
    data = await read_all(key)

    def _scan() -> str:
        with socket.create_connection((s.clamav_host, s.clamav_port), timeout=30) as sock:
            sock.sendall(b"zINSTREAM\0")
            for i in range(0, len(data), 8192):
                chunk = data[i : i + 8192]
                sock.sendall(struct.pack("!L", len(chunk)) + chunk)
            sock.sendall(struct.pack("!L", 0))
            reply = sock.recv(4096).decode(errors="ignore")
        return "infected" if "FOUND" in reply else "clean"

    return await asyncio.to_thread(_scan)
