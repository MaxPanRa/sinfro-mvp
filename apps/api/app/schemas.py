from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    is_demo: bool
    is_active: bool = True
    isAdmin: bool = False
    email_verified_at: datetime | None = None
    onboarding_completed: bool = False

    model_config = ConfigDict(from_attributes=True)


class RegisterIn(BaseModel):
    email: str
    name: str
    password: str


class RegisterStartOut(BaseModel):
    ok: bool
    email: str
    message: str
    devVerificationUrl: str | None = None


class ConfirmEmailIn(BaseModel):
    token: str


class LoginIn(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    accessToken: str
    tokenType: str = "bearer"
    user: UserOut


class ThemeIn(BaseModel):
    theme: str
    accent: str
    density: str = "comoda"


class ThemeOut(ThemeIn):
    pass


class GmailStatusOut(BaseModel):
    connected: bool
    email: str | None = None
    canSendSelfSummaries: bool = False


class GoogleAuthStartOut(BaseModel):
    authUrl: str
    redirectUri: str


class CredentialIn(BaseModel):
    providerId: str
    apiKey: str = ""
    appId: str | None = None
    appKey: str | None = None
    phoneCode: str | None = None
    phoneNumber: str | None = None


class CredentialTestIn(BaseModel):
    apiKey: str | None = None
    appId: str | None = None
    appKey: str | None = None
    phoneCode: str | None = None
    phoneNumber: str | None = None


class CredentialOut(BaseModel):
    id: str
    group: str
    name: str
    glyph: str
    iconColor: str
    status: str
    maskedKey: str
    lastTest: str


class ProfileSkillIn(BaseModel):
    name: str
    level: int = 5


class ProfileIn(BaseModel):
    initials: str = ""
    name: str
    role: str = ""
    email: str = ""
    english: str = ""
    location: str = ""
    modality: str = "Remoto"
    salary: str = ""
    cvStatus: str = "Sin CV cargado"
    description: str = ""
    keywords: list[str] = Field(default_factory=list)
    skills: list[ProfileSkillIn] = Field(default_factory=list)
    active: bool = False


class AiAssignmentItem(BaseModel):
    task: str   # "cv_read" | "cv_vs_job"
    model: str
    adminManaged: bool = False  # asignada por el admin → el usuario no la puede cambiar


class AiProviderConfigOut(BaseModel):
    """Estado de un proveedor de IA: conexión, modelos y tareas asignadas.

    ``assignments`` lista las tareas que atiende este proveedor, cada una con su
    modelo (un proveedor puede tener varias con modelos distintos).
    """
    provider: str
    name: str
    connected: bool
    models: list[str] = Field(default_factory=list)
    defaultModel: str = ""
    assignments: list[AiAssignmentItem] = Field(default_factory=list)


class AiConfigIn(BaseModel):
    provider: str
    assignments: list[AiAssignmentItem] = Field(default_factory=list)


class JobStatusIn(BaseModel):
    status: str  # nueva | vista | aplicada | descartada
    reason: str | None = None  # motivo de descarte (opcional)


class JobTranslationIn(BaseModel):
    language: str


class CoverLetterIn(BaseModel):
    language: str = "es"  # "es" | "en"


class CoverLetterOut(BaseModel):
    jobId: int
    language: str
    text: str
    engine: str


class JobTranslationOut(BaseModel):
    jobId: int
    language: str
    translatedDescription: str
    engine: str


class SubscriptionCodeIn(BaseModel):
    code: str


class AdminPlanChangeIn(BaseModel):
    planCode: str


class AdminUserStatusIn(BaseModel):
    isActive: bool


class AdminAiAssignmentItem(BaseModel):
    task: str
    provider: str
    model: str


class AdminUserOut(BaseModel):
    id: int
    email: str
    name: str
    isActive: bool
    planCode: str
    planName: str
    visibleProfiles: int
    disabledProfiles: int
    totalProfiles: int
    createdAt: datetime | None = None
    aiAssignments: list[AdminAiAssignmentItem] = Field(default_factory=list)


class AdminAiAssignIn(BaseModel):
    userIds: list[int]
    provider: str
    model: str = ""
    tasks: list[str] = Field(default_factory=list)  # "cv_read" | "cv_vs_job"


class AdminAiUnassignIn(BaseModel):
    userIds: list[int]
    tasks: list[str] = Field(default_factory=list)


class AdminCodeOut(BaseModel):
    code: str
    planCode: str
    active: bool
    maxRedemptions: int
    redeemedCount: int


class AdminCodeUpdateIn(BaseModel):
    maxRedemptions: int | None = None
    active: bool | None = None


class AdminAssignCodeIn(BaseModel):
    userIds: list[int] = Field(default_factory=list)
    sendEmail: bool = False


class AdminAssignResultOut(BaseModel):
    assigned: int
    emailed: int
    skipped: list[str] = Field(default_factory=list)


class JobEvaluationOut(BaseModel):
    jobId: int
    score: int
    reasons: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    engine: str = ""        # provider usado, p.ej. "opencode-go"
    mode: str = ""          # "quick" | "deep"
    markdown: str = ""      # evaluación enriquecida en Markdown
    hasEvaluation: bool = True
    needsSource: bool = False  # True si la vacante no trae descripción para analizar
    url: str | None = None     # enlace original (para invitar a visitar el sitio)


class PlanOut(BaseModel):
    id: int
    code: str
    name: str
    priceLabel: str
    description: str
    features: list[str]
    limits: dict = Field(default_factory=dict)


class SubscriptionOut(BaseModel):
    status: str
    plan: PlanOut
