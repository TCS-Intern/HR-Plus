"""Dashboard API endpoints."""

from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter

from app.services.supabase import db
from app.middleware.auth import CurrentUser

router = APIRouter()


@router.get("/metrics")
async def get_metrics(user: CurrentUser) -> dict[str, Any]:
    """Get overall dashboard metrics."""
    # Get job counts
    jobs_result = db.client.table("jobs").select("id, status").execute()
    jobs = jobs_result.data or []

    total_jobs = len(jobs)
    active_jobs = len([j for j in jobs if j["status"] == "active"])

    # Get candidate counts
    candidates_result = db.client.table("candidates").select("id").execute()
    total_candidates = len(candidates_result.data or [])

    # Get application counts by status
    apps_result = db.client.table("applications").select("id, status, hired_at").execute()
    apps = apps_result.data or []

    pipeline_count = len([a for a in apps if a["status"] in ["screening", "shortlisted", "assessment", "offer"]])

    # Get pending assessments
    assessments_result = db.client.table("assessments").select("id, status").execute()
    assessments = assessments_result.data or []
    pending_assessments = len([a for a in assessments if a["status"] in ["pending", "scheduled"]])

    # Get pending offers
    offers_result = db.client.table("offers").select("id, status").execute()
    offers = offers_result.data or []
    pending_offers = len([o for o in offers if o["status"] in ["draft", "approved", "sent"]])

    # Get hired this month
    first_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    hired_this_month = len([
        a for a in apps
        if a.get("hired_at") and datetime.fromisoformat(a["hired_at"].replace("Z", "+00:00")).replace(tzinfo=None) >= first_of_month
    ])

    return {
        "total_jobs": total_jobs,
        "active_jobs": active_jobs,
        "total_candidates": total_candidates,
        "candidates_in_pipeline": pipeline_count,
        "pending_assessments": pending_assessments,
        "pending_offers": pending_offers,
        "hired_this_month": hired_this_month,
    }


@router.get("/pipeline")
async def get_pipeline(user: CurrentUser) -> dict[str, Any]:
    """Get pipeline status overview."""
    # Get application counts by status
    apps_result = db.client.table("applications").select("status").execute()
    apps = apps_result.data or []

    # Count by status
    status_counts = {}
    for app in apps:
        status = app.get("status", "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1

    return {
        "stages": {
            "new": status_counts.get("new", 0),
            "screening": status_counts.get("screening", 0) + status_counts.get("shortlisted", 0),
            "assessment": status_counts.get("assessment", 0),
            "offer": status_counts.get("offer", 0),
            "hired": status_counts.get("hired", 0),
        },
        "rejected": status_counts.get("rejected", 0),
        "withdrawn": status_counts.get("withdrawn", 0),
    }


@router.get("/agent-logs")
async def get_agent_logs(user: CurrentUser, limit: int = 50) -> dict[str, Any]:
    """Get recent agent activity logs."""
    logs = await db.get_recent_agent_logs(limit=limit)

    return {
        "logs": logs,
        "total": len(logs),
    }


@router.get("/recent-activity")
async def get_recent_activity(user: CurrentUser, limit: int = 10) -> dict[str, Any]:
    """Get recent activity across all entities."""
    activities = []

    # Recent jobs
    jobs_result = db.client.table("jobs").select("id, title, status, created_at").order("created_at", desc=True).limit(5).execute()
    for job in jobs_result.data or []:
        activities.append({
            "type": "job",
            "id": job["id"],
            "title": f"Job created: {job['title']}",
            "status": job["status"],
            "timestamp": job["created_at"],
        })

    # Recent applications
    apps_result = db.client.table("applications").select("id, status, created_at, candidates(first_name, last_name), jobs(title)").order("created_at", desc=True).limit(5).execute()
    for app in apps_result.data or []:
        candidate_name = f"{app.get('candidates', {}).get('first_name', '')} {app.get('candidates', {}).get('last_name', '')}".strip() or "Unknown"
        job_title = app.get("jobs", {}).get("title", "Unknown Position")
        activities.append({
            "type": "application",
            "id": app["id"],
            "title": f"{candidate_name} applied for {job_title}",
            "status": app["status"],
            "timestamp": app["created_at"],
        })

    # Recent assessments
    assessments_result = db.client.table("assessments").select("id, status, created_at, applications(candidates(first_name, last_name))").order("created_at", desc=True).limit(5).execute()
    for assessment in assessments_result.data or []:
        app_data = assessment.get("applications", {}) or {}
        candidate = app_data.get("candidates", {}) or {}
        candidate_name = f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip() or "Unknown"
        activities.append({
            "type": "assessment",
            "id": assessment["id"],
            "title": f"Assessment for {candidate_name}",
            "status": assessment["status"],
            "timestamp": assessment["created_at"],
        })

    # Sort by timestamp
    activities.sort(key=lambda x: x["timestamp"], reverse=True)

    return {
        "activities": activities[:limit],
    }


@router.get("/agent-status")
async def get_agent_status(user: CurrentUser) -> dict[str, Any]:
    """Get status of all agents."""
    # Get recent agent logs to determine status
    logs_result = db.client.table("agent_logs").select("agent_type, status, created_at").order("created_at", desc=True).limit(100).execute()
    logs = logs_result.data or []

    # Aggregate by agent type
    agent_stats = {
        "jd_assist": {"name": "JD Assist", "status": "idle", "last_action": None, "actions_today": 0},
        "screener": {"name": "Talent Screener", "status": "idle", "last_action": None, "actions_today": 0},
        "assessor": {"name": "Talent Assessor", "status": "idle", "last_action": None, "actions_today": 0},
        "offer_gen": {"name": "Offer Generator", "status": "idle", "last_action": None, "actions_today": 0},
    }

    today = datetime.utcnow().date()

    for log in logs:
        agent_type = log.get("agent_type")
        if agent_type not in agent_stats:
            continue

        log_date = datetime.fromisoformat(log["created_at"].replace("Z", "+00:00")).date()

        # Update last action if this is the most recent
        if agent_stats[agent_type]["last_action"] is None:
            agent_stats[agent_type]["last_action"] = log["created_at"]
            agent_stats[agent_type]["status"] = "active" if log.get("status") == "success" else "error" if log.get("status") == "error" else "idle"

        # Count actions today
        if log_date == today:
            agent_stats[agent_type]["actions_today"] += 1

    return {
        "agents": list(agent_stats.values()),
    }
