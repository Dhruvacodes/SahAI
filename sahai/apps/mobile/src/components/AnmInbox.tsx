/**
 * Updates-from-ANM inbox section, rendered on HomeScreen.
 *
 * Each row shows the most recent severe-case alert that this ASHA worker
 * triggered, plus its current state (acknowledged / dispatched / resolved)
 * and any ETA / notes set by the supervising ANM.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useFeedbackStore } from "../data/feedbackStore";
import { useT } from "../i18n/useT";
import { colors, radius, spacing, typography } from "../theme";
import { usePatientStore } from "../data/patientStore";

interface Props {
  onPressItem?: (visitId: string, patientId: string) => void;
  maxItems?: number;
}

export function AnmInbox({ onPressItem, maxItems = 4 }: Props) {
  const { t } = useT();
  const items = useFeedbackStore((s) => s.items).slice(0, maxItems);
  const patients = usePatientStore((s) => s.patients);

  if (items.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.title}>{t("inboxTitle")}</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{t("inboxEmpty")}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{t("inboxTitle")}</Text>
      <View style={styles.list}>
        {items.map((item) => {
          const patient = patients.find((p) => p.id === item.patientId);
          const displayName =
            item.patientName || patient?.nameLatin || patient?.name || item.patientId;
          const statusLabel =
            item.status === "ACKNOWLEDGED"
              ? t("inboxStatusAcknowledged")
              : item.status === "DISPATCHED"
                ? t("inboxStatusDispatched")
                : item.status === "RESOLVED"
                  ? t("inboxStatusResolved")
                  : t("inboxStatusNew");
          const etaLabel =
            item.dispatchEtaMinutes && item.status === "DISPATCHED"
              ? t("inboxEtaMinutes", { minutes: item.dispatchEtaMinutes })
              : "";
          const note = item.dispatchNotes ?? item.resolutionNotes ?? "";
          return (
            <Pressable
              key={item.alertId}
              onPress={() =>
                onPressItem?.(item.visitId, item.patientId)
              }
              style={({ pressed }) => [
                styles.card,
                pressed && styles.pressed,
                statusStyles[item.status] ?? null,
              ]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{displayName}</Text>
                <View
                  style={[
                    styles.riskPill,
                    item.riskLevel === "CRITICAL"
                      ? styles.riskCritical
                      : styles.riskHigh,
                  ]}
                >
                  <Text style={styles.riskPillText}>{item.riskLevel}</Text>
                </View>
              </View>
              <Text style={styles.statusText}>{statusLabel}</Text>
              {etaLabel ? <Text style={styles.metaText}>{etaLabel}</Text> : null}
              {note ? (
                <View style={styles.noteWrap}>
                  <Text style={styles.noteHeader}>{t("inboxAnmReply")}</Text>
                  <Text style={styles.noteText}>{note}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const statusStyles: Record<string, { borderColor: string }> = {
  NEW: { borderColor: colors.divider },
  ACKNOWLEDGED: { borderColor: "#3b82f6" },
  DISPATCHED: { borderColor: "#f97316" },
  RESOLVED: { borderColor: "#10b981" },
};

const styles = StyleSheet.create({
  section: { gap: spacing.md, marginTop: spacing.md, paddingHorizontal: spacing.xl },
  title: { ...typography.section, color: colors.ink },
  list: { gap: spacing.sm },
  emptyCard: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  emptyText: { ...typography.body, color: colors.inkMuted },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderLeftWidth: 4,
    borderColor: colors.divider,
    gap: spacing.xs,
  },
  pressed: { opacity: 0.85 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  cardName: { ...typography.bodyStrong, color: colors.ink, flex: 1 },
  riskPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  riskCritical: { backgroundColor: "#fee2e2" },
  riskHigh: { backgroundColor: "#ffedd5" },
  riskPillText: { color: colors.ink, fontWeight: "800", fontSize: 11 },
  statusText: { ...typography.body, color: colors.ink },
  metaText: { ...typography.body, color: colors.inkSoft },
  noteWrap: {
    marginTop: spacing.xs,
    backgroundColor: colors.cream,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  noteHeader: { ...typography.body, color: colors.inkSoft, fontWeight: "700" },
  noteText: { ...typography.body, color: colors.ink },
});
