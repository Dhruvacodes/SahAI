import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing, tapTargets, typography } from "../theme";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  style?: ViewStyle;
}

export function PrimaryButton({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  fullWidth = true,
  iconLeft,
  iconRight,
  style,
}: PrimaryButtonProps) {
  const palette = paletteFor(variant, disabled);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.full,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={palette.fg} />
        ) : (
          <>
            {iconLeft}
            <Text style={[styles.label, { color: palette.fg }]} numberOfLines={1}>
              {label}
            </Text>
            {iconRight}
          </>
        )}
      </View>
    </Pressable>
  );
}

function paletteFor(variant: string, disabled: boolean) {
  if (disabled) {
    return { bg: colors.divider, fg: colors.inkMuted, border: colors.divider };
  }
  if (variant === "secondary") {
    return { bg: colors.primarySoft, fg: colors.primaryDark, border: colors.primarySoft };
  }
  if (variant === "danger") {
    return { bg: colors.dangerSoft, fg: colors.danger, border: colors.danger };
  }
  if (variant === "ghost") {
    return { bg: "transparent", fg: colors.primary, border: "transparent" };
  }
  return { bg: colors.primary, fg: "#FFFFFF", border: colors.primary };
}

const styles = StyleSheet.create({
  base: {
    minHeight: tapTargets.button,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  full: { width: "100%" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  label: { ...typography.button },
});
