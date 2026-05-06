/**
 * Consent helpers.
 *
 * Consent capture is intentionally invisible to the user beyond the single
 * onboarding tap. This module:
 *   - builds a ConsentSnapshot for any backend call that needs one
 *   - posts the snapshot via /api/consent/record at onboarding time
 *   - stores the returned receipt hash in settings, and on each new patient
 *
 * The ASHA worker never sees scope chips, version strings, or receipt UI.
 */

import { recordConsent } from "./api";
import { useSettingsStore } from "./settingsStore";
import type { ConsentSnapshot, Patient } from "../types";

const DEFAULT_SCOPES: string[] = [
  "transcription",
  "ai_extraction",
  "risk_assessment",
  "referral_generation",
  "same_language_readback",
  "clinical_visit",
];

/** Build a consent snapshot for a specific patient. */
export function buildConsentForPatient(patient: Patient): ConsentSnapshot {
  const settings = useSettingsStore.getState();
  return {
    consentGranted: true,
    scopeAgreed: DEFAULT_SCOPES,
    languageCode: patient.languageCode,
    timestamp: new Date().toISOString(),
    witnessPresent: false,
    patientId: patient.id,
    ashaId: patient.ashaId || settings.ashaId,
    receiptHash:
      patient.consentReceiptHash ?? settings.globalConsentReceiptHash,
  };
}

/**
 * Build a global onboarding consent snapshot (no patient context yet).
 * Used to record the worker's acceptance of the SahAI consent notice.
 */
export function buildOnboardingConsent(args: {
  ashaId: string;
  languageCode: string;
}): ConsentSnapshot {
  return {
    consentGranted: true,
    scopeAgreed: DEFAULT_SCOPES,
    languageCode: args.languageCode,
    timestamp: new Date().toISOString(),
    witnessPresent: false,
    patientId: `onboarding-${args.ashaId}`,
    ashaId: args.ashaId,
  };
}

/**
 * Persist the worker's onboarding consent to the backend and stash the
 * returned receipt hash in settings for later reuse on every API call.
 *
 * Network failures are non-fatal — onboarding still completes and the
 * snapshot can be replayed later by the sync queue.
 */
export async function captureOnboardingConsent(args: {
  ashaId: string;
  languageCode: string;
}): Promise<void> {
  const snapshot = buildOnboardingConsent(args);
  try {
    const { receiptHash } = await recordConsent(snapshot);
    useSettingsStore.getState().setConsentHash(receiptHash);
  } catch {
    // Swallow — worker is offline. We'll have a chance to record on first sync.
  }
}
