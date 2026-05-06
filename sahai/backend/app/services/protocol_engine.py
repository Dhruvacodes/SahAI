"""Deterministic protocol-rule executor for SahAI.

This module replaces the inline `risk_engine.score_risk` rules with a
data-driven evaluator. Rules live in JSON files under
`sahai/protocols/v1/<vertical>.v1.json`; the same JSON is also consumed by the
mobile TS port so on-device and server-side decisions stay aligned.

Design principles:
  - Pure function. ``evaluate(visit_input)`` is side-effect free and stateless.
  - Data, not code. Adding/changing a rule requires editing JSON only.
  - Citation-backed. Every fired rule carries its rationale + source.
  - Composable triggers. Trigger expressions support ``all_of``, ``any_of``,
    ``not`` and a small set of atomic clauses (see ``_eval_atom`` below).
  - Authoritative on the server. The engine returns an opaque,
    schema-stable result that the LLM and downstream referral renderer must
    consume verbatim. The LLM never invents severity.

Atomic clauses currently supported:
  - ``patient.<field>``        — equality on a patient-profile attribute
  - ``vitals.<vital>_gte``     — vitals.<vital> >= number (None never matches)
  - ``vitals.<vital>_lte``     — vitals.<vital> <= number
  - ``vitals.<vital>_gt``      — strict >
  - ``vitals.<vital>_lt``      — strict <
  - ``vitals.<vital>_present`` — value is not None
  - ``any_symptom_in``         — list[str] of substrings; case-insensitive
  - ``all_symptoms_in``        — list[str] all substrings present
  - ``mechanism_in``           — patient mechanism-of-injury matches list
  - ``visitType``              — equality on the visit's visitType
  - ``velocity_warning_in``    — substring match in trends velocity_warnings

The engine is generous about missing inputs: a clause referring to a vital
that wasn't extracted simply does not fire (rather than raising), so partial
input never produces noisy outputs.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

log = logging.getLogger(__name__)

# Severity ordering: index = strictness.
LEVEL_ORDER: Tuple[str, ...] = ("LOW", "MODERATE", "HIGH", "CRITICAL")
LEVEL_INDEX: Dict[str, int] = {lvl: i for i, lvl in enumerate(LEVEL_ORDER)}
LEVEL_SCORE: Dict[str, float] = {
    "LOW": 0.10,
    "MODERATE": 0.40,
    "HIGH": 0.70,
    "CRITICAL": 0.92,
}

# Catalog directory (sahai/protocols/v1/), resolved relative to this source file.
_CATALOG_DIR = (
    Path(__file__).resolve().parents[3] / "protocols" / "v1"
)


# ─── input / output shapes ──────────────────────────────────────────────────


@dataclass(frozen=True)
class PatientContext:
    """Patient-level attributes the engine reads. Any field may be None."""

    isPregnant: Optional[bool] = None
    gestationalWeeks: Optional[int] = None
    isPostpartum: Optional[bool] = None
    daysPostpartum: Optional[int] = None
    ageYears: Optional[int] = None
    ageMonths: Optional[int] = None
    sex: Optional[str] = None


@dataclass(frozen=True)
class VisitInput:
    """Everything the engine evaluates against."""

    patient: PatientContext
    vitals: Dict[str, Optional[float]] = field(default_factory=dict)
    symptoms: List[str] = field(default_factory=list)
    mechanisms: List[str] = field(default_factory=list)
    visitType: Optional[str] = None
    velocity_warnings: List[str] = field(default_factory=list)


@dataclass
class FiredRule:
    """A single rule that matched the visit input."""

    id: str
    vertical: str
    label_en: str
    escalates_to: str
    ttt_minutes: int
    rationale: str
    source: Dict[str, str]
    first_response_actions: List[Dict[str, Any]]
    referral_text_templates: Dict[str, Dict[str, str]]


@dataclass
class ProtocolResult:
    level: str
    score: float
    flags: List[str]
    fired_rules: List[FiredRule]
    first_response_actions: List[Dict[str, Any]]
    ttt_minutes: int
    catalog_version: str

    def as_dict(self) -> Dict[str, Any]:
        return {
            "level": self.level,
            "score": self.score,
            "flags": list(self.flags),
            "firedRules": [
                {
                    "id": r.id,
                    "vertical": r.vertical,
                    "label": r.label_en,
                    "escalates_to": r.escalates_to,
                    "ttt_minutes": r.ttt_minutes,
                    "rationale": r.rationale,
                    "source": r.source,
                    "first_response_actions": r.first_response_actions,
                    "referral_text_templates": r.referral_text_templates,
                }
                for r in self.fired_rules
            ],
            "firstResponseActions": list(self.first_response_actions),
            "ttt_minutes": self.ttt_minutes,
            "catalogVersion": self.catalog_version,
        }


# ─── catalog loading ────────────────────────────────────────────────────────


@lru_cache(maxsize=1)
def _load_manifest() -> Dict[str, Any]:
    path = _CATALOG_DIR / "manifest.json"
    if not path.exists():
        log.warning("Protocol manifest missing at %s; rule pack unavailable.", path)
        return {"version": "0.0.0", "verticals": []}
    with path.open(encoding="utf-8") as fp:
        return json.load(fp)


@lru_cache(maxsize=1)
def _load_ttt_defaults() -> Dict[str, Any]:
    path = _CATALOG_DIR / "ttt.v1.json"
    if not path.exists():
        return {"defaults": {"CRITICAL": 30, "HIGH": 240, "MODERATE": 1440, "LOW": 10080}}
    with path.open(encoding="utf-8") as fp:
        return json.load(fp)


@lru_cache(maxsize=1)
def _load_rules() -> List[Dict[str, Any]]:
    """Load every <vertical>.v1.json under the catalog directory.

    Rules from each file are concatenated. Files are optional; absent files
    simply contribute no rules. This means the engine ships safely with a
    partial catalog while we author new verticals.
    """
    manifest = _load_manifest()
    rules: List[Dict[str, Any]] = []
    for vertical_id in manifest.get("verticals", []):
        path = _CATALOG_DIR / f"{vertical_id}.v1.json"
        if not path.exists():
            continue
        try:
            with path.open(encoding="utf-8") as fp:
                payload = json.load(fp)
        except Exception as exc:
            log.warning("Failed to load %s: %s", path, exc)
            continue
        for rule in payload.get("rules", []):
            rules.append(rule)
    return rules


def reload_catalog() -> None:
    """Force a re-read of all catalog files. Useful for tests / hot-reload."""
    _load_manifest.cache_clear()
    _load_ttt_defaults.cache_clear()
    _load_rules.cache_clear()


# ─── trigger evaluation ─────────────────────────────────────────────────────


def _vital(visit: VisitInput, name: str) -> Optional[float]:
    value = visit.vitals.get(name)
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _has_symptom_substring(symptoms: List[str], needle: str) -> bool:
    needle_l = needle.lower()
    for sym in symptoms:
        if needle_l in (sym or "").lower():
            return True
    return False


def _eval_atom(clause: Dict[str, Any], visit: VisitInput) -> bool:
    """Evaluate a single atomic clause. Unknown keys are treated as ``False``."""
    for key, expected in clause.items():
        if key == "patient.isPregnant":
            if bool(visit.patient.isPregnant) != bool(expected):
                return False
        elif key == "patient.isPostpartum":
            if bool(visit.patient.isPostpartum) != bool(expected):
                return False
        elif key == "patient.ageYears_gte":
            if visit.patient.ageYears is None or visit.patient.ageYears < expected:
                return False
        elif key == "patient.ageYears_lte":
            if visit.patient.ageYears is None or visit.patient.ageYears > expected:
                return False
        elif key == "patient.ageMonths_lt":
            if visit.patient.ageMonths is None or not visit.patient.ageMonths < expected:
                return False
        elif key == "patient.ageMonths_lte":
            if visit.patient.ageMonths is None or visit.patient.ageMonths > expected:
                return False
        elif key == "patient.daysPostpartum_lte":
            if visit.patient.daysPostpartum is None or visit.patient.daysPostpartum > expected:
                return False
        elif key == "patient.gestationalWeeks_gte":
            if visit.patient.gestationalWeeks is None or visit.patient.gestationalWeeks < expected:
                return False
        elif key == "patient.gestationalWeeks_lt":
            if visit.patient.gestationalWeeks is None or not visit.patient.gestationalWeeks < expected:
                return False
        elif key.startswith("vitals."):
            tail = key[len("vitals."):]
            for suffix, op in (
                ("_gte", lambda a, b: a >= b),
                ("_lte", lambda a, b: a <= b),
                ("_gt", lambda a, b: a > b),
                ("_lt", lambda a, b: a < b),
            ):
                if tail.endswith(suffix):
                    name = tail[: -len(suffix)]
                    actual = _vital(visit, name)
                    if actual is None or not op(actual, expected):
                        return False
                    break
            else:
                if tail == "present" or tail.endswith("_present"):
                    name = tail[:-len("_present")] if tail.endswith("_present") else None
                    actual = _vital(visit, name) if name else None
                    if (actual is None) == bool(expected):
                        return False
                else:
                    return False
        elif key == "any_symptom_in":
            if not isinstance(expected, list):
                return False
            if not any(_has_symptom_substring(visit.symptoms, n) for n in expected):
                return False
        elif key == "all_symptoms_in":
            if not isinstance(expected, list):
                return False
            if not all(_has_symptom_substring(visit.symptoms, n) for n in expected):
                return False
        elif key == "mechanism_in":
            if not isinstance(expected, list):
                return False
            mech_l = [m.lower() for m in visit.mechanisms]
            if not any(any(needle.lower() in m for m in mech_l) for needle in expected):
                return False
        elif key == "visitType":
            if (visit.visitType or "") != expected:
                return False
        elif key == "velocity_warning_in":
            if not isinstance(expected, list):
                return False
            if not any(
                any(needle.lower() in (warning or "").lower() for warning in visit.velocity_warnings)
                for needle in expected
            ):
                return False
        else:
            # Unknown atomic predicate — fail closed.
            return False
    return True


def _eval_trigger(node: Dict[str, Any], visit: VisitInput) -> bool:
    if "all_of" in node:
        return all(_eval_trigger(child, visit) for child in node["all_of"])
    if "any_of" in node:
        return any(_eval_trigger(child, visit) for child in node["any_of"])
    if "not" in node:
        return not _eval_trigger(node["not"], visit)
    return _eval_atom(node, visit)


def _applies_to(rule: Dict[str, Any], visit: VisitInput) -> bool:
    scope = rule.get("applies_to") or {}
    if not scope:
        return True
    if "isPregnant" in scope and bool(visit.patient.isPregnant) != bool(scope["isPregnant"]):
        return False
    if "isPostpartum" in scope and bool(visit.patient.isPostpartum) != bool(scope["isPostpartum"]):
        return False
    if "ageMonthsMax" in scope and (
        visit.patient.ageMonths is None or visit.patient.ageMonths > scope["ageMonthsMax"]
    ):
        return False
    if "ageMonthsMin" in scope and (
        visit.patient.ageMonths is None or visit.patient.ageMonths < scope["ageMonthsMin"]
    ):
        return False
    if "ageYearsMax" in scope and (
        visit.patient.ageYears is None or visit.patient.ageYears > scope["ageYearsMax"]
    ):
        return False
    if "ageYearsMin" in scope and (
        visit.patient.ageYears is None or visit.patient.ageYears < scope["ageYearsMin"]
    ):
        return False
    if "daysPostpartumMax" in scope and (
        visit.patient.daysPostpartum is None
        or visit.patient.daysPostpartum > scope["daysPostpartumMax"]
    ):
        return False
    if "gestationalWeeksMin" in scope and (
        visit.patient.gestationalWeeks is None
        or visit.patient.gestationalWeeks < scope["gestationalWeeksMin"]
    ):
        return False
    if "gestationalWeeksMax" in scope and (
        visit.patient.gestationalWeeks is None
        or visit.patient.gestationalWeeks > scope["gestationalWeeksMax"]
    ):
        return False
    return True


# ─── public API ─────────────────────────────────────────────────────────────


def evaluate(visit: VisitInput) -> ProtocolResult:
    """Run every rule in the catalog against the visit input.

    The result's ``level`` is the strongest band any fired rule reached. If no
    rules fire, ``level`` is ``"LOW"`` and ``ttt_minutes`` is taken from
    ``ttt.v1.json``'s default for LOW (i.e. one week). The ``flags`` list
    preserves authoring order for stable rendering on the worker UI.
    """
    rules = _load_rules()
    fired: List[FiredRule] = []
    flags: List[str] = []
    actions: List[Dict[str, Any]] = []
    seen_action_ids: set = set()
    max_level_idx = 0
    min_ttt: Optional[int] = None

    for rule in rules:
        if not _applies_to(rule, visit):
            continue
        trigger = rule.get("trigger") or {}
        if not _eval_trigger(trigger, visit):
            continue

        level = rule.get("escalates_to", "LOW")
        idx = LEVEL_INDEX.get(level, 0)
        if idx > max_level_idx:
            max_level_idx = idx

        ttt = rule.get("ttt_minutes")
        if isinstance(ttt, int) and (min_ttt is None or ttt < min_ttt):
            min_ttt = ttt

        actions_for_rule = rule.get("first_response_actions") or []
        for action in actions_for_rule:
            aid = action.get("id")
            if aid and aid in seen_action_ids:
                continue
            if aid:
                seen_action_ids.add(aid)
            actions.append(action)

        fired.append(
            FiredRule(
                id=rule["id"],
                vertical=rule.get("vertical", ""),
                label_en=(rule.get("label") or {}).get("en", rule["id"]),
                escalates_to=level,
                ttt_minutes=int(ttt) if isinstance(ttt, int) else _default_ttt(level),
                rationale=rule.get("rationale", ""),
                source=rule.get("source", {}),
                first_response_actions=actions_for_rule,
                referral_text_templates=rule.get("referral_text_templates", {}),
            )
        )
        flags.append(rule["id"])

    # Apply velocity-warning bump: any RAPID_* warning bumps level by one band.
    rapid_warning = any(
        "rapid" in (w or "").lower() for w in visit.velocity_warnings
    )
    if rapid_warning and max_level_idx < len(LEVEL_ORDER) - 1:
        max_level_idx += 1
        flags.append("VELOCITY.RAPID_TREND_BUMP")

    level_str = LEVEL_ORDER[max_level_idx]
    ttt = min_ttt if min_ttt is not None else _default_ttt(level_str)

    manifest = _load_manifest()
    return ProtocolResult(
        level=level_str,
        score=LEVEL_SCORE[level_str],
        flags=flags,
        fired_rules=fired,
        first_response_actions=actions,
        ttt_minutes=ttt,
        catalog_version=str(manifest.get("version", "0.0.0")),
    )


def _default_ttt(level: str) -> int:
    return int(_load_ttt_defaults().get("defaults", {}).get(level, 1440))


# ─── adapter for legacy `risk_engine.score_risk` callsites ─────────────────


def score_risk_via_protocol(
    *,
    vitals: Dict[str, Any],
    symptoms: List[str],
    patient_profile: Dict[str, Any],
    velocity_warnings: List[str],
    visit_type: Optional[str] = None,
    mechanisms: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Backwards-compatible wrapper that returns the legacy {level, score, flags}
    shape while running the new protocol engine under the hood.
    """
    visit = VisitInput(
        patient=PatientContext(
            isPregnant=patient_profile.get("isPregnant"),
            gestationalWeeks=patient_profile.get("gestationalWeekIfPregnant")
            or patient_profile.get("gestationalWeeks"),
            isPostpartum=patient_profile.get("isPostpartum"),
            daysPostpartum=patient_profile.get("daysPostpartum"),
            ageYears=patient_profile.get("ageYears"),
            ageMonths=patient_profile.get("ageMonths"),
            sex=patient_profile.get("sex"),
        ),
        vitals=dict(vitals or {}),
        symptoms=list(symptoms or []),
        mechanisms=list(mechanisms or []),
        visitType=visit_type,
        velocity_warnings=list(velocity_warnings or []),
    )
    result = evaluate(visit)
    return {
        "level": result.level,
        "score": result.score,
        "flags": result.flags,
        "fired_rules": [
            {
                "id": r.id,
                "vertical": r.vertical,
                "label": r.label_en,
                "escalates_to": r.escalates_to,
                "rationale": r.rationale,
                "source": r.source,
                "ttt_minutes": r.ttt_minutes,
                # Carry the full referral packet so downstream renderers can
                # assemble notes without re-reading the JSON catalog.
                "referral_text_templates": r.referral_text_templates,
                "first_response_actions": r.first_response_actions,
            }
            for r in result.fired_rules
        ],
        "first_response_actions": result.first_response_actions,
        "ttt_minutes": result.ttt_minutes,
        "catalog_version": result.catalog_version,
    }


# ─── catalog lookup helpers ─────────────────────────────────────────────────


def get_rule_by_id(rule_id: str) -> Optional[Dict[str, Any]]:
    """Return the raw JSON rule definition for ``rule_id`` or ``None``.

    Used by the protocols router and the dashboard to render rule citations
    (rationale, source document, applicable population) without re-parsing
    the catalog files.
    """
    if not rule_id:
        return None
    for rule in _load_rules():
        if rule.get("id") == rule_id:
            return rule
    return None
