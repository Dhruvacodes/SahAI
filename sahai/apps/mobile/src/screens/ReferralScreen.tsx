import { Building2, CalendarClock, ChevronLeft, ListChecks, Share2 } from "lucide-react-native";
import React from "react";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "../components/PrimaryButton";
import { ReadbackButton } from "../components/ReadbackButton";
import { getDisplayName, usePatientStore } from "../data/patientStore";
import { useT } from "../i18n/useT";
import { colors, radius, spacing, tapTargets, typography } from "../theme";
import type { ScreenProps } from "../nav/routes";

export function ReferralScreen({ route, navigation }: ScreenProps<"Referral">) {
  const { referral, patientId } = route.params;
  const { t, lang } = useT();
  const patient = usePatientStore((s) => s.getById(patientId));
  const displayName = patient ? getDisplayName(patient, lang) : undefined;

  const onShare = async () => {
    const facilityLine = referral.facility
      ? `\n${t("referralFacility")}: ${referral.facility}`
      : "";
    const message =
      `SahAI Referral\n${displayName ? `${displayName}\n` : ""}${facilityLine}\n\n${referral.referralText}\n\n${referral.patientInstruction}`;
    try {
      await Share.share({ message });
    } catch {
      // user cancelled — ignore
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
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("referralTitle")}</Text>
          {!!displayName && <Text style={styles.subtitle}>{displayName}</Text>}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.bodyText}>{referral.referralText}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("summaryReadback")}</Text>
          <View style={styles.readbackBox}>
            <Text style={styles.readbackText}>{referral.patientInstruction}</Text>
          </View>
          <ReadbackButton
            text={referral.patientInstruction}
            languageCode={patient?.languageCode ?? "hi"}
            playLabel={t("summaryRepeatReadback")}
            stopLabel={t("summaryStop")}
            autoplay
          />
        </View>

        {!!referral.facility && (
          <Row icon={Building2} label={t("referralFacility")} value={referral.facility} />
        )}

        <Row
          icon={CalendarClock}
          label={t("referralFollowUp")}
          value={`${referral.followUpPlan?.nextVisitDays ?? "—"} days`}
        />

        {!!referral.firstResponseActions?.length && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <ListChecks color={colors.primaryDark} size={20} />
              <Text style={styles.sectionTitle}>{t("referralFirstActions")}</Text>
            </View>
            {referral.firstResponseActions.map((action, idx) => (
              <View key={idx} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{action}</Text>
              </View>
            ))}
          </View>
        )}

        <PrimaryButton
          label={t("referralShare")}
          variant="primary"
          iconLeft={<Share2 color="#FFFFFF" size={20} />}
          onPress={onShare}
        />

        <PrimaryButton
          label={t("done")}
          variant="secondary"
          onPress={() => navigation.navigate("Home")}
        />
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
        <Icon color={colors.primaryDark} size={22} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
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
    padding: spacing.lg,
  },
  bodyText: { ...typography.body, color: colors.ink, lineHeight: 28 },
  section: { gap: spacing.md },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionTitle: { ...typography.bodyStrong, color: colors.ink },
  readbackBox: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
  },
  readbackText: { ...typography.body, color: colors.ink },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  rowLabel: { ...typography.caption, color: colors.inkSoft, textTransform: "uppercase" },
  rowValue: { ...typography.bodyStrong, color: colors.ink },
  bulletRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  bulletDot: { ...typography.bodyStrong, color: colors.primaryDark },
  bulletText: { ...typography.body, color: colors.ink, flex: 1 },
});
