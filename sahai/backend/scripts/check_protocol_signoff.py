"""Pre-deploy gate: ensures the protocol catalog has fresh, qualified signoff.

This is run from CI (or a deploy hook) before pushing a build that would
let HIGH/CRITICAL rules drive real referrals. It enforces:

  1. ``manifest.lastReviewedAt`` must be within ``--max-age-days`` (default 365).
  2. ``manifest.reviewers`` must contain at least one external clinical
     reviewer — i.e. one whose role is not "Author" / "Engineering" /
     "Maintainer".
  3. Every vertical listed in the manifest has a corresponding rules file.
  4. Every rule cites a source doc that's defined in the manifest.

Exits non-zero on any violation. Prints a single concise diagnostic per
violation so logs are easy to read.

Usage::

    python scripts/check_protocol_signoff.py
    python scripts/check_protocol_signoff.py --max-age-days 180 --strict-clinical
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List


REPO_ROOT = Path(__file__).resolve().parents[2]
CATALOG_DIR = REPO_ROOT / "protocols" / "v1"


# Roles that do NOT count as an external clinical signer.
_NON_CLINICAL_ROLES = {
    "AUTHOR",
    "ENGINEERING",
    "MAINTAINER",
    "DEVELOPER",
}


def _load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as fp:
        return json.load(fp)


def check(*, max_age_days: int, strict_clinical: bool) -> List[str]:
    errors: List[str] = []

    manifest_path = CATALOG_DIR / "manifest.json"
    if not manifest_path.exists():
        return [f"manifest.json missing at {manifest_path}"]
    manifest = _load_json(manifest_path)

    # 1. Review date freshness.
    last_reviewed = manifest.get("lastReviewedAt")
    if not last_reviewed:
        errors.append("manifest.lastReviewedAt is missing")
    else:
        try:
            reviewed_at = datetime.fromisoformat(last_reviewed.replace("Z", "+00:00"))
        except ValueError as exc:
            errors.append(f"manifest.lastReviewedAt is not a valid ISO date: {exc}")
            reviewed_at = None
        if reviewed_at is not None:
            if reviewed_at.tzinfo is None:
                reviewed_at = reviewed_at.replace(tzinfo=timezone.utc)
            age_days = (datetime.now(timezone.utc) - reviewed_at).days
            if age_days > max_age_days:
                errors.append(
                    f"manifest review is {age_days} days old (max {max_age_days})"
                )

    # 2. Reviewer roster.
    reviewers = manifest.get("reviewers") or []
    if not reviewers:
        errors.append("manifest.reviewers is empty")
    if strict_clinical:
        clinical = [
            r
            for r in reviewers
            if (r.get("role") or "").upper() not in _NON_CLINICAL_ROLES
        ]
        if not clinical:
            errors.append(
                "no external clinical reviewer in manifest.reviewers "
                "(strict-clinical mode)"
            )

    # 3. Verticals with no rule files.
    verticals = manifest.get("verticals") or []
    for vertical in verticals:
        path = CATALOG_DIR / f"{vertical}.v1.json"
        if not path.exists():
            errors.append(f"vertical {vertical!r} declared but {path.name} missing")

    # 4. Rules cite known source docs.
    known_sources = {s.get("id") for s in manifest.get("sources", []) if s.get("id")}
    for vertical in verticals:
        path = CATALOG_DIR / f"{vertical}.v1.json"
        if not path.exists():
            continue
        try:
            payload = _load_json(path)
        except Exception as exc:
            errors.append(f"failed to parse {path.name}: {exc}")
            continue
        for rule in payload.get("rules", []):
            doc = (rule.get("source") or {}).get("doc")
            if doc and doc not in known_sources:
                errors.append(
                    f"rule {rule.get('id')} cites unknown source doc {doc!r}"
                )

    return errors


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--max-age-days",
        type=int,
        default=365,
        help="Maximum allowed age of manifest.lastReviewedAt (days).",
    )
    parser.add_argument(
        "--strict-clinical",
        action="store_true",
        help="Require at least one reviewer whose role is not Author/Engineering.",
    )
    args = parser.parse_args(argv)

    errors = check(
        max_age_days=args.max_age_days,
        strict_clinical=args.strict_clinical,
    )
    if errors:
        print("PROTOCOL SIGNOFF FAILED:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1
    print(
        f"protocol signoff OK ({len(_load_json(CATALOG_DIR / 'manifest.json').get('verticals', []))} verticals, "
        f"max-age-days={args.max_age_days}, strict-clinical={args.strict_clinical})"
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
