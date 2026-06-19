import base64
from email.message import EmailMessage
import hashlib
import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from cryptography.fernet import Fernet
from sqlalchemy import JSON, ForeignKey, Integer, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from worker.config import settings


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255))


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    provider: Mapped[str] = mapped_column(String(60))
    provider_user_id: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255))
    encrypted_access_token: Mapped[str | None] = mapped_column(Text)
    encrypted_refresh_token: Mapped[str | None] = mapped_column(Text)
    scopes: Mapped[list[str]] = mapped_column(JSON)


class JobPosting(Base):
    __tablename__ = "job_postings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(255))
    company: Mapped[str] = mapped_column(String(255))
    source: Mapped[str] = mapped_column(String(120))
    modality: Mapped[str] = mapped_column(String(80))
    location: Mapped[str] = mapped_column(String(120))
    score: Mapped[int] = mapped_column(Integer)
    score_type: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(40))
    detected: Mapped[str] = mapped_column(String(80))
    salary: Mapped[str] = mapped_column(String(120))
    skills: Mapped[list[str]] = mapped_column(JSON)


class JobRun(Base):
    __tablename__ = "job_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    source: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(40))
    found: Mapped[str] = mapped_column(String(40))
    duration: Mapped[str] = mapped_column(String(40))
    started: Mapped[str] = mapped_column(String(80))
    error: Mapped[str | None] = mapped_column(String(255))


engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.app_secret_key.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def decrypt_secret(value: str) -> str:
    return _fernet().decrypt(value.encode("utf-8")).decode("utf-8")


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def refresh_google_access_token(refresh_token: str) -> str:
    payload = urlencode(
        {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
    ).encode("utf-8")
    request = Request("https://oauth2.googleapis.com/token", data=payload, method="POST")
    request.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urlopen(request, timeout=20) as response:
        data = json.loads(response.read().decode("utf-8"))
    return str(data["access_token"])


def send_self_summary(access_token: str, to_email: str, found: str, title: str) -> None:
    message = EmailMessage()
    message["To"] = to_email
    message["From"] = to_email
    message["Subject"] = "Resumen de escaneo SinFro"
    message.set_content(
        "\n".join(
            [
                "Tu escaneo manual de SinFro termino.",
                "",
                f"Vacantes nuevas detectadas: {found}",
                f"Ejemplo destacado: {title}",
                "",
                "Este correo se envio desde tu propia cuenta Gmail conectada a SinFro.",
            ]
        )
    )
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    payload = json.dumps({"raw": raw}).encode("utf-8")
    request = Request("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", data=payload, method="POST")
    request.add_header("Authorization", f"Bearer {access_token}")
    request.add_header("Content-Type", "application/json")
    with urlopen(request, timeout=20) as response:
        response.read()


def process_sync_job(run_id: int, user_id: int, target_user_id: int | None = None, job_family: str = "software") -> None:
    with SessionLocal() as db:
        run = db.scalar(select(JobRun).where(JobRun.id == run_id, JobRun.user_id == user_id))
        if not run:
            return
        owner_id = target_user_id or user_id
        title = "Mock Sync Frontend Engineer" if job_family == "software" else f"Mock Sync {job_family.title()} Role"
        company = "SinFro Worker"
        source = "Manual scan"
        posting = db.scalar(
            select(JobPosting).where(
                JobPosting.user_id == owner_id,
                JobPosting.title == title,
                JobPosting.company == company,
                JobPosting.source == source,
            )
        )
        if not posting:
            posting = JobPosting(
                user_id=owner_id,
                title=title,
                company=company,
                source=source,
                modality="Remoto",
                location="LATAM",
                score=87,
                score_type="IA",
                status="nueva",
                detected="ahora",
                salary="",
                skills=["React", "FastAPI", "Redis"],
            )
            db.add(posting)
        run.status = "success"
        run.found = "1"
        run.duration = "00:07"
        db.commit()
        user = db.get(User, user_id)
        account = db.scalar(select(OAuthAccount).where(OAuthAccount.user_id == user_id, OAuthAccount.provider == "google"))
        if not user or not account or GMAIL_SEND_SCOPE not in (account.scopes or []):
            return
        try:
            access_token = decrypt_secret(account.encrypted_access_token) if account.encrypted_access_token else ""
            if account.encrypted_refresh_token and settings.google_client_id and settings.google_client_secret:
                access_token = refresh_google_access_token(decrypt_secret(account.encrypted_refresh_token))
                account.encrypted_access_token = encrypt_secret(access_token)
                db.commit()
            if access_token:
                send_self_summary(access_token, user.email, run.found, title)
        except Exception as exc:
            print(f"gmail summary skipped: {exc}")
