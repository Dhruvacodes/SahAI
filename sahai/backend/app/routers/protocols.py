"""Read-only API for the protocol catalog.

Used by the supervisor dashboard and the mobile "Why this band?" panel to
render rule citations without re-bundling the JSON. Endpoints:

  GET /api/protocols/v1/manifest          → catalog metadata + reviewer list
  GET /api/protocols/v1/rules             → all rules
  GET /api/protocols/v1/rule/{rule_id}    → single rule (404 if not found)
"""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

from app.services import protocol_engine

router = APIRouter(prefix="/protocols/v1", tags=["protocols"])


@router.get("/manifest")
def get_manifest() -> Dict[str, Any]:
    return protocol_engine._load_manifest()  # noqa: SLF001 — read-only access


@router.get("/rules")
def list_rules() -> Dict[str, Any]:
    rules: List[Dict[str, Any]] = protocol_engine._load_rules()  # noqa: SLF001
    manifest = protocol_engine._load_manifest()  # noqa: SLF001
    return {
        "version": manifest.get("version", "0.0.0"),
        "count": len(rules),
        "rules": rules,
    }


@router.get("/rule/{rule_id}")
def get_rule(rule_id: str) -> Dict[str, Any]:
    rule = protocol_engine.get_rule_by_id(rule_id)
    if rule is None:
        raise HTTPException(status_code=404, detail=f"Rule {rule_id!r} not found")
    manifest = protocol_engine._load_manifest()  # noqa: SLF001
    # Resolve the source.doc reference into the manifest entry so the
    # mobile app can render the full citation in one round-trip.
    source = rule.get("source", {})
    source_doc_id = source.get("doc")
    doc_entry = next(
        (s for s in manifest.get("sources", []) if s.get("id") == source_doc_id),
        None,
    )
    return {**rule, "sourceDoc": doc_entry}
