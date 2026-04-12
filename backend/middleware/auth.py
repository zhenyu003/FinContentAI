from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from services.supabase_client import get_supabase_client


security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Extract and validate user from Supabase JWT token."""
    token = credentials.credentials
    try:
        sb = get_supabase_client()
        user_response = sb.auth.get_user(token)
        user = user_response.user
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {
            "id": user.id,
            "email": user.email or "",
            "role": "authenticated",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Auth failed: {e}")


async def get_optional_user(request: Request) -> dict | None:
    """Optionally extract user from token. Returns None if no auth header."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    try:
        token = auth_header.split(" ", 1)[1]
        sb = get_supabase_client()
        user_response = sb.auth.get_user(token)
        user = user_response.user
        if user:
            return {"id": user.id, "email": user.email or "", "role": "authenticated"}
    except Exception:
        pass
    return None
