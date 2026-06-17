from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    is_demo: bool

    model_config = ConfigDict(from_attributes=True)


class ThemeIn(BaseModel):
    theme: str
    accent: str
    density: str = "comoda"


class ThemeOut(ThemeIn):
    pass


class CredentialIn(BaseModel):
    providerId: str
    apiKey: str


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


class SubscriptionOut(BaseModel):
    status: str
    plan: PlanOut
