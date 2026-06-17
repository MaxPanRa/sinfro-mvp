import base64
import hashlib

from cryptography.fernet import Fernet

from app.core.config import settings


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.app_secret_key.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def mask_secret(value: str) -> str:
    suffix = value[-4:] if value else "demo"
    if value.startswith("sk-ant"):
        return f"sk-ant-····{suffix}"
    if value.startswith("sk-"):
        return f"sk-····{suffix}"
    if value.startswith("apify"):
        return f"apify_····{suffix}"
    return f"····{suffix}"
