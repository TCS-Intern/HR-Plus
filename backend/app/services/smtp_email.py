"""SMTP email service using aiosmtplib for async email sending."""

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any
from uuid import uuid4

import aiosmtplib

from app.config import settings

logger = logging.getLogger(__name__)


class SmtpEmailService:
    """Service for sending emails via SMTP (Gmail).

    When SMTP credentials are not configured, operates in preview mode
    and returns email content without actually sending.
    """

    def __init__(self):
        self.host = settings.smtp_host
        self.port = settings.smtp_port
        self.user = settings.smtp_user
        self.password = settings.smtp_password
        self.default_from_name = settings.app_name

    @property
    def is_configured(self) -> bool:
        """Check if SMTP is properly configured."""
        return bool(self.user and self.password)

    async def send_email(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        html_content: str,
        text_content: str | None = None,
        from_email: str | None = None,
        from_name: str | None = None,
        reply_to: str | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Send a single email via SMTP.

        Returns dict matching EmailService interface:
            {success, message_id, preview}
        """
        sender_email = from_email or self.user or "noreply@example.com"
        sender_name = from_name or self.default_from_name

        if not self.is_configured:
            preview_id = f"smtp_preview_{uuid4().hex[:12]}"
            logger.info(f"SMTP preview mode: {subject} -> {to_email}")
            return {
                "success": True,
                "preview": True,
                "message_id": preview_id,
                "email_data": {
                    "to_email": to_email,
                    "to_name": to_name,
                    "subject": subject,
                    "html_content": html_content,
                    "from_email": sender_email,
                    "from_name": sender_name,
                },
                "note": "SMTP not configured - email not sent. Preview available.",
            }

        # Build MIME message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{sender_name} <{sender_email}>"
        msg["To"] = f"{to_name} <{to_email}>"

        if reply_to:
            msg["Reply-To"] = reply_to

        message_id = f"<{uuid4().hex}@{self.host}>"
        msg["Message-ID"] = message_id

        if text_content:
            msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        try:
            await aiosmtplib.send(
                msg,
                hostname=self.host,
                port=self.port,
                username=self.user,
                password=self.password,
                start_tls=True,
            )

            logger.info(f"SMTP email sent: {subject} -> {to_email}")
            return {
                "success": True,
                "preview": False,
                "message_id": message_id,
            }

        except Exception as e:
            logger.error(f"SMTP send failed: {e}")
            return {
                "success": False,
                "preview": False,
                "message_id": None,
                "error": str(e),
            }


# Singleton instance
smtp_email_service = SmtpEmailService()
