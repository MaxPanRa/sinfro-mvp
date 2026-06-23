"""Schedulers that run inside the worker container."""

from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select

from worker.config import settings
from worker.db import (
    GMAIL_SEND_SCOPE,
    GLOBAL_POOL_EMAIL,
    OAuthAccount,
    SessionLocal,
    User,
    build_scan_summary,
    decrypt_secret,
    encrypt_secret,
    reap_stale_runs,
    refresh_google_access_token,
    run_global_sync_cycle,
    send_self_summary,
)

_scheduler: BackgroundScheduler | None = None


def _gmail_access_token(db, account: OAuthAccount) -> str:
    if account.encrypted_refresh_token and settings.google_client_id and settings.google_client_secret:
        token = refresh_google_access_token(decrypt_secret(account.encrypted_refresh_token))
        account.encrypted_access_token = encrypt_secret(token)
        db.commit()
        return token
    if account.encrypted_access_token:
        return decrypt_secret(account.encrypted_access_token)
    return ""


def run_digests() -> None:
    """Send the legacy periodic digest from each connected Gmail account."""
    if not settings.digest_enabled:
        return

    minutes = settings.digest_interval_minutes
    with SessionLocal() as db:
        pool = db.scalar(select(User).where(User.email == GLOBAL_POOL_EMAIL))
        pool_id = pool.id if pool else None
        accounts = db.scalars(select(OAuthAccount).where(OAuthAccount.provider == "google")).all()

        sent = 0
        for account in accounts:
            if GMAIL_SEND_SCOPE not in (account.scopes or []):
                continue
            user = db.get(User, account.user_id)
            if not user or user.is_demo:
                continue

            owner_ids = [user.id] + ([pool_id] if pool_id else [])
            summary = build_scan_summary(db, owner_ids, minutes)
            if summary["new_total"] <= 0:
                continue

            recipient = account.email or user.email
            if not recipient:
                continue
            try:
                token = _gmail_access_token(db, account)
                if not token:
                    continue
                send_self_summary(token, recipient, summary)
                sent += 1
            except Exception as exc:  # noqa: BLE001
                print(f"digest Gmail to {recipient} failed: {exc}")
        print(f"digest: sent to {sent} user(s) via Gmail")


def start_scheduler() -> None:
    """Start background schedulers next to the Redis queue consumer.

    El envío de correo periódico va DENTRO del escaneo global periódico
    (``run_global_sync_cycle``): si ``GLOBAL_SYNC_ENABLED`` está activo, también
    se mandan los resúmenes por correo (al correo de cada perfil). El escaneo
    manual igual manda correo, sin depender de ninguna variable de entorno.
    """
    global _scheduler
    _scheduler = BackgroundScheduler(timezone="UTC")

    # Reaper periódico: cierra corridas 'running' huérfanas aunque el worker no se
    # reinicie (corre en el hilo del scheduler, independiente del consumidor de la cola).
    _scheduler.add_job(
        reap_stale_runs,
        trigger="interval",
        minutes=10,
        id="reap_stale_runs",
        max_instances=1,
        coalesce=True,
    )

    if settings.global_sync_enabled:
        if not (settings.google_client_id and settings.google_client_secret):
            print("gmail: missing Google credentials; token refresh may fail")
        _scheduler.add_job(
            run_global_sync_cycle,
            trigger="interval",
            minutes=settings.global_sync_interval_minutes,
            id="global_sync",
            max_instances=1,
            coalesce=True,
            next_run_time=datetime.now(timezone.utc),
        )
        print(f"global sync + email: scheduler active every {settings.global_sync_interval_minutes} min")
    else:
        print("global sync: scheduler disabled (GLOBAL_SYNC_ENABLED=false); manual scans still email")

    _scheduler.start()
