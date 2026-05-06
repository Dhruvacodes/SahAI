import { ChevronLeft, MapPin, Phone, User } from "lucide-react-native";
import React, { useMemo } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "../components/PrimaryButton";
import { RiskBanner } from "../components/RiskBanner";
import { VisitTimelineItem } from "../components/VisitTimelineItem";
import { usePatientStore } from "../data/patientStore";
import { useVisitStore } from "../data/visitStore";
import { useT } from "../i18n/useT";
import { colors, radius, spacing, tapTargets, typography } from "../theme";
import type { ScreenProps } from "../nav/routes";
import type { RiskLevel } from "../types";

export function PatientProfileScreen({ route, navigation }: ScreenProps<"PatientProfile">) {
  const { patientId } = route.params;
  const { t } = useT();
  const patient = usePatientStore((s) => s.getById(patientId));
  const visits = useVisitStore((s) => s.visits);
  const patientVisits = useMemo(
    () => visits.filter((v) => v.patientId === patientId),
    [visits, patientId],
  );
  const latestRisk: RiskLevel | undefined = patientVisits[0]?.extraction.riskLevel;

  if (!patient) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={{ padding: spacing.xl }}>
          <Text style={typography.body}>—</Text>
        </View>
      </SafeAreaView>
    );
  }

  const callPatient = () => {
    if (patient.phone) Linking.openURL(`tel:${patient.phone}`);
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
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{patient.name}</Text>
          <Text style={styles.subtitle}>
            {patient.ageYears != null ? `${patient.ageYears} ${t("profileAge")}` : ""}
            {patient.isPregnant && patient.gestationalWeeks != null
              ? ` · ${patient.gestationalWeeks} ${t("profileWeeks")}`
              : ""}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!!latestRisk && (
          <RiskBanner
            level={latestRisk}
            headline={riskHeadline(latestRisk, t)}
            action={riskAction(latestRisk, t)}
          />
        )}

        <View style={styles.card}>
          <Row icon={User} label={t("profileAge")} value={patient.ageYears != null ? String(patient.ageYears) : "—"} />
          {!!patient.village && (
            <Row icon={MapPin} label={t("profileVillage")} value={patient.village} />
          )}
          {!!patient.phone && (
            <Pressable onPress={callPatient} style={({ pressed }) => [pressed && styles.pressed]}>
              <Row icon={Phone} label={t("profilePhone")} value={patient.phone} />
            </Pressable>
          )}
        </View>

        <PrimaryButton
          label={t("profileNewVisit")}
          onPress={() => navigation.navigate("Recording", { patientId: patient.id })}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("profileVisits")}</Text>
          {patientVisits.length === 0 ? (
            <Text style={styles.empty}>{t("profileNoVisits")}</Text>
          ) : (
            patientVisits.map((visit) => (
              <VisitTimelineItem key={visit.id} visit={visit} />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ color: string; size: number }>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Icon color={colors.primaryDark} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
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
  title: { ...typography.title, color: colors.ink },
  subtitle: { ...typography.body, color: colors.inkSoft },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.lg },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  rowLabel: { ...typography.caption, color: colors.inkSoft, textTransform: "uppercase" },
  rowValue: { ...typography.bodyStrong, color: colors.ink },
  section: { gap: spacing.md },
  sectionTitle: { ...typography.section, color: colors.ink },
  empty: { ...typography.body, color: colors.inkMuted },
});
