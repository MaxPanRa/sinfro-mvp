from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.security import encrypt_secret, mask_secret
from app.models import (
    ApiCredential,
    FriendFamilyCode,
    JobEvaluation,
    JobPosting,
    JobRun,
    JobSource,
    Profile,
    SubscriptionPlan,
    User,
    UserSubscription,
    UserTheme,
)

DEMO_EMAIL = "demo@sinfro.local"
GLOBAL_POOL_EMAIL = "global-pool@sinfro.local"

# Títulos de las vacantes demo (para borrarlas: ya no sembramos data falsa).
DEMO_JOB_TITLES = {
    "Forward Deployed Engineer",
    "Node.js Full Stack Developer",
    "Front-end Developer React / Next.js",
    "Principal Fullstack Engineer",
    "Full Stack Laravel + React Developer",
    "Senior Software Engineer",
    "Junior Manual QA Engineer API Testing",
    "Software Engineer Backend Node.js / TS",
    "Frontend Platform Engineer",
    "AI Product Engineer",
    "Automation Engineer Job Search",
    "Senior Frontend Architect",
}


def clear_demo_jobs(db: Session) -> None:
    """Borra las vacantes demo (y sus evaluaciones). El radar usa solo fuentes reales."""
    job_ids = list(db.scalars(select(JobPosting.id).where(JobPosting.title.in_(DEMO_JOB_TITLES))).all())
    if not job_ids:
        return
    db.execute(delete(JobEvaluation).where(JobEvaluation.job_id.in_(job_ids)))
    db.execute(delete(JobPosting).where(JobPosting.id.in_(job_ids)))


@dataclass(frozen=True)
class DemoSeedResult:
    user_email: str
    profiles: int
    jobs: int
    credentials: int
    runs: int
    evaluations: int


def seed_dev_data(db: Session) -> User:
    result = seed_demo_data(db)
    user = db.scalar(select(User).where(User.email == result.user_email))
    if not user:
        raise RuntimeError("Demo user was not created")
    return user


def seed_demo_data(db: Session) -> DemoSeedResult:
    user = upsert_user(db)
    global_user = upsert_global_pool_user(db)
    upsert_theme(db, user)
    plans = upsert_plans(db)
    upsert_friend_family_code(db, plans["friends_family"])
    ensure_users_have_subscription(db, plans["free"])
    upsert_subscription(db, user, plans["free"])
    profiles = upsert_profiles(db, user)
    credentials = upsert_credentials(db, user)
    upsert_sources(db)
    # Ya no sembramos vacantes/evaluaciones demo: el radar usa solo fuentes reales.
    clear_demo_jobs(db)
    runs = upsert_runs(db, user)
    db.commit()
    return DemoSeedResult(
        user_email=user.email,
        profiles=len(profiles),
        jobs=0,
        credentials=len(credentials),
        runs=len(runs),
        evaluations=0,
    )


def upsert_user(db: Session) -> User:
    user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
    if not user:
        user = User(email=DEMO_EMAIL, name="Max Panra", is_demo=True)
        db.add(user)
        db.flush()
    else:
        user.name = "Max Panra"
        user.is_demo = True
    user.email_verified_at = user.email_verified_at or datetime.now(timezone.utc)
    user.onboarding_completed = True
    return user


def upsert_global_pool_user(db: Session) -> User:
    user = db.scalar(select(User).where(User.email == GLOBAL_POOL_EMAIL))
    if not user:
        user = User(email=GLOBAL_POOL_EMAIL, name="Global Job Pool", is_demo=True)
        db.add(user)
        db.flush()
    else:
        user.name = "Global Job Pool"
        user.is_demo = True
    user.email_verified_at = user.email_verified_at or datetime.now(timezone.utc)
    user.onboarding_completed = True
    return user


def upsert_theme(db: Session, user: User) -> UserTheme:
    theme = db.scalar(select(UserTheme).where(UserTheme.user_id == user.id))
    if not theme:
        theme = UserTheme(user_id=user.id)
        db.add(theme)
    theme.theme = "esmeralda"
    theme.accent = "esmeralda"
    theme.density = "comoda"
    return theme


def upsert_plans(db: Session) -> dict[str, SubscriptionPlan]:
    data = [
        {
            "code": "free",
            "name": "Free",
            "price_label": "$0",
            "description": "Pool global, 5 refresh manuales por dia y BYOK basico.",
            "features": ["Pool global", "5 refresh manuales/dia", "1 perfil activo", "BYOK local"],
            "limits": {"profiles_limit": 1, "manual_refresh_per_day": 5, "global_pool_access": True, "custom_sync": False, "deep_analysis": False},
        },
        {
            "code": "friends_family",
            "name": "Friends & Family",
            "price_label": "$0 beta",
            "description": "Plan tester con mas margen para ayudar a probar SinFro.",
            "features": ["Pool global", "15 refresh manuales/dia", "3 perfiles", "Features beta"],
            "limits": {"profiles_limit": 3, "manual_refresh_per_day": 15, "global_pool_access": True, "custom_sync": True, "deep_analysis": True, "beta_features": True},
        },
        {
            "code": "pro_byok",
            "name": "Pro BYOK",
            "price_label": "$12/mes",
            "description": "Multi-perfil, analisis profundo, sync programado y mas fuentes.",
            "features": ["5 perfiles", "Sync programado", "Analisis profundo", "Historial extendido"],
            "limits": {"profiles_limit": 5, "manual_refresh_per_day": 30, "global_pool_access": True, "custom_sync": True, "deep_analysis": True},
        },
        {
            "code": "team_byok",
            "name": "Team BYOK",
            "price_label": "$39/mes",
            "description": "Colaboracion para equipos pequenos con llaves propias.",
            "features": ["Usuarios de equipo", "Roles", "Historial compartido", "Fuentes compartidas"],
            "limits": {"profiles_limit": 20, "manual_refresh_per_day": 100, "global_pool_access": True, "custom_sync": True, "deep_analysis": True, "team_users": True},
        },
    ]
    plans: dict[str, SubscriptionPlan] = {}
    for item in data:
        plan = db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == item["code"]))
        if not plan:
            plan = SubscriptionPlan(code=item["code"])
            db.add(plan)
        plan.name = item["name"]
        plan.price_label = item["price_label"]
        plan.description = item["description"]
        plan.features = item["features"]
        plan.limits = item["limits"]
        plans[plan.code] = plan
    db.flush()
    return plans


def upsert_subscription(db: Session, user: User, plan: SubscriptionPlan) -> UserSubscription:
    subscription = db.scalar(select(UserSubscription).where(UserSubscription.user_id == user.id))
    if not subscription:
        subscription = UserSubscription(user_id=user.id, plan_id=plan.id)
        db.add(subscription)
    subscription.plan_id = plan.id
    subscription.status = "active"
    return subscription


def upsert_friend_family_code(db: Session, plan: SubscriptionPlan) -> FriendFamilyCode:
    code = db.scalar(select(FriendFamilyCode).where(FriendFamilyCode.code == "Tr4b4j0!!!"))
    if not code:
        code = FriendFamilyCode(code="Tr4b4j0!!!", plan_id=plan.id)
        db.add(code)
    code.plan_id = plan.id
    code.active = True
    code.max_redemptions = 3
    code.redeemed_user_ids = code.redeemed_user_ids or []
    return code


def ensure_users_have_subscription(db: Session, free_plan: SubscriptionPlan) -> None:
    users = db.scalars(select(User).where(User.email != GLOBAL_POOL_EMAIL)).all()
    for user in users:
        subscription = db.scalar(select(UserSubscription).where(UserSubscription.user_id == user.id))
        if not subscription:
            upsert_subscription(db, user, free_plan)


def upsert_profiles(db: Session, user: User) -> list[Profile]:
    data = [
        {
            "initials": "MP",
            "name": "Max Panra",
            "role": "Frontend / Fullstack Engineer",
            "email": "maxpanra@gmail.com",
            "english": "B2 - Avanzado",
            "location": "CDMX",
            "modality": "Remoto, Hibrido",
            "salary": "$4-6k USD",
            "cv_status": "CV analizado",
            "description": "Ingeniero en Computacion con mas de 10 anos creando productos web, arquitectura frontend, APIs y herramientas con IA generativa.",
            "keywords": ["react", "typescript", "frontend lead", "nestjs", "node.js", "fastapi", "ia generativa", "remote", "latam", "three.js"],
            "skills": [
                {"name": "React", "level": 8},
                {"name": "TypeScript", "level": 10},
                {"name": "Node.js", "level": 8},
                {"name": "NestJS", "level": 8},
                {"name": "FastAPI", "level": 7},
                {"name": "IA Generativa", "level": 8},
                {"name": "PostgreSQL", "level": 8},
                {"name": "Tailwind CSS", "level": 9},
            ],
            "active": True,
        },
        {
            "initials": "API",
            "name": "Backend API Track",
            "role": "Backend / API Engineer",
            "email": "backend@sinfro.local",
            "english": "C1 - Fluido",
            "location": "LATAM",
            "modality": "Remoto",
            "salary": "$5-7k USD",
            "cv_status": "CV pendiente",
            "description": "Perfil enfocado en APIs, integraciones, colas, observabilidad y automatizacion con Python, FastAPI, Postgres y Redis.",
            "keywords": ["python", "fastapi", "postgresql", "redis", "docker", "openai", "backend", "api integrations"],
            "skills": [
                {"name": "Python", "level": 9},
                {"name": "FastAPI", "level": 9},
                {"name": "PostgreSQL", "level": 8},
                {"name": "Redis", "level": 7},
                {"name": "Docker", "level": 8},
                {"name": "OpenAI", "level": 8},
            ],
            "active": False,
        },
    ]
    profiles: list[Profile] = []
    for item in data:
        profile = db.scalar(select(Profile).where(Profile.user_id == user.id, Profile.email == item["email"]))
        if not profile:
            profile = Profile(user_id=user.id, email=item["email"])
            db.add(profile)
        for key, value in item.items():
            setattr(profile, key, value)
        profiles.append(profile)
    db.flush()
    return profiles


def upsert_credentials(db: Session, user: User) -> list[ApiCredential]:
    data = [
        ("openai", "sk-demo-a93f", "test hace 3 h"),
        ("anthropic", "sk-ant-demo-b21x", "test hace 3 h"),
        ("serpapi", "serp-demo-77ad", "test hace 5 min"),
        ("apify", "apify_demo_c0", "test hace 12 min"),
        ("adzuna", "adzuna-demo-e1", "test hace 1 h"),
    ]
    rows: list[ApiCredential] = []
    for provider, value, last_test in data:
        credential = db.scalar(select(ApiCredential).where(ApiCredential.user_id == user.id, ApiCredential.provider == provider))
        if not credential:
            credential = ApiCredential(user_id=user.id, provider=provider, encrypted_value="", masked_value="")
            db.add(credential)
        credential.encrypted_value = encrypt_secret(value)
        credential.masked_value = mask_secret(value)
        credential.last_test = last_test
        rows.append(credential)
    return rows


def upsert_sources(db: Session) -> dict[str, JobSource]:
    data = [
        ("Indeed MX (Apify)", "scraper"),
        ("LinkedIn (SerpAPI)", "search"),
        ("Adzuna", "api"),
        ("Jooble", "api"),
        ("Workana", "scraper"),
        ("OpenCode Go", "agent"),
    ]
    sources: dict[str, JobSource] = {}
    for name, kind in data:
        source = db.scalar(select(JobSource).where(JobSource.name == name))
        if not source:
            source = JobSource(name=name)
            db.add(source)
        source.kind = kind
        source.enabled = True
        sources[name] = source
    db.flush()
    return sources


def upsert_jobs(db: Session, user: User, profiles: list[Profile], sources: dict[str, JobSource]) -> list[JobPosting]:
    # Cada perfil tiene su propia bandeja: repartimos las vacantes demo entre los
    # perfiles (frontend a Max, backend al perfil de API) para que se vea distinto.
    active = next((profile for profile in profiles if profile.active), profiles[0])
    other = next((profile for profile in profiles if profile.id != active.id), active)
    data: list[dict[str, Any]] = [
        job("Forward Deployed Engineer", "Platzi", "Indeed MX (Apify)", "Remoto", "CDMX", 92, "IA", "nueva", "hace 12 min", "", ["React", "TypeScript", "IA Generativa", "REST APIs"]),
        job("Node.js Full Stack Developer", "Xideral", "Indeed MX (Apify)", "Remoto", "CDMX", 88, "IA", "vista", "hace 38 min", "", ["Angular", "GraphQL", "NestJS", "Node.js", "PostgreSQL"]),
        job("Front-end Developer React / Next.js", "Workana", "Workana", "Remoto", "CDMX", 85, "IA", "descartada", "hace 1 h", "", ["React", "Next.js", "Tailwind"]),
        job("Principal Fullstack Engineer", "Amalga Group", "Indeed MX (Apify)", "Remoto", "Benito Juarez", 95, "IA", "nueva", "hace 1 h", "$90-120k", ["Python", "React", "TypeScript"]),
        job("Full Stack Laravel + React Developer", "Bluelight Consulting", "Indeed MX (Apify)", "Remoto", "LATAM", 78, "prelim", "vista", "hace 2 h", "", ["PHP", "React", "Vue.js", "Tailwind"]),
        job("Senior Software Engineer", "Helix", "LinkedIn (SerpAPI)", "Remoto", "CDMX", 81, "IA", "aplicada", "hace 3 h", "", ["React", "Node.js", "AWS"]),
        job("Junior Manual QA Engineer API Testing", "Lifted, an Upwork Company", "Jooble", "Remoto", "LATAM", 41, "IA", "nueva", "hace 3 h", "", ["MongoDB", "REST APIs", "QA"]),
        job("Software Engineer Backend Node.js / TS", "Lifted, an Upwork Company", "Indeed MX (Apify)", "Remoto", "LATAM", 90, "IA", "nueva", "hace 4 h", "", ["GraphQL", "MongoDB", "Node.js", "TypeScript"]),
        job("Frontend Platform Engineer", "Konfio", "LinkedIn (SerpAPI)", "Hibrido", "CDMX", 84, "prelim", "nueva", "hace 5 h", "$75-95k", ["React", "Design Systems", "TypeScript", "Testing"]),
        job("AI Product Engineer", "Clip", "Adzuna", "Remoto", "Mexico", 91, "IA", "nueva", "hace 6 h", "", ["Python", "OpenAI", "React", "FastAPI"]),
        job("Automation Engineer Job Search", "OpenCode Go", "OpenCode Go", "Remoto", "Global", 89, "IA", "nueva", "hace 7 h", "$6-8k USD", ["Python", "OpenCode", "Scraping", "Redis"]),
        job("Senior Frontend Architect", "Nubank", "LinkedIn (SerpAPI)", "Remoto", "LATAM", 93, "IA", "nueva", "hace 9 h", "", ["React", "Architecture", "TypeScript", "Design Systems"]),
    ]
    # Reparte: las que mencionan backend/python/api/node van al perfil de API;
    # el resto al perfil activo (frontend). Así cada bandeja se ve diferente.
    backend_terms = ("backend", "node", "api", "python", "qa")
    rows: list[JobPosting] = []
    for item in data:
        haystack = f"{item['title']} {' '.join(item['skills'])}".lower()
        target = other if any(term in haystack for term in backend_terms) else active
        posting = db.scalar(
            select(JobPosting).where(
                JobPosting.user_id == user.id,
                JobPosting.profile_id == target.id,
                JobPosting.title == item["title"],
                JobPosting.company == item["company"],
                JobPosting.source == item["source"],
            )
        )
        if not posting:
            posting = JobPosting(user_id=user.id, profile_id=target.id, title=item["title"], company=item["company"], source=item["source"])
            db.add(posting)
        posting.profile_id = target.id
        posting.source_id = sources[item["source"]].id
        posting.modality = item["modality"]
        posting.location = item["location"]
        posting.score = item["score"]
        posting.score_type = item["score_type"]
        posting.status = item["status"]
        posting.detected = item["detected"]
        posting.salary = item["salary"]
        posting.skills = item["skills"]
        posting.url = item["url"]
        posting.description = item["description"]
        rows.append(posting)
    db.flush()
    return rows


def upsert_evaluations(db: Session, jobs: list[JobPosting], profiles: list[Profile]) -> list[JobEvaluation]:
    rows: list[JobEvaluation] = []
    for posting in jobs:
        eval_profile_id = posting.profile_id or (next((p for p in profiles if p.active), profiles[0]).id)
        evaluation = db.scalar(
            select(JobEvaluation).where(
                JobEvaluation.job_id == posting.id,
                JobEvaluation.profile_id == eval_profile_id,
            )
        )
        if not evaluation:
            evaluation = JobEvaluation(job_id=posting.id, profile_id=eval_profile_id, score=posting.score, reasons=[], gaps=[])
            db.add(evaluation)
        top_skills = ", ".join(posting.skills[:3])
        evaluation.score = posting.score
        evaluation.reasons = [
            f"Coincidencia fuerte con skills clave: {top_skills}.",
            f"Modalidad {posting.modality.lower()} compatible con el perfil activo.",
            "El stack encaja con experiencia senior y productos SaaS.",
        ]
        evaluation.gaps = ["Confirmar rango salarial con la empresa."] if posting.score >= 85 else ["Revisar seniority y requisitos especificos antes de aplicar."]
        rows.append(evaluation)
    return rows


def upsert_runs(db: Session, user: User) -> list[JobRun]:
    data = [
        ("Indeed MX (Apify)", "running", "-", "00:48", "ahora", None),
        ("LinkedIn (SerpAPI)", "success", "9", "00:08", "hace 5 min", None),
        ("Adzuna", "success", "18", "00:24", "hace 12 min", None),
        ("Workana", "success", "12", "00:31", "hace 18 min", None),
        ("Jooble", "failed", "0", "00:03", "hace 22 min", "API key invalida (401)"),
        ("Indeed MX (Apify)", "success", "42", "01:12", "hace 41 min", None),
        ("OpenCode Go", "pending", "-", "-", "en cola", None),
    ]
    rows: list[JobRun] = []
    for source, status, found, duration, started, error in data:
        run = db.scalar(
            select(JobRun).where(
                JobRun.user_id == user.id,
                JobRun.source == source,
                JobRun.started == started,
            )
        )
        if not run:
            run = JobRun(user_id=user.id, source=source, started=started)
            db.add(run)
        run.status = status
        run.found = found
        run.duration = duration
        run.error = error
        rows.append(run)
    return rows


def job(
    title: str,
    company: str,
    source: str,
    modality: str,
    location: str,
    score: int,
    score_type: str,
    status: str,
    detected: str,
    salary: str,
    skills: list[str],
) -> dict[str, Any]:
    from urllib.parse import quote_plus
    # URL real (búsqueda) y una descripción breve para que la data demo cumpla la
    # regla "sin URL no se trae" y el análisis tenga de dónde partir.
    url = f"https://www.google.com/search?q={quote_plus(title + ' ' + company)}"
    description = (
        f"{company} busca {title} ({modality}, {location}). "
        f"Tecnologías y temas: {', '.join(skills)}. "
        "Vacante de ejemplo (demo) para probar el flujo de evaluación."
    )
    return {
        "title": title,
        "company": company,
        "source": source,
        "modality": modality,
        "location": location,
        "score": score,
        "score_type": score_type,
        "status": status,
        "detected": detected,
        "salary": salary,
        "skills": skills,
        "url": url,
        "description": description,
    }
