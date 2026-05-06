import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, spacing, typography } from "../theme";

interface LanguageChipProps {
  nativeLabel: string;
  englishLabel: string;
  selected: boolean;
  onPress: () => void;
}

export function LanguageChip({
  nativeLabel,
  englishLabel,
  selected,
  onPress,
}: LanguageChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[styles.native, selected ? styles.nativeSelected : styles.nativeUnselected]}
      >
        {nativeLabel}
      </Text>
      <Text
        style={[styles.english, selected ? styles.englishSelected : styles.englishUnselected]}
      >
        {englishLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minWidth: 140,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    alignItems: "center",
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  unselected: { backgroundColor: colors.paper, borderColor: colors.divider },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  native: { ...typography.section },
  nativeSelected: { color: "#FFFFFF" },
  nativeUnselected: { color: colors.ink },
  english: { ...typography.caption, marginTop: 2 },
  englishSelected: { color: "#FFFFFF" },
  englishUnselected: { color: colors.inkSoft },
});
