"""Supabase client singleton for database and storage operations."""

from functools import lru_cache
from typing import Any

from supabase import Client, create_client

from app.config import settings


@lru_cache
def get_supabase_client() -> Client:
    """Get cached Supabase client instance."""
    return create_client(settings.supabase_url, settings.supabase_service_key)


# Singleton instance for convenience
supabase = get_supabase_client()


class SupabaseService:
    """Service class for Supabase database operations."""

    def __init__(self):
        self.client = get_supabase_client()

    # ==================== Jobs ====================
    async def create_job(self, job_data: dict[str, Any]) -> dict[str, Any]:
        """Create a new job in the database."""
        result = self.client.table("jobs").insert(job_data).execute()
        return result.data[0] if result.data else {}

    async def get_job(self, job_id: str) -> dict[str, Any] | None:
        """Get a job by ID."""
        result = self.client.table("jobs").select("*").eq("id", job_id).execute()
        return result.data[0] if result.data else None

    async def update_job(self, job_id: str, job_data: dict[str, Any]) -> dict[str, Any]:
        """Update a job."""
        result = self.client.table("jobs").update(job_data).eq("id", job_id).execute()
        return result.data[0] if result.data else {}

    async def list_jobs(self, status: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        """List jobs with optional filtering."""
        query = self.client.table("jobs").select("*").order("created_at", desc=True).limit(limit)
        if status:
            query = query.eq("status", status)
        result = query.execute()
        return result.data or []

    # ==================== Candidates ====================
    async def create_candidate(self, candidate_data: dict[str, Any]) -> dict[str, Any]:
        """Create a new candidate."""
        result = self.client.table("candidates").insert(candidate_data).execute()
        return result.data[0] if result.data else {}

    async def get_candidate(self, candidate_id: str) -> dict[str, Any] | None:
        """Get a candidate by ID."""
        result = self.client.table("candidates").select("*").eq("id", candidate_id).execute()
        return result.data[0] if result.data else None

    async def get_candidate_by_email(self, email: str) -> dict[str, Any] | None:
        """Get a candidate by email."""
        result = self.client.table("candidates").select("*").eq("email", email).execute()
        return result.data[0] if result.data else None

    async def update_candidate(self, candidate_id: str, candidate_data: dict[str, Any]) -> dict[str, Any]:
        """Update a candidate."""
        result = self.client.table("candidates").update(candidate_data).eq("id", candidate_id).execute()
        return result.data[0] if result.data else {}

    async def upsert_candidate(self, candidate_data: dict[str, Any]) -> dict[str, Any]:
        """Upsert a candidate (insert or update on conflict)."""
        result = self.client.table("candidates").upsert(candidate_data, on_conflict="email").execute()
        return result.data[0] if result.data else {}

    # ==================== Applications ====================
    async def create_application(self, application_data: dict[str, Any]) -> dict[str, Any]:
        """Create a new application."""
        result = self.client.table("applications").insert(application_data).execute()
        return result.data[0] if result.data else {}

    async def get_application(self, application_id: str) -> dict[str, Any] | None:
        """Get an application by ID."""
        result = self.client.table("applications").select("*").eq("id", application_id).execute()
        return result.data[0] if result.data else None

    async def update_application(self, application_id: str, application_data: dict[str, Any]) -> dict[str, Any]:
        """Update an application."""
        result = self.client.table("applications").update(application_data).eq("id", application_id).execute()
        return result.data[0] if result.data else {}

    async def list_applications_for_job(
        self, job_id: str, status: str | None = None, limit: int = 100
    ) -> list[dict[str, Any]]:
        """List applications for a job with candidate data."""
        query = (
            self.client.table("applications")
            .select("*, candidates(*)")
            .eq("job_id", job_id)
            .order("screening_score", desc=True)
            .limit(limit)
        )
        if status:
            query = query.eq("status", status)
        result = query.execute()
        return result.data or []

    async def list_applications(
        self,
        candidate_id: str | None = None,
        status: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """List applications with optional filtering."""
        query = self.client.table("applications").select("*").order("created_at", desc=True).limit(limit)
        if candidate_id:
            query = query.eq("candidate_id", candidate_id)
        if status:
            query = query.eq("status", status)
        result = query.execute()
        return result.data or []

    # ==================== Assessments ====================
    async def create_assessment(self, assessment_data: dict[str, Any]) -> dict[str, Any]:
        """Create a new assessment."""
        result = self.client.table("assessments").insert(assessment_data).execute()
        return result.data[0] if result.data else {}

    async def get_assessment(self, assessment_id: str) -> dict[str, Any] | None:
        """Get an assessment by ID."""
        result = self.client.table("assessments").select("*").eq("id", assessment_id).execute()
        return result.data[0] if result.data else None

    async def get_assessment_by_token(self, token: str) -> dict[str, Any] | None:
        """Get an assessment by access token (for candidate access)."""
        result = self.client.table("assessments").select("*").eq("access_token", token).execute()
        return result.data[0] if result.data else None

    async def update_assessment(self, assessment_id: str, assessment_data: dict[str, Any]) -> dict[str, Any]:
        """Update an assessment."""
        result = self.client.table("assessments").update(assessment_data).eq("id", assessment_id).execute()
        return result.data[0] if result.data else {}

    async def get_assessment_by_calendar_event(self, calendar_event_id: str) -> dict[str, Any] | None:
        """Get an assessment by calendar event ID (Cal.com booking ID)."""
        result = self.client.table("assessments").select("*").eq("calendar_event_id", calendar_event_id).execute()
        return result.data[0] if result.data else None

    async def list_assessments(
        self,
        application_id: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """List assessments with optional filtering."""
        query = self.client.table("assessments").select("*").order("created_at", desc=True).limit(limit)
        if application_id:
            query = query.eq("application_id", application_id)
        if status:
            query = query.eq("status", status)
        result = query.execute()
        return result.data or []

    # ==================== Offers ====================
    async def create_offer(self, offer_data: dict[str, Any]) -> dict[str, Any]:
        """Create a new offer."""
        result = self.client.table("offers").insert(offer_data).execute()
        return result.data[0] if result.data else {}

    async def get_offer(self, offer_id: str) -> dict[str, Any] | None:
        """Get an offer by ID."""
        result = self.client.table("offers").select("*").eq("id", offer_id).execute()
        return result.data[0] if result.data else None

    async def update_offer(self, offer_id: str, offer_data: dict[str, Any]) -> dict[str, Any]:
        """Update an offer."""
        result = self.client.table("offers").update(offer_data).eq("id", offer_id).execute()
        return result.data[0] if result.data else {}

    # ==================== Agent Logs ====================
    async def log_agent_activity(self, log_data: dict[str, Any]) -> dict[str, Any]:
        """Log agent activity."""
        result = self.client.table("agent_logs").insert(log_data).execute()
        return result.data[0] if result.data else {}

    async def get_recent_agent_logs(self, limit: int = 50) -> list[dict[str, Any]]:
        """Get recent agent activity logs."""
        result = (
            self.client.table("agent_logs")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []

    # ==================== Phone Screens ====================
    async def create_phone_screen(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create a new phone screen record."""
        result = self.client.table("phone_screens").insert(data).execute()
        return result.data[0] if result.data else {}

    async def get_phone_screen(self, phone_screen_id: str) -> dict[str, Any] | None:
        """Get a phone screen by ID."""
        result = self.client.table("phone_screens").select("*").eq("id", phone_screen_id).execute()
        return result.data[0] if result.data else None

    async def get_phone_screen_by_application(self, application_id: str) -> dict[str, Any] | None:
        """Get phone screen by application ID."""
        result = self.client.table("phone_screens").select("*").eq("application_id", application_id).execute()
        return result.data[0] if result.data else None

    async def get_phone_screen_by_vapi_call_id(self, vapi_call_id: str) -> dict[str, Any] | None:
        """Get phone screen by Vapi call ID."""
        result = self.client.table("phone_screens").select("*").eq("vapi_call_id", vapi_call_id).execute()
        return result.data[0] if result.data else None

    async def update_phone_screen(self, phone_screen_id: str, data: dict[str, Any]) -> dict[str, Any]:
        """Update a phone screen record."""
        result = self.client.table("phone_screens").update(data).eq("id", phone_screen_id).execute()
        return result.data[0] if result.data else {}

    async def list_phone_screens(
        self,
        status: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """List phone screens with optional filtering."""
        query = (
            self.client.table("phone_screens")
            .select("*, applications(*, candidates(*), jobs(*))")
            .order("created_at", desc=True)
            .limit(limit)
        )
        if status:
            query = query.eq("status", status)
        result = query.execute()
        return result.data or []

    # ==================== Sourced Candidates ====================
    async def create_sourced_candidate(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create a new sourced candidate record."""
        result = self.client.table("sourced_candidates").insert(data).execute()
        return result.data[0] if result.data else {}

    async def get_sourced_candidate(self, candidate_id: str) -> dict[str, Any] | None:
        """Get a sourced candidate by ID."""
        result = self.client.table("sourced_candidates").select("*").eq("id", candidate_id).execute()
        return result.data[0] if result.data else None

    async def update_sourced_candidate(self, candidate_id: str, data: dict[str, Any]) -> dict[str, Any]:
        """Update a sourced candidate record."""
        result = self.client.table("sourced_candidates").update(data).eq("id", candidate_id).execute()
        return result.data[0] if result.data else {}

    async def list_sourced_candidates(
        self,
        job_id: str | None = None,
        status: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """List sourced candidates with optional filtering."""
        query = (
            self.client.table("sourced_candidates")
            .select("*")
            .order("fit_score", desc=True)
            .limit(limit)
        )
        if job_id:
            query = query.eq("job_id", job_id)
        if status:
            query = query.eq("status", status)
        result = query.execute()
        return result.data or []

    # ==================== Campaigns ====================
    async def create_campaign(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create a new campaign."""
        result = self.client.table("campaigns").insert(data).execute()
        return result.data[0] if result.data else {}

    async def get_campaign(self, campaign_id: str) -> dict[str, Any] | None:
        """Get a campaign by ID."""
        result = self.client.table("campaigns").select("*").eq("id", campaign_id).execute()
        return result.data[0] if result.data else None

    async def update_campaign(self, campaign_id: str, data: dict[str, Any]) -> dict[str, Any]:
        """Update a campaign."""
        result = self.client.table("campaigns").update(data).eq("id", campaign_id).execute()
        return result.data[0] if result.data else {}

    async def list_campaigns(
        self,
        job_id: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """List campaigns with optional filtering."""
        query = (
            self.client.table("campaigns")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
        )
        if job_id:
            query = query.eq("job_id", job_id)
        if status:
            query = query.eq("status", status)
        result = query.execute()
        return result.data or []

    # ==================== Outreach Messages ====================
    async def create_outreach_message(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create a new outreach message."""
        result = self.client.table("outreach_messages").insert(data).execute()
        return result.data[0] if result.data else {}

    async def get_outreach_message(self, message_id: str) -> dict[str, Any] | None:
        """Get an outreach message by ID."""
        result = self.client.table("outreach_messages").select("*").eq("id", message_id).execute()
        return result.data[0] if result.data else None

    async def get_outreach_message_by_provider_id(self, provider_message_id: str) -> dict[str, Any] | None:
        """Get an outreach message by provider message ID."""
        result = (
            self.client.table("outreach_messages")
            .select("*")
            .eq("provider_message_id", provider_message_id)
            .execute()
        )
        return result.data[0] if result.data else None

    async def update_outreach_message(self, message_id: str, data: dict[str, Any]) -> dict[str, Any]:
        """Update an outreach message."""
        result = self.client.table("outreach_messages").update(data).eq("id", message_id).execute()
        return result.data[0] if result.data else {}

    async def list_outreach_messages(
        self,
        campaign_id: str | None = None,
        status: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """List outreach messages with optional filtering."""
        query = (
            self.client.table("outreach_messages")
            .select("*, sourced_candidates(*)")
            .order("created_at", desc=True)
            .limit(limit)
        )
        if campaign_id:
            query = query.eq("campaign_id", campaign_id)
        if status:
            query = query.eq("status", status)
        result = query.execute()
        return result.data or []

    # ==================== Email Templates ====================
    async def get_email_template(self, template_id: str) -> dict[str, Any] | None:
        """Get an email template by ID."""
        result = self.client.table("email_templates").select("*").eq("id", template_id).execute()
        return result.data[0] if result.data else None

    async def list_email_templates(
        self,
        template_type: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """List email templates."""
        query = (
            self.client.table("email_templates")
            .select("*")
            .order("name")
            .limit(limit)
        )
        if template_type:
            query = query.eq("type", template_type)
        result = query.execute()
        return result.data or []

    # ==================== Dashboard Metrics ====================
    async def get_pipeline_metrics(self) -> dict[str, Any]:
        """Get pipeline metrics for dashboard."""
        # Get counts by application status
        applications = self.client.table("applications").select("status").execute()

        status_counts = {}
        for app in applications.data or []:
            status = app.get("status", "unknown")
            status_counts[status] = status_counts.get(status, 0) + 1

        # Get job counts
        jobs = self.client.table("jobs").select("status").execute()
        job_counts = {}
        for job in jobs.data or []:
            status = job.get("status", "unknown")
            job_counts[status] = job_counts.get(status, 0) + 1

        # Get phone screen counts
        phone_screens = self.client.table("phone_screens").select("status").execute()
        phone_screen_counts = {}
        for ps in phone_screens.data or []:
            status = ps.get("status", "unknown")
            phone_screen_counts[status] = phone_screen_counts.get(status, 0) + 1

        return {
            "applications": status_counts,
            "jobs": job_counts,
            "phone_screens": phone_screen_counts,
            "total_candidates": len(self.client.table("candidates").select("id").execute().data or []),
            "total_sourced": len(self.client.table("sourced_candidates").select("id").execute().data or []),
        }


# Singleton instance
db = SupabaseService()
