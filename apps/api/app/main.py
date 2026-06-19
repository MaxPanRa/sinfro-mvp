import json
import secrets
from datetime import datetime, timedelta, time, timezone
from typing import Annotated
from urllib.parse import urlencode
from urllib.request import urlopen

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from redis import Redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.email import send_verification_email, smtp_configured
from app.core.google import GMAIL_SEND_SCOPE, build_google_auth_url, exchange_code, get_google_userinfo
from app.core.security import create_access_token, encrypt_secret, hash_password, hash_token, mask_secret, read_access_token, verify_password
from app.db.redis import get_redis
from app.db.session import SessionLocal, get_db
from app.models import ApiCredential, JobPosting, JobRun, OAuthAccount, PendingRegistration, Profile, SubscriptionPlan, User, UserSubscription, UserTheme
from app.schemas import ConfirmEmailIn, CredentialIn, CredentialOut, CredentialTestIn, GmailStatusOut, GoogleAuthStartOut, LoginIn, PlanOut, RegisterIn, RegisterStartOut, SubscriptionOut, ThemeIn, ThemeOut, TokenOut, UserOut
from app.seed import GLOBAL_POOL_EMAIL, seed_demo_data, seed_dev_data

app = FastAPI(title=settings.project_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.public_web_url, "http://localhost:5173", "http://127.0.0.1:5173","http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DbDep = Annotated[Session, Depends(get_db)]
RedisDep = Annotated[Redis, Depends(get_redis)]

PROVIDERS = {
    "gmail": ("Correo", "Gmail", "GM", "#EA4335"),
    "whatsapp": ("Correo", "WhatsApp / CallMeBot", "WA", "#25D366"),
    "openai": ("Modelos de IA", "OpenAI", "AI", "var(--accent)"),
    "anthropic": ("Modelos de IA", "Claude / Anthropic", "CL", "#F2B84B"),
    "gemini": ("Modelos de IA", "Gemini", "GE", "#4EA7F5"),
    "opencode-go": ("Modelos de IA", "OpenCode Go", "OC", "var(--text2)"),
    "serpapi": ("Busqueda & scraping", "SerpAPI", "SE", "#4EA7F5"),
    "apify": ("Busqueda & scraping", "Apify", "AP", "var(--accent)"),
    "adzuna": ("Bolsas de empleo", "Adzuna", "AD", "var(--accent)"),
    "jooble": ("Bolsas de empleo", "Jooble", "JO", "#E5484D"),
}


@app.on_event("startup")
def startup() -> None:
    with SessionLocal() as db:
        seed_dev_data(db)


def current_user(db: DbDep, authorization: Annotated[str | None, Header()] = None) -> User:
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        user_id = read_access_token(token)
        if user_id:
            user = db.get(User, user_id)
            if user and user.email_verified_at:
                return user
    raise HTTPException(status_code=401, detail="Authentication required")


def global_pool_user(db: Session) -> User:
    user = db.scalar(select(User).where(User.email == GLOBAL_POOL_EMAIL))
    if not user:
        seed_demo_data(db)
        user = db.scalar(select(User).where(User.email == GLOBAL_POOL_EMAIL))
    if not user:
        raise HTTPException(status_code=500, detail="Global pool user not available")
    return user


@app.get("/health")
def health(db: DbDep, redis: RedisDep) -> dict:
    db.execute(select(1))
    redis.ping()
    return {"status": "ok", "service": "api"}


@app.post("/auth/demo-login", response_model=TokenOut)
def demo_login(db: DbDep) -> TokenOut:
    user = db.scalar(select(User).where(User.email == "demo@sinfro.local"))
    if not user:
        user = seed_dev_data(db)
    user.email_verified_at = user.email_verified_at or datetime.now(timezone.utc)
    user.onboarding_completed = True
    db.commit()
    db.refresh(user)
    return TokenOut(accessToken=create_access_token(user.id), user=user)


@app.post("/auth/register", response_model=RegisterStartOut)
def register(payload: RegisterIn, db: DbDep) -> RegisterStartOut:
    email = payload.email.strip().lower()
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Email already registered")
    token = secrets.token_urlsafe(32)
    pending = db.scalar(select(PendingRegistration).where(PendingRegistration.email == email))
    if not pending:
        pending = PendingRegistration(email=email, name="", password_hash="", token_hash="", expires_at=datetime.now(timezone.utc))
        db.add(pending)
    pending.name = payload.name.strip() or email.split("@")[0]
    pending.password_hash = hash_password(payload.password)
    pending.token_hash = hash_token(token)
    pending.expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    db.commit()
    verification_url = f"{settings.public_web_url.rstrip('/')}/?verifyEmail={token}"
    try:
        email_sent = send_verification_email(email, pending.name, verification_url)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not send verification email") from exc
    dev_url = verification_url if settings.environment == "local" and not smtp_configured() else None
    message = "Te mandamos una liga para confirmar tu cuenta."
    if not email_sent and settings.environment == "local":
        message = "SMTP no esta configurado localmente; usa la liga dev para confirmar."
    return RegisterStartOut(ok=True, email=email, message=message, devVerificationUrl=dev_url)


@app.post("/auth/confirm-email", response_model=TokenOut)
def confirm_email(payload: ConfirmEmailIn, db: DbDep) -> TokenOut:
    pending = db.scalar(select(PendingRegistration).where(PendingRegistration.token_hash == hash_token(payload.token)))
    if not pending:
        raise HTTPException(status_code=404, detail="Verification token not found")
    if pending.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Verification token expired")
    existing = db.scalar(select(User).where(User.email == pending.email))
    if existing:
        db.delete(pending)
        db.commit()
        return TokenOut(accessToken=create_access_token(existing.id), user=existing)
    user = User(
        email=pending.email,
        name=pending.name,
        password_hash=pending.password_hash,
        is_demo=False,
        email_verified_at=datetime.now(timezone.utc),
        onboarding_completed=False,
    )
    db.add(user)
    db.flush()
    db.add(UserTheme(user_id=user.id, theme="esmeralda", accent="#10A37F", density="comoda"))
    free_plan = db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == "free"))
    if not free_plan:
        seed_demo_data(db)
        free_plan = db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == "free"))
    db.add(UserSubscription(user_id=user.id, plan_id=free_plan.id, status="active"))
    db.delete(pending)
    db.commit()
    db.refresh(user)
    return TokenOut(accessToken=create_access_token(user.id), user=user)


@app.post("/auth/login", response_model=TokenOut)
def login(payload: LoginIn, db: DbDep) -> TokenOut:
    user = db.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.email_verified_at:
        raise HTTPException(status_code=403, detail="Email not verified")
    return TokenOut(accessToken=create_access_token(user.id), user=user)


@app.get("/auth/google/start", response_model=GoogleAuthStartOut)
def google_start(user: Annotated[User, Depends(current_user)]) -> GoogleAuthStartOut:
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured")
    state = create_access_token(user.id)
    return GoogleAuthStartOut(authUrl=build_google_auth_url(state), redirectUri=settings.google_redirect_uri)


@app.get("/auth/google/callback")
def google_callback(code: Annotated[str | None, Query()] = None, state: Annotated[str | None, Query()] = None, error: Annotated[str | None, Query()] = None, db: Session = Depends(get_db)) -> RedirectResponse:
    if error:
        return RedirectResponse(f"{settings.public_web_url.rstrip('/')}/?gmail=error")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing Google OAuth code/state")
    user_id = read_access_token(state)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid OAuth state")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    token_data = exchange_code(code)
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    scopes = token_data.get("scope", "").split()
    if not access_token:
        raise HTTPException(status_code=502, detail="Google did not return an access token")
    google_user = get_google_userinfo(access_token)
    account = db.scalar(select(OAuthAccount).where(OAuthAccount.user_id == user.id, OAuthAccount.provider == "google"))
    if not account:
        account = OAuthAccount(user_id=user.id, provider="google", provider_user_id=str(google_user.get("id") or google_user.get("email") or user.id), email=google_user.get("email") or user.email)
        db.add(account)
    account.provider_user_id = str(google_user.get("id") or google_user.get("email") or account.provider_user_id)
    account.email = google_user.get("email") or user.email
    account.encrypted_access_token = encrypt_secret(access_token)
    if refresh_token:
        account.encrypted_refresh_token = encrypt_secret(refresh_token)
    account.scopes = scopes
    account.connected_at = datetime.now(timezone.utc)
    db.commit()
    return RedirectResponse(f"{settings.public_web_url.rstrip('/')}/?gmail=connected")


@app.get("/me", response_model=UserOut)
def me(user: Annotated[User, Depends(current_user)]) -> User:
    return user


@app.get("/me/theme", response_model=ThemeOut)
def get_theme(db: DbDep, user: Annotated[User, Depends(current_user)]) -> ThemeOut:
    theme = db.scalar(select(UserTheme).where(UserTheme.user_id == user.id))
    if not theme:
        theme = UserTheme(user_id=user.id, theme="esmeralda", accent="#10A37F", density="comoda")
        db.add(theme)
        db.commit()
    return ThemeOut(theme=theme.theme, accent=theme.accent, density=theme.density)


@app.put("/me/theme", response_model=ThemeOut)
def update_theme(payload: ThemeIn, db: DbDep, user: Annotated[User, Depends(current_user)]) -> ThemeOut:
    theme = db.scalar(select(UserTheme).where(UserTheme.user_id == user.id))
    if not theme:
        theme = UserTheme(user_id=user.id)
        db.add(theme)
    theme.theme = payload.theme
    theme.accent = payload.accent
    theme.density = payload.density
    db.commit()
    return ThemeOut(theme=theme.theme, accent=theme.accent, density=theme.density)


@app.post("/me/onboarding", response_model=ThemeOut)
def complete_onboarding(payload: ThemeIn, db: DbDep, user: Annotated[User, Depends(current_user)]) -> ThemeOut:
    theme = update_theme(payload, db, user)
    user.onboarding_completed = True
    db.commit()
    return theme


@app.get("/integrations/gmail", response_model=GmailStatusOut)
def gmail_status(db: DbDep, user: Annotated[User, Depends(current_user)]) -> GmailStatusOut:
    account = db.scalar(select(OAuthAccount).where(OAuthAccount.user_id == user.id, OAuthAccount.provider == "google"))
    if not account:
        return GmailStatusOut(connected=False)
    scopes = account.scopes or []
    return GmailStatusOut(connected=True, email=account.email, canSendSelfSummaries=GMAIL_SEND_SCOPE in scopes)


@app.get("/subscription/plans", response_model=list[PlanOut])
def plans(db: DbDep) -> list[PlanOut]:
    rows = db.scalars(select(SubscriptionPlan).order_by(SubscriptionPlan.id)).all()
    return [PlanOut(id=row.id, code=row.code, name=row.name, priceLabel=row.price_label, description=row.description, features=row.features, limits=row.limits or {}) for row in rows]


@app.get("/subscription/current", response_model=SubscriptionOut)
def current_subscription(db: DbDep, user: Annotated[User, Depends(current_user)]) -> SubscriptionOut:
    sub = db.scalar(select(UserSubscription).where(UserSubscription.user_id == user.id))
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    plan = PlanOut(id=sub.plan.id, code=sub.plan.code, name=sub.plan.name, priceLabel=sub.plan.price_label, description=sub.plan.description, features=sub.plan.features, limits=sub.plan.limits or {})
    return SubscriptionOut(status=sub.status, plan=plan)


@app.get("/profiles")
def profiles(db: DbDep, user: Annotated[User, Depends(current_user)]) -> list[dict]:
    rows = db.scalars(select(Profile).where(Profile.user_id == user.id).order_by(Profile.id)).all()
    return [{
        "id": row.id,
        "initials": row.initials,
        "name": row.name,
        "role": row.role,
        "email": row.email,
        "english": row.english,
        "location": row.location,
        "modality": row.modality,
        "salary": row.salary,
        "cvStatus": row.cv_status,
        "description": row.description,
        "keywords": row.keywords,
        "skills": row.skills,
    } for row in rows]


@app.get("/jobs")
def jobs(db: DbDep, user: Annotated[User, Depends(current_user)]) -> list[dict]:
    pool_user = global_pool_user(db)
    rows = db.scalars(select(JobPosting).where(JobPosting.user_id.in_([pool_user.id, user.id])).order_by(JobPosting.score.desc())).all()
    return [job_to_dict(row) for row in rows]


@app.get("/jobs/{job_id}")
def job_detail(job_id: int, db: DbDep, user: Annotated[User, Depends(current_user)]) -> dict:
    pool_user = global_pool_user(db)
    job = db.scalar(select(JobPosting).where(JobPosting.id == job_id, JobPosting.user_id.in_([pool_user.id, user.id])))
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job_to_dict(job)


@app.get("/credentials", response_model=list[CredentialOut])
def credentials(db: DbDep, user: Annotated[User, Depends(current_user)]) -> list[CredentialOut]:
    saved = {row.provider: row for row in db.scalars(select(ApiCredential).where(ApiCredential.user_id == user.id)).all()}
    gmail = db.scalar(select(OAuthAccount).where(OAuthAccount.user_id == user.id, OAuthAccount.provider == "google"))
    result = []
    for provider_id, meta in PROVIDERS.items():
        if provider_id == "gmail":
            connected = bool(gmail and GMAIL_SEND_SCOPE in (gmail.scopes or []))
            result.append(CredentialOut(id=provider_id, group=meta[0], name=meta[1], glyph=meta[2], iconColor=meta[3], status="connected" if connected else "disconnected", maskedKey=gmail.email if gmail else "sin Google conectado", lastTest="gmail.send activo" if connected else "requiere permiso Gmail"))
            continue
        if provider_id == "whatsapp" and provider_id not in saved:
            result.append(CredentialOut(id=provider_id, group=meta[0], name=meta[1], glyph=meta[2], iconColor=meta[3], status="disconnected", maskedKey="sin WhatsApp conectado", lastTest="requiere prueba"))
            continue
        row = saved.get(provider_id)
        result.append(CredentialOut(id=provider_id, group=meta[0], name=meta[1], glyph=meta[2], iconColor=meta[3], status="connected" if row else "disconnected", maskedKey=row.masked_value if row else "— sin credencial —", lastTest=row.last_test if row and row.last_test else "nunca probado"))
    return result


@app.post("/credentials", response_model=CredentialOut)
def save_credential(payload: CredentialIn, db: DbDep, user: Annotated[User, Depends(current_user)]) -> CredentialOut:
    if payload.providerId not in PROVIDERS:
        raise HTTPException(status_code=404, detail="Unknown provider")
    if payload.providerId == "gmail":
        raise HTTPException(status_code=400, detail="Use Google OAuth to connect Gmail")
    if payload.providerId == "whatsapp":
        whatsapp = normalize_whatsapp_payload(payload.phoneCode, payload.phoneNumber, payload.apiKey)
        row = db.scalar(select(ApiCredential).where(ApiCredential.user_id == user.id, ApiCredential.provider == payload.providerId))
        if not row:
            row = ApiCredential(user_id=user.id, provider=payload.providerId, encrypted_value="", masked_value="")
            db.add(row)
        row.encrypted_value = encrypt_secret(json.dumps(whatsapp))
        row.masked_value = mask_whatsapp(whatsapp["phone_number"], whatsapp["api_key"])
        row.last_test = "guardado ahora"
        db.commit()
        meta = PROVIDERS[payload.providerId]
        return CredentialOut(id=payload.providerId, group=meta[0], name=meta[1], glyph=meta[2], iconColor=meta[3], status="connected", maskedKey=row.masked_value, lastTest=row.last_test)
    row = db.scalar(select(ApiCredential).where(ApiCredential.user_id == user.id, ApiCredential.provider == payload.providerId))
    if not row:
        row = ApiCredential(user_id=user.id, provider=payload.providerId, encrypted_value="", masked_value="")
        db.add(row)
    row.encrypted_value = encrypt_secret(payload.apiKey)
    row.masked_value = mask_secret(payload.apiKey)
    row.last_test = "test ahora"
    db.commit()
    meta = PROVIDERS[payload.providerId]
    return CredentialOut(id=payload.providerId, group=meta[0], name=meta[1], glyph=meta[2], iconColor=meta[3], status="connected", maskedKey=row.masked_value, lastTest=row.last_test)


@app.post("/credentials/{provider_id}/test")
def test_credential(provider_id: str, payload: CredentialTestIn | None = None) -> dict:
    if provider_id not in PROVIDERS:
        raise HTTPException(status_code=404, detail="Unknown provider")
    if provider_id == "gmail":
        return {"ok": True, "providerId": provider_id, "message": "Use Google OAuth to test Gmail permissions"}
    if provider_id == "whatsapp":
        if not payload:
            raise HTTPException(status_code=400, detail="WhatsApp phone and API key are required")
        whatsapp = normalize_whatsapp_payload(payload.phoneCode, payload.phoneNumber, payload.apiKey)
        test_callmebot(whatsapp["full_phone"], whatsapp["api_key"])
        return {"ok": True, "providerId": provider_id, "message": "WhatsApp test sent", "maskedKey": mask_whatsapp(whatsapp["phone_number"], whatsapp["api_key"])}
    return {"ok": True, "providerId": provider_id, "message": "Placeholder credential test passed"}


@app.get("/sync/runs")
def sync_runs(db: DbDep, user: Annotated[User, Depends(current_user)]) -> list[dict]:
    rows = db.scalars(select(JobRun).where(JobRun.user_id == user.id).order_by(JobRun.id.desc())).all()
    return [{"id": row.id, "source": row.source, "status": row.status, "found": int(row.found) if row.found.isdigit() else "—", "duration": row.duration, "started": row.started, "error": row.error} for row in rows]


@app.post("/sync/run")
def run_sync(db: DbDep, redis: RedisDep, user: Annotated[User, Depends(current_user)]) -> dict:
    subscription = db.scalar(select(UserSubscription).where(UserSubscription.user_id == user.id))
    limits = subscription.plan.limits if subscription and subscription.plan and subscription.plan.limits else {}
    daily_limit = int(limits.get("manual_refresh_per_day", 5))
    today_start = datetime.combine(datetime.now(timezone.utc).date(), time.min, tzinfo=timezone.utc)
    used_today = db.scalars(
        select(JobRun).where(
            JobRun.user_id == user.id,
            JobRun.source == "Manual scan",
            JobRun.created_at >= today_start,
        )
    ).all()
    if len(used_today) >= daily_limit:
        raise HTTPException(status_code=429, detail=f"Manual refresh limit reached ({daily_limit}/day)")

    run = JobRun(user_id=user.id, source="Manual scan", status="running", found="—", duration="00:00", started="ahora")
    db.add(run)
    db.commit()
    db.refresh(run)
    pool_user = global_pool_user(db)
    redis.lpush("sync_jobs", json.dumps({"run_id": run.id, "user_id": user.id, "target_user_id": pool_user.id, "job_family": "software"}))
    return {"id": run.id, "source": run.source, "status": run.status, "found": "—", "duration": run.duration, "started": run.started, "limit": daily_limit, "usedToday": len(used_today) + 1}


@app.post("/dev/seed-demo")
def dev_seed_demo(db: DbDep) -> dict:
    if settings.environment != "local":
        raise HTTPException(status_code=404, detail="Not found")
    result = seed_demo_data(db)
    return {
        "ok": True,
        "userEmail": result.user_email,
        "profiles": result.profiles,
        "jobs": result.jobs,
        "credentials": result.credentials,
        "runs": result.runs,
        "evaluations": result.evaluations,
    }


def job_to_dict(row: JobPosting) -> dict:
    return {
        "id": row.id,
        "title": row.title,
        "company": row.company,
        "source": row.source,
        "modality": row.modality,
        "location": row.location,
        "score": row.score,
        "scoreType": row.score_type,
        "status": row.status,
        "detected": row.detected,
        "salary": row.salary,
        "skills": row.skills,
    }


def only_digits(value: str | None) -> str:
    return "".join(character for character in (value or "") if character.isdigit())


def normalize_whatsapp_payload(phone_code: str | None, phone_number: str | None, api_key: str | None) -> dict:
    code = only_digits(phone_code)
    number = only_digits(phone_number)
    key = (api_key or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Country code is required")
    if not key:
        raise HTTPException(status_code=400, detail="WhatsApp API key is required")
    if code in {"52", "521"} and len(number) != 10:
        raise HTTPException(status_code=400, detail="Mexico phone numbers must have exactly 10 digits")
    if code not in {"52", "521"} and not (6 <= len(number) <= 15):
        raise HTTPException(status_code=400, detail="Phone number must have 6 to 15 digits")
    full_phone = f"{code}{number}"
    return {"phone_code": code, "phone_number": number, "full_phone": full_phone, "api_key": key}


def mask_whatsapp(phone_number: str, api_key: str) -> str:
    phone_suffix = phone_number[-2:] if phone_number else ""
    key_suffix = api_key[-3:] if api_key else ""
    return f"****{phone_suffix} *****{key_suffix}"


def test_callmebot(full_phone: str, api_key: str) -> None:
    params = urlencode({"phone": full_phone, "text": "SinFro prueba de WhatsApp", "apikey": api_key})
    url = f"https://api.callmebot.com/whatsapp.php?{params}"
    try:
        with urlopen(url, timeout=20) as response:
            body = response.read().decode("utf-8", errors="replace").lower()
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not reach CallMeBot") from exc
    if "message queued" not in body and "queued" not in body:
        raise HTTPException(status_code=400, detail="CallMeBot did not accept the WhatsApp test")
