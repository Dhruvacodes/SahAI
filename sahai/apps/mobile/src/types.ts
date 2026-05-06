/**
 * Shared types for the SahAI mobile app.
 * Keep aligned with backend Pydantic schemas.
 */

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export type VisitType =
  | "ANC"
  | "PNC"
  | "SICK_CHILD"
  | "TB_FOLLOWUP"
  | "MALARIA_SCREENING"
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
}

export interface PatientProfile {
  isPregnant: boolean;
  gestationalWeekIfPregnant?: number;
  isPostpartum?: boolean;
  daysPostpartum?: number;
  ageYears?: number;
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
  name: string;
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
