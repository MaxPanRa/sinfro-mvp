import json
import secrets
import hashlib
from datetime import datetime, timedelta, time, timezone
from pathlib import Path
from typing import Annotated
import urllib.error
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, Response
from redis import Redis
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core import ai
from app.core.ai import AIError, AI_PROVIDER_IDS, analyze_cv_with_ai, compare_job_with_ai, translate_job_description
from app.core.config import settings
from app.core.cv import analyze_cv_text, extract_cv_text
from app.core.email import send_new_user_admin_email, send_plan_assigned_email, send_verification_email, smtp_configured
from app.core.google import GMAIL_SEND_SCOPE, build_google_auth_url, exchange_code, get_google_userinfo
from app.core.security import create_access_token, decrypt_bytes, decrypt_secret, encrypt_bytes, encrypt_secret, hash_password, hash_token, mask_secret, read_access_token, verify_password
from app.db.redis import get_redis
from app.db.session import SessionLocal, get_db
from app.models import AiTaskAssignment, ApiCredential, ApiCredentialGrant, ApiUsage, CvDocument, FriendFamilyCode, JobEvaluation, JobPosting, JobRun, OAuthAccount, PendingRegistration, Profile, SubscriptionPlan, User, UserSubscription, UserTheme
from app.schemas import AdminAiAssignIn, AdminAiAssignmentItem, AdminAiUnassignIn, AdminApiLendIn, AdminApiUnlendIn, AdminApiUsageIn, AdminLendableOut, AdminAssignCodeIn, AdminAssignResultOut, AdminCodeOut, AdminCodeUpdateIn, AdminPlanChangeIn, AdminUserOut, AdminUserStatusIn, AiAssignmentItem, AiConfigIn, AiProviderConfigOut, ApiUsageOut, ConfirmEmailIn, CredentialIn, CredentialOut, CredentialTestIn, CoverLetterIn, CoverLetterOut, GmailStatusOut, GoogleAuthStartOut, JobEvaluationOut, JobStatusIn, JobTranslationIn, JobTranslationOut, LoginIn, PlanOut, ProfileIn, RegisterIn, RegisterStartOut, SubscriptionCodeIn, SubscriptionOut, ThemeIn, ThemeOut, TokenOut, UserOut
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


AI_TASKS = ("cv_read", "cv_vs_job")  # lectura de CV | análisis CV vs vacante
ADMIN_EMAIL = "maxpanra@gmail.com"
CREDENTIAL_TEST_TTL_SECONDS = 15 * 60


def ai_provider_name(provider: str) -> str:
    meta = PROVIDERS.get(provider)
    return meta[1] if meta else provider


def load_credential_value(db: Session, user_id: int, provider: str) -> str | None:
    """Devuelve la API key descifrada de un proveedor, o None si no existe."""
    row = db.scalar(select(ApiCredential).where(ApiCredential.user_id == user_id, ApiCredential.provider == provider))
    if not row:
        return None
    try:
        return decrypt_secret(row.encrypted_value)
    except Exception:  # noqa: BLE001 — credencial corrupta
        return None


# APIs de búsqueda/scraping que el admin puede prestar a usuarios.
LENDABLE_PROVIDERS = ("apify", "serpapi", "adzuna", "jooble")

# Cuota local por proveedor (espejo del worker). apify: sin cuota (cobra por uso).
PROVIDER_USAGE_DEFAULTS = {
    "serpapi": {"quota_limit": 250, "period": "month", "renew_days": None},
    "adzuna": {"quota_limit": 250, "period": "month", "renew_days": None},
    "jooble": {"quota_limit": None, "period": "rolling7", "renew_days": 7},
    "apify": {"quota_limit": None, "period": "none", "renew_days": None},
}


def get_or_create_api_usage(db: Session, owner_id: int, provider: str) -> ApiUsage:
    usage = db.scalar(select(ApiUsage).where(ApiUsage.user_id == owner_id, ApiUsage.provider == provider))
    if usage:
        return usage
    d = PROVIDER_USAGE_DEFAULTS.get(provider, {"quota_limit": None, "period": "none", "renew_days": None})
    usage = ApiUsage(user_id=owner_id, provider=provider, used=0, quota_limit=d["quota_limit"], period=d["period"], period_start=datetime.now(timezone.utc), renew_days=d["renew_days"])
    db.add(usage)
    db.flush()
    return usage


def _aware(value):
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def usage_to_out(usage: ApiUsage | None, provider: str) -> ApiUsageOut | None:
    """Convierte una fila de uso en payload para la UI (etiqueta + días restantes)."""
    if usage is None:
        return None
    now = datetime.now(timezone.utc)
    used = usage.used or 0
    days_left = None
    if usage.period == "month":
        start = _aware(usage.period_start)
        if start and (start.year, start.month) != (now.year, now.month):
            used = 0
        label = f"{used}/{usage.quota_limit} este mes" if usage.quota_limit else f"{used} usos este mes"
    elif usage.period == "rolling7":
        start = _aware(usage.period_start)
        renew = usage.renew_days or 7
        elapsed = (now - start).days if start else 0
        days_left = max(0, renew - elapsed)
        label = f"renovar en {days_left} día(s)" if days_left > 0 else "renovación vencida"
    else:
        label = f"{used} usos · sin cuota (cobra por uso)"
    return ApiUsageOut(provider=provider, used=used, quotaLimit=usage.quota_limit, period=usage.period, daysLeft=days_left, label=label)


def effective_usage_for(db: Session, user_id: int, provider: str) -> ApiUsage | None:
    """La fila de uso que aplica al usuario para un provider: la suya o, si es una
    API prestada por el admin, la del admin (el cupo se comparte)."""
    own = db.scalar(select(ApiCredential).where(ApiCredential.user_id == user_id, ApiCredential.provider == provider))
    if own:
        return db.scalar(select(ApiUsage).where(ApiUsage.user_id == user_id, ApiUsage.provider == provider))
    grant = db.scalar(select(ApiCredentialGrant).where(ApiCredentialGrant.user_id == user_id, ApiCredentialGrant.provider == provider))
    if grant:
        return db.scalar(select(ApiUsage).where(ApiUsage.user_id == grant.credential_user_id, ApiUsage.provider == provider))
    return None


def _request_json(url: str, *, method: str = "GET", params: dict | None = None, payload: dict | None = None, timeout: int = 30) -> dict:
    full_url = f"{url}?{urlencode(params)}" if params else url
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(
        full_url,
        data=data,
        method=method,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "SinFro credential test",
        },
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:240]
        raise HTTPException(status_code=400, detail=f"La prueba falló ({exc.code}): {body}") from exc
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=400, detail=f"No se pudo contactar la API: {exc.reason}") from exc
    except (TimeoutError, OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail=f"No se pudo validar la respuesta de la API: {exc}") from exc


def normalize_adzuna_payload(api_key: str | None = None, app_id: str | None = None, app_key: str | None = None) -> dict[str, str]:
    clean_app_id = (app_id or "").strip()
    clean_app_key = (app_key or "").strip()
    raw = (api_key or "").strip()
    if clean_app_id and clean_app_key:
        return {"app_id": clean_app_id, "app_key": clean_app_key}
    if raw:
        try:
            data = json.loads(raw)
            clean_app_id = str(data.get("app_id") or data.get("appId") or "").strip()
            clean_app_key = str(data.get("app_key") or data.get("appKey") or "").strip()
        except json.JSONDecodeError:
            if ":" in raw:
                clean_app_id, clean_app_key = [part.strip() for part in raw.split(":", 1)]
    if not clean_app_id or not clean_app_key:
        raise HTTPException(status_code=400, detail="Adzuna requiere app_id y app_key")
    return {"app_id": clean_app_id, "app_key": clean_app_key}


def adzuna_secret(value: dict[str, str]) -> str:
    return json.dumps(value, separators=(",", ":"))


def mask_adzuna(value: dict[str, str]) -> str:
    app_id = value["app_id"]
    app_key = value["app_key"]
    return f"{app_id[:4]}…{app_key[-4:]}" if app_key else f"{app_id[:4]}…"


def test_adzuna_credential(app_id: str, app_key: str) -> int:
    data = _request_json(
        "https://api.adzuna.com/v1/api/jobs/mx/search/1",
        params={
            "app_id": app_id,
            "app_key": app_key,
            "results_per_page": 1,
            "what": "software developer",
            "content-type": "application/json",
        },
    )
    return int(data.get("count") or len(data.get("results") or []))


def test_jooble_credential(api_key: str) -> int:
    key = api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="Jooble requiere API key")
    data = _request_json(
        f"https://mx.jooble.org/api/{key}",
        method="POST",
        payload={
            "keywords": "software developer",
            "location": "Mexico",
            "radius": "80",
            "page": "1",
            "ResultOnPage": "1",
            "companysearch": "false",
        },
    )
    return int(data.get("totalCount") or data.get("total") or len(data.get("jobs") or []))


def test_serpapi_credential(api_key: str) -> int:
    key = api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="SerpAPI requiere API key")
    data = _request_json(
        "https://serpapi.com/search.json",
        params={
            "engine": "google_jobs",
            "q": "software developer",
            "location": "Mexico",
            "google_domain": "google.com.mx",
            "hl": "es",
            "gl": "mx",
            "api_key": key,
        },
    )
    if data.get("error"):
        error = str(data["error"])
        if "hasn't returned any results" in error.lower():
            return 0
        raise HTTPException(status_code=400, detail=f"SerpAPI: {error}")
    return len(data.get("jobs_results") or [])


def normalize_apify_payload(api_key: str | None) -> dict[str, object]:
    raw = (api_key or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Apify requiere API token")
    if raw.startswith("{"):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="La configuración de Apify no es JSON válido") from exc
        token = str(data.get("token") or data.get("apiToken") or "").strip()
        if not token:
            raise HTTPException(status_code=400, detail="Apify requiere token")
        actors = data.get("actors") if isinstance(data.get("actors"), dict) else {}
        return {
            "token": token,
            "actors": actors,
            "maxItems": int(data.get("maxItems") or data.get("max_items") or 40),
        }
    return {"token": raw, "actors": {}, "maxItems": 40}


def apify_secret(value: dict[str, object]) -> str:
    actors = value.get("actors") or {}
    max_items = int(value.get("maxItems") or 40)
    if actors or max_items != 40:
        return json.dumps(value, separators=(",", ":"))
    return str(value["token"])


def test_apify_credential(api_key: str) -> str:
    config = normalize_apify_payload(api_key)
    token = str(config["token"])
    data = _request_json("https://api.apify.com/v2/users/me", params={"token": token})
    user_data = data.get("data") if isinstance(data.get("data"), dict) else data
    username = str(user_data.get("username") or user_data.get("id") or "cuenta verificada") if isinstance(user_data, dict) else "cuenta verificada"
    return username


def credential_fingerprint(provider_id: str, value: str) -> str:
    return hash_token(f"{provider_id}:{value.strip()}")


def credential_test_key(user_id: int, provider_id: str, fingerprint: str) -> str:
    return f"credential_test:{user_id}:{provider_id}:{fingerprint}"


def mark_credential_tested(redis: Redis, user_id: int, provider_id: str, value: str) -> None:
    fingerprint = credential_fingerprint(provider_id, value)
    redis.setex(credential_test_key(user_id, provider_id, fingerprint), CREDENTIAL_TEST_TTL_SECONDS, "1")


def require_credential_tested(redis: Redis, user_id: int, provider_id: str, value: str) -> None:
    fingerprint = credential_fingerprint(provider_id, value)
    if not redis.get(credential_test_key(user_id, provider_id, fingerprint)):
        raise HTTPException(status_code=409, detail="Prueba esta credencial antes de guardarla")


def provider_for_task(db: Session, user_id: int, task: str) -> tuple[str, str] | None:
    """(provider, model) asignado a una tarea, si hay credencial usable.

    Si la asignación la hizo el admin, la credencial es la del admin
    (``credential_user_id``), no la del usuario.
    """
    assignment = db.scalar(select(AiTaskAssignment).where(AiTaskAssignment.user_id == user_id, AiTaskAssignment.task == task))
    if not assignment:
        return None
    cred_owner = assignment.credential_user_id or user_id
    key = load_credential_value(db, cred_owner, assignment.provider)
    if not key:
        return None
    model = assignment.model or ai.default_model(assignment.provider)
    return assignment.provider, model


def assign_ai_task(db: Session, user_id: int, provider: str, task: str, model: str) -> None:
    """Asigna ``provider``+``model`` a ``task``. Cada tarea la hace una sola IA, pero
    un proveedor puede atender varias tareas (con modelos distintos)."""
    # Exclusión por tarea: libera la IA previa de esta tarea (puede ser otro provider).
    # No tocamos asignaciones puestas por el admin (esas las gestiona solo el admin).
    db.execute(delete(AiTaskAssignment).where(AiTaskAssignment.user_id == user_id, AiTaskAssignment.task == task, AiTaskAssignment.assigned_by_admin.is_(False)))
    db.add(AiTaskAssignment(user_id=user_id, task=task, provider=provider, model=model or None))


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
            if user and user.email_verified_at and user.is_active:
                return user
    raise HTTPException(status_code=401, detail="Authentication required")


def require_admin(user: Annotated[User, Depends(current_user)]) -> User:
    if user.email.strip().lower() != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin only")
    return user


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
    # Avisa al administrador del nuevo registro (no debe romper el alta si falla).
    try:
        send_new_user_admin_email(ADMIN_EMAIL, user.email, user.name)
    except Exception as exc:  # noqa: BLE001
        print(f"admin new-user email skipped: {exc}")
    return TokenOut(accessToken=create_access_token(user.id), user=user)


@app.post("/auth/login", response_model=TokenOut)
def login(payload: LoginIn, db: DbDep) -> TokenOut:
    user = db.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Cuenta desactivada")
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


def subscription_payload(subscription: UserSubscription, plan_override: SubscriptionPlan | None = None) -> SubscriptionOut:
    plan = plan_override or subscription.plan
    plan = PlanOut(
        id=plan.id,
        code=plan.code,
        name=plan.name,
        priceLabel=plan.price_label,
        description=plan.description,
        features=plan.features,
        limits=plan.limits or {},
    )
    return SubscriptionOut(status=subscription.status, plan=plan)


def plan_profile_limit(plan: SubscriptionPlan | None) -> int:
    if not plan or not plan.limits:
        return 1
    return int(plan.limits.get("profiles_limit", 1))


def user_subscription(db: Session, user_id: int) -> UserSubscription | None:
    return db.scalar(select(UserSubscription).where(UserSubscription.user_id == user_id).order_by(UserSubscription.id.desc()))


def enforce_profile_limit(db: Session, user_id: int, plan: SubscriptionPlan) -> None:
    limit = max(0, plan_profile_limit(plan))
    profiles = list(db.scalars(select(Profile).where(Profile.user_id == user_id).order_by(Profile.id)).all())
    if not profiles:
        return

    active = next((profile for profile in profiles if profile.active), None) or profiles[0]
    ordered = [active, *[profile for profile in profiles if profile.id != active.id]]
    allowed_ids = {profile.id for profile in ordered[:limit]}

    for profile in profiles:
        profile.plan_disabled = profile.id not in allowed_ids
        if profile.plan_disabled and profile.active:
            profile.active = False

    visible = [profile for profile in profiles if profile.id in allowed_ids]
    if visible and not any(profile.active for profile in visible):
        visible[0].active = True


def visible_profile_query(user_id: int):
    return select(Profile).where(Profile.user_id == user_id, Profile.plan_disabled == False)  # noqa: E712


def visible_profile_count(db: Session, user_id: int) -> int:
    return len(list(db.scalars(visible_profile_query(user_id)).all()))


@app.get("/subscription/current", response_model=SubscriptionOut)
def current_subscription(db: DbDep, user: Annotated[User, Depends(current_user)]) -> SubscriptionOut:
    sub = db.scalar(select(UserSubscription).where(UserSubscription.user_id == user.id))
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return subscription_payload(sub)


@app.post("/subscription/redeem-code", response_model=SubscriptionOut)
def redeem_subscription_code(payload: SubscriptionCodeIn, db: DbDep, user: Annotated[User, Depends(current_user)]) -> SubscriptionOut:
    code_value = payload.code.strip()
    if not code_value:
        raise HTTPException(status_code=400, detail="Ingresa un código")

    code = db.scalar(select(FriendFamilyCode).where(FriendFamilyCode.code == code_value))
    if not code or not code.active:
        raise HTTPException(status_code=404, detail="Código inválido")

    redeemed_user_ids = list(code.redeemed_user_ids or [])
    already_redeemed = user.id in redeemed_user_ids
    if not already_redeemed and len(redeemed_user_ids) >= code.max_redemptions:
        raise HTTPException(status_code=409, detail="Este código ya alcanzó su límite de canjes")

    subscription = db.scalar(select(UserSubscription).where(UserSubscription.user_id == user.id))
    if not subscription:
        subscription = UserSubscription(user_id=user.id, plan_id=code.plan_id, status="active")
        db.add(subscription)
    subscription.plan_id = code.plan_id
    subscription.status = "active"

    if not already_redeemed:
        code.redeemed_user_ids = [*redeemed_user_ids, user.id]

    enforce_profile_limit(db, user.id, code.plan)
    db.commit()
    db.refresh(subscription)
    return subscription_payload(subscription, code.plan)


def admin_user_payload(db: Session, user: User) -> AdminUserOut:
    subscription = user_subscription(db, user.id)
    if not subscription:
        free_plan = db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == "free"))
        if not free_plan:
            raise HTTPException(status_code=500, detail="Plan Free no disponible")
        subscription = UserSubscription(user_id=user.id, plan_id=free_plan.id, status="active")
        db.add(subscription)
        db.flush()
    plan = db.get(SubscriptionPlan, subscription.plan_id)
    if not plan:
        raise HTTPException(status_code=500, detail="Plan no disponible")

    profiles = list(db.scalars(select(Profile).where(Profile.user_id == user.id)).all())
    visible = [profile for profile in profiles if not profile.plan_disabled]
    disabled = [profile for profile in profiles if profile.plan_disabled]
    ai_rows = db.scalars(
        select(AiTaskAssignment).where(AiTaskAssignment.user_id == user.id, AiTaskAssignment.assigned_by_admin.is_(True))
    ).all()
    ai_assignments = [
        AdminAiAssignmentItem(task=row.task, provider=row.provider, model=row.model or ai.default_model(row.provider))
        for row in ai_rows
    ]
    api_grants = [grant.provider for grant in db.scalars(select(ApiCredentialGrant).where(ApiCredentialGrant.user_id == user.id)).all()]
    return AdminUserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        isActive=user.is_active,
        planCode=plan.code,
        planName=plan.name,
        visibleProfiles=len(visible),
        disabledProfiles=len(disabled),
        totalProfiles=len(profiles),
        createdAt=user.created_at,
        aiAssignments=ai_assignments,
        apiGrants=api_grants,
    )


@app.get("/admin/users", response_model=list[AdminUserOut])
def admin_users(db: DbDep, _admin: Annotated[User, Depends(require_admin)]) -> list[AdminUserOut]:
    rows = db.scalars(select(User).where(User.email != GLOBAL_POOL_EMAIL).order_by(User.id)).all()
    return [admin_user_payload(db, row) for row in rows]


@app.get("/admin/ai/assignable", response_model=list[AiProviderConfigOut])
def admin_ai_assignable(db: DbDep, admin: Annotated[User, Depends(require_admin)]) -> list[AiProviderConfigOut]:
    """IAs que el admin tiene conectadas (su BYOK) y por tanto puede asignar a usuarios."""
    return [provider for provider in ai_providers_payload(db, admin.id) if provider.connected]


@app.post("/admin/ai/assign", response_model=list[AdminUserOut])
def admin_ai_assign(payload: AdminAiAssignIn, db: DbDep, admin: Annotated[User, Depends(require_admin)]) -> list[AdminUserOut]:
    """Asigna una IA del admin (provider+model) a uno o más usuarios para ciertas tareas.
    Los usuarios la usan con la API key del admin y no pueden cambiarla."""
    if payload.provider not in AI_PROVIDER_IDS:
        raise HTTPException(status_code=404, detail="Proveedor de IA desconocido")
    if not load_credential_value(db, admin.id, payload.provider):
        raise HTTPException(status_code=400, detail="Conecta primero tu API key de este proveedor")
    tasks = [task for task in payload.tasks if task in AI_TASKS]
    if not tasks:
        raise HTTPException(status_code=400, detail="Selecciona al menos una tarea válida")
    model = payload.model.strip() or ai.default_model(payload.provider)
    updated: list[User] = []
    for user_id in dict.fromkeys(payload.userIds):
        target = db.get(User, user_id)
        if not target or target.email == GLOBAL_POOL_EMAIL:
            continue
        for task in tasks:
            # Sustituye la asignación (propia o admin) de esa tarea por la del admin.
            db.execute(delete(AiTaskAssignment).where(AiTaskAssignment.user_id == user_id, AiTaskAssignment.task == task))
            db.add(AiTaskAssignment(user_id=user_id, task=task, provider=payload.provider, model=model, assigned_by_admin=True, credential_user_id=admin.id))
        updated.append(target)
    db.commit()
    return [admin_user_payload(db, target) for target in updated]


@app.post("/admin/ai/unassign", response_model=list[AdminUserOut])
def admin_ai_unassign(payload: AdminAiUnassignIn, db: DbDep, _admin: Annotated[User, Depends(require_admin)]) -> list[AdminUserOut]:
    """Quita las asignaciones de IA hechas por el admin (todas o solo ciertas tareas)."""
    tasks = [task for task in payload.tasks if task in AI_TASKS] or list(AI_TASKS)
    updated: list[User] = []
    for user_id in dict.fromkeys(payload.userIds):
        target = db.get(User, user_id)
        if not target:
            continue
        db.execute(delete(AiTaskAssignment).where(AiTaskAssignment.user_id == user_id, AiTaskAssignment.task.in_(tasks), AiTaskAssignment.assigned_by_admin.is_(True)))
        updated.append(target)
    db.commit()
    return [admin_user_payload(db, target) for target in updated]


@app.get("/admin/api/lendable", response_model=list[AdminLendableOut])
def admin_api_lendable(db: DbDep, admin: Annotated[User, Depends(require_admin)]) -> list[AdminLendableOut]:
    """APIs de búsqueda/scraping que el admin tiene conectadas y puede prestar, con su uso."""
    out: list[AdminLendableOut] = []
    for provider_id in LENDABLE_PROVIDERS:
        meta = PROVIDERS.get(provider_id)
        if not meta:
            continue
        connected = bool(load_credential_value(db, admin.id, provider_id))
        usage = db.scalar(select(ApiUsage).where(ApiUsage.user_id == admin.id, ApiUsage.provider == provider_id))
        out.append(AdminLendableOut(provider=provider_id, name=meta[1], connected=connected, usage=usage_to_out(usage, provider_id)))
    return out


@app.post("/admin/api/lend", response_model=list[AdminUserOut])
def admin_api_lend(payload: AdminApiLendIn, db: DbDep, admin: Annotated[User, Depends(require_admin)]) -> list[AdminUserOut]:
    """Presta una API del admin (su key) a uno o más usuarios. Acceso compartido."""
    if payload.provider not in LENDABLE_PROVIDERS:
        raise HTTPException(status_code=404, detail="Esa API no se puede prestar")
    if not load_credential_value(db, admin.id, payload.provider):
        raise HTTPException(status_code=400, detail="Conecta primero tu API key de este proveedor")
    get_or_create_api_usage(db, admin.id, payload.provider)  # asegura fila de uso
    updated: list[User] = []
    for user_id in dict.fromkeys(payload.userIds):
        target = db.get(User, user_id)
        if not target or target.email == GLOBAL_POOL_EMAIL or target.id == admin.id:
            continue
        grant = db.scalar(select(ApiCredentialGrant).where(ApiCredentialGrant.user_id == user_id, ApiCredentialGrant.provider == payload.provider))
        if not grant:
            db.add(ApiCredentialGrant(user_id=user_id, provider=payload.provider, credential_user_id=admin.id))
        else:
            grant.credential_user_id = admin.id
        updated.append(target)
    db.commit()
    return [admin_user_payload(db, target) for target in updated]


@app.post("/admin/api/unlend", response_model=list[AdminUserOut])
def admin_api_unlend(payload: AdminApiUnlendIn, db: DbDep, _admin: Annotated[User, Depends(require_admin)]) -> list[AdminUserOut]:
    updated: list[User] = []
    for user_id in dict.fromkeys(payload.userIds):
        target = db.get(User, user_id)
        if not target:
            continue
        db.execute(delete(ApiCredentialGrant).where(ApiCredentialGrant.user_id == user_id, ApiCredentialGrant.provider == payload.provider))
        updated.append(target)
    db.commit()
    return [admin_user_payload(db, target) for target in updated]


@app.patch("/admin/api/usage", response_model=AdminLendableOut)
def admin_api_usage(payload: AdminApiUsageIn, db: DbDep, admin: Annotated[User, Depends(require_admin)]) -> AdminLendableOut:
    """Ajusta el contador de uso de una API del admin (sembrar/corregir)."""
    if payload.provider not in LENDABLE_PROVIDERS:
        raise HTTPException(status_code=404, detail="Proveedor no soportado")
    usage = get_or_create_api_usage(db, admin.id, payload.provider)
    if payload.used is not None:
        usage.used = max(0, payload.used)
    if payload.quotaLimit is not None:
        usage.quota_limit = max(0, payload.quotaLimit) or None
    if payload.period is not None:
        usage.period = payload.period
    if payload.renewDays is not None:
        usage.renew_days = max(1, payload.renewDays)
    if payload.resetRenewal:
        usage.period_start = datetime.now(timezone.utc)
    db.commit()
    meta = PROVIDERS.get(payload.provider)
    return AdminLendableOut(provider=payload.provider, name=meta[1] if meta else payload.provider, connected=bool(load_credential_value(db, admin.id, payload.provider)), usage=usage_to_out(usage, payload.provider))


@app.get("/me/api-usage", response_model=list[ApiUsageOut])
def my_api_usage(db: DbDep, user: Annotated[User, Depends(current_user)]) -> list[ApiUsageOut]:
    """Uso efectivo de las APIs de búsqueda/scraping del usuario (propias o prestadas)."""
    out: list[ApiUsageOut] = []
    for provider_id in LENDABLE_PROVIDERS:
        usage = effective_usage_for(db, user.id, provider_id)
        payload = usage_to_out(usage, provider_id)
        if payload:
            out.append(payload)
    return out


@app.patch("/admin/users/{user_id}/plan", response_model=AdminUserOut)
def admin_change_user_plan(user_id: int, payload: AdminPlanChangeIn, db: DbDep, _admin: Annotated[User, Depends(require_admin)]) -> AdminUserOut:
    target = db.get(User, user_id)
    if not target or target.email == GLOBAL_POOL_EMAIL:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    plan = db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == payload.planCode))
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")

    subscription = user_subscription(db, target.id)
    if not subscription:
        subscription = UserSubscription(user_id=target.id, plan_id=plan.id, status="active")
        db.add(subscription)
    subscription.plan_id = plan.id
    subscription.status = "active"
    enforce_profile_limit(db, target.id, plan)
    db.commit()
    db.refresh(target)
    return admin_user_payload(db, target)


@app.patch("/admin/users/{user_id}/status", response_model=AdminUserOut)
def admin_change_user_status(user_id: int, payload: AdminUserStatusIn, db: DbDep, admin: Annotated[User, Depends(require_admin)]) -> AdminUserOut:
    target = db.get(User, user_id)
    if not target or target.email == GLOBAL_POOL_EMAIL:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if target.id == admin.id and not payload.isActive:
        raise HTTPException(status_code=400, detail="No puedes desactivar tu propia cuenta admin")
    target.is_active = payload.isActive
    db.commit()
    db.refresh(target)
    return admin_user_payload(db, target)


@app.delete("/admin/users/{user_id}", response_model=AdminUserOut)
def admin_deactivate_user(user_id: int, db: DbDep, admin: Annotated[User, Depends(require_admin)]) -> AdminUserOut:
    return admin_change_user_status(user_id, AdminUserStatusIn(isActive=False), db, admin)


@app.get("/admin/codes", response_model=list[AdminCodeOut])
def admin_codes(db: DbDep, _admin: Annotated[User, Depends(require_admin)]) -> list[AdminCodeOut]:
    codes = db.scalars(select(FriendFamilyCode).order_by(FriendFamilyCode.id)).all()
    return [
        AdminCodeOut(
            code=code.code,
            planCode=code.plan.code,
            active=code.active,
            maxRedemptions=code.max_redemptions,
            redeemedCount=len(code.redeemed_user_ids or []),
        )
        for code in codes
    ]


@app.patch("/admin/codes/{code}", response_model=AdminCodeOut)
def admin_update_code(code: str, payload: AdminCodeUpdateIn, db: DbDep, _admin: Annotated[User, Depends(require_admin)]) -> AdminCodeOut:
    """Edita un código: máximo de canjes y/o activo."""
    ff = db.scalar(select(FriendFamilyCode).where(FriendFamilyCode.code == code.strip()))
    if not ff:
        raise HTTPException(status_code=404, detail="Código no encontrado")
    if payload.maxRedemptions is not None:
        if payload.maxRedemptions < len(ff.redeemed_user_ids or []):
            raise HTTPException(status_code=400, detail="El máximo no puede ser menor a los canjes ya hechos")
        ff.max_redemptions = max(0, payload.maxRedemptions)
    if payload.active is not None:
        ff.active = payload.active
    db.commit()
    return AdminCodeOut(code=ff.code, planCode=ff.plan.code, active=ff.active, maxRedemptions=ff.max_redemptions, redeemedCount=len(ff.redeemed_user_ids or []))


@app.post("/admin/codes/{code}/assign", response_model=AdminAssignResultOut)
def admin_assign_code(code: str, payload: AdminAssignCodeIn, db: DbDep, _admin: Annotated[User, Depends(require_admin)]) -> AdminAssignResultOut:
    """Asigna el plan de un código a N usuarios existentes; opcionalmente les avisa por SMTP."""
    ff = db.scalar(select(FriendFamilyCode).where(FriendFamilyCode.code == code.strip()))
    if not ff:
        raise HTTPException(status_code=404, detail="Código no encontrado")
    plan = ff.plan
    redeemed = list(ff.redeemed_user_ids or [])
    assigned = 0
    emailed = 0
    skipped: list[str] = []
    for user_id in payload.userIds:
        target = db.get(User, user_id)
        if not target or target.email == GLOBAL_POOL_EMAIL:
            skipped.append(f"#{user_id}: usuario no encontrado")
            continue
        already = user_id in redeemed
        if not already and len(redeemed) >= ff.max_redemptions:
            skipped.append(f"{target.email}: el código alcanzó su límite de canjes")
            continue
        subscription = user_subscription(db, target.id)
        if not subscription:
            subscription = UserSubscription(user_id=target.id, plan_id=plan.id, status="active")
            db.add(subscription)
        subscription.plan_id = plan.id
        subscription.status = "active"
        enforce_profile_limit(db, target.id, plan)
        if not already:
            redeemed.append(user_id)
        assigned += 1
        if payload.sendEmail:
            try:
                if send_plan_assigned_email(target.email, target.name, plan.name):
                    emailed += 1
                else:
                    skipped.append(f"{target.email}: SMTP no configurado (sin correo)")
            except Exception as exc:  # noqa: BLE001
                skipped.append(f"{target.email}: el correo falló ({exc})")
    ff.redeemed_user_ids = redeemed
    db.commit()
    return AdminAssignResultOut(assigned=assigned, emailed=emailed, skipped=skipped)


def active_cv_document(db: Session, profile_id: int) -> CvDocument | None:
    return db.scalar(
        select(CvDocument)
        .where(CvDocument.profile_id == profile_id, CvDocument.active == True)  # noqa: E712
        .order_by(CvDocument.uploaded_at.desc(), CvDocument.id.desc())
    )


def cv_document_payload(row: CvDocument | None) -> dict | None:
    if not row:
        return None
    return {
        "id": row.id,
        "filename": row.original_filename,
        "mimeType": row.mime_type,
        "sizeBytes": row.size_bytes,
        "uploadedAt": row.uploaded_at.isoformat() if hasattr(row.uploaded_at, "isoformat") else str(row.uploaded_at),
        "parseStatus": row.parse_status,
    }


def profile_to_dict(row: Profile, db: Session | None = None) -> dict:
    cv_doc = active_cv_document(db, row.id) if db else None
    return {
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
        "active": row.active,
        "cvDocument": cv_document_payload(cv_doc),
    }


def initials_from(name: str) -> str:
    parts = [word for word in name.split() if word]
    return ("".join(word[0] for word in parts[:2]).upper()) or "P"


@app.get("/profiles")
def profiles(db: DbDep, user: Annotated[User, Depends(current_user)]) -> list[dict]:
    rows = db.scalars(visible_profile_query(user.id).order_by(Profile.id)).all()
    return [profile_to_dict(row, db) for row in rows]


@app.post("/profiles")
def create_profile(payload: ProfileIn, db: DbDep, user: Annotated[User, Depends(current_user)]) -> dict:
    subscription = user_subscription(db, user.id)
    if visible_profile_count(db, user.id) >= plan_profile_limit(subscription.plan if subscription else None):
        raise HTTPException(status_code=403, detail="Tu plan no permite más perfiles activos")

    has_profiles = db.scalar(select(Profile.id).where(Profile.user_id == user.id, Profile.plan_disabled == False)) is not None  # noqa: E712
    make_active = payload.active or not has_profiles  # el primer perfil queda activo
    if make_active:
        db.execute(update(Profile).where(Profile.user_id == user.id, Profile.plan_disabled == False).values(active=False))  # noqa: E712
    profile = Profile(
        user_id=user.id,
        initials=payload.initials or initials_from(payload.name or "Perfil"),
        name=payload.name.strip() or "Nuevo perfil",
        role=payload.role,
        email=payload.email,
        english=payload.english,
        location=payload.location,
        modality=payload.modality,
        salary=payload.salary,
        cv_status=payload.cvStatus,
        description=payload.description,
        keywords=payload.keywords,
        skills=[skill.model_dump() for skill in payload.skills],
        active=make_active,
        plan_disabled=False,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile_to_dict(profile, db)


@app.put("/profiles/{profile_id}")
def update_profile(profile_id: int, payload: ProfileIn, db: DbDep, user: Annotated[User, Depends(current_user)]) -> dict:
    profile = db.scalar(select(Profile).where(Profile.id == profile_id, Profile.user_id == user.id, Profile.plan_disabled == False))  # noqa: E712
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    if payload.active and not profile.active:
        db.execute(update(Profile).where(Profile.user_id == user.id, Profile.plan_disabled == False).values(active=False))  # noqa: E712
    profile.initials = payload.initials or initials_from(payload.name or "Perfil")
    profile.name = payload.name.strip() or "Nuevo perfil"
    profile.role = payload.role
    profile.email = payload.email
    profile.english = payload.english
    profile.location = payload.location
    profile.modality = payload.modality
    profile.salary = payload.salary
    profile.cv_status = payload.cvStatus
    profile.description = payload.description
    profile.keywords = payload.keywords
    profile.skills = [skill.model_dump() for skill in payload.skills]
    profile.active = payload.active
    db.commit()
    db.refresh(profile)
    return profile_to_dict(profile, db)


@app.delete("/profiles/{profile_id}")
def delete_profile(profile_id: int, db: DbDep, user: Annotated[User, Depends(current_user)]) -> dict:
    """Elimina el perfil Y TODAS las vacantes propias del usuario.

    No toca el pool global de vacantes (compartido entre usuarios), solo las que
    pertenecen a este usuario, junto con sus evaluaciones. Acción destructiva.
    """
    profile = db.scalar(select(Profile).where(Profile.id == profile_id, Profile.user_id == user.id, Profile.plan_disabled == False))  # noqa: E712
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    was_active = profile.active
    job_ids = list(db.scalars(select(JobPosting.id).where(JobPosting.user_id == user.id, JobPosting.profile_id == profile_id)).all())
    cv_documents = list(db.scalars(select(CvDocument).where(CvDocument.user_id == user.id, CvDocument.profile_id == profile_id)).all())

    # Borra evaluaciones que apunten a las vacantes del usuario o a este perfil
    # (la FK no tiene cascade, así que limpiamos antes de borrar los padres).
    if job_ids:
        db.execute(delete(JobEvaluation).where(JobEvaluation.job_id.in_(job_ids)))
    db.execute(delete(JobEvaluation).where(JobEvaluation.profile_id == profile_id))
    db.execute(delete(JobPosting).where(JobPosting.user_id == user.id, JobPosting.profile_id == profile_id))
    for document in cv_documents:
        delete_cv_file(document)
        db.delete(document)
    db.delete(profile)
    db.commit()

    # Si el perfil borrado era el activo, promovemos otro (si queda).
    if was_active:
        next_profile = db.scalar(visible_profile_query(user.id).order_by(Profile.id))
        if next_profile:
            next_profile.active = True
            db.commit()

    return {"ok": True, "id": profile_id, "deletedJobs": len(job_ids)}


MAX_CV_BYTES = 6 * 1024 * 1024
CV_ALLOWED_SUFFIXES = {".pdf", ".docx", ".doc"}


def cv_storage_root() -> Path:
    root = Path(settings.cv_storage_dir)
    if not root.is_absolute():
        root = Path.cwd() / root
    root.mkdir(parents=True, exist_ok=True)
    return root.resolve()


def safe_cv_filename(filename: str | None) -> str:
    name = Path(filename or "cv.pdf").name.strip() or "cv.pdf"
    cleaned = "".join(char if char.isalnum() or char in {" ", ".", "-", "_"} else "_" for char in name).strip()
    return cleaned[:180] or "cv.pdf"


def cv_relative_path(user_id: int, profile_id: int, filename: str) -> str:
    suffix = Path(filename).suffix.lower() or ".bin"
    return str(Path(str(user_id)) / str(profile_id) / f"{uuid4().hex}{suffix}.enc")


def cv_absolute_path(relative_path: str) -> Path:
    root = cv_storage_root()
    path = (root / relative_path).resolve()
    if root not in path.parents and path != root:
        raise HTTPException(status_code=400, detail="Ruta de CV inválida")
    return path


def delete_cv_file(row: CvDocument) -> None:
    try:
        cv_absolute_path(row.storage_path).unlink(missing_ok=True)
    except OSError as exc:
        print(f"cv file delete skipped: {exc}")


def analyze_cv_bytes(db: Session, user: User, filename: str, data: bytes) -> tuple[dict, str]:
    if not data:
        raise HTTPException(status_code=422, detail="El archivo está vacío.")
    if len(data) > MAX_CV_BYTES:
        raise HTTPException(status_code=413, detail="El CV supera el límite de 6 MB.")
    if Path(filename).suffix.lower() not in CV_ALLOWED_SUFFIXES:
        raise HTTPException(status_code=415, detail="Formato no soportado. Sube PDF, DOCX o DOC.")
    try:
        text = extract_cv_text(filename, data)
    except ValueError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=422, detail="No se pudo leer el archivo del CV.") from exc
    if len(text.strip()) < 30:
        raise HTTPException(
            status_code=422,
            detail="No se pudo extraer texto del CV. Si es un PDF escaneado (imagen), súbelo como DOCX o PDF con texto.",
        )

    selected = provider_for_task(db, user.id, "cv_read")
    if selected:
        provider, model = selected
        key = load_credential_value(db, user.id, provider)
        try:
            result = analyze_cv_with_ai(provider, key or "", text, model=model)
            return {**result, "charCount": len(text), "engine": provider}, text
        except AIError as exc:
            print(f"CV con IA falló ({provider}), usando local: {exc}")
    return {**analyze_cv_text(text), "charCount": len(text), "engine": "local"}, text


@app.post("/cv/analyze")
async def analyze_cv(
    user: Annotated[User, Depends(current_user)],
    file: UploadFile = File(...),
) -> dict:
    """Analiza un CV (PDF/DOCX) con métodos locales gratuitos. No guarda nada.

    Devuelve ``{skills, keywords, summary, charCount}`` para autollenar el editor
    de perfil en el cliente. El archivo se procesa en memoria y se descarta.
    """
    data = await file.read()
    if not data:
        raise HTTPException(status_code=422, detail="El archivo está vacío.")
    if len(data) > MAX_CV_BYTES:
        raise HTTPException(status_code=413, detail="El CV supera el límite de 6 MB.")
    try:
        text = extract_cv_text(file.filename or "", data)
    except ValueError as exc:
        raise HTTPException(status_code=415, detail=str(exc))
    except Exception:  # noqa: BLE001 — archivo corrupto / ilegible
        raise HTTPException(status_code=422, detail="No se pudo leer el archivo del CV.")
    if len(text.strip()) < 30:
        raise HTTPException(
            status_code=422,
            detail="No se pudo extraer texto del CV. Si es un PDF escaneado (imagen), súbelo como DOCX o PDF con texto.",
        )

    # Si hay una IA asignada a "Lectura de CV", la usamos; si falla, caemos al
    # análisis local gratuito. ``engine`` indica qué motor produjo el resultado.
    db = SessionLocal()
    try:
        selected = provider_for_task(db, user.id, "cv_read")
        if selected:
            provider, model = selected
            key = load_credential_value(db, user.id, provider)
            try:
                result = analyze_cv_with_ai(provider, key or "", text, model=model)
                return {**result, "charCount": len(text), "engine": provider}
            except AIError as exc:
                print(f"CV con IA falló ({provider}), usando local: {exc}")
    finally:
        db.close()

    return {**analyze_cv_text(text), "engine": "local"}


@app.post("/profiles/{profile_id}/cv")
async def upload_profile_cv(
    profile_id: int,
    db: DbDep,
    user: Annotated[User, Depends(current_user)],
    file: UploadFile = File(...),
) -> dict:
    profile = db.scalar(select(Profile).where(Profile.id == profile_id, Profile.user_id == user.id, Profile.plan_disabled == False))  # noqa: E712
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    filename = safe_cv_filename(file.filename)
    data = await file.read()
    analysis, text = analyze_cv_bytes(db, user, filename, data)
    relative_path = cv_relative_path(user.id, profile.id, filename)
    absolute_path = cv_absolute_path(relative_path)
    absolute_path.parent.mkdir(parents=True, exist_ok=True)
    absolute_path.write_bytes(encrypt_bytes(data))

    previous_documents = list(db.scalars(select(CvDocument).where(CvDocument.user_id == user.id, CvDocument.profile_id == profile.id)).all())
    for previous in previous_documents:
        delete_cv_file(previous)
        db.delete(previous)
    document = CvDocument(
        user_id=user.id,
        profile_id=profile.id,
        original_filename=filename,
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
        storage_path=relative_path,
        encrypted_text=encrypt_secret(text),
        parse_status="processed",
        active=True,
    )
    db.add(document)
    profile.cv_status = f"{filename} · CV guardado"
    db.commit()
    db.refresh(document)
    db.refresh(profile)
    return {"document": cv_document_payload(document), "analysis": analysis, "profile": profile_to_dict(profile, db)}


@app.get("/profiles/{profile_id}/cv/download")
def download_profile_cv(profile_id: int, db: DbDep, user: Annotated[User, Depends(current_user)]) -> Response:
    profile = db.scalar(select(Profile).where(Profile.id == profile_id, Profile.user_id == user.id, Profile.plan_disabled == False))  # noqa: E712
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    document = active_cv_document(db, profile.id)
    if not document:
        raise HTTPException(status_code=404, detail="CV no encontrado")
    try:
        data = decrypt_bytes(cv_absolute_path(document.storage_path).read_bytes())
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Archivo de CV no encontrado") from exc
    headers = {"Content-Disposition": f'attachment; filename="{document.original_filename}"'}
    return Response(content=data, media_type=document.mime_type or "application/octet-stream", headers=headers)


@app.delete("/profiles/{profile_id}/cv")
def delete_profile_cv(profile_id: int, db: DbDep, user: Annotated[User, Depends(current_user)]) -> dict:
    profile = db.scalar(select(Profile).where(Profile.id == profile_id, Profile.user_id == user.id, Profile.plan_disabled == False))  # noqa: E712
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    document = active_cv_document(db, profile.id)
    if not document:
        raise HTTPException(status_code=404, detail="CV no encontrado")
    delete_cv_file(document)
    db.delete(document)
    profile.cv_status = "Sin CV cargado"
    db.commit()
    db.refresh(profile)
    return {"ok": True, "profile": profile_to_dict(profile, db)}


JOB_STATUSES = {"nueva", "vista", "aplicada", "descartada"}


def resolve_profile(db: Session, user: User, profile_id: int | None) -> Profile | None:
    """Perfil objetivo de la bandeja: el pedido (si es del usuario), o el activo."""
    if profile_id is not None:
        wanted = db.scalar(select(Profile).where(Profile.id == profile_id, Profile.user_id == user.id, Profile.plan_disabled == False))  # noqa: E712
        if wanted:
            return wanted
    active = db.scalar(select(Profile).where(Profile.user_id == user.id, Profile.active == True, Profile.plan_disabled == False))  # noqa: E712
    return active or db.scalar(visible_profile_query(user.id).order_by(Profile.id))


@app.get("/jobs")
def jobs(db: DbDep, user: Annotated[User, Depends(current_user)], profile_id: Annotated[int | None, Query()] = None) -> list[dict]:
    # Cada perfil tiene su propia bandeja: filtramos por el perfil pedido/activo.
    profile = resolve_profile(db, user, profile_id)
    if not profile:
        return []
    rows = db.scalars(
        select(JobPosting).where(JobPosting.user_id == user.id, JobPosting.profile_id == profile.id).order_by(JobPosting.score.desc())
    ).all()
    return [job_to_dict(row) for row in rows]


@app.get("/jobs/{job_id}")
def job_detail(job_id: int, db: DbDep, user: Annotated[User, Depends(current_user)]) -> dict:
    job = db.scalar(select(JobPosting).where(JobPosting.id == job_id, JobPosting.user_id == user.id))
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job_to_dict(job)


@app.patch("/jobs/{job_id}/status")
def update_job_status(job_id: int, payload: JobStatusIn, db: DbDep, user: Annotated[User, Depends(current_user)]) -> dict:
    if payload.status not in JOB_STATUSES:
        raise HTTPException(status_code=422, detail="Estado de vacante inválido")
    job = db.scalar(select(JobPosting).where(JobPosting.id == job_id, JobPosting.user_id == user.id))
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.status = payload.status
    # Guarda el motivo solo al descartar; lo limpia si vuelve a otro estado.
    job.discard_reason = (payload.reason or None) if payload.status == "descartada" else None
    db.commit()
    return job_to_dict(job)


@app.get("/credentials", response_model=list[CredentialOut])
def credentials(db: DbDep, user: Annotated[User, Depends(current_user)]) -> list[CredentialOut]:
    saved = {row.provider: row for row in db.scalars(select(ApiCredential).where(ApiCredential.user_id == user.id)).all()}
    gmail = db.scalar(select(OAuthAccount).where(OAuthAccount.user_id == user.id, OAuthAccount.provider == "google"))
    granted = {grant.provider for grant in db.scalars(select(ApiCredentialGrant).where(ApiCredentialGrant.user_id == user.id)).all()}
    result = []
    for provider_id, meta in PROVIDERS.items():
        if provider_id == "gmail":
            connected = bool(gmail and GMAIL_SEND_SCOPE in (gmail.scopes or []))
            result.append(CredentialOut(id=provider_id, group=meta[0], name=meta[1], glyph=meta[2], iconColor=meta[3], status="connected" if connected else "disconnected", maskedKey=gmail.email if gmail else "sin Google conectado", lastTest="gmail.send activo" if connected else "requiere permiso Gmail"))
            continue
        row = saved.get(provider_id)
        is_granted = provider_id in granted and not row
        usage = usage_to_out(effective_usage_for(db, user.id, provider_id), provider_id) if provider_id in LENDABLE_PROVIDERS else None
        if is_granted:
            # Prestada por el admin: el usuario la ve conectada pero no la puede quitar.
            result.append(CredentialOut(id=provider_id, group=meta[0], name=meta[1], glyph=meta[2], iconColor=meta[3], status="connected", maskedKey="prestada por el administrador", lastTest="activa (key del admin)", adminManaged=True, usage=usage))
            continue
        if provider_id == "whatsapp" and not row:
            result.append(CredentialOut(id=provider_id, group=meta[0], name=meta[1], glyph=meta[2], iconColor=meta[3], status="disconnected", maskedKey="sin WhatsApp conectado", lastTest="requiere prueba"))
            continue
        result.append(CredentialOut(id=provider_id, group=meta[0], name=meta[1], glyph=meta[2], iconColor=meta[3], status="connected" if row else "disconnected", maskedKey=row.masked_value if row else "— sin credencial —", lastTest=row.last_test if row and row.last_test else "nunca probado", usage=usage if row else None))
    return result


@app.delete("/credentials/{provider_id}")
def delete_credential(provider_id: str, db: DbDep, user: Annotated[User, Depends(current_user)]) -> dict:
    """Quita una conexión para que dejen de llegar notificaciones por ese canal.
    - gmail: elimina la cuenta de Google (corta el correo de resumen).
    - whatsapp / resto: elimina la API key guardada.
    """
    if provider_id not in PROVIDERS:
        raise HTTPException(status_code=404, detail="Unknown provider")
    # No se puede quitar una API prestada por el admin (mientras no tengas la tuya).
    own = db.scalar(select(ApiCredential).where(ApiCredential.user_id == user.id, ApiCredential.provider == provider_id))
    if not own:
        grant = db.scalar(select(ApiCredentialGrant).where(ApiCredentialGrant.user_id == user.id, ApiCredentialGrant.provider == provider_id))
        if grant:
            raise HTTPException(status_code=403, detail="Esta API la asignó el administrador; no puedes quitarla.")
    if provider_id == "gmail":
        account = db.scalar(select(OAuthAccount).where(OAuthAccount.user_id == user.id, OAuthAccount.provider == "google"))
        if account:
            db.delete(account)
            db.commit()
        return {"id": provider_id, "status": "disconnected"}
    row = db.scalar(select(ApiCredential).where(ApiCredential.user_id == user.id, ApiCredential.provider == provider_id))
    if row:
        db.delete(row)
        db.commit()
    return {"id": provider_id, "status": "disconnected"}


@app.post("/credentials", response_model=CredentialOut)
def save_credential(payload: CredentialIn, db: DbDep, redis: RedisDep, user: Annotated[User, Depends(current_user)]) -> CredentialOut:
    if payload.providerId not in PROVIDERS:
        raise HTTPException(status_code=404, detail="Unknown provider")
    if payload.providerId == "gmail":
        raise HTTPException(status_code=400, detail="Use Google OAuth to connect Gmail")
    if payload.providerId == "whatsapp":
        whatsapp = normalize_whatsapp_payload(payload.phoneCode, payload.phoneNumber, payload.apiKey)
        require_credential_tested(redis, user.id, payload.providerId, json.dumps(whatsapp, sort_keys=True))
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
    if payload.providerId == "adzuna":
        adzuna = normalize_adzuna_payload(payload.apiKey, payload.appId, payload.appKey)
        require_credential_tested(redis, user.id, payload.providerId, adzuna_secret(adzuna))
        row = db.scalar(select(ApiCredential).where(ApiCredential.user_id == user.id, ApiCredential.provider == payload.providerId))
        if not row:
            row = ApiCredential(user_id=user.id, provider=payload.providerId, encrypted_value="", masked_value="")
            db.add(row)
        row.encrypted_value = encrypt_secret(adzuna_secret(adzuna))
        row.masked_value = mask_adzuna(adzuna)
        row.last_test = "guardado ahora"
        db.commit()
        meta = PROVIDERS[payload.providerId]
        return CredentialOut(id=payload.providerId, group=meta[0], name=meta[1], glyph=meta[2], iconColor=meta[3], status="connected", maskedKey=row.masked_value, lastTest=row.last_test)
    if payload.providerId == "jooble" and not payload.apiKey.strip():
        raise HTTPException(status_code=400, detail="Jooble requiere API key")
    if payload.providerId == "serpapi" and not payload.apiKey.strip():
        raise HTTPException(status_code=400, detail="SerpAPI requiere API key")
    if payload.providerId == "apify":
        apify_config = normalize_apify_payload(payload.apiKey)
        require_credential_tested(redis, user.id, payload.providerId, apify_secret(apify_config))
        row = db.scalar(select(ApiCredential).where(ApiCredential.user_id == user.id, ApiCredential.provider == payload.providerId))
        if not row:
            row = ApiCredential(user_id=user.id, provider=payload.providerId, encrypted_value="", masked_value="")
            db.add(row)
        row.encrypted_value = encrypt_secret(apify_secret(apify_config))
        row.masked_value = mask_secret(str(apify_config["token"]))
        row.last_test = "guardado ahora"
        db.commit()
        meta = PROVIDERS[payload.providerId]
        return CredentialOut(id=payload.providerId, group=meta[0], name=meta[1], glyph=meta[2], iconColor=meta[3], status="connected", maskedKey=row.masked_value, lastTest=row.last_test)
    require_credential_tested(redis, user.id, payload.providerId, payload.apiKey)
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
def test_credential(provider_id: str, db: DbDep, redis: RedisDep, user: Annotated[User, Depends(current_user)], payload: CredentialTestIn | None = None) -> dict:
    if provider_id not in PROVIDERS:
        raise HTTPException(status_code=404, detail="Unknown provider")
    if provider_id == "gmail":
        return {"ok": True, "providerId": provider_id, "message": "Use Google OAuth to test Gmail permissions"}
    if provider_id == "whatsapp":
        if not payload:
            raise HTTPException(status_code=400, detail="WhatsApp phone and API key are required")
        whatsapp = normalize_whatsapp_payload(payload.phoneCode, payload.phoneNumber, payload.apiKey)
        test_callmebot(whatsapp["full_phone"], whatsapp["api_key"])
        mark_credential_tested(redis, user.id, provider_id, json.dumps(whatsapp, sort_keys=True))
        return {"ok": True, "providerId": provider_id, "message": "WhatsApp test sent", "maskedKey": mask_whatsapp(whatsapp["phone_number"], whatsapp["api_key"])}
    if provider_id == "adzuna":
        saved_value = load_credential_value(db, user.id, provider_id) or ""
        adzuna = normalize_adzuna_payload(
            payload.apiKey if payload and payload.apiKey else saved_value,
            payload.appId if payload else None,
            payload.appKey if payload else None,
        )
        count = test_adzuna_credential(adzuna["app_id"], adzuna["app_key"])
        mark_credential_tested(redis, user.id, provider_id, adzuna_secret(adzuna))
        cred = db.scalar(select(ApiCredential).where(ApiCredential.user_id == user.id, ApiCredential.provider == provider_id))
        if cred:
            cred.last_test = f"verificado: {count} resultados disponibles"
            db.commit()
        return {"ok": True, "providerId": provider_id, "message": f"Adzuna verificado ({count} resultados disponibles)", "maskedKey": mask_adzuna(adzuna)}
    if provider_id == "jooble":
        key = (payload.apiKey.strip() if payload and payload.apiKey else "") or load_credential_value(db, user.id, provider_id) or ""
        count = test_jooble_credential(key)
        mark_credential_tested(redis, user.id, provider_id, key)
        cred = db.scalar(select(ApiCredential).where(ApiCredential.user_id == user.id, ApiCredential.provider == provider_id))
        if cred:
            cred.last_test = f"verificado: {count} resultados disponibles"
            db.commit()
        return {"ok": True, "providerId": provider_id, "message": f"Jooble verificado ({count} resultados disponibles)", "maskedKey": mask_secret(key)}
    if provider_id == "serpapi":
        key = (payload.apiKey.strip() if payload and payload.apiKey else "") or load_credential_value(db, user.id, provider_id) or ""
        count = test_serpapi_credential(key)
        mark_credential_tested(redis, user.id, provider_id, key)
        cred = db.scalar(select(ApiCredential).where(ApiCredential.user_id == user.id, ApiCredential.provider == provider_id))
        if cred:
            cred.last_test = f"verificado: {count} resultados disponibles"
            db.commit()
        return {"ok": True, "providerId": provider_id, "message": f"SerpAPI verificado ({count} resultados disponibles)", "maskedKey": mask_secret(key)}
    if provider_id == "apify":
        raw = (payload.apiKey.strip() if payload and payload.apiKey else "") or load_credential_value(db, user.id, provider_id) or ""
        username = test_apify_credential(raw)
        apify_config = normalize_apify_payload(raw)
        mark_credential_tested(redis, user.id, provider_id, apify_secret(apify_config))
        cred = db.scalar(select(ApiCredential).where(ApiCredential.user_id == user.id, ApiCredential.provider == provider_id))
        if cred:
            cred.last_test = f"verificado: {username}"
            db.commit()
        return {"ok": True, "providerId": provider_id, "message": f"Apify verificado ({username})", "maskedKey": mask_secret(str(apify_config["token"]))}
    # Proveedores de IA: prueba REAL contra el gateway con la key guardada (o la
    # que venga en el payload). Si el modelo responde 200, la credencial sirve.
    if provider_id in AI_PROVIDER_IDS:
        key = (payload.apiKey.strip() if payload and payload.apiKey else "") or load_credential_value(db, user.id, provider_id) or ""
        if not key:
            raise HTTPException(status_code=400, detail="Conecta primero la API key de este proveedor")
        cred = db.scalar(select(ApiCredential).where(ApiCredential.user_id == user.id, ApiCredential.provider == provider_id))
        model = cred.model if cred and cred.model else ai.default_model(provider_id)
        try:
            ai.ping(provider_id, key, model=model)
        except AIError as exc:
            raise HTTPException(status_code=400, detail=f"La prueba falló: {exc}") from exc
        mark_credential_tested(redis, user.id, provider_id, key)
        if cred:
            cred.last_test = f"verificado con {model}"
            db.commit()
        return {"ok": True, "providerId": provider_id, "message": f"Conexión verificada ({model})"}
    return {"ok": True, "providerId": provider_id, "message": "Placeholder credential test passed"}


def ai_providers_payload(db: Session, user_id: int) -> list[AiProviderConfigOut]:
    saved = {row.provider: row for row in db.scalars(select(ApiCredential).where(ApiCredential.user_id == user_id)).all()}
    rows = db.scalars(select(AiTaskAssignment).where(AiTaskAssignment.user_id == user_id)).all()
    by_provider: dict[str, list[AiAssignmentItem]] = {}
    admin_providers: set[str] = set()
    for row in rows:
        by_provider.setdefault(row.provider, []).append(
            AiAssignmentItem(task=row.task, model=row.model or ai.default_model(row.provider), adminManaged=bool(row.assigned_by_admin))
        )
        if row.assigned_by_admin:
            admin_providers.add(row.provider)
    result: list[AiProviderConfigOut] = []
    for provider_id in AI_PROVIDER_IDS:
        cred = saved.get(provider_id)
        # Conectado si el usuario tiene su propia key O si el admin le asignó este
        # proveedor (en ese caso usa la API key del admin, sin tener la suya).
        connected = bool(cred) or provider_id in admin_providers
        result.append(AiProviderConfigOut(
            provider=provider_id,
            name=ai_provider_name(provider_id),
            connected=connected,
            models=ai.PROVIDER_MODELS.get(provider_id, []),
            defaultModel=(cred.model if cred and cred.model else ai.default_model(provider_id)),
            assignments=by_provider.get(provider_id, []),
        ))
    result.sort(key=lambda item: item.name.lower())
    return result


@app.get("/ai/providers", response_model=list[AiProviderConfigOut])
def ai_providers(db: DbDep, user: Annotated[User, Depends(current_user)]) -> list[AiProviderConfigOut]:
    return ai_providers_payload(db, user.id)


@app.put("/ai/config", response_model=list[AiProviderConfigOut])
def update_ai_config(payload: AiConfigIn, db: DbDep, user: Annotated[User, Depends(current_user)]) -> list[AiProviderConfigOut]:
    if payload.provider not in AI_PROVIDER_IDS:
        raise HTTPException(status_code=404, detail="Proveedor de IA desconocido")
    cred = db.scalar(select(ApiCredential).where(ApiCredential.user_id == user.id, ApiCredential.provider == payload.provider))
    if not cred:
        raise HTTPException(status_code=400, detail="Conecta primero la API key de este proveedor")

    # Tareas bloqueadas por el admin: el usuario no las puede reasignar ni quitar.
    admin_locked = {
        row.task for row in db.scalars(
            select(AiTaskAssignment).where(AiTaskAssignment.user_id == user.id, AiTaskAssignment.assigned_by_admin.is_(True))
        ).all()
    }
    # Reemplaza las asignaciones (propias) de ESTE proveedor por las pedidas. Cada
    # tarea es única; un proveedor puede atender varias. No tocamos las del admin.
    db.execute(delete(AiTaskAssignment).where(AiTaskAssignment.user_id == user.id, AiTaskAssignment.provider == payload.provider, AiTaskAssignment.assigned_by_admin.is_(False)))
    seen_tasks: set[str] = set()
    last_model = ""
    for item in payload.assignments:
        task = item.task.strip()
        if task not in AI_TASKS or task in seen_tasks or task in admin_locked:
            continue
        seen_tasks.add(task)
        model = item.model.strip() or ai.default_model(payload.provider)
        assign_ai_task(db, user.id, payload.provider, task, model)
        last_model = model
    # Recuerda el último modelo como default del proveedor (para nuevas filas).
    if last_model:
        cred.model = last_model
    db.commit()
    return ai_providers_payload(db, user.id)


@app.post("/jobs/{job_id}/evaluate", response_model=JobEvaluationOut)
def evaluate_job(job_id: int, db: DbDep, user: Annotated[User, Depends(current_user)], mode: Annotated[str, Query()] = "deep") -> JobEvaluationOut:
    """Compara una vacante contra el perfil activo usando la IA asignada a 'cv_vs_job'.

    ``mode``: "quick" (análisis rápido) o "deep" (análisis profundo).
    """
    if mode not in ("quick", "deep"):
        raise HTTPException(status_code=422, detail="Modo inválido (quick|deep)")
    selected = provider_for_task(db, user.id, "cv_vs_job")
    if not selected:
        raise HTTPException(status_code=400, detail="Asigna una IA a 'Análisis CV vs vacante' en Conexiones")
    provider, model = selected
    job = db.scalar(select(JobPosting).where(JobPosting.id == job_id, JobPosting.user_id == user.id))
    if not job:
        raise HTTPException(status_code=404, detail="Vacante no encontrada")
    # La vacante pertenece a un perfil (su bandeja); evaluamos contra ese perfil.
    profile = db.scalar(select(Profile).where(Profile.id == job.profile_id, Profile.user_id == user.id)) if job.profile_id else None
    if not profile:
        profile = resolve_profile(db, user, None)
    if not profile:
        raise HTTPException(status_code=400, detail="Crea un perfil antes de evaluar vacantes")

    # Sin descripción no inventamos análisis: invitamos a abrir el sitio original.
    if not (job.description or "").strip():
        return JobEvaluationOut(jobId=job.id, score=job.score, engine=provider, mode=mode, markdown="", hasEvaluation=False, needsSource=True, url=job.url)

    key = load_credential_value(db, user.id, provider)
    try:
        result = ai.evaluate_job_markdown(provider, key or "", profile_to_dict(profile), job_to_dict(job), model=model, mode=mode)
    except AIError as exc:
        raise HTTPException(status_code=502, detail=f"Error de la IA: {exc}") from exc

    evaluation = db.scalar(select(JobEvaluation).where(JobEvaluation.job_id == job.id, JobEvaluation.profile_id == profile.id))
    if not evaluation:
        evaluation = JobEvaluation(job_id=job.id, profile_id=profile.id, score=0, reasons=[], gaps=[])
        db.add(evaluation)
    evaluation.score = result["score"]
    evaluation.reasons = []
    evaluation.gaps = []
    evaluation.detail = result["markdown"]
    evaluation.mode = mode
    # Refleja el score de IA en la vacante (solo en la copia propia del usuario).
    if job.user_id == user.id:
        job.score = result["score"]
        job.score_type = "IA"
    db.commit()
    return JobEvaluationOut(jobId=job.id, score=result["score"], engine=provider, mode=mode, markdown=result["markdown"], hasEvaluation=True)


@app.get("/jobs/{job_id}/evaluation", response_model=JobEvaluationOut)
def get_job_evaluation(job_id: int, db: DbDep, user: Annotated[User, Depends(current_user)]) -> JobEvaluationOut:
    """Devuelve la evaluación con IA guardada de una vacante (para su perfil)."""
    job = db.scalar(select(JobPosting).where(JobPosting.id == job_id, JobPosting.user_id == user.id))
    if not job:
        raise HTTPException(status_code=404, detail="Vacante no encontrada")
    evaluation = db.scalar(
        select(JobEvaluation).where(JobEvaluation.job_id == job.id, JobEvaluation.profile_id == job.profile_id).order_by(JobEvaluation.id.desc())
    ) if job.profile_id else None
    if not evaluation or not evaluation.detail:
        return JobEvaluationOut(jobId=job.id, score=job.score, mode="", markdown="", hasEvaluation=False)
    return JobEvaluationOut(jobId=job.id, score=evaluation.score, mode=evaluation.mode or "", markdown=evaluation.detail, hasEvaluation=True)


@app.post("/jobs/{job_id}/cover-letter", response_model=CoverLetterOut)
def cover_letter(job_id: int, payload: CoverLetterIn, db: DbDep, user: Annotated[User, Depends(current_user)]) -> CoverLetterOut:
    """Genera una carta de presentación con la IA asignada a 'cv_vs_job' (es/en)."""
    lang = payload.language if payload.language in ("es", "en") else "es"
    selected = provider_for_task(db, user.id, "cv_vs_job")
    if not selected:
        raise HTTPException(status_code=400, detail="Asigna una IA a 'Análisis CV vs vacante' en Conexiones")
    provider, model = selected
    job = db.scalar(select(JobPosting).where(JobPosting.id == job_id, JobPosting.user_id == user.id))
    if not job:
        raise HTTPException(status_code=404, detail="Vacante no encontrada")
    profile = db.scalar(select(Profile).where(Profile.id == job.profile_id, Profile.user_id == user.id)) if job.profile_id else None
    if not profile:
        profile = resolve_profile(db, user, None)
    if not profile:
        raise HTTPException(status_code=400, detail="Crea un perfil antes de generar la carta")
    key = load_credential_value(db, user.id, provider)
    try:
        text = ai.generate_cover_letter(provider, key or "", profile_to_dict(profile), job_to_dict(job), model=model, lang=lang)
    except AIError as exc:
        raise HTTPException(status_code=502, detail=f"Error de la IA: {exc}") from exc
    return CoverLetterOut(jobId=job.id, language=lang, text=text, engine=provider)


@app.post("/jobs/{job_id}/translate", response_model=JobTranslationOut)
def translate_job(job_id: int, payload: JobTranslationIn, db: DbDep, user: Annotated[User, Depends(current_user)]) -> JobTranslationOut:
    selected = provider_for_task(db, user.id, "cv_vs_job")
    if not selected:
        raise HTTPException(status_code=400, detail="Asigna una IA a 'Analisis CV vs vacante' en Conexiones")
    provider, model = selected
    job = db.scalar(select(JobPosting).where(JobPosting.id == job_id, JobPosting.user_id == user.id))
    if not job:
        raise HTTPException(status_code=404, detail="Vacante no encontrada")
    if not (job.description or "").strip():
        raise HTTPException(status_code=422, detail="La vacante no tiene descripcion original para traducir")

    key = load_credential_value(db, user.id, provider)
    try:
        translated = translate_job_description(provider, key or "", job.description or "", payload.language, model=model)
    except AIError as exc:
        raise HTTPException(status_code=502, detail=f"Error de la IA: {exc}") from exc
    return JobTranslationOut(jobId=job.id, language=payload.language, translatedDescription=translated, engine=provider)


def relative_time_label(value) -> str:
    """'hace X min/h/d' a partir de un datetime; 'ahora' si es muy reciente o falta."""
    if not value:
        return "ahora"
    try:
        moment = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    except AttributeError:
        return "ahora"
    seconds = int((datetime.now(timezone.utc) - moment).total_seconds())
    if seconds < 45:
        return "ahora"
    minutes = seconds // 60
    if minutes < 1:
        return "hace un momento"
    if minutes < 60:
        return f"hace {minutes} min"
    hours = minutes // 60
    if hours < 24:
        return f"hace {hours} h"
    return f"hace {hours // 24} d"


@app.get("/sync/runs")
def sync_runs(db: DbDep, user: Annotated[User, Depends(current_user)]) -> list[dict]:
    rows = db.scalars(select(JobRun).where(JobRun.user_id == user.id).order_by(JobRun.id.desc())).all()
    return [{"id": row.id, "source": row.source, "status": row.status, "found": int(row.found) if row.found.isdigit() else "—", "duration": row.duration, "started": relative_time_label(row.created_at), "createdAt": row.created_at.isoformat() if row.created_at else None, "error": row.error} for row in rows]


@app.post("/sync/run")
def run_sync(db: DbDep, redis: RedisDep, user: Annotated[User, Depends(current_user)], profile_id: Annotated[int | None, Query()] = None) -> dict:
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

    # Búsqueda propia por perfil: la del perfil activo, con sus keywords.
    profile = resolve_profile(db, user, profile_id)
    if not profile:
        raise HTTPException(status_code=400, detail="Crea un perfil antes de buscar vacantes")

    run = JobRun(user_id=user.id, profile_id=profile.id, source="Manual scan", status="running", found="—", duration="00:00", started="ahora")
    db.add(run)
    db.commit()
    db.refresh(run)
    redis.lpush("sync_jobs", json.dumps({
        "run_id": run.id,
        "user_id": user.id,
        "target_user_id": user.id,   # las vacantes son del usuario, no del pool
        "profile_id": profile.id,
        "keywords": profile.keywords or [],
        "job_family": "any",
        "summary_minutes": 60,
    }))
    return {"id": run.id, "source": run.source, "status": run.status, "found": "—", "duration": run.duration, "started": run.started, "createdAt": run.created_at.isoformat() if run.created_at else None, "limit": daily_limit, "usedToday": len(used_today) + 1}


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


def _clean_skills(skills) -> list[str]:
    """Normaliza skills a strings (algunos scrapers dejan dicts/objetos sueltos)."""
    out: list[str] = []
    for item in skills or []:
        if isinstance(item, str):
            text = item.strip()
        elif isinstance(item, dict):
            text = str(item.get("name") or item.get("label") or "").strip()
        else:
            text = ""
        if text:
            out.append(text)
    return out


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
        "detectedAt": row.detected_at.isoformat() if row.detected_at else None,
        "url": row.url,
        "description": row.description,
        "salary": row.salary,
        "skills": _clean_skills(row.skills),
        "discardReason": row.discard_reason,
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
