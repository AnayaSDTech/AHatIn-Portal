import base64
import hashlib
import hmac
import secrets

import pyotp
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from cryptography.fernet import Fernet

from app.config import get_settings

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        # Spend the same time as a real check, so unknown emails can't be detected by timing.
        _hasher.hash(password)
        return False
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def random_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def otp_hash(email: str, code: str) -> str:
    """One-time codes are stored only as an HMAC (keyed with a server-side pepper)."""
    return hmac.new(get_settings().otp_pepper.encode(), f"{email}:{code}".encode(), hashlib.sha256).hexdigest()


def random_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _fernet() -> Fernet:
    s = get_settings()
    if s.field_encryption_key:
        return Fernet(s.field_encryption_key.encode())
    # Development only: a key derived from the session secret, so encrypted values survive restarts.
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(s.session_secret.encode()).digest()))


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    return _fernet().decrypt(value.encode()).decode()


def new_totp_secret() -> str:
    return pyotp.random_base32()


def totp_matches(secret: str, code: str, last_step: int | None) -> int | None:
    """Checks a 6-digit authenticator code (current or previous 30 s window). Returns the matched step, or None.
    A code that was already used (same or earlier step) is refused."""
    totp = pyotp.TOTP(secret)
    import time

    step_now = int(time.time()) // 30
    for step in (step_now, step_now - 1):
        if last_step is not None and step <= last_step:
            continue
        if hmac.compare_digest(totp.at(step * 30), code):
            return step
    return None


def totp_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=get_settings().totp_issuer)


def sign(value: str) -> str:
    mac = hmac.new(get_settings().session_secret.encode(), value.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(mac).decode().rstrip("=")


def signed_token(payload: str) -> str:
    return f"{payload}.{sign(payload)}"


def unsign(token: str) -> str | None:
    payload, _, mac = token.rpartition(".")
    if payload and hmac.compare_digest(sign(payload), mac):
        return payload
    return None
