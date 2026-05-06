/**
 * Mobile-side port of the SahAI protocol engine.
 *
 * Mirrors `backend/app/services/protocol_engine.py` (same semantics, same
 * atomic clauses) so on-device triage and server-side authoritative
 * evaluation always agree. The catalog is bundled at build time via
 * `scripts/build-protocols.mjs` into `catalog.gen.ts`.
 *
 * Use this engine immediately after on-device parsing in RecordingScreen so
 * the worker sees an instant rule-based banner even before the network call
 * to /api/extract returns. When the backend response arrives, the server
 * result is authoritative and overrides this on-device result.
 */

import {
  PROTOCOL_MANIFEST,
  PROTOCOL_RULES,
  PROTOCOL_TTT,
  type ProtocolRule,
  type Severity,
  type TriggerExpr,
} from "./catalog.gen";

const LEVEL_ORDER: Severity[] = ["LOW", "MODERATE", "HIGH", "CRITICAL"];
const LEVEL_INDEX: Record<Severity, number> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  CRITICAL: 3,
};
const LEVEL_SCORE: Record<Severity, number> = {
  LOW: 0.10,
  MODERATE: 0.40,
  HIGH: 0.70,
  CRITICAL: 0.92,
};

export interface PatientContext {
  isPregnant?: boolean;
  gestationalWeeks?: number;
  isPostpartum?: boolean;
  daysPostpartum?: number;
  ageYears?: number;
  ageMonths?: number;
  sex?: string;
}

export interface VisitInput {
  patient: PatientContext;
  vitals: Record<string, number | boolean | string | null | undefined>;
  symptoms: string[];
  mechanisms?: string[];
  visitType?: string;
  velocityWarnings?: string[];
}

export interface FiredRule {
  id: string;
  vertical: string;
  label: string;
  escalates_to: Severity;
  ttt_minutes: number;
  rationale: string;
  source: { doc: string; section?: string; url?: string };
  first_response_actions: Array<{ id: string; text: { en: string } & Record<string, string | undefined> }>;
  referral_text_templates?: ProtocolRule["referral_text_templates"];
}

export interface ProtocolResult {
  level: Severity;
  score: number;
  flags: string[];
  firedRules: FiredRule[];
  firstResponseActions: Array<{ id: string; text: Record<string, string | undefined> }>;
  ttt_minutes: number;
  catalogVersion: string;
}

// ─── trigger evaluation ────────────────────────────────────────────────────

function vital(visit: VisitInput, name: string): number | undefined {
  const v = visit.vitals[name];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function hasSymptomSubstring(symptoms: string[], needle: string): boolean {
  const n = needle.toLowerCase();
  for (const s of symptoms) {
    if ((s ?? "").toLowerCase().includes(n)) return true;
  }
  return false;
}

function evalAtom(clause: Record<string, unknown>, visit: VisitInput): boolean {
  for (const [key, expected] of Object.entries(clause)) {
    if (key === "patient.isPregnant") {
      if (Boolean(visit.patient.isPregnant) !== Boolean(expected)) return false;
    } else if (key === "patient.isPostpartum") {
      if (Boolean(visit.patient.isPostpartum) !== Boolean(expected)) return false;
    } else if (key === "patient.ageYears_gte") {
      if (visit.patient.ageYears == null || visit.patient.ageYears < (expected as number)) return false;
    } else if (key === "patient.ageYears_lte") {
      if (visit.patient.ageYears == null || visit.patient.ageYears > (expected as number)) return false;
    } else if (key === "patient.ageMonths_lt") {
      if (visit.patient.ageMonths == null || !(visit.patient.ageMonths < (expected as number))) return false;
    } else if (key === "patient.ageMonths_lte") {
      if (visit.patient.ageMonths == null || visit.patient.ageMonths > (expected as number)) return false;
    } else if (key === "patient.daysPostpartum_lte") {
      if (visit.patient.daysPostpartum == null || visit.patient.daysPostpartum > (expected as number)) return false;
    } else if (key === "patient.gestationalWeeks_gte") {
      if (visit.patient.gestationalWeeks == null || visit.patient.gestationalWeeks < (expected as number)) return false;
    } else if (key === "patient.gestationalWeeks_lt") {
      if (visit.patient.gestationalWeeks == null || !(visit.patient.gestationalWeeks < (expected as number))) return false;
    } else if (key.startsWith("vitals.")) {
      const tail = key.slice("vitals.".length);
      const cmpMap: Array<[string, (a: number, b: number) => boolean]> = [
        ["_gte", (a, b) => a >= b],
        ["_lte", (a, b) => a <= b],
        ["_gt", (a, b) => a > b],
        ["_lt", (a, b) => a < b],
      ];
      let matched = false;
      for (const [suffix, op] of cmpMap) {
        if (tail.endsWith(suffix)) {
          const name = tail.slice(0, -suffix.length);
          const actual = vital(visit, name);
          if (actual == null || !op(actual, expected as number)) return false;
          matched = true;
          break;
        }
      }
      if (!matched) {
        // vitals.<name>: <expected boolean/value>  → equality check
        const actual = visit.vitals[tail];
        if (actual !== expected) return false;
      }
    } else if (key === "any_symptom_in") {
      if (!Array.isArray(expected)) return false;
      const matches = (expected as string[]).some((needle) => hasSymptomSubstring(visit.symptoms, needle));
      if (!matches) return false;
    } else if (key === "all_symptoms_in") {
      if (!Array.isArray(expected)) return false;
      const matches = (expected as string[]).every((needle) => hasSymptomSubstring(visit.symptoms, needle));
      if (!matches) return false;
    } else if (key === "mechanism_in") {
      if (!Array.isArray(expected)) return false;
      const mechs = (visit.mechanisms ?? []).map((m) => m.toLowerCase());
      const matches = (expected as string[]).some((needle) =>
        mechs.some((m) => m.includes(needle.toLowerCase())),
      );
      if (!matches) return false;
    } else if (key === "visitType") {
      if ((visit.visitType ?? "") !== expected) return false;
    } else if (key === "velocity_warning_in") {
      if (!Array.isArray(expected)) return false;
      const warnings = (visit.velocityWarnings ?? []).map((w) => w.toLowerCase());
      const matches = (expected as string[]).some((needle) =>
        warnings.some((w) => w.includes(needle.toLowerCase())),
      );
      if (!matches) return false;
    } else {
      return false;
    }
  }
  return true;
}

function evalTrigger(node: TriggerExpr, visit: VisitInput): boolean {
  if ("all_of" in node && Array.isArray((node as { all_of: TriggerExpr[] }).all_of)) {
    return (node as { all_of: TriggerExpr[] }).all_of.every((c) => evalTrigger(c, visit));
  }
  if ("any_of" in node && Array.isArray((node as { any_of: TriggerExpr[] }).any_of)) {
    return (node as { any_of: TriggerExpr[] }).any_of.some((c) => evalTrigger(c, visit));
  }
  if ("not" in node && (node as { not: TriggerExpr }).not) {
    return !evalTrigger((node as { not: TriggerExpr }).not, visit);
  }
  return evalAtom(node as Record<string, unknown>, visit);
}

function appliesTo(rule: ProtocolRule, visit: VisitInput): boolean {
  const scope = rule.applies_to;
  if (!scope) return true;
  const p = visit.patient;
  if ("isPregnant" in scope && Boolean(p.isPregnant) !== Boolean(scope.isPregnant)) return false;
  if ("isPostpartum" in scope && Boolean(p.isPostpartum) !== Boolean(scope.isPostpartum)) return false;
  if (scope.ageMonthsMax != null && (p.ageMonths == null || p.ageMonths > (scope.ageMonthsMax as number))) return false;
  if (scope.ageMonthsMin != null && (p.ageMonths == null || p.ageMonths < (scope.ageMonthsMin as number))) return false;
  if (scope.ageYearsMax != null && (p.ageYears == null || p.ageYears > (scope.ageYearsMax as number))) return false;
  if (scope.ageYearsMin != null && (p.ageYears == null || p.ageYears < (scope.ageYearsMin as number))) return false;
  if (scope.daysPostpartumMax != null && (p.daysPostpartum == null || p.daysPostpartum > (scope.daysPostpartumMax as number))) return false;
  if (scope.gestationalWeeksMin != null && (p.gestationalWeeks == null || p.gestationalWeeks < (scope.gestationalWeeksMin as number))) return false;
  if (scope.gestationalWeeksMax != null && (p.gestationalWeeks == null || p.gestationalWeeks > (scope.gestationalWeeksMax as number))) return false;
  return true;
}

function defaultTtt(level: Severity): number {
  const defaults = (PROTOCOL_TTT as { defaults: Record<Severity, number> }).defaults;
  return defaults?.[level] ?? 1440;
}

// ─── public API ────────────────────────────────────────────────────────────

export function evaluate(visit: VisitInput): ProtocolResult {
  const fired: FiredRule[] = [];
  const flags: string[] = [];
  const actions: Array<{ id: string; text: Record<string, string | undefined> }> = [];
  const seenAction = new Set<string>();
  let maxIdx = 0;
  let minTtt: number | undefined;

  for (const rule of PROTOCOL_RULES) {
    if (!appliesTo(rule, visit)) continue;
    if (!evalTrigger(rule.trigger, visit)) continue;

    const level = rule.escalates_to;
    const idx = LEVEL_INDEX[level] ?? 0;
    if (idx > maxIdx) maxIdx = idx;

    if (typeof rule.ttt_minutes === "number" && (minTtt == null || rule.ttt_minutes < minTtt)) {
      minTtt = rule.ttt_minutes;
    }

    for (const action of rule.first_response_actions ?? []) {
      if (action.id && seenAction.has(action.id)) continue;
      if (action.id) seenAction.add(action.id);
      actions.push(action);
    }

    fired.push({
      id: rule.id,
      vertical: rule.vertical,
      label: rule.label.en,
      escalates_to: level,
      ttt_minutes:
        typeof rule.ttt_minutes === "number" ? rule.ttt_minutes : defaultTtt(level),
      rationale: rule.rationale,
      source: rule.source,
      first_response_actions: rule.first_response_actions ?? [],
      referral_text_templates: rule.referral_text_templates,
    });
    flags.push(rule.id);
  }

  // Velocity bump (rapid trends bump severity by one band).
  const rapid = (visit.velocityWarnings ?? []).some((w) => (w || "").toLowerCase().includes("rapid"));
  if (rapid && maxIdx < LEVEL_ORDER.length - 1) {
    maxIdx += 1;
    flags.push("VELOCITY.RAPID_TREND_BUMP");
  }

  const level = LEVEL_ORDER[maxIdx];
  const ttt = minTtt ?? defaultTtt(level);

  return {
    level,
    score: LEVEL_SCORE[level],
    flags,
    firedRules: fired,
    firstResponseActions: actions,
    ttt_minutes: ttt,
    catalogVersion: String(
      (PROTOCOL_MANIFEST as { version?: string }).version ?? "0.0.0",
    ),
  };
}

export const CATALOG_VERSION = String(
  (PROTOCOL_MANIFEST as { version?: string }).version ?? "0.0.0",
);
