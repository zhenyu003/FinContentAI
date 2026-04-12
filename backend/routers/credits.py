from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from middleware.auth import get_current_user
from services.supabase_client import get_supabase_client

router = APIRouter(prefix="/credits", tags=["credits"])

CREDIT_COSTS = {
    "topic_search": 1,
    "idea_generation": 2,
    "opinion_refinement": 2,
    "scene_generation": 3,
    "image_generation": 5,
    "audio_generation": 3,
    "video_synthesis": 10,
    "social_post_generation": 5,
    "thumbnail_generation": 3,
}


class PurchaseRequest(BaseModel):
    amount: int
    payment_method: str


async def deduct_credits(
    user_id: str, operation: str, content_id: str = None
) -> int:
    """Deduct credits for an operation and record the transaction.

    Returns the new balance after deduction.
    Raises HTTPException 402 if balance is insufficient.
    """
    cost = CREDIT_COSTS.get(operation)
    if cost is None:
        raise HTTPException(status_code=400, detail=f"Unknown operation: {operation}")

    supabase = get_supabase_client()

    # Get current balance
    result = (
        supabase.table("credits")
        .select("balance")
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    current_balance = result.data["balance"] if result.data else 0

    if current_balance < cost:
        raise HTTPException(
            status_code=402,
            detail="Insufficient credits",
        )

    new_balance = current_balance - cost

    # Update balance
    supabase.table("credits").upsert(
        {"user_id": user_id, "balance": new_balance}
    ).execute()

    # Record transaction
    transaction = {
        "user_id": user_id,
        "type": "deduction",
        "amount": -cost,
        "operation": operation,
        "description": f"Credit deduction for {operation}",
    }
    if content_id:
        transaction["content_id"] = content_id
    supabase.table("credit_transactions").insert(transaction).execute()

    return new_balance


@router.get("")
async def get_credit_balance(user: dict = Depends(get_current_user)):
    """Get the current user's credit balance and subscription tier."""
    try:
        supabase = get_supabase_client()
        user_id = user["id"]

        # Get credit balance
        credits_result = (
            supabase.table("credits")
            .select("balance")
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        balance = credits_result.data["balance"] if credits_result.data else 0

        # Get subscription tier from profiles
        profile_result = (
            supabase.table("profiles")
            .select("subscription_tier")
            .eq("id", user_id)
            .single()
            .execute()
        )
        tier = profile_result.data["subscription_tier"] if profile_result.data else "free"

        return {"balance": balance, "tier": tier}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/transactions")
async def get_transactions(
    limit: int = Query(default=20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    """Get the current user's credit transaction history."""
    try:
        supabase = get_supabase_client()

        result = (
            supabase.table("credit_transactions")
            .select("*")
            .eq("user_id", user["id"])
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        return {"transactions": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/purchase")
async def purchase_credits(
    request: PurchaseRequest, user: dict = Depends(get_current_user)
):
    """Purchase credits (mock implementation)."""
    try:
        if request.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")

        supabase = get_supabase_client()
        user_id = user["id"]

        # Get current balance
        credits_result = (
            supabase.table("credits")
            .select("balance")
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        current_balance = credits_result.data["balance"] if credits_result.data else 0
        new_balance = current_balance + request.amount

        # Update balance
        supabase.table("credits").upsert(
            {"user_id": user_id, "balance": new_balance}
        ).execute()

        # Record transaction
        supabase.table("credit_transactions").insert(
            {
                "user_id": user_id,
                "type": "purchase",
                "amount": request.amount,
                "operation": "purchase",
                "description": f"Purchased {request.amount} credits via {request.payment_method}",
            }
        ).execute()

        return {"balance": new_balance}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
