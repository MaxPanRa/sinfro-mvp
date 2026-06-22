from email.message import EmailMessage
import smtplib

from app.core.config import settings


def smtp_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_username and settings.smtp_password)


def send_verification_email(to_email: str, name: str, verification_url: str) -> bool:
    if not smtp_configured():
        print(f"Email verification link for {to_email}: {verification_url}")
        return False

    message = EmailMessage()
    message["Subject"] = "Confirma tu cuenta de SinFro"
    message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    message["To"] = to_email
    message.set_content(
        "\n".join(
            [
                f"Hola {name or to_email},",
                "",
                "Confirma tu cuenta de SinFro con esta liga:",
                verification_url,
                "",
                "Si no pediste esta cuenta, puedes ignorar este correo.",
            ]
        )
    )
    message.add_alternative(
        f"""
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#10201a">
          <h2>Confirma tu cuenta de SinFro</h2>
          <p>Hola {name or to_email},</p>
          <p>Usa esta liga para crear tu usuario y entrar de inmediato:</p>
          <p><a href="{verification_url}">Confirmar cuenta</a></p>
          <p style="font-size:12px;color:#66736d">Si no pediste esta cuenta, puedes ignorar este correo.</p>
        </div>
        """,
        subtype="html",
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
    return True


def send_plan_assigned_email(to_email: str, name: str, plan_name: str) -> bool:
    """Avisa a un usuario que el admin le asignó un plan. Devuelve True si se envió."""
    if not smtp_configured():
        print(f"[SMTP no configurado] Aviso de plan '{plan_name}' para {to_email}")
        return False

    message = EmailMessage()
    message["Subject"] = f"Tu plan en SinFro: {plan_name}"
    message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    message["To"] = to_email
    message.set_content(
        "\n".join(
            [
                f"Hola {name or to_email},",
                "",
                f"Se te asignó el plan {plan_name} en SinFro.",
                "Ya puedes entrar y disfrutar de sus beneficios.",
                "",
                "El equipo de SinFro.",
            ]
        )
    )
    message.add_alternative(
        f"""
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#10201a">
          <h2>¡Tienes un nuevo plan en SinFro!</h2>
          <p>Hola {name or to_email},</p>
          <p>Se te asignó el plan <b>{plan_name}</b>. Ya puedes entrar y disfrutar de sus beneficios.</p>
          <p style="font-size:12px;color:#66736d">El equipo de SinFro.</p>
        </div>
        """,
        subtype="html",
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
    return True
