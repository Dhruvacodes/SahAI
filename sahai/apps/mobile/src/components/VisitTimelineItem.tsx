import { ChevronRight } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../theme";
import type { Visit } from "../types";

interface VisitTimelineItemProps {
  visit: Visit;
  onPress?: () => void;
}

export function VisitTimelineItem({ visit, onPress }: VisitTimelineItemProps) {
  const palette = riskPalette(visit.extraction.riskLevel);
  const date = formatDate(visit.visitDate ?? visit.createdAt);
  const summary = visit.extraction.chiefComplaint?.trim() || "—";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.dot, { backgroundColor: palette.border }]} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.date}>{date}</Text>
          <View style={[styles.chip, { backgroundColor: palette.bg }]}>
            <Text style={[styles.chipText, { color: palette.fg }]}>
              {visit.extraction.riskLevel}
            </Text>
          </View>
        </View>
        <Text style={styles.summary} numberOfLines={2}>
          {summary}
        </Text>
      </View>
      {onPress && <ChevronRight color={colors.inkMuted} size={20} />}
    </Pressable>
  );
}

function riskPalette(level: string) {
  if (level === "CRITICAL") return colors.risk.critical;
  if (level === "HIGH") return colors.risk.high;
  if (level === "MODERATE") return colors.risk.moderate;
  return colors.risk.low;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
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
  pressed: { opacity: 0.85 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  body: { flex: 1, gap: 4 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  date: { ...typography.caption, color: colors.inkSoft },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  chipText: { ...typography.caption, fontWeight: "800" },
  summary: { ...typography.body, color: colors.ink },
});
