import base64
from email.message import EmailMessage
import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.core.config import settings

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"


def build_google_auth_url(state: str) -> str:
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile " + GMAIL_SEND_SCOPE,
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def exchange_code(code: str) -> dict:
    payload = urlencode(
        {
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri,
            "grant_type": "authorization_code",
        }
    ).encode("utf-8")
    request = Request(GOOGLE_TOKEN_URL, data=payload, method="POST")
    request.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def get_google_userinfo(access_token: str) -> dict:
    request = Request(GOOGLE_USERINFO_URL)
    request.add_header("Authorization", f"Bearer {access_token}")
    with urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def send_gmail_message(access_token: str, to_email: str, subject: str, body: str) -> None:
    message = EmailMessage()
    message["To"] = to_email
    message["From"] = to_email
    message["Subject"] = subject
    message.set_content(body)
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    payload = json.dumps({"raw": raw}).encode("utf-8")
    request = Request(GMAIL_SEND_URL, data=payload, method="POST")
    request.add_header("Authorization", f"Bearer {access_token}")
    request.add_header("Content-Type", "application/json")
    with urlopen(request, timeout=20) as response:
        response.read()
