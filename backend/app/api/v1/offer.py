"""Offer API endpoints."""

from datetime import datetime, timedelta
from uuid import UUID
from typing import Any

from fastapi import APIRouter, HTTPException

from app.schemas.offer import OfferCreate, OfferResponse, OfferUpdate
from app.agents.coordinator import agent_coordinator
from app.services.supabase import db
from app.middleware.auth import CurrentUser

router = APIRouter()


@router.post("/generate")
async def generate_offer(application_id: str, user: CurrentUser) -> dict[str, Any]:
    """Generate an offer package for a candidate."""
    # Get application with related data
    application = await db.get_application(application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Get job data
    job = await db.get_job(application["job_id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get candidate data
    candidate = await db.get_candidate(application["candidate_id"])
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Get assessment data if available
    assessments_result = db.client.table("assessments").select("*").eq("application_id", application_id).order("created_at", desc=True).limit(1).execute()
    assessment = assessments_result.data[0] if assessments_result.data else None

    # Prepare offer input
    salary_range = job.get("salary_range", {})
    offer_input = {
        "application_id": application_id,
        "candidate_name": f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip(),
        "candidate_email": candidate.get("email", ""),
        "job_title": job.get("title", ""),
        "department": job.get("department", ""),
        "salary_range_min": salary_range.get("min", 0),
        "salary_range_max": salary_range.get("max", 0),
        "experience_years": 0,  # Would be extracted from resume parsing
        "assessment_score": assessment.get("overall_score", 0) if assessment else 0,
    }

    # Run the offer generator agent
    try:
        result = await agent_coordinator.run_offer_generator(offer_input)

        # Extract offer data from agent result
        compensation = result.get("compensation", {})

        # Calculate expiry date (14 days from now)
        expiry_date = (datetime.utcnow() + timedelta(days=14)).date()

        # Create offer in database
        offer_data = {
            "application_id": application_id,
            "base_salary": compensation.get("base_salary", salary_range.get("min", 0)),
            "currency": compensation.get("currency", "USD"),
            "signing_bonus": compensation.get("signing_bonus", 0),
            "annual_bonus_target": compensation.get("annual_bonus_target", 0),
            "equity_type": compensation.get("equity", {}).get("type", "none"),
            "equity_amount": compensation.get("equity", {}).get("amount", 0),
            "equity_vesting_schedule": compensation.get("equity", {}).get("vesting_schedule", ""),
            "benefits": result.get("benefits", []),
            "start_date": result.get("start_date"),
            "offer_expiry_date": expiry_date.isoformat(),
            "contingencies": result.get("contingencies", []),
            "negotiation_guidance": result.get("negotiation_guidance"),
            "status": "draft",
        }

        offer = await db.create_offer(offer_data)

        # Update application status
        await db.update_application(application_id, {"status": "offer"})

        return {
            "id": offer.get("id"),
            "application_id": application_id,
            "candidate": {
                "name": offer_input["candidate_name"],
                "email": offer_input["candidate_email"],
            },
            "job_title": offer_input["job_title"],
            "compensation": {
                "base_salary": offer_data["base_salary"],
                "currency": offer_data["currency"],
                "signing_bonus": offer_data["signing_bonus"],
                "annual_bonus_target": offer_data["annual_bonus_target"],
                "equity": {
                    "type": offer_data["equity_type"],
                    "amount": offer_data["equity_amount"],
                    "vesting_schedule": offer_data["equity_vesting_schedule"],
                },
            },
            "benefits": offer_data["benefits"],
            "start_date": offer_data["start_date"],
            "offer_expiry_date": offer_data["offer_expiry_date"],
            "contingencies": offer_data["contingencies"],
            "negotiation_guidance": offer_data["negotiation_guidance"],
            "status": "draft",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate offer: {str(e)}")


@router.get("")
async def list_offers(user: CurrentUser, status: str | None = None, limit: int = 50) -> dict[str, Any]:
    """List all offers."""
    query = db.client.table("offers").select("*, applications(*, candidates(*), jobs(*))").order("created_at", desc=True).limit(limit)

    if status:
        query = query.eq("status", status)

    result = query.execute()

    offers = []
    for offer in result.data or []:
        app = offer.get("applications", {})
        offers.append({
            **offer,
            "candidate": app.get("candidates", {}),
            "job": app.get("jobs", {}),
        })

    return {
        "offers": offers,
        "total": len(offers),
    }


@router.get("/{offer_id}")
async def get_offer(offer_id: str, user: CurrentUser) -> dict[str, Any]:
    """Get offer details by ID."""
    offer = await db.get_offer(offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    # Get related data
    application = await db.get_application(offer["application_id"])
    candidate = await db.get_candidate(application["candidate_id"]) if application else None
    job = await db.get_job(application["job_id"]) if application else None

    return {
        **offer,
        "candidate": candidate,
        "job": job,
    }


@router.put("/{offer_id}")
async def update_offer(offer_id: str, offer_update: OfferUpdate, user: CurrentUser) -> dict[str, Any]:
    """Update an offer."""
    existing_offer = await db.get_offer(offer_id)
    if not existing_offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    update_data = offer_update.model_dump(exclude_unset=True, exclude_none=True)

    # Handle nested objects
    if "equity" in update_data:
        update_data["equity_type"] = update_data["equity"].get("type")
        update_data["equity_amount"] = update_data["equity"].get("amount")
        update_data["equity_vesting_schedule"] = update_data["equity"].get("vesting_schedule")
        del update_data["equity"]

    updated_offer = await db.update_offer(offer_id, update_data)

    return updated_offer


@router.post("/{offer_id}/approve")
async def approve_offer(offer_id: str, user: CurrentUser) -> dict[str, Any]:
    """Approve an offer for sending."""
    offer = await db.get_offer(offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    if offer.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Only draft offers can be approved")

    await db.update_offer(
        offer_id,
        {
            "status": "approved",
            "approved_at": datetime.utcnow().isoformat(),
        },
    )

    return {
        "status": "approved",
        "offer_id": offer_id,
    }


@router.post("/{offer_id}/send")
async def send_offer(offer_id: str, user: CurrentUser) -> dict[str, Any]:
    """Send offer to candidate via email."""
    offer = await db.get_offer(offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    if offer.get("status") not in ["draft", "approved"]:
        raise HTTPException(status_code=400, detail="Offer cannot be sent in current status")

    # Get candidate email
    application = await db.get_application(offer["application_id"])
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    candidate = await db.get_candidate(application["candidate_id"])
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    job = await db.get_job(application["job_id"])

    # TODO: Send actual email with offer letter
    # For now, just update the status
    # await send_offer_email(
    #     to_email=candidate["email"],
    #     candidate_name=f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}",
    #     job_title=job.get("title", ""),
    #     offer=offer,
    # )

    await db.update_offer(
        offer_id,
        {
            "status": "sent",
            "sent_at": datetime.utcnow().isoformat(),
        },
    )

    # Update application status
    await db.update_application(offer["application_id"], {"offered_at": datetime.utcnow().isoformat()})

    return {
        "status": "sent",
        "offer_id": offer_id,
        "sent_to": candidate.get("email"),
    }


@router.put("/{offer_id}/status")
async def update_offer_status(offer_id: str, status: str, user: CurrentUser) -> dict[str, Any]:
    """Update offer status (accepted, rejected, negotiating)."""
    valid_statuses = ["accepted", "rejected", "negotiating", "expired", "withdrawn"]
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {valid_statuses}",
        )

    offer = await db.get_offer(offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    update_data = {"status": status}

    if status == "accepted":
        update_data["responded_at"] = datetime.utcnow().isoformat()
        # Update application status to hired
        await db.update_application(
            offer["application_id"],
            {"status": "hired", "hired_at": datetime.utcnow().isoformat()},
        )
    elif status == "rejected":
        update_data["responded_at"] = datetime.utcnow().isoformat()
        # Update application status
        await db.update_application(
            offer["application_id"],
            {"status": "rejected", "rejected_at": datetime.utcnow().isoformat()},
        )

    await db.update_offer(offer_id, update_data)

    return {
        "status": "updated",
        "offer_id": offer_id,
        "new_status": status,
    }


@router.post("/{offer_id}/add-note")
async def add_negotiation_note(offer_id: str, note: str, user: CurrentUser) -> dict[str, Any]:
    """Add a negotiation note to an offer."""
    offer = await db.get_offer(offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    existing_notes = offer.get("negotiation_notes", []) or []
    existing_notes.append({
        "timestamp": datetime.utcnow().isoformat(),
        "note": note,
        "actor": user.email,  # Track who added the note
    })

    await db.update_offer(offer_id, {"negotiation_notes": existing_notes})

    return {
        "status": "note_added",
        "offer_id": offer_id,
        "notes_count": len(existing_notes),
    }


@router.get("/application/{application_id}")
async def get_offer_for_application(application_id: str, user: CurrentUser) -> dict[str, Any]:
    """Get offer for a specific application."""
    result = db.client.table("offers").select("*").eq("application_id", application_id).order("created_at", desc=True).limit(1).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="No offer found for this application")

    offer = result.data[0]

    # Get related data
    application = await db.get_application(application_id)
    candidate = await db.get_candidate(application["candidate_id"]) if application else None
    job = await db.get_job(application["job_id"]) if application else None

    return {
        **offer,
        "candidate": candidate,
        "job": job,
    }
