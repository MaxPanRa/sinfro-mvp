import base64
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
import hashlib
import html
import json
import re
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

from cryptography.fernet import Fernet
from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, create_engine, delete, func, select
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


class ApiCredential(Base):
    __tablename__ = "api_credentials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    provider: Mapped[str] = mapped_column(String(80))
    encrypted_value: Mapped[str] = mapped_column(Text)
    masked_value: Mapped[str] = mapped_column(String(120))
    last_test: Mapped[str | None] = mapped_column(String(120))


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
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    url: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    salary: Mapped[str] = mapped_column(String(120))
    skills: Mapped[list[str]] = mapped_column(JSON)


class JobEvaluation(Base):
    __tablename__ = "job_evaluations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("job_postings.id"))


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
USER_AGENT = "SinFro MVP job sync (contact: developer@maxpanra.xyz)"
PRIMARY = "#4338ca"
PRIMARY_DARK = "#3730a3"

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
    "Mock Sync Frontend Engineer",
}
REAL_SOURCE_NAMES = {
    "RemoteOK",
    "Remotive",
    "Jobicy",
    "Arbeitnow",
    "Himalayas",
    "WorkingNomads",
    "GetOnBoard",
    "HackerNews",
    "WeWorkRemotely",
    "Jobspresso",
    "Jooble",
    "Adzuna",
    "SerpAPI",
    "Apify",
}
SOFTWARE_KEYWORDS = {
    "api",
    "backend",
    "data analyst",
    "data scientist",
    "developer",
    "devops",
    "engineer",
    "fastapi",
    "frontend",
    "fullstack",
    "javascript",
    "node",
    "python",
    "react",
    "software",
    "typescript",
}


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


def process_sync_job(
    run_id: int,
    user_id: int,
    target_user_id: int | None = None,
    job_family: str = "software",
    summary_minutes: int = 60,
) -> None:
    started_at = datetime.now(timezone.utc)
    with SessionLocal() as db:
        run = db.scalar(select(JobRun).where(JobRun.id == run_id, JobRun.user_id == user_id))
        if not run:
            return
        owner_id = target_user_id or user_id
        try:
            credentials = load_api_credentials(db, user_id)
            fetched_jobs = fetch_all_real_jobs(job_family=job_family, credentials=credentials)
            if fetched_jobs:
                clear_demo_seed_jobs(db, owner_id)
                clear_non_matching_real_jobs(db, owner_id)
            inserted = upsert_real_jobs(db, owner_id, fetched_jobs)
            run.status = "success"
            run.found = str(inserted)
            run.duration = duration_label(started_at)
            run.error = None
            db.commit()
        except Exception as exc:
            db.rollback()
            run = db.scalar(select(JobRun).where(JobRun.id == run_id, JobRun.user_id == user_id))
            if not run:
                return
            run.status = "failed"
            run.found = "0"
            run.duration = duration_label(started_at)
            run.error = f"Job sync error: {exc}"[:255]
            db.commit()
            print(f"real job sync failed: {exc}")
            return

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
                summary = build_scan_summary(db, owner_id, summary_minutes)
                send_self_summary(access_token, user.email, summary)
        except Exception as exc:
            print(f"gmail summary skipped: {exc}")


def load_api_credentials(db, user_id: int) -> dict[str, str]:
    rows = db.scalars(select(ApiCredential).where(ApiCredential.user_id == user_id)).all()
    credentials: dict[str, str] = {}
    for row in rows:
        try:
            value = decrypt_secret(row.encrypted_value)
            if credential_is_usable(value):
                credentials[row.provider] = value
        except Exception as exc:
            print(f"{row.provider} credential skipped: {exc}")
    return credentials


def fetch_all_real_jobs(job_family: str = "software", credentials: dict[str, str] | None = None) -> list[dict[str, Any]]:
    credentials = credentials or {}
    source_calls = [
        ("RemoteOK", lambda: fetch_remoteok_jobs(limit=35)),
        ("Remotive", lambda: fetch_remotive_jobs(limit=35)),
        ("Jobicy", lambda: fetch_jobicy_jobs(limit=35)),
        ("Arbeitnow", lambda: fetch_arbeitnow_jobs(limit=30)),
        ("Himalayas", lambda: fetch_himalayas_jobs(limit=30)),
        ("WorkingNomads", lambda: fetch_workingnomads_jobs(limit=30)),
        ("GetOnBoard", lambda: fetch_getonboard_jobs(limit=30)),
        ("HackerNews", lambda: fetch_hackernews_jobs(limit=20)),
        ("WeWorkRemotely", lambda: fetch_rss_jobs("WeWorkRemotely", "https://weworkremotely.com/remote-jobs.rss", limit=25)),
        ("Jobspresso", lambda: fetch_rss_jobs("Jobspresso", "https://jobspresso.co/?feed=job_feed", limit=25)),
    ]
    if credentials.get("jooble"):
        source_calls.append(("Jooble", lambda: fetch_jooble_jobs(credentials["jooble"], limit=35)))
    adzuna = parse_adzuna_credential(credentials.get("adzuna", ""))
    if adzuna:
        source_calls.append(("Adzuna", lambda: fetch_adzuna_jobs(adzuna["app_id"], adzuna["app_key"], limit=35)))
    if credentials.get("serpapi"):
        source_calls.append(("SerpAPI", lambda: fetch_serpapi_jobs(credentials["serpapi"], limit=25)))
    if credentials.get("apify"):
        source_calls.append(("Apify", lambda: fetch_apify_jobs(credentials["apify"], limit=25)))
    jobs: list[dict[str, Any]] = []
    for name, fetcher in source_calls:
        try:
            jobs.extend(fetcher())
        except Exception as exc:
            print(f"{name} skipped: {exc}")

    deduped: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for job in jobs:
        if job_family == "software" and not is_software_job(job):
            continue
        key = (normalize_key(job["title"]), normalize_key(job["company"]), job["source"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(job)
    return sorted(deduped, key=lambda item: item["score"], reverse=True)[:160]


def fetch_remoteok_jobs(limit: int = 25) -> list[dict[str, Any]]:
    payload = http_json("https://remoteok.com/api")
    rows = payload if isinstance(payload, list) else []
    jobs: list[dict[str, Any]] = []
    for item in rows:
        if not isinstance(item, dict) or "position" not in item:
            continue
        tags = [str(tag).strip() for tag in item.get("tags") or [] if str(tag).strip()]
        salary = salary_label(item.get("salary_min"), item.get("salary_max"))
        jobs.append(make_job(
            title=item.get("position") or item.get("title"),
            company=item.get("company"),
            source="RemoteOK",
            url=item.get("url") or item.get("apply_url"),
            location=item.get("location") or "Remote",
            modality="Remoto",
            description=item.get("description") or " ".join(tags),
            salary=salary,
            tags=tags,
            detected=item.get("date"),
        ))
        if len(jobs) >= limit:
            break
    return [job for job in jobs if job]


def fetch_remotive_jobs(limit: int = 35) -> list[dict[str, Any]]:
    payload = http_json("https://remotive.com/api/remote-jobs?limit=100")
    return compact_jobs([
        make_job(
            title=item.get("title"),
            company=item.get("company_name"),
            source="Remotive",
            url=item.get("url"),
            location=item.get("candidate_required_location") or "Remoto",
            modality="Remoto",
            description=item.get("description"),
        )
        for item in payload.get("jobs", [])
    ], limit)


def fetch_jobicy_jobs(limit: int = 35) -> list[dict[str, Any]]:
    payload = http_json("https://jobicy.com/api/v2/remote-jobs", {"count": 60})
    return compact_jobs([
        make_job(
            title=item.get("jobTitle"),
            company=item.get("companyName"),
            source="Jobicy",
            url=item.get("url"),
            location=item.get("jobGeo") or "Remoto",
            modality="Remoto",
            description=item.get("jobDescription") or item.get("jobExcerpt"),
            tags=[item.get("jobIndustry") or "", item.get("jobLevel") or ""],
            detected=item.get("pubDate"),
        )
        for item in payload.get("jobs", [])
    ], limit)


def fetch_arbeitnow_jobs(limit: int = 30) -> list[dict[str, Any]]:
    payload = http_json("https://www.arbeitnow.com/api/job-board-api")
    return compact_jobs([
        make_job(
            title=item.get("title"),
            company=item.get("company_name"),
            source="Arbeitnow",
            url=item.get("url"),
            location=item.get("location") or ("Remoto" if item.get("remote") else ""),
            modality="Remoto" if item.get("remote") else "",
            description=item.get("description"),
            tags=item.get("tags") or item.get("job_types") or [],
            detected=item.get("created_at"),
        )
        for item in payload.get("data", [])
    ], limit)


def fetch_himalayas_jobs(limit: int = 30) -> list[dict[str, Any]]:
    jobs: list[dict[str, Any]] = []
    for offset in range(0, 60, 20):
        payload = http_json("https://himalayas.app/jobs/api", {"limit": 20, "offset": offset})
        for item in payload.get("jobs", []):
            locations = item.get("locationRestrictions") or []
            location = ", ".join(locations) if isinstance(locations, list) else str(locations or "")
            salary = salary_label(item.get("minSalary"), item.get("maxSalary"), item.get("salaryCurrency") or "USD")
            url = item.get("applicationLink") or item.get("url") or (f"https://himalayas.app/jobs/{item['guid']}" if item.get("guid") else "")
            jobs.append(make_job(
                title=item.get("title"),
                company=item.get("companyName") or item.get("company"),
                source="Himalayas",
                url=url,
                location=location or "Remoto",
                modality="Remoto",
                description=item.get("description") or item.get("excerpt"),
                salary=salary,
                tags=[item.get("seniority") or "", item.get("employmentType") or ""],
                detected=item.get("pubDate"),
            ))
            if len(jobs) >= limit:
                return compact_jobs(jobs, limit)
    return compact_jobs(jobs, limit)


def fetch_workingnomads_jobs(limit: int = 30) -> list[dict[str, Any]]:
    payload = http_json("https://www.workingnomads.com/api/exposed_jobs/")
    rows = payload if isinstance(payload, list) else payload.get("jobs", [])
    return compact_jobs([
        make_job(
            title=item.get("title"),
            company=item.get("company_name") or item.get("company"),
            source="WorkingNomads",
            url=item.get("url"),
            location=item.get("location") or "Remoto",
            modality="Remoto",
            description=item.get("description"),
            tags=item.get("tags") or item.get("category_name") or [],
            detected=item.get("pub_date"),
        )
        for item in rows if isinstance(item, dict)
    ], limit)


def fetch_getonboard_jobs(limit: int = 30) -> list[dict[str, Any]]:
    payload = http_json(
        "https://www.getonbrd.com/api/v0/categories/programming/jobs",
        {"per_page": 80, "expand": '["company"]'},
    )
    jobs: list[dict[str, Any]] = []
    for item in payload.get("data", []):
        attrs = item.get("attributes") or {}
        company = attrs.get("company")
        company_name = ""
        if isinstance(company, dict):
            company_name = ((company.get("data") or {}).get("attributes") or {}).get("name") or ""
        elif isinstance(company, str):
            company_name = company
        countries = attrs.get("countries") or []
        location = ", ".join(countries) if isinstance(countries, list) else ""
        salary = salary_label(attrs.get("min_salary"), attrs.get("max_salary"))
        jobs.append(make_job(
            title=attrs.get("title"),
            company=company_name or attrs.get("company_name"),
            source="GetOnBoard",
            url=(item.get("links") or {}).get("public_url"),
            location=location or ("Remoto" if attrs.get("remote") else ""),
            modality="Remoto" if attrs.get("remote") else (attrs.get("remote_modality") or ""),
            description=attrs.get("description") or attrs.get("functions"),
            salary=salary,
            tags=[attrs.get("category_name") or "", attrs.get("modality") or ""],
        ))
    return compact_jobs(jobs, limit)


def fetch_hackernews_jobs(limit: int = 20) -> list[dict[str, Any]]:
    search = http_json(
        "https://hn.algolia.com/api/v1/search_by_date",
        {"query": "Ask HN: Who is hiring?", "tags": "story,author_whoishiring", "hitsPerPage": 1},
    )
    hits = search.get("hits", [])
    if not hits:
        return []
    story_id = hits[0].get("objectID")
    payload = http_json(f"https://hn.algolia.com/api/v1/items/{story_id}")
    jobs: list[dict[str, Any]] = []
    for child in payload.get("children", [])[:120]:
        text = clean_html(child.get("text"))
        if not text or len(text) < 40:
            continue
        first = text.split(".")[0][:160]
        company = first.split("|")[0].strip()[:80] or child.get("author") or "Hacker News"
        title = first if "|" not in first else " | ".join(part.strip() for part in first.split("|")[1:3])
        jobs.append(make_job(
            title=(title or first)[:160],
            company=company,
            source="HackerNews",
            url=f"https://news.ycombinator.com/item?id={child.get('id')}",
            location="",
            modality="",
            description=text,
        ))
        if len(jobs) >= limit:
            break
    return compact_jobs(jobs, limit)


def fetch_rss_jobs(source: str, url: str, limit: int = 25) -> list[dict[str, Any]]:
    raw = http_text(url)
    root = ET.fromstring(raw)
    jobs: list[dict[str, Any]] = []
    for item in root.findall(".//item"):
        title = node_text(item, "title")
        link = node_text(item, "link")
        description = node_text(item, "description")
        company = source
        if ":" in title:
            company, title = [part.strip() for part in title.split(":", 1)]
        jobs.append(make_job(
            title=title,
            company=company,
            source=source,
            url=link,
            location="Remoto",
            modality="Remoto",
            description=description,
            detected=node_text(item, "pubDate"),
        ))
        if len(jobs) >= limit:
            break
    return compact_jobs(jobs, limit)


def fetch_jooble_jobs(api_key: str, limit: int = 35) -> list[dict[str, Any]]:
    payload = http_post_json(
        f"https://mx.jooble.org/api/{api_key}",
        {
            "keywords": "software engineer developer react python data analyst",
            "location": "Mexico",
            "page": 1,
        },
    )
    return compact_jobs([
        make_job(
            title=item.get("title"),
            company=item.get("company"),
            source="Jooble",
            url=item.get("link"),
            location=item.get("location") or "Mexico",
            modality="Remoto" if "remote" in f"{item.get('title')} {item.get('snippet')}".lower() else "",
            description=item.get("snippet"),
            salary=item.get("salary") or "",
            detected=item.get("updated") or item.get("date"),
        )
        for item in payload.get("jobs", [])
    ], limit)


def fetch_adzuna_jobs(app_id: str, app_key: str, limit: int = 35) -> list[dict[str, Any]]:
    payload = http_json(
        "https://api.adzuna.com/v1/api/jobs/mx/search/1",
        {
            "app_id": app_id,
            "app_key": app_key,
            "results_per_page": limit,
            "what": "software developer react python data analyst",
            "content-type": "application/json",
        },
    )
    jobs = []
    for item in payload.get("results", []):
        company = item.get("company") or {}
        location = item.get("location") or {}
        areas = location.get("area") or []
        jobs.append(make_job(
            title=item.get("title"),
            company=company.get("display_name") if isinstance(company, dict) else "",
            source="Adzuna",
            url=item.get("redirect_url"),
            location=", ".join(areas) if isinstance(areas, list) else "",
            modality="",
            description=item.get("description"),
            salary=salary_label(item.get("salary_min"), item.get("salary_max"), item.get("salary_currency") or "MXN"),
            detected=item.get("created"),
        ))
    return compact_jobs(jobs, limit)


def fetch_serpapi_jobs(api_key: str, limit: int = 25) -> list[dict[str, Any]]:
    payload = http_json(
        "https://serpapi.com/search.json",
        {
            "engine": "google_jobs",
            "q": "software developer OR react OR python jobs Mexico remote",
            "hl": "es",
            "api_key": api_key,
        },
    )
    jobs = []
    for item in payload.get("jobs_results", []):
        jobs.append(make_job(
            title=item.get("title"),
            company=item.get("company_name"),
            source="SerpAPI",
            url=(item.get("apply_options") or [{}])[0].get("link") if isinstance(item.get("apply_options"), list) else item.get("share_link"),
            location=item.get("location"),
            modality="Remoto" if "remote" in f"{item.get('title')} {item.get('description')}".lower() else "",
            description=item.get("description"),
            detected=item.get("detected_extensions", {}).get("posted_at") if isinstance(item.get("detected_extensions"), dict) else None,
        ))
    return compact_jobs(jobs, limit)


def fetch_apify_jobs(token: str, limit: int = 25) -> list[dict[str, Any]]:
    actor = "misceres/indeed-scraper"
    url = f"https://api.apify.com/v2/acts/{actor.replace('/', '~')}/run-sync-get-dataset-items?token={token}"
    payload = http_post_json(
        url,
        {
            "position": "software developer",
            "country": "MX",
            "location": "Mexico",
            "maxItems": limit,
            "parseCompanyDetails": False,
            "saveOnlyUniqueItems": True,
        },
    )
    rows = payload if isinstance(payload, list) else []
    return compact_jobs([
        make_job(
            title=item.get("positionName") or item.get("title"),
            company=item.get("company") or item.get("companyName"),
            source="Apify",
            url=item.get("url") or item.get("jobUrl"),
            location=item.get("location"),
            modality="Remoto" if "remote" in f"{item.get('title')} {item.get('description')}".lower() else "",
            description=item.get("description"),
            salary=item.get("salary") or "",
            detected=item.get("postedAt") or item.get("date"),
        )
        for item in rows if isinstance(item, dict)
    ], limit)


def http_json(url: str, params: dict[str, Any] | None = None) -> Any:
    full_url = f"{url}?{urlencode(params)}" if params else url
    request = Request(full_url, headers={"Accept": "application/json", "User-Agent": USER_AGENT})
    with urlopen(request, timeout=25) as response:
        return json.loads(response.read().decode("utf-8", errors="replace"))


def http_post_json(url: str, payload: dict[str, Any]) -> Any:
    data = json.dumps(payload).encode("utf-8")
    request = Request(url, data=data, method="POST", headers={"Accept": "application/json", "Content-Type": "application/json", "User-Agent": USER_AGENT})
    with urlopen(request, timeout=45) as response:
        return json.loads(response.read().decode("utf-8", errors="replace"))


def http_text(url: str) -> str:
    request = Request(url, headers={"Accept": "application/rss+xml,text/xml,text/html", "User-Agent": USER_AGENT})
    with urlopen(request, timeout=25) as response:
        return response.read().decode("utf-8", errors="replace")


def make_job(
    *,
    title: Any,
    company: Any,
    source: str,
    url: Any = "",
    location: Any = "",
    modality: str = "",
    description: Any = "",
    salary: str = "",
    tags: Any = None,
    detected: Any = None,
) -> dict[str, Any]:
    clean_title = str(title or "").strip()
    clean_company = str(company or "").strip() or source
    if not clean_title:
        return {}
    tag_list = normalize_tags(tags)
    desc = clean_html(description)
    return {
        "title": clean_title[:255],
        "company": clean_company[:255],
        "source": source,
        "modality": (modality or "Remoto")[:80],
        "location": str(location or "Remoto").strip()[:120] or "Remoto",
        "score": score_real_job(clean_title, tag_list, desc),
        "score_type": "prelim",
        "status": "nueva",
        "detected": detected_label(detected),
        "url": str(url or "").strip(),
        "description": desc[:4000],
        "salary": salary[:120],
        "skills": tag_list[:8] or infer_skills(f"{clean_title} {desc}"),
    }


def compact_jobs(jobs: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    return [job for job in jobs if job][:limit]


def parse_adzuna_credential(raw: str) -> dict[str, str] | None:
    if not raw:
        return None
    try:
        data = json.loads(raw)
        app_id = str(data.get("app_id") or data.get("appId") or "").strip()
        app_key = str(data.get("app_key") or data.get("appKey") or "").strip()
    except json.JSONDecodeError:
        if ":" not in raw:
            return None
        app_id, app_key = [part.strip() for part in raw.split(":", 1)]
    if not app_id or not app_key:
        return None
    return {"app_id": app_id, "app_key": app_key}


def credential_is_usable(value: str) -> bool:
    lowered = value.strip().lower()
    if len(lowered) < 8:
        return False
    placeholders = ("demo", "fake", "placeholder", "test-", "sample", "your_", "tu_")
    return not any(token in lowered for token in placeholders)


def upsert_real_jobs(db, owner_id: int, jobs: list[dict[str, Any]]) -> int:
    changed = 0
    for item in jobs:
        posting = db.scalar(
            select(JobPosting).where(
                JobPosting.user_id == owner_id,
                JobPosting.title == item["title"],
                JobPosting.company == item["company"],
                JobPosting.source == item["source"],
            )
        )
        if not posting:
            posting = JobPosting(
                user_id=owner_id,
                title=item["title"],
                company=item["company"],
                source=item["source"],
                detected_at=datetime.now(timezone.utc),
            )
            db.add(posting)
            changed += 1
        posting.modality = item["modality"]
        posting.location = item["location"]
        posting.score = item["score"]
        posting.score_type = item["score_type"]
        posting.status = posting.status or item["status"]
        posting.detected = item["detected"]
        posting.url = item["url"]
        posting.description = item["description"]
        posting.salary = item["salary"]
        posting.skills = item["skills"]
    return changed


def clear_demo_seed_jobs(db, owner_id: int) -> None:
    job_ids = db.scalars(select(JobPosting.id).where(JobPosting.user_id == owner_id, JobPosting.title.in_(DEMO_JOB_TITLES))).all()
    if not job_ids:
        return
    db.execute(delete(JobEvaluation).where(JobEvaluation.job_id.in_(job_ids)))
    db.execute(delete(JobPosting).where(JobPosting.id.in_(job_ids)))


def clear_non_matching_real_jobs(db, owner_id: int) -> None:
    rows = db.scalars(select(JobPosting).where(JobPosting.user_id == owner_id, JobPosting.source.in_(REAL_SOURCE_NAMES))).all()
    job_ids = [row.id for row in rows if not is_software_job({"title": row.title, "description": row.description or "", "skills": row.skills or []})]
    if not job_ids:
        return
    db.execute(delete(JobEvaluation).where(JobEvaluation.job_id.in_(job_ids)))
    db.execute(delete(JobPosting).where(JobPosting.id.in_(job_ids)))


def build_scan_summary(db, owner_id: int, minutes: int) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=minutes)
    all_jobs = db.scalars(select(JobPosting).where(JobPosting.user_id == owner_id).order_by(JobPosting.score.desc())).all()
    recent_jobs = [job for job in all_jobs if ensure_aware(job.detected_at) >= cutoff]
    compatible_prelim = sum(1 for job in recent_jobs if job.score >= 70 and job.score_type.lower() != "ia")
    compatible_ai = sum(1 for job in recent_jobs if job.score >= 70 and job.score_type.lower() == "ia")
    return {
        "now": now.astimezone().strftime("%Y-%m-%d %H:%M"),
        "minutes": minutes,
        "total": len(all_jobs),
        "new_total": len(recent_jobs),
        "compatible_prelim": compatible_prelim,
        "compatible_ai": compatible_ai,
        "compatible_total": sum(1 for job in all_jobs if job.score >= 70),
        "applied": sum(1 for job in all_jobs if job.status == "aplicada"),
        "visited": sum(1 for job in all_jobs if job.status == "vista"),
        "discarded": sum(1 for job in all_jobs if job.status == "descartada"),
        "unseen": sum(1 for job in all_jobs if job.status == "nueva"),
        "recent": sorted(recent_jobs, key=lambda row: row.score, reverse=True),
    }


def send_self_summary(access_token: str, to_email: str, summary: dict[str, Any]) -> None:
    subject = f"SinFro: {summary['new_total']} nuevas / {summary['total']} total"
    message = EmailMessage()
    message["To"] = to_email
    message["From"] = to_email
    message["Subject"] = subject
    text_body, html_body = render_summary_email(summary)
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    payload = json.dumps({"raw": raw}).encode("utf-8")
    request = Request("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", data=payload, method="POST")
    request.add_header("Authorization", f"Bearer {access_token}")
    request.add_header("Content-Type", "application/json")
    with urlopen(request, timeout=20) as response:
        response.read()


def render_summary_email(summary: dict[str, Any]) -> tuple[str, str]:
    recent = summary["recent"]
    compatible = summary["compatible_prelim"] + summary["compatible_ai"]
    text_lines = [
        f"Resumen SinFro - {summary['now']}",
        f"Periodo: ultimos {summary['minutes']} minutos",
        "",
        f"Total en pool: {summary['total']}",
        f"Nuevas: {summary['new_total']}",
        f"Compatibles preliminares: {summary['compatible_prelim']}",
        f"Compatibles AI: {summary['compatible_ai']}",
        "",
        "Top 5:",
    ]
    text_lines.extend(summary_line(job) for job in recent[:5])
    text_lines.extend(["", "Todas las nuevas:"])
    text_lines.extend(summary_line(job) for job in recent)
    text_body = "\n".join(text_lines)

    top = "".join(top_card(index, job) for index, job in enumerate(recent[:5], start=1))
    rows = "".join(job_row(job) for job in recent) or '<tr><td style="padding:14px;color:#6b7280;">Sin vacantes nuevas en este periodo.</td></tr>'
    stats = stats_grid([
        ("Nuevas", summary["new_total"], True),
        ("Compatibles prelim.", summary["compatible_prelim"], True),
        ("Compatibles AI", summary["compatible_ai"], True),
        ("Total pool", summary["total"], False),
        ("Compatibles total", summary["compatible_total"], False),
        ("Aplicadas", summary["applied"], False),
        ("Visitadas", summary["visited"], False),
        ("No vistas", summary["unseen"], False),
    ])
    html_body = f"""\
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#eef0f4;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f4;padding:24px 12px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(16,24,40,.08);">
  <tr><td style="background:{PRIMARY};padding:24px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:.5px;">SinFro</td>
      <td align="right" style="font-size:12px;color:#c7d2fe;">{escape(summary["now"])}</td>
    </tr></table>
    <div style="margin-top:8px;font-size:13px;color:#dbe1ff;">Pool global · ultimos {summary["minutes"]} minutos</div>
  </td></tr>
  <tr><td style="padding:24px 28px 8px 28px;">
    <div style="font-size:15px;color:#111827;">
      <b style="color:{PRIMARY_DARK};font-size:17px;">{summary["new_total"]}</b> vacantes nuevas ·
      <b style="color:#16a34a;">{compatible}</b> compatibles
    </div>
    <div style="height:14px;"></div>
    {stats}
  </td></tr>
  <tr><td style="padding:0 28px;">
    {section_title("Top 5 por compatibilidad")}
    <table width="100%" cellpadding="0" cellspacing="0">{top}</table>
    {section_title(f"Todas las nuevas ({summary['new_total']})")}
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eceef2;border-radius:12px;border-collapse:separate;overflow:hidden;">{rows}</table>
  </td></tr>
  <tr><td style="padding:24px 28px;">
    <div style="border-top:1px solid #eceef2;padding-top:16px;font-size:11px;color:#9ca3af;line-height:1.5;">
      Resumen automatico generado por SinFro. Los enlaces llevan a la publicacion original de cada vacante.
    </div>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""
    return text_body, html_body


def summary_line(job: JobPosting) -> str:
    url = job.url or "sin liga"
    return f"{job.title} ({job.company}) - {job.score}% - {job.source} - {url}"


def stats_grid(cards: list[tuple[str, Any, bool]]) -> str:
    html_cards = [stat_card(label, value, accent) for label, value, accent in cards]
    rows = "".join("<tr>" + "".join(html_cards[index:index + 4]) + "</tr>" for index in range(0, len(html_cards), 4))
    return f'<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">{rows}</table>'


def stat_card(label: str, value: Any, accent: bool = False) -> str:
    num_color = PRIMARY if accent else "#111827"
    bg = "#eef2ff" if accent else "#f9fafb"
    border = "#c7d2fe" if accent else "#eceef2"
    return (
        '<td width="25%" style="padding:5px;">'
        f'<div style="background:{bg};border:1px solid {border};border-radius:12px;padding:14px 8px;text-align:center;">'
        f'<div style="font-size:24px;font-weight:700;color:{num_color};line-height:1;">{value}</div>'
        f'<div style="font-size:10px;color:#6b7280;margin-top:5px;letter-spacing:.4px;text-transform:uppercase;">{escape(label)}</div>'
        '</div></td>'
    )


def top_card(rank: int, job: JobPosting) -> str:
    meta = " · ".join(filter(None, [escape(job.company), escape(job.source), escape(job.location)]))
    description = escape((job.description or "").strip()[:150])
    description_html = f'<div style="font-size:12px;color:#6b7280;margin-top:6px;line-height:1.4;">{description}</div>' if description else ""
    meta_html = f'<div style="font-size:12px;color:#9ca3af;margin-top:3px;">{meta}</div>' if meta else ""
    title = job_link(job, escape(job.title))
    return (
        '<tr><td style="padding:0 0 10px 0;">'
        f'<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background:#ffffff;border:1px solid #eceef2;border-radius:12px;border-left:4px solid {score_color(job.score)};">'
        '<tr>'
        '<td valign="top" width="56" style="padding:14px 0 14px 14px;">'
        f'<div style="font-size:11px;color:#9ca3af;font-weight:700;margin-bottom:6px;">#{rank}</div>{badge(job.score)}'
        '</td>'
        '<td valign="top" style="padding:14px 14px 14px 12px;">'
        f'<div style="font-size:15px;font-weight:600;color:#111827;line-height:1.35;">{title}</div>'
        f'{meta_html}{description_html}'
        '</td></tr></table></td></tr>'
    )


def job_row(job: JobPosting) -> str:
    name = job_link(job, escape(job.title))
    company = escape(job.company or "")
    if company:
        name += f' <span style="color:#9ca3af;">· {company}</span>'
    return (
        '<tr>'
        f'<td style="padding:9px 12px;border-bottom:1px solid #f1f2f4;width:60px;vertical-align:top;">{badge(job.score)}</td>'
        f'<td style="padding:9px 12px;border-bottom:1px solid #f1f2f4;font-size:14px;color:#111827;vertical-align:top;">{name}</td>'
        '</tr>'
    )


def job_link(job: JobPosting, text_html: str) -> str:
    if not job.url:
        return text_html
    return f'<a href="{escape(job.url, quote=True)}" style="color:#1d4ed8;text-decoration:none;">{text_html}</a>'


def badge(score: int | None) -> str:
    text = f"{score}%" if score is not None else "s/p"
    return (
        f'<span style="display:inline-block;min-width:46px;text-align:center;background:{score_color(score)};'
        f'color:#ffffff;font-size:13px;font-weight:700;border-radius:8px;padding:5px 8px;">{text}</span>'
    )


def section_title(text: str) -> str:
    return f'<h2 style="margin:26px 0 12px 0;font-size:14px;color:{PRIMARY_DARK};text-transform:uppercase;letter-spacing:.5px;">{escape(text)}</h2>'


def score_color(score: int | None) -> str:
    value = score or 0
    if value >= 70:
        return "#16a34a"
    if value >= 40:
        return "#d97706"
    return "#6b7280"


def clean_html(value: Any) -> str:
    text = re.sub(r"<[^>]+>", " ", str(value or ""))
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def escape(value: Any, quote: bool = False) -> str:
    return html.escape(str(value or ""), quote=quote)


def node_text(node: ET.Element, child_name: str) -> str:
    child = node.find(child_name)
    return child.text.strip() if child is not None and child.text else ""


def normalize_tags(tags: Any) -> list[str]:
    if isinstance(tags, str):
        raw = re.split(r"[,;/|]", tags)
    elif isinstance(tags, list):
        raw = tags
    else:
        raw = []
    return [str(tag).strip() for tag in raw if str(tag or "").strip()]


def normalize_key(value: str) -> str:
    return re.sub(r"\s+", " ", value.lower()).strip()


def is_software_job(job: dict[str, Any]) -> bool:
    title = str(job.get("title") or "").lower()
    description = str(job.get("description") or "").lower()
    skills = " ".join(str(skill) for skill in job.get("skills") or []).lower()
    title_tokens = set(re.findall(r"[a-z0-9+#.]+", title))
    title_phrases = {
        "data analyst",
        "data scientist",
        "full stack",
        "full-stack",
        "software engineer",
        "software developer",
    }
    if any(phrase in title for phrase in title_phrases):
        return True
    if title_tokens.intersection(SOFTWARE_KEYWORDS):
        return True
    return any(keyword in f"{description} {skills}" for keyword in ["react", "typescript", "python", "fastapi", "backend", "frontend"])


def score_real_job(title: str, tags: list[str], description: str = "") -> int:
    haystack = f"{title} {' '.join(tags)} {description}".lower()
    score = 62
    for keyword in ["react", "typescript", "python", "fastapi", "node", "backend", "frontend", "fullstack", "api", "data"]:
        if keyword in haystack:
            score += 4
    if "remote" in haystack or "remoto" in haystack:
        score += 3
    if "senior" in haystack or "principal" in haystack or "lead" in haystack:
        score += 5
    return min(score, 96)


def infer_skills(text: str) -> list[str]:
    detected = []
    haystack = text.lower()
    mapping = {
        "api": "API",
        "backend": "Backend",
        "frontend": "Frontend",
        "fullstack": "Fullstack",
        "javascript": "JavaScript",
        "node": "Node.js",
        "python": "Python",
        "react": "React",
        "typescript": "TypeScript",
        "data": "Data",
    }
    for key, label in mapping.items():
        if key in haystack:
            detected.append(label)
    return detected or ["Remote"]


def salary_label(minimum, maximum, currency: str = "USD") -> str:
    try:
        min_value = int(float(minimum or 0))
        max_value = int(float(maximum or 0))
    except (TypeError, ValueError):
        return ""
    if min_value and max_value:
        return f"${min_value:,}-${max_value:,} {currency}"
    if max_value:
        return f"Hasta ${max_value:,} {currency}"
    if min_value:
        return f"Desde ${min_value:,} {currency}"
    return ""


def detected_label(value) -> str:
    if not value:
        return "reciente"
    try:
        if isinstance(value, (int, float)):
            parsed = datetime.fromtimestamp(float(value), timezone.utc)
        else:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        delta = datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)
        hours = max(0, int(delta.total_seconds() // 3600))
        if hours < 1:
            return "hace menos de 1 h"
        if hours < 24:
            return f"hace {hours} h"
        return f"hace {hours // 24} d"
    except (TypeError, ValueError):
        return "reciente"


def ensure_aware(value: datetime) -> datetime:
    if value.tzinfo:
        return value.astimezone(timezone.utc)
    return value.replace(tzinfo=timezone.utc)


def duration_label(started_at: datetime) -> str:
    seconds = max(0, int((datetime.now(timezone.utc) - started_at).total_seconds()))
    return f"00:{seconds:02d}" if seconds < 60 else f"{seconds // 60:02d}:{seconds % 60:02d}"
