/**
 * Represents an ASHA worker assigned to field care in a local community.
 */
export interface ASHAWorker {
  /** Unique identifier for the ASHA worker. */
  id: string;
  /** Full display name of the ASHA worker. */
  name: string;
  /** Primary phone number used to contact the ASHA worker. */
  phone: string;
  /** District where the ASHA worker is assigned. */
  district: string;
  /** Administrative block where the ASHA worker operates. */
  block: string;
  /** Village served by the ASHA worker. */
  village: string;
  /** Preferred language code for app prompts and generated content. */
  languageCode: string;
}

/**
 * Represents a patient supported through ASHA-led field visits.
 */
export interface Patient {
  /** Unique identifier for the patient. */
  id: string;
  /** Full display name of the patient. */
  name: string;
  /** Patient age in completed years. */
  ageYears: number;
  /** Whether the patient is currently pregnant. */
  isPregnant: boolean;
  /** Current gestational week when pregnant, otherwise null. */
  gestationalWeekIfPregnant: number | null;
  /** Date of the patient's most recent recorded visit. */
  lastVisitDate: string;
  /** Identifier of the ASHA worker assigned to this patient. */
  assignedASHAId: string;
  /** Village where the patient resides. */
  village: string;
}

/**
 * Structured vital signs and observations extracted from a visit transcript.
 */
export interface ExtractedVitals {
  /** Systolic blood pressure reading in mmHg, or null when unavailable. */
  bloodPressureSystolic: number | null;
  /** Diastolic blood pressure reading in mmHg, or null when unavailable. */
  bloodPressureDiastolic: number | null;
  /** Hemoglobin level reading, or null when unavailable. */
  hemoglobinLevel: number | null;
  /** Whether fetal movements were reported, or null when not applicable or unknown. */
  fetalMovements: boolean | null;
  /** Whether oedema was observed or reported, or null when unknown. */
  oedema: boolean | null;
  /** Body temperature reading, or null when unavailable. */
  temperature: number | null;
}

/**
 * Patient consent captured before privacy-sensitive processing.
 */
export interface ConsentSnapshot {
  /** Whether the patient explicitly granted consent for the current workflow. */
  consentGiven: boolean;
  /** Whether the privacy notice was explained and accepted. */
  privacyNoticeAccepted: boolean;
  /** Consent text/version used when consent was captured. */
  consentVersion: string;
  /** Language used to explain consent and read back patient guidance. */
  languageCode: string;
  /** Data-use scopes approved by the patient. */
  dataUseScopes: string[];
  /** Timestamp when consent was recorded, if available. */
  recordedAt?: string;
  /** Optional patient-entered or ASHA-confirmed acknowledgement name. */
  patientSignatureName?: string;
}

/**
 * Represents a documented field visit and its clinical decision-support output.
 */
export interface VisitRecord {
  /** Unique identifier for the visit record. */
  id: string;
  /** Identifier of the patient visited. */
  patientId: string;
  /** Identifier of the ASHA worker who conducted the visit. */
  ashaId: string;
  /** Date when the field visit took place. */
  visitDate: string;
  /** Original transcript text captured during or after the visit. */
  rawTranscriptText: string;
  /** Vitals and observations extracted from the transcript. */
  extractedVitals: ExtractedVitals;
  /** List of symptoms identified during the visit. */
  symptoms: string[];
  /** Numeric risk score for the visit, ranging from 0 to 100. */
  riskScore: number;
  /** Risk category assigned from the visit assessment. */
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** Whether a referral note was generated for this visit. */
  referralGenerated: boolean;
  /** Recommended follow-up plan for the patient. */
  followUpPlan: string;
  /** Whether this visit record has been synced to cloud storage. */
  syncedToCloud: boolean;
  /** Consent snapshot attached to this visit record. */
  consent: ConsentSnapshot;
  /** Visit language used for same-language output. */
  languageCode: string;
}

/**
 * Represents a generated referral note linked to a visit.
 */
export interface ReferralNote {
  /** Unique identifier for the referral note. */
  id: string;
  /** Identifier of the visit that produced the referral note. */
  visitId: string;
  /** Identifier of the patient receiving the referral. */
  patientId: string;
  /** Identifier of the ASHA worker associated with the referral. */
  ashaId: string;
  /** Generated referral text intended for the receiving care team. */
  generatedText: string;
  /** Urgency level assigned to the referral. */
  urgency: "ROUTINE" | "URGENT" | "EMERGENCY";
  /** Timestamp when the referral note was created. */
  createdAt: string;
}

/**
 * Represents batched visit data prepared for cloud synchronization.
 */
export interface SyncPayload {
  /** Visit records included in the sync request. */
  visits: VisitRecord[];
  /** Timestamp when the sync payload was created. */
  timestamp: string;
  /** Identifier of the device sending the sync payload. */
  deviceId: string;
  /** Identifier of the ASHA worker sending the sync payload. */
  ashaId: string;
}

