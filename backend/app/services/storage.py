"""Document storage. Files never pass through business endpoints: the browser uploads to and downloads
from a short-lived signed URL. Development stores files on disk behind signed API URLs; production uses
a private S3-compatible bucket with presigned URLs."""

import asyncio
import json
import socket
import struct
import time
from pathlib import Path

from app.config import get_settings
from app.core.security import signed_token, unsign

ALLOWED_TYPES = {"application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png"}
MAGIC = {"application/pdf": [b"%PDF"], "image/png": [b"\x89PNG"], "image/jpeg": [b"\xff\xd8\xff"]}


def object_key(student_id: str, document_id: str, upload_id: str, content_type: str) -> str:
    return f"students/{student_id}/documents/{document_id}/{upload_id}.{ALLOWED_TYPES[content_type]}"


def matches_magic(content_type: str, head: bytes) -> bool:
    return any(head.startswith(m) for m in MAGIC.get(content_type, []))


# ---------------------------------------------------------------- local (development)


def _local_path(key: str) -> Path:
    base = Path(get_settings().local_storage_dir).resolve()
    path = (base / key).resolve()
    if base not in path.parents:
        raise ValueError("Invalid key")
    return path


def _token(kind: str, key: str, content_type: str, ttl: int, size: int = 0) -> str:
    payload = json.dumps({"k": kind, "key": key, "ct": content_type, "exp": int(time.time()) + ttl, "size": size}, separators=(",", ":"))
    import base64

    return signed_token(base64.urlsafe_b64encode(payload.encode()).decode())


def read_token(token: str, kind: str) -> dict | None:
    import base64

    payload = unsign(token)
    if not payload:
        return None
    data = json.loads(base64.urlsafe_b64decode(payload.encode()))
    if data.get("k") != kind or data["exp"] < time.time():
        return None
    return data


def _s3():
    import boto3
    from botocore.config import Config

    s = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=s.s3_endpoint or None,
        region_name=s.s3_region,
        aws_access_key_id=s.s3_access_key_id or None,
        aws_secret_access_key=s.s3_secret_access_key or None,
        config=Config(signature_version="s3v4"),  # Backblaze B2 and other S3-compatible stores only accept SigV4
    )


def upload_url(key: str, content_type: str, size: int) -> dict:
    s = get_settings()
    if s.storage_backend == "s3":
        url = _s3().generate_presigned_url(
            "put_object",
            Params={"Bucket": s.s3_bucket, "Key": key, "ContentType": content_type, "ContentLength": size, "ServerSideEncryption": "AES256"},
            ExpiresIn=600,
        )
        return {"url": url, "method": "PUT", "headers": {"Content-Type": content_type, "x-amz-server-side-encryption": "AES256"}}
    return {"url": f"/api/v1/files/upload/{_token('up', key, content_type, 600, size)}", "method": "PUT", "headers": {"Content-Type": content_type}}


def download_url(key: str, content_type: str, filename: str, inline: bool = True) -> str:
    s = get_settings()
    if s.storage_backend == "s3":
        disposition = f'{"inline" if inline else "attachment"}; filename="{filename}"'
        return _s3().generate_presigned_url(
            "get_object", Params={"Bucket": s.s3_bucket, "Key": key, "ResponseContentDisposition": disposition, "ResponseContentType": content_type}, ExpiresIn=300
        )
    return f"/api/v1/files/download/{_token('down', key, content_type, 300)}"


def write_local(key: str, data: bytes) -> None:
    path = _local_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def read_local(key: str) -> bytes:
    return _local_path(key).read_bytes()


async def head(key: str, nbytes: int = 8) -> tuple[int, bytes] | None:
    """Size and first bytes of a stored object (None if it doesn't exist)."""
    s = get_settings()
    if s.storage_backend == "s3":

        def _get():
            c = _s3()
            try:
                meta = c.head_object(Bucket=s.s3_bucket, Key=key)
            except Exception:  # noqa: BLE001
                return None
            body = c.get_object(Bucket=s.s3_bucket, Key=key, Range=f"bytes=0-{nbytes - 1}")["Body"].read()
            return meta["ContentLength"], body

        return await asyncio.to_thread(_get)
    path = _local_path(key)
    if not path.exists():
        return None
    with path.open("rb") as f:
        return path.stat().st_size, f.read(nbytes)


async def read_all(key: str) -> bytes:
    s = get_settings()
    if s.storage_backend == "s3":
        return await asyncio.to_thread(lambda: _s3().get_object(Bucket=s.s3_bucket, Key=key)["Body"].read())
    return read_local(key)


async def delete(key: str) -> None:
    s = get_settings()
    if s.storage_backend == "s3":
        await asyncio.to_thread(lambda: _s3().delete_object(Bucket=s.s3_bucket, Key=key))
        return
    path = _local_path(key)
    if path.exists():
        path.unlink()


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
