"""Shared consent and privacy schemas."""

from typing import List, Optional

from pydantic import BaseModel


class ConsentSnapshot(BaseModel):
    """Patient consent state captured before AI-assisted processing.
    V3 format: consentGranted, scopeAgreed, patientId, ashaId.
    """

    consentGranted: bool
    scopeAgreed: List[str]
    languageCode: str = "hi"
    timestamp: str = ""
    witnessPresent: bool = False
    patientId: str = ""
    ashaId: str = ""
    receiptHash: Optional[str] = None
