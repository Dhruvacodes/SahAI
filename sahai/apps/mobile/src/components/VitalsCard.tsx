import {
  Activity,
  Droplet,
  Heart,
  Ruler,
  Scale,
  Thermometer,
  Wind,
} from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useT } from "../i18n/useT";
import { colors, radius, spacing, typography } from "../theme";
import type { Vitals } from "../types";

interface VitalsCardProps {
  vitals: Vitals;
}

export function VitalsCard({ vitals }: VitalsCardProps) {
  const { t } = useT();
  const items = buildItems(vitals, t);

  if (items.length === 0) {
    return (
      <View style={[styles.empty]}>
        <Text style={styles.emptyText}>{t("summaryNoVitals")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.label} style={styles.tile}>
          <View style={styles.tileIcon}>
            <item.Icon color={colors.primaryDark} size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tileLabel}>{item.label}</Text>
            <Text style={styles.tileValue}>{item.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

interface TileItem {
  label: string;
  value: string;
  Icon: React.ComponentType<{ color: string; size: number }>;
}

function buildItems(v: Vitals, t: ReturnType<typeof useT>["t"]): TileItem[] {
  const out: TileItem[] = [];
  if (v.systolicBP != null && v.diastolicBP != null) {
    out.push({ label: t("vitalBP"), value: `${v.systolicBP}/${v.diastolicBP}`, Icon: Activity });
  }
  if (v.heartRate != null) {
    out.push({ label: t("vitalHR"), value: `${v.heartRate}`, Icon: Heart });
  }
  if (v.spO2 != null) {
    out.push({ label: t("vitalSpO2"), value: `${v.spO2}%`, Icon: Wind });
  }
  if (v.temperature != null) {
    out.push({ label: t("vitalTemp"), value: `${v.temperature}°C`, Icon: Thermometer });
  }
  if (v.weight != null) {
    out.push({ label: t("vitalWeight"), value: `${v.weight} kg`, Icon: Scale });
  }
  if (v.haemoglobin != null) {
    out.push({ label: t("vitalHb"), value: `${v.haemoglobin}`, Icon: Droplet });
  }
  if (v.muacMm != null) {
    out.push({ label: t("vitalMUAC"), value: `${v.muacMm} mm`, Icon: Ruler });
  }
  if (v.respiratoryRate != null) {
    out.push({ label: t("vitalRR"), value: `${v.respiratoryRate}`, Icon: Wind });
  }
  return out;
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 64,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  tileLabel: { ...typography.caption, color: colors.inkSoft, textTransform: "uppercase" },
  tileValue: { ...typography.bodyStrong, color: colors.ink },
  empty: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  emptyText: { ...typography.body, color: colors.inkMuted },
});
