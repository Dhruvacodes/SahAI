import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import type {
  ASHAWorker,
  ExtractedVitals,
  Patient,
  VisitRecord
} from "../../../packages/shared-types";
import { saveVisit } from "../db/database";
import { syncPendingVisits } from "../services/syncService";
import VoiceInputScreen from "./VoiceInputScreen";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

type WorkflowStep =
  | "RECORD"
  | "EXTRACTING"
  | "RISK_REVIEW"
  | "REFERRAL_PREVIEW"
  | "DONE";

type RiskLevel = VisitRecord["riskLevel"];

type Urgency = "ROUTINE" | "URGENT" | "EMERGENCY";

type ExtractionResponse = ExtractedVitals & {
  symptoms: string[];
  patientComplaint: string;
};

type RiskResponse = {
  score: number;
  level: RiskLevel;
  flags: string[];
  recommendedAction: string;
};

type ReferralResponse = {
  referralText: string;
  followUpPlan: string;
  urgency: Urgency;
  generatedAt: string;
};

type LocalVisitRecord = VisitRecord & {
  createdAt: string;
  referralText: string;
};

/**
 * Props for the complete ASHA visit workflow screen.
 */
export interface VisitWorkflowScreenProps {
  /** Patient receiving care during this visit. */
  patient: Patient;
  /** ASHA worker conducting and documenting the visit. */
  ashaWorker: ASHAWorker;
}

/**
 * Runs the end-to-end voice visit workflow from recording to local save and sync.
 *
 * @param props - Patient and ASHA context for this visit.
 * @returns A multi-step React Native visit workflow screen.
 */
export default function VisitWorkflowScreen({
  patient,
  ashaWorker
}: VisitWorkflowScreenProps) {
  const [step, setStep] = useState<WorkflowStep>("RECORD");
  const [visitId, setVisitId] = useState(createVisitId());
  const [transcript, setTranscript] = useState("");
  const [extraction, setExtraction] = useState<ExtractionResponse | null>(null);
  const [riskResult, setRiskResult] = useState<RiskResponse | null>(null);
  const [referral, setReferral] = useState<ReferralResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReferralGenerating, setIsReferralGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const hasSavedVisitRef = useRef(false);

  const runAnalysis = useCallback(async () => {
    if (!transcript) {
      return;
    }

    try {
      setErrorMessage(null);
      const extractionResponse = await postJson<ExtractionResponse>("/api/extract", {
        transcript,
        visitId
      });
      const riskResponse = await postJson<RiskResponse>("/api/risk/score", {
        vitals: extractionResponse,
        patient: {
          isPregnant: patient.isPregnant,
          gestationalWeek: patient.gestationalWeekIfPregnant,
          ageYears: patient.ageYears
        }
      });

      setExtraction(extractionResponse);
      setRiskResult(riskResponse);
      setStep("RISK_REVIEW");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }, [patient.ageYears, patient.gestationalWeekIfPregnant, patient.isPregnant, transcript, visitId]);

  useEffect(() => {
    if (step === "EXTRACTING") {
      void runAnalysis();
    }
  }, [runAnalysis, step]);

  useEffect(() => {
    if (step !== "DONE" || hasSavedVisitRef.current || !extraction || !riskResult) {
      return;
    }

    hasSavedVisitRef.current = true;
    void saveCompletedVisit(extraction, riskResult);
  }, [extraction, riskResult, step]);

  /**
   * Stores transcript text and advances into the extraction step.
   *
   * @param transcriptText - Transcript returned from voice transcription.
   */
  function handleTranscriptReady(transcriptText: string) {
    setTranscript(transcriptText);
    setStep("EXTRACTING");
  }

  /**
   * Retries extraction and risk scoring after a recoverable failure.
   */
  function retryAnalysis() {
    setErrorMessage(null);
    setStep("EXTRACTING");
    void runAnalysis();
  }

  /**
   * Generates a referral before showing the preview step.
   */
  async function generateReferralPreview() {
    if (!extraction || !riskResult) {
      return;
    }

    try {
      setIsReferralGenerating(true);
      setErrorMessage(null);
      const referralResponse = await postJson<ReferralResponse>("/api/referral/generate", {
        patientName: patient.name,
        ageYears: patient.ageYears,
        village: patient.village,
        visitDate: new Date().toISOString(),
        vitals: toVitalsPayload(extraction),
        symptoms: extraction.symptoms,
        riskLevel: riskResult.level,
        riskFlags: riskResult.flags,
        ashaName: ashaWorker.name,
        outputLanguage: ashaWorker.languageCode === "hi" ? "hi" : "en"
      });

      setReferral(referralResponse);
      setStep("REFERRAL_PREVIEW");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsReferralGenerating(false);
    }
  }

  /**
   * Saves the visit locally and starts a silent background sync attempt.
   *
   * @param extractedData - Extracted vitals and symptoms.
   * @param riskData - Calculated risk result.
   */
  async function saveCompletedVisit(
    extractedData: ExtractionResponse,
    riskData: RiskResponse
  ) {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      await saveVisit(
        buildVisitRecord({
          ashaWorker,
          extractedData,
          patient,
          referral,
          riskData,
          transcript,
          visitId
        })
      );
      void syncPendingVisits(ashaWorker.id);
    } catch (error) {
      hasSavedVisitRef.current = false;
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Moves from referral preview into final save while reserving native share work.
   */
  function handleSaveAndShare() {
    // TODO: Add native referral sharing after the share target requirements are finalized.
    setStep("DONE");
  }

  /**
   * Resets local state so another visit can be recorded.
   */
  function startNewVisit() {
    hasSavedVisitRef.current = false;
    setVisitId(createVisitId());
    setTranscript("");
    setExtraction(null);
    setRiskResult(null);
    setReferral(null);
    setErrorMessage(null);
    setStep("RECORD");
  }

  if (step === "RECORD") {
    return (
      <VoiceInputScreen
        ashaId={ashaWorker.id}
        onTranscriptReady={handleTranscriptReady}
        patientId={patient.id}
      />
    );
  }

  if (step === "EXTRACTING") {
    return (
      <CenteredState
        errorMessage={errorMessage}
        onRetry={retryAnalysis}
        retryLabel="Retry"
        text="SahAI is analyzing your visit notes..."
      />
    );
  }

  if (step === "RISK_REVIEW" && extraction && riskResult) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.container}>
        {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Risk Review</Text>
          <Text style={styles.title}>{patient.name}</Text>
          <Text style={styles.subtitle}>{patient.village}</Text>

          <View style={styles.summaryRow}>
            <RiskBadge level={riskResult.level} />
            <Text style={styles.scoreLabel}>{riskResult.score}/100</Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                getRiskFillStyle(riskResult.level),
                { width: `${Math.max(0, Math.min(riskResult.score, 100))}%` }
              ]}
            />
          </View>

          <View style={styles.flagsList}>
            {riskResult.flags.map((flag) => (
              <View key={flag} style={styles.flagRow}>
                <View style={styles.warningIcon}>
                  <Text style={styles.warningIconText}>!</Text>
                </View>
                <Text style={styles.flagText}>{flag}</Text>
              </View>
            ))}
          </View>

          <View style={styles.vitalsGrid}>
            <VitalTile label="BP" value={formatBloodPressure(extraction)} />
            <VitalTile label="Hb" value={formatNullable(extraction.hemoglobinLevel)} />
            <VitalTile label="Oedema" value={formatBoolean(extraction.oedema)} />
            <VitalTile
              label="Fetal movement"
              value={formatBoolean(extraction.fetalMovements)}
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={isReferralGenerating}
          onPress={
            isReferralRequired(riskResult.level)
              ? generateReferralPreview
              : () => setStep("DONE")
          }
          style={({ pressed }) => [
            styles.primaryButton,
            pressed ? styles.primaryButtonPressed : null,
            isReferralGenerating ? styles.buttonDisabled : null
          ]}
        >
          {isReferralGenerating ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isReferralRequired(riskResult.level) ? "Generate Referral" : "Save Visit"}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    );
  }

  if (step === "REFERRAL_PREVIEW" && referral) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.container}>
        <View style={styles.card}>
          <View style={styles.summaryRow}>
            <Text style={styles.eyebrow}>Referral Preview</Text>
            <UrgencyBadge urgency={referral.urgency} />
          </View>
          <Text style={styles.sectionTitle}>Referral note</Text>
          <ScrollView nestedScrollEnabled style={styles.referralCard}>
            <Text style={styles.referralText}>{referral.referralText}</Text>
          </ScrollView>

          <Text style={styles.sectionTitle}>Follow-up plan</Text>
          <Text style={styles.followUpText}>{referral.followUpPlan}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={handleSaveAndShare}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed ? styles.primaryButtonPressed : null
          ]}
        >
          <Text style={styles.primaryButtonText}>Save & Share</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (step === "DONE" && riskResult) {
    return (
      <View style={styles.doneContainer}>
        {isSaving ? <ActivityIndicator color="#047857" size="large" /> : null}
        {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
        <Text style={styles.doneTitle}>{isSaving ? "Saving visit..." : "Visit saved."}</Text>
        <Text style={styles.doneText}>Risk level: {riskResult.level}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={startNewVisit}
          style={({ pressed }) => [
            styles.primaryButton,
            styles.doneButton,
            pressed ? styles.primaryButtonPressed : null
          ]}
        >
          <Text style={styles.primaryButtonText}>New Visit</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <CenteredState
      errorMessage="Workflow data is incomplete. Please start a new visit."
      onRetry={startNewVisit}
      retryLabel="New Visit"
      text="Unable to continue this visit."
    />
  );
}

/**
 * Shows a loading state with optional retry affordance.
 *
 * @param props - Display text, error message, retry label, and retry handler.
 * @returns Centered loading or error state.
 */
function CenteredState({
  errorMessage,
  onRetry,
  retryLabel,
  text
}: {
  errorMessage: string | null;
  onRetry: () => void;
  retryLabel: string;
  text: string;
}) {
  return (
    <View style={styles.centeredContainer}>
      {errorMessage ? (
        <>
          <ErrorBanner message={errorMessage} />
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed ? styles.primaryButtonPressed : null
            ]}
          >
            <Text style={styles.primaryButtonText}>{retryLabel}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color="#047857" size="large" />
          <Text style={styles.loadingText}>{text}</Text>
        </>
      )}
    </View>
  );
}

/**
 * Renders an error banner.
 *
 * @param props - Error message to show.
 * @returns Error banner view.
 */
function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

/**
 * Renders a color-coded risk level badge.
 *
 * @param props - Risk level to display.
 * @returns Risk badge view.
 */
function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <View style={[styles.badge, getRiskBadgeStyle(level)]}>
      <Text style={[styles.badgeText, getRiskBadgeTextStyle(level)]}>{level}</Text>
    </View>
  );
}

/**
 * Renders a color-coded referral urgency badge.
 *
 * @param props - Referral urgency to display.
 * @returns Urgency badge view.
 */
function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return (
    <View style={[styles.badge, styles.urgencyBadge]}>
      <Text style={styles.urgencyBadgeText}>{urgency}</Text>
    </View>
  );
}

/**
 * Renders one extracted vital value in the review grid.
 *
 * @param props - Vital label and formatted value.
 * @returns Vital tile view.
 */
function VitalTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.vitalTile}>
      <Text style={styles.vitalLabel}>{label}</Text>
      <Text style={styles.vitalValue}>{value}</Text>
    </View>
  );
}

/**
 * Posts JSON to the configured backend API and parses the response body.
 *
 * @param path - API path beginning with a slash.
 * @param body - JSON body to send.
 * @returns Parsed JSON response.
 */
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }

  return response.json() as Promise<T>;
}

/**
 * Builds the local visit record persisted after review.
 *
 * @param data - Workflow data required to build the local visit record.
 * @returns Visit record with local metadata fields used by SQLite.
 */
function buildVisitRecord({
  ashaWorker,
  extractedData,
  patient,
  referral,
  riskData,
  transcript,
  visitId
}: {
  ashaWorker: ASHAWorker;
  extractedData: ExtractionResponse;
  patient: Patient;
  referral: ReferralResponse | null;
  riskData: RiskResponse;
  transcript: string;
  visitId: string;
}): LocalVisitRecord {
  const createdAt = new Date().toISOString();

  return {
    id: visitId,
    patientId: patient.id,
    ashaId: ashaWorker.id,
    visitDate: createdAt,
    rawTranscriptText: transcript,
    extractedVitals: toVitalsPayload(extractedData),
    symptoms: extractedData.symptoms,
    riskScore: riskData.score,
    riskLevel: riskData.level,
    referralGenerated: Boolean(referral) || isReferralRequired(riskData.level),
    referralText: referral?.referralText ?? "",
    followUpPlan: referral?.followUpPlan ?? riskData.recommendedAction,
    syncedToCloud: false,
    createdAt
  };
}

/**
 * Generates a stable visit identifier for local workflow state.
 *
 * @returns Unique visit identifier string.
 */
function createVisitId(): string {
  return `visit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Converts extraction response into the shared ExtractedVitals shape.
 *
 * @param extraction - Extracted values from the backend.
 * @returns ExtractedVitals payload.
 */
function toVitalsPayload(extraction: ExtractionResponse): ExtractedVitals {
  return {
    bloodPressureSystolic: extraction.bloodPressureSystolic,
    bloodPressureDiastolic: extraction.bloodPressureDiastolic,
    hemoglobinLevel: extraction.hemoglobinLevel,
    fetalMovements: extraction.fetalMovements,
    oedema: extraction.oedema,
    temperature: extraction.temperature
  };
}

/**
 * Reads backend error text from a failed response.
 *
 * @param response - Failed fetch response.
 * @returns Human-readable error message.
 */
async function readErrorText(response: Response): Promise<string> {
  try {
    const responseBody = await response.text();
    return responseBody || `Request failed with HTTP ${response.status}`;
  } catch {
    return `Request failed with HTTP ${response.status}`;
  }
}

/**
 * Normalizes thrown values into displayable messages.
 *
 * @param error - Unknown thrown value.
 * @returns Error message for UI display.
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/**
 * Checks whether the risk level requires referral generation.
 *
 * @param level - Risk level returned by the backend.
 * @returns True when referral preview should be required.
 */
function isReferralRequired(level: RiskLevel): boolean {
  return level === "HIGH" || level === "CRITICAL";
}

/**
 * Formats blood pressure values for display.
 *
 * @param vitals - Extracted vitals.
 * @returns Blood pressure display text.
 */
function formatBloodPressure(vitals: ExtractedVitals): string {
  if (
    vitals.bloodPressureSystolic === null ||
    vitals.bloodPressureDiastolic === null
  ) {
    return "Not recorded";
  }

  return `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}`;
}

/**
 * Formats optional numeric values for display.
 *
 * @param value - Numeric value or null.
 * @returns Display text for the value.
 */
function formatNullable(value: number | null): string {
  return value === null ? "Not recorded" : String(value);
}

/**
 * Formats optional boolean values for display.
 *
 * @param value - Boolean value or null.
 * @returns Display text for the value.
 */
function formatBoolean(value: boolean | null): string {
  if (value === null) {
    return "Unknown";
  }

  return value ? "Yes" : "No";
}

/**
 * Maps risk level to badge background style.
 *
 * @param level - Risk level.
 * @returns Badge background style.
 */
function getRiskBadgeStyle(level: RiskLevel) {
  return {
    LOW: styles.lowBadge,
    MEDIUM: styles.mediumBadge,
    HIGH: styles.highBadge,
    CRITICAL: styles.criticalBadge
  }[level];
}

/**
 * Maps risk level to badge text style.
 *
 * @param level - Risk level.
 * @returns Badge text style.
 */
function getRiskBadgeTextStyle(level: RiskLevel) {
  return {
    LOW: styles.lowBadgeText,
    MEDIUM: styles.mediumBadgeText,
    HIGH: styles.highBadgeText,
    CRITICAL: styles.criticalBadgeText
  }[level];
}

/**
 * Maps risk level to progress fill style.
 *
 * @param level - Risk level.
 * @returns Progress fill style.
 */
function getRiskFillStyle(level: RiskLevel) {
  return {
    LOW: styles.lowFill,
    MEDIUM: styles.mediumFill,
    HIGH: styles.highFill,
    CRITICAL: styles.criticalFill
  }[level];
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 12
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "800"
  },
  buttonDisabled: {
    opacity: 0.6
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    padding: 18
  },
  centeredContainer: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  container: {
    backgroundColor: "#f8fafc",
    flex: 1
  },
  criticalBadge: {
    backgroundColor: "#fee2e2"
  },
  criticalBadgeText: {
    color: "#991b1b"
  },
  criticalFill: {
    backgroundColor: "#dc2626"
  },
  doneButton: {
    marginTop: 28,
    minWidth: 180
  },
  doneContainer: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  doneText: {
    color: "#334155",
    fontSize: 18,
    marginTop: 8
  },
  doneTitle: {
    color: "#111827",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 14
  },
  errorBanner: {
    backgroundColor: "#fee2e2",
    borderColor: "#ef4444",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    padding: 12
  },
  errorText: {
    color: "#991b1b",
    fontSize: 14,
    fontWeight: "700"
  },
  eyebrow: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  flagRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    marginTop: 10
  },
  flagText: {
    color: "#334155",
    flex: 1,
    fontSize: 14,
    lineHeight: 20
  },
  flagsList: {
    marginTop: 18
  },
  followUpText: {
    color: "#334155",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 8
  },
  highBadge: {
    backgroundColor: "#ffedd5"
  },
  highBadgeText: {
    color: "#9a3412"
  },
  highFill: {
    backgroundColor: "#f97316"
  },
  loadingText: {
    color: "#334155",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 18,
    textAlign: "center"
  },
  lowBadge: {
    backgroundColor: "#dcfce7"
  },
  lowBadgeText: {
    color: "#166534"
  },
  lowFill: {
    backgroundColor: "#16a34a"
  },
  mediumBadge: {
    backgroundColor: "#fef9c3"
  },
  mediumBadgeText: {
    color: "#854d0e"
  },
  mediumFill: {
    backgroundColor: "#eab308"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#047857",
    borderRadius: 8,
    justifyContent: "center",
    marginTop: 18,
    minHeight: 52,
    paddingHorizontal: 18
  },
  primaryButtonPressed: {
    backgroundColor: "#065f46"
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800"
  },
  progressFill: {
    borderRadius: 999,
    height: 10
  },
  progressTrack: {
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    height: 10,
    marginTop: 12,
    overflow: "hidden"
  },
  referralCard: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    maxHeight: 220,
    padding: 12
  },
  referralText: {
    color: "#111827",
    fontSize: 15,
    lineHeight: 23
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 34
  },
  scoreLabel: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800"
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 20
  },
  subtitle: {
    color: "#64748b",
    fontSize: 15,
    marginTop: 4
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16
  },
  title: {
    color: "#111827",
    fontSize: 26,
    fontWeight: "800",
    marginTop: 8
  },
  urgencyBadge: {
    backgroundColor: "#e0f2fe"
  },
  urgencyBadgeText: {
    color: "#075985",
    fontSize: 12,
    fontWeight: "800"
  },
  vitalLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  vitalTile: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: "48%",
    padding: 12
  },
  vitalValue: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 6
  },
  vitalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 20
  },
  warningIcon: {
    alignItems: "center",
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    height: 20,
    justifyContent: "center",
    width: 20
  },
  warningIconText: {
    color: "#92400e",
    fontSize: 13,
    fontWeight: "900"
  }
});
