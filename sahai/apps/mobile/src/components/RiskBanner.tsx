import { AlertTriangle, CheckCircle2, ShieldAlert, Siren } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../theme";
import type { RiskLevel } from "../types";

interface RiskBannerProps {
  level: RiskLevel;
  headline: string;
  action: string;
}

export function RiskBanner({ level, headline, action }: RiskBannerProps) {
  const palette = paletteFor(level);
  const Icon = iconFor(level);
  return (
    <View style={[styles.band, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <View style={[styles.iconCircle, { backgroundColor: palette.border }]}>
        <Icon color="#FFFFFF" size={36} strokeWidth={2.5} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.headline, { color: palette.fg }]}>{headline}</Text>
        <Text style={[styles.action, { color: palette.fg }]}>{action}</Text>
      </View>
    </View>
  );
}

function paletteFor(level: RiskLevel) {
  if (level === "CRITICAL") return colors.risk.critical;
  if (level === "HIGH") return colors.risk.high;
  if (level === "MODERATE") return colors.risk.moderate;
  return colors.risk.low;
}

function iconFor(level: RiskLevel) {
  if (level === "CRITICAL") return Siren;
  if (level === "HIGH") return ShieldAlert;
  if (level === "MODERATE") return AlertTriangle;
  return CheckCircle2;
}

const styles = StyleSheet.create({
  band: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, gap: spacing.xs },
  headline: { ...typography.title },
  action: { ...typography.body },
});
