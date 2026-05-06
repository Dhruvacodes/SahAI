"""Manifest signoff sanity checks.

These tests guard the reviewer/signoff metadata that ships with the protocol
catalog. They run on every commit so regressions like "vertical added but no
rules", "rule cites a doc that isn't in the manifest", or "manifest review is
stale" are caught immediately.

The hard production gate (must have an external clinical reviewer, must be
reviewed within the last 365 days) lives in
``scripts/check_protocol_signoff.py`` and is invoked from CI before deploy —
this avoids blocking active development on dev machines.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from app.services.protocol_engine import _CATALOG_DIR, _load_manifest, _load_rules


def test_manifest_has_version_and_reviewers():
    manifest = _load_manifest()
    assert manifest.get("version"), "manifest.version must be set"
    assert isinstance(manifest.get("reviewers"), list) and manifest["reviewers"], (
        "manifest.reviewers must be a non-empty list"
    )
    for reviewer in manifest["reviewers"]:
        assert reviewer.get("name"), "every reviewer needs a name"
        assert reviewer.get("role"), "every reviewer needs a role"


def test_manifest_review_date_parses():
    manifest = _load_manifest()
    last_reviewed = manifest.get("lastReviewedAt")
    assert last_reviewed, "manifest.lastReviewedAt must be set"
    parsed = datetime.fromisoformat(last_reviewed.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    # The review date must be in the past (or today) — never the future.
    assert parsed <= datetime.now(timezone.utc), (
        f"manifest.lastReviewedAt is in the future: {last_reviewed}"
    )


def test_every_vertical_in_manifest_has_a_file():
    manifest = _load_manifest()
    for vertical in manifest.get("verticals", []):
        path = Path(_CATALOG_DIR) / f"{vertical}.v1.json"
        assert path.exists(), f"manifest lists vertical {vertical!r} but {path.name} is missing"


def test_every_rule_cites_a_known_source():
    """Every rule's ``source.doc`` must reference a manifest source id."""
    manifest = _load_manifest()
    known = {s["id"] for s in manifest.get("sources", []) if s.get("id")}
    bad = []
    for rule in _load_rules():
        source = rule.get("source") or {}
        doc = source.get("doc")
        if doc and doc not in known:
            bad.append((rule.get("id"), doc))
    assert not bad, f"rules reference unknown source docs: {bad}"


def test_every_rule_has_required_fields():
    for rule in _load_rules():
        rid = rule.get("id")
        assert rid and isinstance(rid, str), f"rule missing id: {rule}"
        assert rule.get("trigger"), f"rule {rid} has no trigger expression"
        assert rule.get("escalates_to") in {"LOW", "MODERATE", "HIGH", "CRITICAL"}, (
            f"rule {rid} escalates_to is missing or invalid"
        )
        assert rule.get("rationale"), f"rule {rid} must include a rationale"
        label = rule.get("label") or {}
        assert label.get("en"), f"rule {rid} must have an English label"


def test_rule_ids_are_unique():
    seen = {}
    for rule in _load_rules():
        rid = rule.get("id")
        assert rid not in seen, f"duplicate rule id: {rid}"
        seen[rid] = True


def test_referral_templates_have_at_least_english():
    """Patient-facing template + ASHA-to-PHC template must each have English."""
    missing = []
    for rule in _load_rules():
        templates = rule.get("referral_text_templates")
        if not templates:
            # Some lightweight rules (e.g. monitoring-only) intentionally
            # delegate templates to defaults — that's allowed.
            continue
        for key in ("patient_instruction", "asha_to_phc"):
            block = templates.get(key)
            if block is not None and not (block.get("en") or "").strip():
                missing.append((rule.get("id"), key))
    assert not missing, f"referral templates missing English text: {missing}"
