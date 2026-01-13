"""Supabase client singleton for database and storage operations."""

from functools import lru_cache
from typing import Any

from supabase import create_client, Client

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

        return {
            "applications": status_counts,
            "jobs": job_counts,
            "total_candidates": len(self.client.table("candidates").select("id").execute().data or []),
        }


# Singleton instance
db = SupabaseService()
