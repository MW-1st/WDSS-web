import smtplib
from email.message import EmailMessage

from app.core import config


def send_email(to_email: str, subject: str, text_body: str) -> None:
    """Send an email via SMTP. If SMTP not configured, print to stdout as fallback."""
    if not config.SMTP_HOST or not to_email:
        # Fallback to console for non-configured environments
        print("[MAIL:FALLBACK] To:", to_email)
        print("[MAIL:FALLBACK] Subject:", subject)
        print("[MAIL:FALLBACK] Body:\n", text_body)
        return

    try:
        msg = EmailMessage()
        msg["From"] = config.SMTP_FROM
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.set_content(text_body)

        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT) as server:
            if config.SMTP_STARTTLS:
                server.starttls()
            if config.SMTP_USERNAME:
                server.login(config.SMTP_USERNAME, config.SMTP_PASSWORD)
            server.send_message(msg)

        print(f"[SUCCESS] Email sent successfully to {to_email}")

    except Exception as e:
        print(f"[ERROR] Email send failed: {e}")
        print(f"   To: {to_email}")
        print(f"   SMTP: {config.SMTP_HOST}:{config.SMTP_PORT}")
        print(f"   From: {config.SMTP_FROM}")
        raise  # 에러를 다시 발생시켜서 상위에서 처리하도록

