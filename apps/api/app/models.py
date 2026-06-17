from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    provider: Mapped[str] = mapped_column(String(60))
    provider_user_id: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255))


class UserTheme(Base):
    __tablename__ = "user_themes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    theme: Mapped[str] = mapped_column(String(40), default="esmeralda")
    accent: Mapped[str] = mapped_column(String(40), default="esmeralda")
    density: Mapped[str] = mapped_column(String(40), default="comoda")


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    price_label: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(Text)
    features: Mapped[list[str]] = mapped_column(JSON)


class UserSubscription(Base):
    __tablename__ = "user_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    plan_id: Mapped[int] = mapped_column(ForeignKey("subscription_plans.id"))
    status: Mapped[str] = mapped_column(String(40), default="active")
    plan: Mapped[SubscriptionPlan] = relationship()


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    initials: Mapped[str] = mapped_column(String(12))
    name: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255))
    english: Mapped[str] = mapped_column(String(80))
    location: Mapped[str] = mapped_column(String(120))
    modality: Mapped[str] = mapped_column(String(120))
    salary: Mapped[str] = mapped_column(String(120))
    cv_status: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    keywords: Mapped[list[str]] = mapped_column(JSON)
    skills: Mapped[list[dict]] = mapped_column(JSON)
    active: Mapped[bool] = mapped_column(Boolean, default=False)


class ApiCredential(Base):
    __tablename__ = "api_credentials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    provider: Mapped[str] = mapped_column(String(80))
    encrypted_value: Mapped[str] = mapped_column(Text)
    masked_value: Mapped[str] = mapped_column(String(120))
    last_test: Mapped[str | None] = mapped_column(String(120), nullable=True)


class JobSource(Base):
    __tablename__ = "job_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(80))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class JobPosting(Base):
    __tablename__ = "job_postings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    source_id: Mapped[int | None] = mapped_column(ForeignKey("job_sources.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255))
    company: Mapped[str] = mapped_column(String(255))
    source: Mapped[str] = mapped_column(String(120))
    modality: Mapped[str] = mapped_column(String(80))
    location: Mapped[str] = mapped_column(String(120))
    score: Mapped[int] = mapped_column(Integer)
    score_type: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(40), default="nueva")
    detected: Mapped[str] = mapped_column(String(80))
    salary: Mapped[str] = mapped_column(String(120), default="")
    skills: Mapped[list[str]] = mapped_column(JSON)


class JobEvaluation(Base):
    __tablename__ = "job_evaluations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("job_postings.id"))
    profile_id: Mapped[int | None] = mapped_column(ForeignKey("profiles.id"), nullable=True)
    score: Mapped[int] = mapped_column(Integer)
    reasons: Mapped[list[str]] = mapped_column(JSON)
    gaps: Mapped[list[str]] = mapped_column(JSON)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())


class JobRun(Base):
    __tablename__ = "job_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    source: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(40))
    found: Mapped[str] = mapped_column(String(40))
    duration: Mapped[str] = mapped_column(String(40))
    started: Mapped[str] = mapped_column(String(80))
    error: Mapped[str | None] = mapped_column(String(255), nullable=True)
