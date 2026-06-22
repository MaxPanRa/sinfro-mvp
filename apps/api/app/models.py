from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_verified_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())

    @property
    def isAdmin(self) -> bool:
        return self.email.strip().lower() == "maxpanra@gmail.com"


class PendingRegistration(Base):
    __tablename__ = "pending_registrations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    expires_at: Mapped[str] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    provider: Mapped[str] = mapped_column(String(60))
    provider_user_id: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255))
    encrypted_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    encrypted_refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    scopes: Mapped[list[str]] = mapped_column(JSON, default=list)
    connected_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)


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
    limits: Mapped[dict] = mapped_column(JSON, default=dict)


class UserSubscription(Base):
    __tablename__ = "user_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("subscription_plans.id"))
    status: Mapped[str] = mapped_column(String(40), default="active")
    plan: Mapped[SubscriptionPlan] = relationship()


class FriendFamilyCode(Base):
    __tablename__ = "friend_family_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("subscription_plans.id"))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    max_redemptions: Mapped[int] = mapped_column(Integer, default=3)
    redeemed_user_ids: Mapped[list[int]] = mapped_column(JSON, default=list)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
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
    plan_disabled: Mapped[bool] = mapped_column(Boolean, default=False)


class CvDocument(Base):
    __tablename__ = "cv_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id"), index=True)
    original_filename: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(120))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    storage_path: Mapped[str] = mapped_column(Text)
    encrypted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    parse_status: Mapped[str] = mapped_column(String(40), default="processed")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    uploaded_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ApiCredential(Base):
    __tablename__ = "api_credentials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    provider: Mapped[str] = mapped_column(String(80))
    encrypted_value: Mapped[str] = mapped_column(Text)
    masked_value: Mapped[str] = mapped_column(String(120))
    last_test: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Modelo elegido para proveedores de IA (p.ej. opencode-go "deepseek-v4-flash").
    model: Mapped[str | None] = mapped_column(String(120), nullable=True)


class AiTaskAssignment(Base):
    """Qué proveedor+modelo de IA hace cada tarea.

    ``task`` ∈ {"cv_read", "cv_vs_job"}. Cada tarea la hace UN solo (proveedor,
    modelo) — única por (user, task). Pero un mismo proveedor PUEDE atender varias
    tareas con modelos distintos (p.ej. OpenCode Go: deepseek lee CVs y kimi
    compara), por eso ya no es único por (user, provider).
    """

    __tablename__ = "ai_task_assignments"
    __table_args__ = (
        UniqueConstraint("user_id", "task", name="uq_ai_task_user_task"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    task: Mapped[str] = mapped_column(String(40))
    provider: Mapped[str] = mapped_column(String(80))
    model: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Asignada por el administrador: el usuario la ve activa pero no puede cambiarla.
    assigned_by_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    # Credencial a usar (NULL = la del propio usuario). En asignaciones admin apunta
    # al admin, para que el usuario consuma la API key BYOK del administrador.
    credential_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)


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
    profile_id: Mapped[int | None] = mapped_column(ForeignKey("profiles.id"), nullable=True)
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
    detected_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
    whatsapp_notified_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    salary: Mapped[str] = mapped_column(String(120), default="")
    skills: Mapped[list[str]] = mapped_column(JSON)
    discard_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class JobEvaluation(Base):
    __tablename__ = "job_evaluations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("job_postings.id"))
    profile_id: Mapped[int | None] = mapped_column(ForeignKey("profiles.id"), nullable=True)
    score: Mapped[int] = mapped_column(Integer)
    reasons: Mapped[list[str]] = mapped_column(JSON)
    gaps: Mapped[list[str]] = mapped_column(JSON)
    # Markdown enriquecido de la evaluación con IA (rápida/profunda) y su modo.
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    mode: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())


class JobRun(Base):
    __tablename__ = "job_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    profile_id: Mapped[int | None] = mapped_column(ForeignKey("profiles.id"), nullable=True)
    source: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(40))
    found: Mapped[str] = mapped_column(String(40))
    duration: Mapped[str] = mapped_column(String(40))
    started: Mapped[str] = mapped_column(String(80))
    error: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
