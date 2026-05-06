/**
 * Shared types for the SahAI mobile app.
 * Keep aligned with backend Pydantic schemas.
 */

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export type VisitType =
  | "ANC"
  | "PNC"
  | "SICK_CHILD"
  | "NEONATAL"
  | "TB_FOLLOWUP"
  | "MALARIA_SCREENING"
  | "EMERGENCY"
  | "TRAUMA"
  | "MENTAL_HEALTH"
  | "NCD_SCREEN"
  | "OTHER";

export type LanguageCode =
  | "hi"
  | "en"
  | "bn"
  | "ta"
  | "te"
  | "mr"
  | "gu"
  | "kn"
  | "ml"
  | "pa"
  | "or"
  | "ur"
  | "as"
  | "kok"
  | "mai"
  | "ne"
  | "sa"
  | "sat"
  | "sd"
  | "ks"
  | "doi"
  | "brx"
  | "mni";

export interface ConsentSnapshot {
  consentGranted: boolean;
  scopeAgreed: string[];
  languageCode: string;
  timestamp: string;
  witnessPresent: boolean;
  patientId: string;
  ashaId: string;
  receiptHash?: string;
}

export interface Vitals {
  systolicBP?: number | null;
  diastolicBP?: number | null;
  heartRate?: number | null;
  spO2?: number | null;
  temperature?: number | null;
  weight?: number | null;
  haemoglobin?: number | null;
  muacMm?: number | null;
  respiratoryRate?: number | null;

  // Trauma / emergency-only fields. All optional and only used by trauma rules.
  /** Glasgow Coma Scale total (3..15). */
  gcs?: number | null;
  /** Estimated external blood loss in millilitres. */
  bloodLossMl?: number | null;
  /** Numeric pain rating 0..10. */
  painScore?: number | null;
  /** Free-text mechanism of injury (also see Visit.mechanisms array). */
  injuryMechanism?: string | null;
  /** "open" / "closed" / "burn" / "abrasion" / "puncture" / null. */
  wound?: string | null;
  /** Boolean: is the patient maintaining a clear airway? */
  airwayClear?: boolean | null;

  // Paediatric / obstetric profile-derived helpers (passed through to engine).
  ageMonths?: number | null;
  gestationalDays?: number | null;
}

export interface PatientProfile {
  isPregnant: boolean;
  gestationalWeekIfPregnant?: number;
  isPostpartum?: boolean;
  daysPostpartum?: number;
  ageYears?: number;
}

export interface FiredRuleSummary {
  id: string;
  vertical?: string;
  label?: string;
  rationale?: string;
  source?: { doc?: string; section?: string; url?: string };
  ttt_minutes?: number;
}

export interface ExtractResponse {
  visitType: VisitType;
  vitals: Vitals;
  symptoms: string[];
  chiefComplaint: string;
  patientInstruction: string;
  riskLevel: RiskLevel;
  riskScore: number;
  riskFlags: string[];
  velocityWarnings: string[];
  trendContext: string;
  dataQuality: {
    confidence: number;
    suspectedInjection: boolean;
    missingFields: string[];
  };
  /** Rules from the protocol engine that fired for this visit (may be empty). */
  firedRules?: FiredRuleSummary[];
  /** Ordered first-response checklist derived from the fired rules. */
  firstResponseActions?: Array<{ id: string; text: { en: string; [k: string]: string | undefined } }>;
  /** Protocol pack version that produced firedRules. */
  catalogVersion?: string;
  /** Time-to-treatment in minutes (minimum across fired rules). */
  ttt_minutes?: number;
}

export interface ReferralResponse {
  referralText: string;
  patientInstruction: string;
  urgency: "EMERGENCY" | "URGENT" | "ELEVATED" | "ROUTINE";
  facility: string | null;
  facilityType: "PHC" | "CHC" | "DH" | "IMCI_HOSPITAL" | null;
  followUpPlan: { nextVisitDays: number; monitorFor: string[] };
  firstResponseActions?: string[];
  generatedAt?: string;
}

/**
 * Local Patient record. Mirrors the backend PatientORM but lives on-device first.
 */
export interface Patient {
  id: string;
  ashaId: string;
  /** Native-script name (Devanagari, Bangla, etc., or Latin if spoken in English). */
  name: string;
  /** Roman/Latin transliteration. Rendered when UI language is English. */
  nameLatin?: string;
  ageYears?: number;
  sex?: "F" | "M" | "O";
  isPregnant: boolean;
  gestationalWeeks?: number;
  isPostpartum?: boolean;
  daysPostpartum?: number;
  village?: string;
  phone?: string;
  languageCode: LanguageCode;
  consentReceiptHash?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Local Visit record stored on-device. Becomes the payload for /api/sync/visit.
 */
export interface Visit {
  id: string;
  patientId: string;
  ashaId: string;
  visitDate: string;
  rawTranscriptText: string;
  extraction: ExtractResponse;
  referral?: ReferralResponse;
  consent: ConsentSnapshot;
  languageCode: LanguageCode;
  syncedToCloud: boolean;
  createdAt: string;
}
