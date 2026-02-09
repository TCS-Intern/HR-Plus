"""Email service using Resend for outreach and notifications."""

import logging
from datetime import datetime
from typing import Any
from uuid import uuid4

import resend

from app.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails via Resend.

    When Resend is not configured (no API key), operates in preview mode
    and returns email content without actually sending.
    """

    def __init__(self):
        self.api_key = settings.resend_api_key
        self.from_email = settings.resend_from_email or "noreply@example.com"
        self.from_name = settings.resend_from_name or "Telentic"

        # Configure Resend API key
        if self.api_key:
            resend.api_key = self.api_key

    @property
    def is_configured(self) -> bool:
        """Check if Resend is properly configured."""
        return bool(self.api_key and len(self.api_key) > 10)

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
        tracking_enabled: bool = True,
        custom_args: dict | None = None,
        force_preview: bool = False,
    ) -> dict[str, Any]:
        """
        Send a single email.

        Args:
            to_email: Recipient email
            to_name: Recipient name
            subject: Email subject
            html_content: HTML body
            text_content: Plain text body (optional)
            from_email: Override sender email
            from_name: Override sender name
            reply_to: Reply-to email address
            tracking_enabled: Enable open/click tracking
            custom_args: Custom arguments for webhook callbacks
            force_preview: If True, return preview instead of sending even if configured

        Returns:
            {message_id, status, ...} or preview data if not configured
        """
        email_data = {
            "to_email": to_email,
            "to_name": to_name,
            "subject": subject,
            "html_content": html_content,
            "text_content": text_content,
            "from_email": from_email or self.from_email,
            "from_name": from_name or self.from_name,
            "reply_to": reply_to,
            "custom_args": custom_args or {},
        }

        # If Resend not configured, try SMTP fallback
        if not self.is_configured or force_preview:
            from app.services.smtp_email import smtp_email_service

            if smtp_email_service.is_configured and not force_preview:
                logger.info(f"Resend not configured, using SMTP fallback for: {subject} -> {to_email}")
                return await smtp_email_service.send_email(
                    to_email=to_email,
                    to_name=to_name,
                    subject=subject,
                    html_content=html_content,
                    text_content=text_content,
                    from_email=from_email or self.from_email,
                    from_name=from_name or self.from_name,
                    reply_to=reply_to,
                )

            preview_id = f"preview_{uuid4().hex[:12]}"
            logger.info(f"Email preview mode: {subject} -> {to_email}")
            return {
                "success": True,
                "preview": True,
                "message_id": preview_id,
                "email_data": email_data,
                "note": "Email not configured - email not sent. Preview available.",
            }

        sender = f"{from_name or self.from_name} <{from_email or self.from_email}>"

        params: resend.Emails.SendParams = {
            "from": sender,
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        }

        if text_content:
            params["text"] = text_content

        if reply_to:
            params["reply_to"] = [reply_to]

        if custom_args:
            params["headers"] = {f"X-Custom-{k}": str(v) for k, v in custom_args.items()}

        try:
            response = resend.Emails.send(params)
            message_id = response.get("id", "") if isinstance(response, dict) else getattr(response, "id", "")

            return {
                "success": True,
                "preview": False,
                "message_id": message_id,
                "status_code": 200,
            }
        except Exception as e:
            logger.error(f"Resend email send failed: {e}")
            return {"success": False, "error": str(e)}

    async def send_bulk(
        self,
        recipients: list[dict],
        subject: str,
        html_template: str,
        from_email: str | None = None,
        from_name: str | None = None,
        schedule_at: datetime | None = None,
    ) -> dict[str, Any]:
        """
        Send bulk emails with personalization.

        Args:
            recipients: List of {email, name, substitutions: {key: value}}
            subject: Email subject (can include {{variables}})
            html_template: HTML template with {{variable}} placeholders
            from_email: Override sender email
            from_name: Override sender name
            schedule_at: Optional datetime to schedule send

        Returns:
            {batch_id, status, sent_count, ...}
        """
        sender = f"{from_name or self.from_name} <{from_email or self.from_email}>"
        sent_count = 0
        errors = []

        for recipient in recipients:
            # Personalize content
            personalized_html = html_template
            for key, value in recipient.get("substitutions", {}).items():
                personalized_html = personalized_html.replace(f"{{{{{key}}}}}", str(value))

            personalized_subject = subject
            for key, value in recipient.get("substitutions", {}).items():
                personalized_subject = personalized_subject.replace(f"{{{{{key}}}}}", str(value))

            params: resend.Emails.SendParams = {
                "from": sender,
                "to": [recipient["email"]],
                "subject": personalized_subject,
                "html": personalized_html,
            }

            if schedule_at:
                params["scheduled_at"] = schedule_at.isoformat()

            try:
                resend.Emails.send(params)
                sent_count += 1
            except Exception as e:
                errors.append({"email": recipient["email"], "error": str(e)})

        return {
            "success": sent_count > 0,
            "sent_count": sent_count,
            "errors": errors,
            "batch_id": f"batch_{uuid4().hex[:12]}",
        }

    def personalize_template(
        self,
        template: str,
        substitutions: dict[str, str],
    ) -> str:
        """
        Replace {{variable}} placeholders in template.

        Args:
            template: Template string with {{variable}} placeholders
            substitutions: Dict of variable -> value mappings

        Returns:
            Personalized string
        """
        result = template
        for key, value in substitutions.items():
            result = result.replace(f"{{{{{key}}}}}", str(value))
        return result


class ResendWebhookHandler:
    """Handler for Resend webhook events."""

    @staticmethod
    def parse_event(event: dict) -> dict[str, Any]:
        """
        Parse a Resend webhook event.

        Returns standardized event data:
            {
                event_type: "delivered" | "opened" | "clicked" | "bounced" | ...,
                message_id: str,
                email: str,
                timestamp: datetime,
                url: str | None,
                reason: str | None,
                custom_args: dict,
            }
        """
        return {
            "event_type": event.get("type"),
            "message_id": event.get("data", {}).get("email_id", ""),
            "email": event.get("data", {}).get("to", [""])[0] if event.get("data", {}).get("to") else "",
            "timestamp": datetime.fromisoformat(event.get("created_at", datetime.utcnow().isoformat())),
            "url": event.get("data", {}).get("click", {}).get("link"),
            "reason": event.get("data", {}).get("bounce", {}).get("message"),
            "bounce_type": event.get("data", {}).get("bounce", {}).get("type"),
            "custom_args": event.get("data", {}).get("headers", {}),
        }

    async def preview_email(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        html_content: str,
        text_content: str | None = None,
        from_email: str | None = None,
        from_name: str | None = None,
    ) -> dict[str, Any]:
        """
        Generate email preview without sending.

        Returns the email data for display in UI.
        """
        return {
            "to_email": to_email,
            "to_name": to_name,
            "subject": subject,
            "html_content": html_content,
            "text_content": text_content,
            "from_email": from_email or self.from_email,
            "from_name": from_name or self.from_name,
            "created_at": datetime.utcnow().isoformat(),
        }

    def get_configuration_status(self) -> dict[str, Any]:
        """Get email service configuration status."""
        return {
            "configured": self.is_configured,
            "from_email": self.from_email if self.is_configured else None,
            "from_name": self.from_name,
            "mode": "live" if self.is_configured else "preview",
        }


# Singleton instance
email_service = EmailService()
resend_webhook_handler = ResendWebhookHandler()
