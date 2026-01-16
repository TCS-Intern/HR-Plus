"""Email service using SendGrid for outreach and notifications."""

import httpx
from typing import Any, Optional
from datetime import datetime

from app.config import settings


class EmailService:
    """Service for sending emails via SendGrid."""

    BASE_URL = "https://api.sendgrid.com/v3"

    def __init__(self):
        self.api_key = settings.sendgrid_api_key
        self.from_email = settings.sendgrid_from_email
        self.from_name = settings.sendgrid_from_name

    def _headers(self) -> dict:
        """Get headers for SendGrid API requests."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

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
    ) -> dict[str, Any]:
        """
        Send a single email.

        Args:
            to_email: Recipient email
            to_name: Recipient name
            subject: Email subject
            html_content: HTML body
            text_content: Plain text body (optional, extracted from HTML if not provided)
            from_email: Override sender email
            from_name: Override sender name
            reply_to: Reply-to email address
            tracking_enabled: Enable open/click tracking
            custom_args: Custom arguments for webhook callbacks

        Returns:
            {message_id, status, ...}
        """
        payload = {
            "personalizations": [
                {
                    "to": [{"email": to_email, "name": to_name}],
                    "custom_args": custom_args or {},
                }
            ],
            "from": {
                "email": from_email or self.from_email,
                "name": from_name or self.from_name,
            },
            "subject": subject,
            "content": [
                {"type": "text/html", "value": html_content},
            ],
            "tracking_settings": {
                "click_tracking": {"enable": tracking_enabled},
                "open_tracking": {"enable": tracking_enabled},
            },
        }

        if text_content:
            payload["content"].insert(0, {"type": "text/plain", "value": text_content})

        if reply_to:
            payload["reply_to"] = {"email": reply_to}

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/mail/send",
                headers=self._headers(),
                json=payload,
                timeout=30.0,
            )

            # SendGrid returns 202 for successful send
            if response.status_code == 202:
                # Extract message ID from headers
                message_id = response.headers.get("X-Message-Id", "")
                return {
                    "success": True,
                    "message_id": message_id,
                    "status_code": response.status_code,
                }

            response.raise_for_status()
            return {"success": False, "error": response.text}

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
        personalizations = []

        for recipient in recipients:
            personalization = {
                "to": [{"email": recipient["email"], "name": recipient.get("name", "")}],
                "substitutions": recipient.get("substitutions", {}),
                "custom_args": recipient.get("custom_args", {}),
            }
            personalizations.append(personalization)

        payload = {
            "personalizations": personalizations,
            "from": {
                "email": from_email or self.from_email,
                "name": from_name or self.from_name,
            },
            "subject": subject,
            "content": [{"type": "text/html", "value": html_template}],
            "tracking_settings": {
                "click_tracking": {"enable": True},
                "open_tracking": {"enable": True},
            },
        }

        if schedule_at:
            payload["send_at"] = int(schedule_at.timestamp())

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/mail/send",
                headers=self._headers(),
                json=payload,
                timeout=60.0,
            )

            if response.status_code == 202:
                return {
                    "success": True,
                    "sent_count": len(recipients),
                    "batch_id": response.headers.get("X-Message-Id"),
                }

            response.raise_for_status()
            return {"success": False, "error": response.text}

    async def get_email_activity(
        self,
        query: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """
        Get email activity/events.

        Args:
            query: Search query (e.g., email address)
            limit: Max results

        Returns:
            List of email events
        """
        params = {"limit": limit}
        if query:
            params["query"] = query

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/messages",
                headers=self._headers(),
                params=params,
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json().get("messages", [])

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


class SendGridWebhookHandler:
    """Handler for SendGrid webhook events."""

    @staticmethod
    def parse_event(event: dict) -> dict[str, Any]:
        """
        Parse a SendGrid webhook event.

        Returns standardized event data:
            {
                event_type: "delivered" | "opened" | "clicked" | "bounced" | ...,
                message_id: str,
                email: str,
                timestamp: datetime,
                url: str | None,  # for click events
                reason: str | None,  # for bounce events
                custom_args: dict,
            }
        """
        return {
            "event_type": event.get("event"),
            "message_id": event.get("sg_message_id", "").split(".")[0],
            "email": event.get("email"),
            "timestamp": datetime.fromtimestamp(event.get("timestamp", 0)),
            "url": event.get("url"),
            "reason": event.get("reason"),
            "bounce_type": event.get("type"),  # bounce, blocked
            "custom_args": {
                k: v
                for k, v in event.items()
                if k not in ["event", "sg_message_id", "email", "timestamp", "url", "reason", "type"]
            },
        }


# Singleton instance
email_service = EmailService()
sendgrid_webhook_handler = SendGridWebhookHandler()
