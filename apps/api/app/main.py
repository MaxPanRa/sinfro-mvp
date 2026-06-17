import json
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from redis import Redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import encrypt_secret, mask_secret
from app.db.redis import get_redis
from app.db.session import SessionLocal, get_db
from app.models import ApiCredential, JobPosting, JobRun, Profile, SubscriptionPlan, User, UserSubscription, UserTheme
from app.schemas import CredentialIn, CredentialOut, PlanOut, SubscriptionOut, ThemeIn, ThemeOut, UserOut
from app.seed import seed_demo_data, seed_dev_data

app = FastAPI(title=settings.project_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.public_web_url, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DbDep = Annotated[Session, Depends(get_db)]
RedisDep = Annotated[Redis, Depends(get_redis)]

PROVIDERS = {
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


def current_user(db: DbDep) -> User:
    user = db.scalar(select(User).where(User.email == "demo@sinfro.local"))
    if not user:
        user = seed_dev_data(db)
    return user


@app.get("/health")
def health(db: DbDep, redis: RedisDep) -> dict:
    db.execute(select(1))
    redis.ping()
    return {"status": "ok", "service": "api"}


@app.post("/auth/demo-login", response_model=UserOut)
def demo_login(user: Annotated[User, Depends(current_user)]) -> User:
    return user


@app.get("/auth/google/start")
def google_start() -> dict:
    return {
        "status": "placeholder",
        "message": "Configure GOOGLE_CLIENT_ID/SECRET and exchange the OAuth code in /auth/google/callback.",
        "redirectUri": settings.google_redirect_uri,
    }


@app.get("/me", response_model=UserOut)
def me(user: Annotated[User, Depends(current_user)]) -> User:
    return user


@app.get("/me/theme", response_model=ThemeOut)
def get_theme(db: DbDep, user: Annotated[User, Depends(current_user)]) -> ThemeOut:
    theme = db.scalar(select(UserTheme).where(UserTheme.user_id == user.id))
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


@app.get("/subscription/plans", response_model=list[PlanOut])
def plans(db: DbDep) -> list[PlanOut]:
    rows = db.scalars(select(SubscriptionPlan).order_by(SubscriptionPlan.id)).all()
    return [PlanOut(id=row.id, code=row.code, name=row.name, priceLabel=row.price_label, description=row.description, features=row.features) for row in rows]


@app.get("/subscription/current", response_model=SubscriptionOut)
def current_subscription(db: DbDep, user: Annotated[User, Depends(current_user)]) -> SubscriptionOut:
    sub = db.scalar(select(UserSubscription).where(UserSubscription.user_id == user.id))
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    plan = PlanOut(id=sub.plan.id, code=sub.plan.code, name=sub.plan.name, priceLabel=sub.plan.price_label, description=sub.plan.description, features=sub.plan.features)
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
    rows = db.scalars(select(JobPosting).where(JobPosting.user_id == user.id).order_by(JobPosting.score.desc())).all()
    return [job_to_dict(row) for row in rows]


@app.get("/jobs/{job_id}")
def job_detail(job_id: int, db: DbDep, user: Annotated[User, Depends(current_user)]) -> dict:
    job = db.scalar(select(JobPosting).where(JobPosting.id == job_id, JobPosting.user_id == user.id))
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job_to_dict(job)


@app.get("/credentials", response_model=list[CredentialOut])
def credentials(db: DbDep, user: Annotated[User, Depends(current_user)]) -> list[CredentialOut]:
    saved = {row.provider: row for row in db.scalars(select(ApiCredential).where(ApiCredential.user_id == user.id)).all()}
    result = []
    for provider_id, meta in PROVIDERS.items():
        row = saved.get(provider_id)
        result.append(CredentialOut(id=provider_id, group=meta[0], name=meta[1], glyph=meta[2], iconColor=meta[3], status="connected" if row else "disconnected", maskedKey=row.masked_value if row else "— sin credencial —", lastTest=row.last_test if row and row.last_test else "nunca probado"))
    return result


@app.post("/credentials", response_model=CredentialOut)
def save_credential(payload: CredentialIn, db: DbDep, user: Annotated[User, Depends(current_user)]) -> CredentialOut:
    if payload.providerId not in PROVIDERS:
        raise HTTPException(status_code=404, detail="Unknown provider")
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
def test_credential(provider_id: str) -> dict:
    if provider_id not in PROVIDERS:
        raise HTTPException(status_code=404, detail="Unknown provider")
    return {"ok": True, "providerId": provider_id, "message": "Placeholder credential test passed"}


@app.get("/sync/runs")
def sync_runs(db: DbDep, user: Annotated[User, Depends(current_user)]) -> list[dict]:
    rows = db.scalars(select(JobRun).where(JobRun.user_id == user.id).order_by(JobRun.id.desc())).all()
    return [{"id": row.id, "source": row.source, "status": row.status, "found": int(row.found) if row.found.isdigit() else "—", "duration": row.duration, "started": row.started, "error": row.error} for row in rows]


@app.post("/sync/run")
def run_sync(db: DbDep, redis: RedisDep, user: Annotated[User, Depends(current_user)]) -> dict:
    run = JobRun(user_id=user.id, source="Manual scan", status="running", found="—", duration="00:00", started="ahora")
    db.add(run)
    db.commit()
    db.refresh(run)
    redis.lpush("sync_jobs", json.dumps({"run_id": run.id, "user_id": user.id}))
    return {"id": run.id, "source": run.source, "status": run.status, "found": "—", "duration": run.duration, "started": run.started}


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
