import * as Haptics from "expo-haptics";
import { ChevronLeft, Phone, RefreshCw } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "../components/PrimaryButton";
import { ReadbackButton } from "../components/ReadbackButton";
import { RiskBanner } from "../components/RiskBanner";
import { VitalsCard } from "../components/VitalsCard";
import { generateReferral } from "../data/api";
import { buildConsentForPatient } from "../data/consent";
import { usePatientStore } from "../data/patientStore";
import { useSettingsStore } from "../data/settingsStore";
import { flushSyncQueue, useSyncStore } from "../data/syncQueue";
import { useVisitStore } from "../data/visitStore";
import { useT } from "../i18n/useT";
import { buildReadback } from "../voice/readback";
import { stop as stopTts } from "../voice/tts";
import { colors, radius, spacing, tapTargets, typography } from "../theme";
import type { ScreenProps } from "../nav/routes";
import type { RiskLevel, Visit } from "../types";

export function VisitSummaryScreen({ route, navigation }: ScreenProps<"VisitSummary">) {
  const { patientId, visitId, rawTranscriptText, extraction } = route.params;
  const { t, lang } = useT();
  const patient = usePatientStore((s) => s.getById(patientId));
  const ashaId = useSettingsStore((s) => s.ashaId);
  const isOnline = useSyncStore((s) => s.isOnline);
  const appendVisit = useVisitStore((s) => s.appendVisit);

  const [referralLoading, setReferralLoading] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const headline = useMemo(() => {
    return riskHeadline(extraction.riskLevel, t);
  }, [extraction.riskLevel, t]);

  const action = useMemo(() => {
    return riskAction(extraction.riskLevel, t);
  }, [extraction.riskLevel, t]);

  const readbackText = useMemo(
    () => buildReadback(extraction, patient?.languageCode ?? lang),
    [extraction, patient?.languageCode, lang],
  );

  const isUnclear =
    !!extraction.dataQuality?.suspectedInjection ||
    (extraction.dataQuality?.confidence ?? 0) < 0.2;

  const onSave = async (): Promise<Visit | null> => {
    if (!patient) return null;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    stopTts();
    const visit: Visit = {
      id: visitId,
      patientId: patient.id,
      ashaId: ashaId || patient.ashaId,
      visitDate: new Date().toISOString(),
      rawTranscriptText,
      extraction,
      consent: buildConsentForPatient(patient),
      languageCode: patient.languageCode,
      syncedToCloud: false,
      createdAt: new Date().toISOString(),
    };
    appendVisit(visit);
    if (isOnline) void flushSyncQueue();
    setSaved(true);
    return visit;
  };

  const onSaveAndExit = async () => {
    await onSave();
    navigation.navigate("Home");
  };

  const onReferral = async () => {
    if (!patient) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setReferralError(null);
    setReferralLoading(true);
    try {
      const referral = await generateReferral({
        extraction,
        ashaFacilityInfo: { name: patient.village ?? undefined },
      });
      const visit = (await onSave()) as Visit | null;
      if (!visit) return;
      navigation.replace("Referral", {
        patientId: patient.id,
        visitId: visit.id,
        referral,
      });
    } catch (err) {
      setReferralError(t("errorTryAgain"));
    } finally {
      setReferralLoading(false);
    }
  };

  if (!patient) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={{ padding: spacing.xl }}>
          <Text style={typography.body}>—</Text>
        </View>
      </SafeAreaView>
    );
  }

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
        <View style={{ flex: 1 }}>
          <Text style={styles.who}>{patient.name}</Text>
          <Text style={styles.where}>{t("summaryTitle")}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isUnclear ? (
          <View style={styles.unclearBox}>
            <Text style={styles.unclearTitle}>{t("summaryUnclearTitle")}</Text>
            <Text style={styles.unclearBody}>{t("summaryUnclearBody")}</Text>
            <PrimaryButton
              label={t("summaryRetryRecord")}
              variant="primary"
              iconLeft={<RefreshCw color="#FFFFFF" size={18} />}
              onPress={() => navigation.replace("Recording", { patientId: patient.id })}
            />
          </View>
        ) : (
          <RiskBanner level={extraction.riskLevel} headline={headline} action={action} />
        )}

        {extraction.riskLevel === "CRITICAL" && (
          <Pressable
            onPress={() => Linking.openURL(Platform.OS === "ios" ? "tel:108" : "tel:108")}
            style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
          >
            <Phone color="#FFFFFF" size={22} />
            <Text style={styles.callText}>{t("summaryCall108")}</Text>
          </Pressable>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("summaryReadback")}</Text>
          <View style={styles.readbackBox}>
            <Text style={styles.readbackText}>{readbackText}</Text>
          </View>
          <ReadbackButton
            text={readbackText}
            languageCode={patient.languageCode}
            playLabel={t("summaryRepeatReadback")}
            stopLabel={t("summaryStop")}
            autoplay={!isUnclear}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("summaryVitals")}</Text>
          <VitalsCard vitals={extraction.vitals} />
        </View>

        {extraction.symptoms.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("summarySymptoms")}</Text>
            <View style={styles.chipWrap}>
              {extraction.symptoms.map((s, idx) => (
                <View key={`${s}-${idx}`} style={styles.symptomChip}>
                  <Text style={styles.symptomChipText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {(extraction.riskLevel === "HIGH" || extraction.riskLevel === "CRITICAL") && (
          <PrimaryButton
            label={t("summaryGenerateReferral")}
            variant="primary"
            loading={referralLoading}
            onPress={onReferral}
          />
        )}
        {!!referralError && (
          <Text style={[typography.body, { color: colors.danger }]}>{referralError}</Text>
        )}

        <PrimaryButton
          label={saved ? t("saved") : t("summarySaveVisit")}
          variant={
            saved
              ? "secondary"
              : extraction.riskLevel === "HIGH" || extraction.riskLevel === "CRITICAL"
                ? "secondary"
                : "primary"
          }
          onPress={onSaveAndExit}
          disabled={referralLoading}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function riskHeadline(level: RiskLevel, t: ReturnType<typeof useT>["t"]): string {
  if (level === "CRITICAL") return t("summaryRiskCritical");
  if (level === "HIGH") return t("summaryRiskHigh");
  if (level === "MODERATE") return t("summaryRiskModerate");
  return t("summaryRiskLow");
}

function riskAction(level: RiskLevel, t: ReturnType<typeof useT>["t"]): string {
  if (level === "CRITICAL") return t("summaryRiskCriticalAction");
  if (level === "HIGH") return t("summaryRiskHighAction");
  if (level === "MODERATE") return t("summaryRiskModerateAction");
  return t("summaryRiskLowAction");
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
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
  pressed: { opacity: 0.85 },
  who: { ...typography.section, color: colors.ink },
  where: { ...typography.caption, color: colors.inkSoft },
  scroll: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  unclearBox: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.warning,
    padding: spacing.lg,
    gap: spacing.md,
  },
  unclearTitle: { ...typography.section, color: colors.warning },
  unclearBody: { ...typography.body, color: colors.warning },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: tapTargets.button,
    backgroundColor: colors.risk.critical.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  callText: { ...typography.button, color: "#FFFFFF" },
  section: { gap: spacing.md },
  sectionTitle: { ...typography.bodyStrong, color: colors.ink },
  readbackBox: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
  },
  readbackText: { ...typography.body, color: colors.ink, lineHeight: 28 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  symptomChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.pill,
  },
  symptomChipText: { ...typography.small, color: colors.warning, fontWeight: "700" },
});
