from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    is_demo: bool
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
    apiKey: str
    phoneCode: str | None = None
    phoneNumber: str | None = None


class CredentialTestIn(BaseModel):
    apiKey: str | None = None
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
