# backend/app/routers/auth.py

from __future__ import annotations
"""Authentication routes for ANM dashboard login."""
import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from jose import jwt, JWTError
import bcrypt
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.anm_supervisor import ANMSupervisorORM
from app.services.audit import log_event

router = APIRouter(tags=["auth"])


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))

JWT_SECRET = os.getenv("JWT_SECRET_KEY", "change-me-in-prod")
JWT_ALGO = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXP_MIN = int(os.getenv("JWT_EXPIRY_MINUTES", "30"))


def _make_token(user: ANMSupervisorORM) -> str:
    payload = {
        "sub": user.id,
        "name": user.name,
        "role": user.role,
        "district": user.district,
        "exp": datetime.utcnow() + timedelta(minutes=JWT_EXP_MIN),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    token: str
    user: dict


@router.post("/api/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(ANMSupervisorORM).filter(
        (ANMSupervisorORM.email == req.username) | (ANMSupervisorORM.id == req.username)
    ).first()
    if not user or not _verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = _make_token(user)
    log_event(db, actor_id=user.id, actor_role="ANM", event_type="AUTH_LOGIN")
    return TokenResponse(token=token, user={"id": user.id, "name": user.name, "role": user.role, "district": user.district})


@router.post("/api/auth/demo-login", response_model=TokenResponse)
def demo_login(db: Session = Depends(get_db)):
    user = db.query(ANMSupervisorORM).filter(ANMSupervisorORM.id == "demo_anm_pune_001").first()
    if not user:
        raise HTTPException(status_code=500, detail="Demo user not seeded")
    token = _make_token(user)
    log_event(db, actor_id=user.id, actor_role="ANM", event_type="AUTH_DEMO_LOGIN")
    return TokenResponse(token=token, user={"id": user.id, "name": user.name, "role": user.role, "district": user.district})


@router.get("/api/auth/me")
def me(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(ANMSupervisorORM).filter(ANMSupervisorORM.id == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"id": user.id, "name": user.name, "role": user.role, "district": user.district}
