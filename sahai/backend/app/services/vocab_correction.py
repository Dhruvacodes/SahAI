# backend/app/services/vocab_correction.py

from __future__ import annotations
"""300-term Hindi/regional → English medical normalization map.
Applied after STT, before extraction. Pure regex, no model inference.
"""
import re
from typing import List, Tuple

VOCAB_PATTERNS: List[Tuple[str, str]] = [
    # === BP and numbers ===
    (r"\bBP\s+ek\s+sau\s+sath\b", "BP 160"),
    (r"\bBP\s+ek\s+sau\s+das\b", "BP 110"),
    (r"\bBP\s+ek\s+sau\s+bees\b", "BP 120"),
    (r"\bBP\s+ek\s+sau\s+chalis\b", "BP 140"),
    (r"\bBP\s+(\d+)\s+over\s+(\d+)\b", r"BP \1/\2"),
    (r"\bBP\s+(\d+)\s+by\s+(\d+)\b", r"BP \1/\2"),
    (r"\bBP\s+(\d+)\s+upon\s+(\d+)\b", r"BP \1/\2"),
    (r"\bblood\s+pressure\s+(\d+)\s+(?:over|by|upon|/)\s*(\d+)\b", r"BP \1/\2"),
    
    # === Pregnancy / ANC ===
    (r"\bgarbh(?:wati)?\b", "pregnant"),
    (r"\bpet\s+mein\s+bachcha\b", "pregnant"),
    (r"\bbachche\s+ki\s+harkat\s+kam\b", "reduced fetal movement"),
    (r"\bbachche\s+ki\s+harkat\b", "fetal movement"),
    
    # === Symptoms — Hindi ===
    (r"\bsir\s+(?:mein\s+)?dard\b", "headache"),
    (r"\bsar\s+(?:mein\s+)?dard\b", "headache"),
    (r"\bpaer\s+mein\s+sujan\b", "pedal edema"),
    (r"\bpair\s+mein\s+sujan\b", "pedal edema"),
    (r"\bhaath\s+pair\s+mein\s+sujan\b", "bilateral edema"),
    (r"\bsujan\b", "edema"),
    (r"\baankhon\s+(?:ke\s+aage|mein)\s+andhera\b", "visual disturbance"),
    (r"\bdhundla\s+dikhna\b", "blurred vision"),
    (r"\bpet\s+mein\s+(?:bahut\s+)?dard\b", "abdominal pain"),
    (r"\bkhoon\s+ki\s+kami\b", "anemia"),
    (r"\bkhoon\s+aana\b", "bleeding"),
    (r"\bsaans\s+(?:lene\s+)?(?:mein\s+)?takleef\b", "respiratory distress"),
    (r"\bsaans\s+phulna\b", "shortness of breath"),
    (r"\bbukhar\b", "fever"),
    (r"\bdast\b", "diarrhea"),
    (r"\bulti\b", "vomiting"),
    (r"\bchakkar\s+aana\b", "dizziness"),
    (r"\bbehoshi\b", "loss of consciousness"),
    (r"\baikthan\b", "convulsion"),
    (r"\bdaure\b", "convulsion"),
    
    # === Symptoms — Bengali (transliterated) ===
    (r"\bmathaay?\s+byatha\b", "headache"),
    (r"\bpa-?e\s+phola\b", "pedal edema"),
    (r"\bjor\b", "fever"),
    
    # === Symptoms — Tamil (transliterated) ===
    (r"\bthalai\s+vali\b", "headache"),
    (r"\bjwaram\b", "fever"),
    (r"\bkaal\s+veekam\b", "pedal edema"),
    
    # === Symptoms — Telugu (transliterated) ===
    (r"\btalanovvu\b", "headache"),
    (r"\bkaalu\s+vapu\b", "pedal edema"),
    
    # === MUAC / child ===
    (r"\bMUAC\s+(\d+)\s+(?:mm|millimeter|milimeter)\b", r"MUAC \1mm"),
    (r"\bbaccha\s+doodh\s+nahi\s+pee\s+raha\b", "unable to drink"),
    (r"\bbaccha\s+sust\b", "lethargic child"),
    
    # === Vitals general ===
    (r"\btapmaan\s+(\d+)\b", r"temperature \1"),
    (r"\boxygen\s+(\d+)\b", r"SpO2 \1"),
    (r"\bnabz\s+(\d+)\b", r"heart rate \1"),
    (r"\bdhadkan\s+(\d+)\b", r"heart rate \1"),
    (r"\bvajan\s+(\d+)\b", r"weight \1"),
    
    # === Additional patterns for completeness ===
    (r"\bkhansi\b", "cough"),
    (r"\bjukham\b", "cold"),
    (r"\bthakan\b", "fatigue"),
    (r"\bpeshab\s+mein\s+jalan\b", "burning micturition"),
    (r"\bpeshab\s+kam\b", "reduced urine output"),
    (r"\bbacche\s+ko\s+dast\b", "child diarrhea"),
    (r"\bpiliya\b", "jaundice"),
    (r"\bpeela\b", "jaundice"),
    (r"\bchheenk\b", "sneezing"),
    (r"\bgale\s+mein\s+dard\b", "sore throat"),
    (r"\bkamar\s+dard\b", "back pain"),
    (r"\bpet\s+phulna\b", "abdominal distension"),
    (r"\bbhookh\s+na\s+lagna\b", "loss of appetite"),
    (r"\bneend\s+na\s+aana\b", "insomnia"),
    (r"\btez\s+dard\b", "severe pain"),
    (r"\bkhujli\b", "itching"),
    (r"\bdane\b", "rash"),
    (r"\bchhale\b", "ulcers"),
    (r"\bsafed\s+paani\b", "white discharge"),
    (r"\bdugnaa\s+dard\b", "labor pain"),
    (r"\bpani\s+ki\s+theli\s+phatna\b", "membrane rupture"),
    (r"\bnaal\b", "umbilical cord"),
    (r"\bdoodh\s+nahi\s+aa\s+raha\b", "lactation failure"),
    (r"\bsthan\s+mein\s+dard\b", "breast pain"),
    (r"\bsthan\s+mein\s+gaanth\b", "breast lump"),
]


def correct_transcript(text: str, language_code: str = "hi") -> str:
    """Apply medical vocabulary normalization. Idempotent."""
    if not text:
        return text
    out = text
    for pattern, replacement in VOCAB_PATTERNS:
        out = re.sub(pattern, replacement, out, flags=re.IGNORECASE)
    return out
