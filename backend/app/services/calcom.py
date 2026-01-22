"""Cal.com service for interview scheduling."""

import hashlib
import hmac
from datetime import datetime
from typing import Any

import httpx

from app.config import settings


class CalcomService:
    """Service for Cal.com scheduling operations."""

    BASE_URL = "https://api.cal.com/v1"

    def __init__(self):
        self.api_key = settings.calcom_api_key
        self.webhook_secret = settings.calcom_webhook_secret
        self.default_event_type_id = settings.calcom_event_type_id

    def _headers(self) -> dict:
        """Get headers for Cal.com API requests."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _params(self) -> dict:
        """Get default params with API key."""
        return {"apiKey": self.api_key}

    async def get_event_types(self) -> list[dict[str, Any]]:
        """
        Get available event types (interview types).

        Returns:
            List of event types with id, title, length, etc.
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/event-types",
                params=self._params(),
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json().get("event_types", [])

    async def get_availability(
        self,
        event_type_id: int | str,
        start_date: datetime,
        end_date: datetime,
        timezone: str = "America/New_York",
    ) -> dict[str, Any]:
        """
        Get available time slots for an event type.

        Args:
            event_type_id: Cal.com event type ID
            start_date: Start of availability window
            end_date: End of availability window
            timezone: Timezone for slots

        Returns:
            {busy: [...], slots: [...]}
        """
        params = {
            **self._params(),
            "eventTypeId": event_type_id,
            "startTime": start_date.isoformat(),
            "endTime": end_date.isoformat(),
            "timeZone": timezone,
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/availability",
                params=params,
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    async def create_booking(
        self,
        event_type_id: int | str,
        start_time: datetime,
        attendee_email: str,
        attendee_name: str,
        attendee_timezone: str = "America/New_York",
        title: str | None = None,
        notes: str | None = None,
        metadata: dict | None = None,
    ) -> dict[str, Any]:
        """
        Create a booking (schedule an interview).

        Args:
            event_type_id: Cal.com event type ID
            start_time: When the meeting starts
            attendee_email: Candidate email
            attendee_name: Candidate name
            attendee_timezone: Candidate timezone
            title: Optional custom title
            notes: Optional notes visible to interviewer
            metadata: Optional metadata for tracking

        Returns:
            Booking details including ID, meeting URL, etc.
        """
        payload = {
            "eventTypeId": int(event_type_id),
            "start": start_time.isoformat(),
            "responses": {
                "email": attendee_email,
                "name": attendee_name,
            },
            "timeZone": attendee_timezone,
            "language": "en",
            "metadata": metadata or {},
        }

        if title:
            payload["title"] = title
        if notes:
            payload["responses"]["notes"] = notes

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/bookings",
                params=self._params(),
                json=payload,
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    async def get_booking(self, booking_id: int | str) -> dict[str, Any]:
        """Get booking details."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/bookings/{booking_id}",
                params=self._params(),
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    async def cancel_booking(
        self,
        booking_id: int | str,
        reason: str | None = None,
    ) -> dict[str, Any]:
        """
        Cancel a booking.

        Args:
            booking_id: Cal.com booking ID
            reason: Optional cancellation reason

        Returns:
            Cancellation confirmation
        """
        payload = {}
        if reason:
            payload["reason"] = reason

        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.BASE_URL}/bookings/{booking_id}",
                params=self._params(),
                json=payload if payload else None,
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    async def reschedule_booking(
        self,
        booking_id: int | str,
        new_start_time: datetime,
        reason: str | None = None,
    ) -> dict[str, Any]:
        """
        Reschedule a booking.

        Args:
            booking_id: Cal.com booking ID
            new_start_time: New meeting time
            reason: Optional reschedule reason

        Returns:
            Updated booking details
        """
        payload = {
            "start": new_start_time.isoformat(),
        }
        if reason:
            payload["rescheduleReason"] = reason

        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{self.BASE_URL}/bookings/{booking_id}",
                params=self._params(),
                json=payload,
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    async def list_bookings(
        self,
        status: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """
        List bookings.

        Args:
            status: Filter by status (upcoming, past, cancelled)
            limit: Max results

        Returns:
            List of bookings
        """
        params = {**self._params(), "limit": limit}
        if status:
            params["status"] = status

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/bookings",
                params=params,
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json().get("bookings", [])

    def generate_scheduling_link(
        self,
        event_type_slug: str,
        username: str,
        prefill_email: str | None = None,
        prefill_name: str | None = None,
        metadata: dict | None = None,
    ) -> str:
        """
        Generate a scheduling link for a candidate.

        Args:
            event_type_slug: Event type URL slug (e.g., "interview-30")
            username: Cal.com username
            prefill_email: Pre-fill candidate email
            prefill_name: Pre-fill candidate name
            metadata: Metadata to pass through booking

        Returns:
            Full scheduling URL
        """
        base_url = f"https://cal.com/{username}/{event_type_slug}"
        params = []

        if prefill_email:
            params.append(f"email={prefill_email}")
        if prefill_name:
            params.append(f"name={prefill_name}")
        if metadata:
            for key, value in metadata.items():
                params.append(f"metadata[{key}]={value}")

        if params:
            return f"{base_url}?{'&'.join(params)}"
        return base_url

    def verify_webhook_signature(
        self,
        payload: bytes,
        signature: str,
    ) -> bool:
        """
        Verify Cal.com webhook signature.

        Args:
            payload: Raw request body bytes
            signature: X-Cal-Signature-256 header value

        Returns:
            True if signature is valid
        """
        if not self.webhook_secret:
            return True  # Skip in dev mode

        expected = hmac.new(
            self.webhook_secret.encode(),
            payload,
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(f"sha256={expected}", signature)


class CalcomWebhookHandler:
    """Handler for Cal.com webhook events."""

    @staticmethod
    def parse_event(payload: dict) -> dict[str, Any]:
        """
        Parse a Cal.com webhook event.

        Returns standardized event data:
            {
                event_type: "BOOKING_CREATED" | "BOOKING_CANCELLED" | ...,
                booking_id: int,
                event_type_id: int,
                start_time: datetime,
                end_time: datetime,
                attendee_email: str,
                attendee_name: str,
                meeting_url: str | None,
                metadata: dict,
            }
        """
        booking = payload.get("payload", {})
        attendees = booking.get("attendees", [{}])
        first_attendee = attendees[0] if attendees else {}

        return {
            "event_type": payload.get("triggerEvent"),
            "booking_id": booking.get("id"),
            "booking_uid": booking.get("uid"),
            "event_type_id": booking.get("eventTypeId"),
            "title": booking.get("title"),
            "start_time": datetime.fromisoformat(booking["startTime"].replace("Z", "+00:00"))
            if booking.get("startTime")
            else None,
            "end_time": datetime.fromisoformat(booking["endTime"].replace("Z", "+00:00"))
            if booking.get("endTime")
            else None,
            "attendee_email": first_attendee.get("email"),
            "attendee_name": first_attendee.get("name"),
            "attendee_timezone": first_attendee.get("timeZone"),
            "meeting_url": booking.get("metadata", {}).get("videoCallUrl"),
            "location": booking.get("location"),
            "status": booking.get("status"),
            "cancelled": payload.get("triggerEvent") == "BOOKING_CANCELLED",
            "cancellation_reason": booking.get("cancellationReason"),
            "metadata": booking.get("metadata", {}),
        }


# Singleton instances
calcom_service = CalcomService()
calcom_webhook_handler = CalcomWebhookHandler()
