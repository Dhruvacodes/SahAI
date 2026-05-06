import { Cloud, CloudOff, RefreshCw } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSyncStore } from "../data/syncQueue";
import { useT } from "../i18n/useT";
import { colors, radius, spacing, typography } from "../theme";

interface SyncPillProps {
  pendingCount: number;
}

export function SyncPill({ pendingCount }: SyncPillProps) {
  const { t } = useT();
  const isOnline = useSyncStore((s) => s.isOnline);
  const isFlushing = useSyncStore((s) => s.isFlushing);

  const palette = isOnline
    ? { bg: colors.successSoft, fg: colors.success }
    : { bg: colors.warningSoft, fg: colors.warning };

  const Icon = isFlushing ? RefreshCw : isOnline ? Cloud : CloudOff;

  let label = isOnline ? t("syncOnline") : t("syncOffline");
  if (pendingCount > 0) {
    label = t("syncPending", { count: pendingCount });
  }

  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <Icon color={palette.fg} size={16} />
      <Text style={[styles.text, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  text: { ...typography.caption },
});
