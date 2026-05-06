/**
 * SahAI backend HTTP client.
 *
 * Resolution order for the base URL:
 *   1. settingsStore.backendUrl (worker-supplied override in Settings)
 *   2. process.env.EXPO_PUBLIC_API_URL (compile-time / .env)
 *   3. globalThis.EXPO_PUBLIC_API_URL (legacy)
 *   4. DEFAULT_BASE_URL (LAN dev fallback)
 */

import type {
  ConsentSnapshot,
  ExtractResponse,
  Patient,
  PatientProfile,
  ReferralResponse,
  Visit,
  VisitType,
} from "../types";
import { useSettingsStore } from "./settingsStore";

const DEFAULT_BASE_URL = "http://192.168.1.10:8000";

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, ""); // strip trailing slashes
}

function resolveBaseUrl(): string {
  const override = useSettingsStore.getState().backendUrl;
  if (override && override.trim().length > 0) return normalizeUrl(override);
  const env = (globalThis as any).process?.env?.EXPO_PUBLIC_API_URL as
    | string
    | undefined;
  if (env && env.trim().length > 0) return normalizeUrl(env);
  const legacy = (globalThis as any).EXPO_PUBLIC_API_URL as string | undefined;
  if (legacy && legacy.trim().length > 0) return normalizeUrl(legacy);
  return DEFAULT_BASE_URL;
}

export function currentBaseUrl(): string {
  return resolveBaseUrl();
}

const REQUEST_TIMEOUT_MS = 90_000;

class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`HTTP ${status}: ${body.slice(0, 200)}`);
    this.status = status;
    this.body = body;
  }
}

async function fetchJson<T>(
  path: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${resolveBaseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new ApiError(response.status, body);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function recordConsent(
  payload: ConsentSnapshot,
): Promise<{ receiptHash: string }> {
  return fetchJson("/api/consent/record", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function transcribeAudio(
  audioUri: string,
  languageCode: string,
  consent: ConsentSnapshot,
): Promise<{ transcriptText: string; provider: string }> {
  // Use React Native's FormData with the standard file-object syntax.
  // Do NOT set Content-Type manually — fetch must auto-attach it with the boundary.
  const form = new FormData();
  form.append("audio_file", {
    uri: audioUri,
    name: "visit.wav",
    type: "audio/wav",
  } as any);
  form.append("language_code", languageCode);
  form.append("consent_json", JSON.stringify(consent));

  // Backend returns { transcriptText, transcript, language_code, duration_ms, provider }
  // We accept both field names for resilience against older backend versions.
  const raw = await fetchJson<{
    transcript?: string;
    transcriptText?: string;
    language_code?: string;
    duration_ms?: number;
    provider?: string;
  }>("/api/asr/transcribe", { method: "POST", body: form });

  const text = raw.transcriptText ?? raw.transcript ?? "";
  return { transcriptText: text, provider: raw.provider ?? "sarvam" };
}

export interface DemographicsExtraction {
  name: string | null;
  ageYears: number | null;
  village: string | null;
  phone: string | null;
  isPregnant: boolean | null;
  gestationalWeeks: number | null;
}

/**
 * LLM fallback used by NewPatientScreen *only* when the on-device regex parser
 * cannot recover a name. Cheap by design (~$0.0005 per call, Claude Haiku).
 */
export async function extractDemographics(
  transcriptText: string,
  languageCode: string,
): Promise<DemographicsExtraction> {
  return fetchJson("/api/extract/demographics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcriptText, languageCode }),
  });
}

export async function extractClinical(args: {
  transcriptText: string;
  languageCode: string;
  consent: ConsentSnapshot;
  patientProfile: PatientProfile;
  visitTypeHint?: VisitType;
}): Promise<ExtractResponse> {
  return fetchJson("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
}

export async function generateReferral(args: {
  extraction: ExtractResponse;
  ashaFacilityInfo?: { name?: string; phcName?: string; chcName?: string };
}): Promise<ReferralResponse> {
  return fetchJson("/api/referral/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
}

export async function syncVisit(visit: Visit): Promise<{ status: string; visitId: string }> {
  const payload = {
    id: visit.id,
    patientId: visit.patientId,
    ashaId: visit.ashaId,
    visitDate: visit.visitDate,
    rawTranscriptText: visit.rawTranscriptText,
    extractedVitals: {
      bloodPressureSystolic: visit.extraction.vitals.systolicBP ?? null,
      bloodPressureDiastolic: visit.extraction.vitals.diastolicBP ?? null,
      hemoglobinLevel: visit.extraction.vitals.haemoglobin ?? null,
      temperature: visit.extraction.vitals.temperature ?? null,
      fetalMovements: null,
      oedema: null,
    },
    symptoms: visit.extraction.symptoms,
    consent: visit.consent,
    languageCode: visit.languageCode,
    riskScore: Math.round((visit.extraction.riskScore ?? 0) * 100),
    riskLevel: visit.extraction.riskLevel,
    referralGenerated: !!visit.referral,
    followUpPlan: visit.referral?.referralText ?? "",
    syncedToCloud: true,
  };
  return fetchJson("/api/sync/visit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function upsertPatient(patient: Patient): Promise<Patient> {
  return fetchJson("/api/patient", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: patient.id,
      ashaId: patient.ashaId,
      name: patient.name,
      ageYears: patient.ageYears ?? null,
      sex: patient.sex ?? null,
      isPregnant: patient.isPregnant,
      gestationalWeeks: patient.gestationalWeeks ?? null,
      isPostpartum: patient.isPostpartum ?? false,
      daysPostpartum: patient.daysPostpartum ?? null,
      village: patient.village ?? null,
      phone: patient.phone ?? null,
      languageCode: patient.languageCode,
      consentReceiptHash: patient.consentReceiptHash ?? null,
    }),
  });
}

export async function listPatients(ashaId: string): Promise<Patient[]> {
  return fetchJson(
    `/api/patient?ashaId=${encodeURIComponent(ashaId)}`,
    { method: "GET" },
  );
}

export { ApiError };
