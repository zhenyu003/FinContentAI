from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional

from services.supabase_client import get_supabase_client, get_supabase_anon_client
from middleware.auth import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


# --------------- Request / Response Models ---------------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# --------------- Endpoints ---------------

@router.post("/register")
async def register(body: RegisterRequest):
    """Register a new user with email + password."""
    try:
        supabase = get_supabase_anon_client()
        sign_up_params = {
            "email": body.email,
            "password": body.password,
        }
        if body.display_name:
            sign_up_params["options"] = {
                "data": {"display_name": body.display_name}
            }
        res = supabase.auth.sign_up(sign_up_params)

        if not res.user:
            raise HTTPException(status_code=400, detail="Registration failed")

        # If a display_name was provided, upsert into the profiles table
        if body.display_name:
            try:
                sb = get_supabase_client()
                sb.table("profiles").upsert({
                    "id": res.user.id,
                    "display_name": body.display_name,
                }).execute()
            except Exception:
                pass  # non-critical; profile row may be created by a DB trigger

        return {
            "user": {
                "id": res.user.id,
                "email": res.user.email,
                "display_name": body.display_name,
            },
            "session": {
                "access_token": res.session.access_token if res.session else None,
                "refresh_token": res.session.refresh_token if res.session else None,
                "expires_in": res.session.expires_in if res.session else None,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login")
async def login(body: LoginRequest):
    """Login with email + password and return session tokens."""
    try:
        supabase = get_supabase_anon_client()
        res = supabase.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })

        if not res.user or not res.session:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        return {
            "user": {
                "id": res.user.id,
                "email": res.user.email,
            },
            "session": {
                "access_token": res.session.access_token,
                "refresh_token": res.session.refresh_token,
                "expires_in": res.session.expires_in,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout the current user."""
    return {"message": "Successfully logged out"}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get the current authenticated user's info and profile."""
    try:
        supabase = get_supabase_client()
        result = (
            supabase.table("profiles")
            .select("*")
            .eq("id", current_user["id"])
            .maybe_single()
            .execute()
        )
        profile = result.data if result.data else {}

        return {
            "id": current_user["id"],
            "email": current_user["email"],
            "role": current_user.get("role", "authenticated"),
            "profile": profile,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
