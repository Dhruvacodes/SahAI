"""API routes for extracting structured health data from transcripts."""

from typing import List, Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.services.extraction_service import (
    ExtractionParseError,
    ExtractionServiceError,
    extract_health_data,
)

router = APIRouter(tags=["extraction"])


class ExtractionRequest(BaseModel):
    """Request body for transcript extraction."""

    transcript: str = Field(..., min_length=10, max_length=5000)
    visitId: str


class ExtractionResponse(BaseModel):
    """Flattened health data extracted from a visit transcript."""

    bloodPressureSystolic: Optional[int]
    bloodPressureDiastolic: Optional[int]
    hemoglobinLevel: Optional[float]
    fetalMovements: Optional[bool]
    oedema: Optional[bool]
    temperature: Optional[float]
    symptoms: List[str]
    patientComplaint: str


@router.post("/extract", response_model=ExtractionResponse)
async def extract_transcript_health_data(
    request: ExtractionRequest,
) -> ExtractionResponse | JSONResponse:
    """Extract vitals, symptoms, and complaint text from a transcript.

    Args:
        request: Transcript extraction request with visit context.

    Returns:
        Flattened extraction response or a structured error response.
    """
    _ = request.visitId

    try:
        extracted_data = await extract_health_data(request.transcript)
    except ExtractionParseError as exc:
        return JSONResponse(
            status_code=422,
            content={"error": "Extraction failed", "raw": exc.raw},
        )
    except ExtractionServiceError:
        return JSONResponse(
            status_code=503,
            content={"error": "Service unavailable"},
        )

    extracted_vitals = extracted_data.get("extractedVitals")
    if not isinstance(extracted_vitals, dict):
        extracted_vitals = {}

    symptoms = extracted_data.get("symptoms")
    if not isinstance(symptoms, list):
        symptoms = []

    patient_complaint = extracted_data.get("patientComplaint")
    if not isinstance(patient_complaint, str):
        patient_complaint = ""

    return ExtractionResponse(
        bloodPressureSystolic=extracted_vitals.get("bloodPressureSystolic"),
        bloodPressureDiastolic=extracted_vitals.get("bloodPressureDiastolic"),
        hemoglobinLevel=extracted_vitals.get("hemoglobinLevel"),
        fetalMovements=extracted_vitals.get("fetalMovements"),
        oedema=extracted_vitals.get("oedema"),
        temperature=extracted_vitals.get("temperature"),
        symptoms=symptoms,
        patientComplaint=patient_complaint,
    )

