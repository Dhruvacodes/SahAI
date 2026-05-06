import * as Haptics from "expo-haptics";
import { ChevronLeft } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BigMicButton } from "../components/BigMicButton";
import { extractClinical, transcribeAudio } from "../data/api";
import { buildConsentForPatient } from "../data/consent";
import { getDisplayName, usePatientStore } from "../data/patientStore";
import { uuidv4 } from "../data/uuid";
import { useT } from "../i18n/useT";
import { evaluate as evaluateProtocol } from "../protocol/protocolEngine";
import { mergeVitals, parseVitals } from "../voice/parseVitals";
import {
  ensureMicPermission,
  startRecording,
  stopRecording,
  type ActiveRecording,
} from "../voice/recorder";
import { speak as speakTts, stop as stopTts } from "../voice/tts";
import { colors, radius, spacing, tapTargets, typography } from "../theme";
import type { ScreenProps } from "../nav/routes";
import type { ExtractResponse } from "../types";

type Phase = "ready" | "recording" | "processing";

export function RecordingScreen({ route, navigation }: ScreenProps<"Recording">) {
  const { patientId } = route.params;
  const { t, lang } = useT();
  const patient = usePatientStore((s) => s.getById(patientId));

  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef<ActiveRecording | null>(null);

  useEffect(() => {
    return () => {
      if (activeRef.current) {
        void activeRef.current.recording
          .stopAndUnloadAsync()
          .catch(() => undefined);
        activeRef.current = null;
      }
      stopTts();
    };
  }, []);

  useEffect(() => {
    void Haptics.selectionAsync();
  }, [phase]);

  const onMicPress = async () => {
    setError(null);
    if (phase === "ready") {
      await begin();
    } else if (phase === "recording") {
      await finish();
    }
  };

  const begin = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const granted = await ensureMicPermission();
    if (!granted) {
      setError(t("recordingMicDenied"));
      return;
    }
    try {
      const active = await startRecording();
      activeRef.current = active;
      setPhase("recording");
    } catch (err) {
      setError(t("recordingError"));
    }
  };

  const finish = async () => {
    const active = activeRef.current;
    if (!active) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhase("processing");
    try {
      const { uri } = await stopRecording(active);
      activeRef.current = null;

      if (!patient) {
        throw new Error("Patient not found");
      }

      speakTts(t("recordingProcessing"), lang);

      const consent = buildConsentForPatient(patient);
      // ASR follows the patient's recorded language (the patient is the one speaking).
      // Extraction follows the worker's active UI language so the readback the
      // ASHA worker hears on the next screen is in *her* language, not the
      // patient's.
      const { transcriptText } = await transcribeAudio(uri, patient.languageCode, consent);

      const serverExtraction: ExtractResponse = await extractClinical({
        transcriptText,
        languageCode: lang,
        consent,
        patientProfile: {
          isPregnant: patient.isPregnant,
          gestationalWeekIfPregnant: patient.gestationalWeeks,
          isPostpartum: patient.isPostpartum,
          daysPostpartum: patient.daysPostpartum,
          ageYears: patient.ageYears,
        },
      });

      // Tier-1 deterministic regex pass — recovers any vital the LLM dropped
      // on the first take ("BP 120 by 80" said quickly, "हीमोग्लोबिन 9").
      // Backend value wins when present; regex only fills gaps.
      const localVitals = parseVitals(transcriptText);
      const mergedVitals = mergeVitals(serverExtraction.vitals, localVitals);

      // Run the on-device protocol engine on the merged observations. The
      // server's risk band is authoritative on the wire (so dashboards stay
      // consistent), but if the on-device engine returns a STRONGER band we
      // surface that on the worker UI immediately rather than under-triaging.
      const onDevice = evaluateProtocol({
        patient: {
          isPregnant: patient.isPregnant,
          gestationalWeeks: patient.gestationalWeeks,
          isPostpartum: patient.isPostpartum,
          daysPostpartum: patient.daysPostpartum,
          ageYears: patient.ageYears,
        },
        vitals: mergedVitals as Record<string, number | boolean | string | null | undefined>,
        symptoms: serverExtraction.symptoms ?? [],
        velocityWarnings: serverExtraction.velocityWarnings ?? [],
      });

      const LEVEL_ORDER = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const;
      const serverIdx = LEVEL_ORDER.indexOf(serverExtraction.riskLevel as typeof LEVEL_ORDER[number]);
      const onDeviceIdx = LEVEL_ORDER.indexOf(onDevice.level);
      const reconciled =
        onDeviceIdx > serverIdx
          ? {
              riskLevel: onDevice.level,
              riskScore: onDevice.score,
              riskFlags: Array.from(new Set([...(serverExtraction.riskFlags ?? []), ...onDevice.flags])),
            }
          : {
              riskLevel: serverExtraction.riskLevel,
              riskScore: serverExtraction.riskScore,
              riskFlags: serverExtraction.riskFlags,
            };

      const extraction: ExtractResponse = {
        ...serverExtraction,
        vitals: mergedVitals,
        ...reconciled,
      };

      stopTts();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      navigation.replace("VisitSummary", {
        patientId: patient.id,
        visitId: uuidv4(),
        rawTranscriptText: transcriptText,
        extraction,
      });
    } catch (err: any) {
      const detail =
        err?.body
          ? `${err.status}: ${err.body.slice(0, 120)}`
          : err?.message
            ? err.message.slice(0, 120)
            : t("errorNetwork");
      setError(detail);
      setPhase("ready");
      stopTts();
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityLabel={t("back")}
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <ChevronLeft color={colors.inkSoft} size={22} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.who}>{patient ? getDisplayName(patient, lang) : "—"}</Text>
          {!!patient?.village && (
            <Text style={styles.where}>{patient.village}</Text>
          )}
        </View>
        <View style={styles.spacer} />
      </View>

      <View style={styles.center}>
        <BigMicButton
          onPress={onMicPress}
          isRecording={phase === "recording"}
          label={
            phase === "ready"
              ? t("recordingPrompt")
              : phase === "recording"
                ? t("recordingTapStop")
                : t("recordingProcessing")
          }
          hint={phase === "ready" ? t("recordingSpeak") : undefined}
          size={tapTargets.big}
        />

        {phase === "processing" && (
          <View style={styles.processingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.processingText}>{t("recordingProcessing")}</Text>
          </View>
        )}

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>{t("recordingMicDenied")}</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  backBtn: {
    width: tapTargets.iconButton,
    height: tapTargets.iconButton,
    borderRadius: tapTargets.iconButton / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  spacer: { width: tapTargets.iconButton },
  who: { ...typography.section, color: colors.ink },
  where: { ...typography.caption, color: colors.inkSoft },
  pressed: { opacity: 0.85 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
    padding: spacing.xl,
  },
  processingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  processingText: { ...typography.body, color: colors.inkSoft },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.lg,
    width: "100%",
    gap: spacing.xs,
  },
  errorTitle: { ...typography.bodyStrong, color: colors.danger },
  errorBody: { ...typography.body, color: colors.danger },
});
