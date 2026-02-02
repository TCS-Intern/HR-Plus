"""
Credits API for pay-per-reveal model
"""

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

from app.services.supabase import supabase

router = APIRouter(prefix="/credits", tags=["credits"])


# =====================================================
# Schemas
# =====================================================


class CreditBalance(BaseModel):
    """User credit balance"""

    credits: int
    total_purchased: int
    total_spent: int
    total_reveals: int
    last_purchase_at: str | None = None


class CreditTransaction(BaseModel):
    """Credit transaction record"""

    id: str
    transaction_type: str
    amount: int
    balance_after: int
    description: str | None = None
    created_at: str


class PurchaseRequest(BaseModel):
    """Credit purchase request"""

    package: str  # "starter", "professional", "enterprise"
    payment_method: str | None = "stripe"


class PurchaseResponse(BaseModel):
    """Credit purchase response"""

    success: bool
    checkout_url: str | None = None  # Stripe checkout URL
    credits_added: int | None = None
    new_balance: int | None = None
    error: str | None = None


# =====================================================
# Package Configurations
# =====================================================

CREDIT_PACKAGES = {
    "starter": {"credits": 10, "price_cents": 4900, "price_display": "$49"},
    "professional": {"credits": 50, "price_cents": 19900, "price_display": "$199"},
    "enterprise": {"credits": 200, "price_cents": 69900, "price_display": "$699"},
}


# =====================================================
# Endpoints
# =====================================================


@router.get("/balance", response_model=CreditBalance)
async def get_balance(
    user_id: str = Header("00000000-0000-0000-0000-000000000001", alias="X-User-ID"),
):
    """
    Get user's current credit balance and usage stats.
    """
    # Get user credits using Supabase function
    result = supabase.rpc("get_user_credits", {"p_user_id": user_id}).execute()

    _ = result.data if result.data is not None else 0  # noqa: F841

    # Get full credit record for stats
    credit_record = supabase.table("user_credits").select("*").eq("user_id", user_id).execute()

    if credit_record.data:
        record = credit_record.data[0]
        return CreditBalance(
            credits=record.get("credits", 0),
            total_purchased=record.get("total_credits_purchased", 0),
            total_spent=record.get("total_credits_spent", 0),
            total_reveals=record.get("total_reveals", 0),
            last_purchase_at=record.get("last_purchase_at"),
        )

    # No record yet, return zeros
    return CreditBalance(
        credits=0,
        total_purchased=0,
        total_spent=0,
        total_reveals=0,
        last_purchase_at=None,
    )


@router.get("/transactions", response_model=list[CreditTransaction])
async def get_transactions(
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    user_id: str = Header("00000000-0000-0000-0000-000000000001", alias="X-User-ID"),
):
    """
    Get user's credit transaction history.
    """
    result = (
        supabase.table("credit_transactions")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .offset(offset)
        .execute()
    )

    transactions = result.data or []

    return [
        CreditTransaction(
            id=t["id"],
            transaction_type=t["transaction_type"],
            amount=t["amount"],
            balance_after=t["balance_after"],
            description=t.get("description"),
            created_at=t["created_at"],
        )
        for t in transactions
    ]


@router.post("/purchase", response_model=PurchaseResponse)
async def purchase_credits(
    request: PurchaseRequest,
    user_id: str = Header("00000000-0000-0000-0000-000000000001", alias="X-User-ID"),
):
    """
    Purchase credit package.

    For MVP, this is a placeholder that directly adds credits without payment.
    In production, this would:
    1. Create Stripe checkout session
    2. Return checkout URL
    3. Webhook handles credit addition after successful payment
    """
    # Validate package
    if request.package not in CREDIT_PACKAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid package. Choose from: {', '.join(CREDIT_PACKAGES.keys())}",
        )

    package_config = CREDIT_PACKAGES[request.package]

    # For MVP: Directly add credits (skip payment)
    # TODO: In production, create Stripe checkout session instead
    try:
        result = supabase.rpc(
            "add_credits",
            {
                "p_user_id": user_id,
                "p_amount": package_config["credits"],
                "p_transaction_type": "purchase",
                "p_package_name": request.package,
                "p_package_price_cents": package_config["price_cents"],
                "p_payment_provider": "test",  # "stripe" in production
                "p_payment_id": f"test_{request.package}_{user_id}",
                "p_description": f"Purchased {request.package} package ({package_config['credits']} credits)",
            },
        ).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to add credits")

        response_data = result.data

        return PurchaseResponse(
            success=True,
            credits_added=package_config["credits"],
            new_balance=response_data.get("new_balance", 0),
            checkout_url=None,  # Would be Stripe URL in production
        )

    except Exception as e:
        print(f"Error purchasing credits: {e}")
        return PurchaseResponse(
            success=False,
            error="Failed to process credit purchase",
        )


@router.get("/packages")
async def get_packages():
    """
    Get available credit packages with pricing.
    """
    return {
        "packages": [
            {
                "id": package_id,
                "name": package_id.title(),
                "credits": config["credits"],
                "price": config["price_display"],
                "price_cents": config["price_cents"],
                "price_per_credit": f"${config['price_cents'] / config['credits'] / 100:.2f}",
            }
            for package_id, config in CREDIT_PACKAGES.items()
        ]
    }
