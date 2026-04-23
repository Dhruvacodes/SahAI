"""Prompt templates for clinical data extraction from visit transcripts."""

SYSTEM_PROMPT = """You extract structured maternal and community health data from ASHA visit transcripts.
Return only valid JSON. Do not include markdown, prose, or explanations."""

USER_PROMPT_TEMPLATE = """Extract health data from this transcript:

{transcript}

Return JSON with this exact shape:
{{
  "extractedVitals": {{
    "bloodPressureSystolic": number or null,
    "bloodPressureDiastolic": number or null,
    "hemoglobinLevel": number or null,
    "fetalMovements": boolean or null,
    "oedema": boolean or null,
    "temperature": number or null
  }},
  "symptoms": string[] or null,
  "patientComplaint": string or null,
  "riskScore": number or null,
  "riskLevel": "LOW" or "MEDIUM" or "HIGH" or "CRITICAL" or null,
  "referralGenerated": boolean or null,
  "followUpPlan": string or null
}}"""
