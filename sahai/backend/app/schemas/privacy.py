"""Shared consent and privacy schemas."""

from typing import List, Optional

from pydantic import BaseModel, Field

from app.services.consent_service import CONSENT_VERSION


class ConsentSnapshot(BaseModel):
    """Patient consent state captured before AI-assisted processing."""

    consentGiven: bool
    privacyNoticeAccepted: bool
    consentVersion: str = CONSENT_VERSION
    languageCode: str = "hi"
    dataUseScopes: List[str] = Field(default_factory=list)
    recordedAt: Optional[str] = None
    patientSignatureName: Optional[str] = None
