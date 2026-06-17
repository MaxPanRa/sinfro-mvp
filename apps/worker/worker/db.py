from sqlalchemy import JSON, ForeignKey, Integer, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from worker.config import settings


class Base(DeclarativeBase):
    pass


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


def process_sync_job(run_id: int, user_id: int) -> None:
    with SessionLocal() as db:
        run = db.scalar(select(JobRun).where(JobRun.id == run_id, JobRun.user_id == user_id))
        if not run:
            return
        run.status = "success"
        run.found = "1"
        run.duration = "00:07"
        db.add(JobPosting(user_id=user_id, title="Mock Sync Frontend Engineer", company="SinFro Worker", source="Manual scan", modality="Remoto", location="LATAM", score=87, score_type="IA", status="nueva", detected="ahora", salary="", skills=["React", "FastAPI", "Redis"]))
        db.commit()
