import { ChevronRight, User } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getDisplayName } from "../data/patientStore";
import { useT } from "../i18n/useT";
import { colors, radius, shadows, spacing, typography } from "../theme";
import type { Patient } from "../types";

interface PatientCardProps {
  patient: Patient;
  onPress: () => void;
  subtitle?: string;
  compact?: boolean;
}

export function PatientCard({ patient, onPress, subtitle, compact }: PatientCardProps) {
  const { lang } = useT();
  const meta = buildMeta(patient);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact ? styles.compact : styles.full,
        shadows.card,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.avatar}>
        <User color={colors.primaryDark} size={26} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.name} numberOfLines={1}>
          {getDisplayName(patient, lang)}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {subtitle ?? meta}
        </Text>
      </View>
      <ChevronRight color={colors.inkMuted} size={22} />
    </Pressable>
  );
}

function buildMeta(p: Patient): string {
  const parts: string[] = [];
  if (p.ageYears != null) parts.push(`${p.ageYears}`);
  if (p.isPregnant && p.gestationalWeeks != null) parts.push(`${p.gestationalWeeks}w`);
  if (p.village) parts.push(p.village);
  return parts.join(" · ");
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  full: { width: "100%" },
  compact: { width: 240 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  copy: { flex: 1 },
  name: { ...typography.bodyStrong, color: colors.ink },
  meta: { ...typography.small, color: colors.inkSoft, marginTop: 2 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
