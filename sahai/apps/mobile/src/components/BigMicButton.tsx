import { Mic, Square } from "lucide-react-native";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors, radius, shadows, spacing, tapTargets, typography } from "../theme";

interface BigMicButtonProps {
  onPress: () => void;
  isRecording?: boolean;
  label: string;
  hint?: string;
  size?: number;
}

export function BigMicButton({
  onPress,
  isRecording = false,
  label,
  hint,
  size = tapTargets.big,
}: BigMicButtonProps) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (isRecording) {
      pulse.value = 0;
      pulse.value = withRepeat(
        withTiming(1, { duration: 1100, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
  }, [isRecording, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.value),
    transform: [{ scale: 1 + 0.45 * pulse.value }],
  }));

  return (
    <View style={styles.wrapper}>
      <View style={[styles.ringSlot, { width: size + 24, height: size + 24 }]}>
        {isRecording && (
          <Animated.View
            style={[
              styles.ring,
              { width: size, height: size, borderRadius: size / 2 },
              ringStyle,
            ]}
          />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          style={({ pressed }) => [
            styles.btn,
            { width: size, height: size, borderRadius: size / 2 },
            shadows.lifted,
            pressed && styles.pressed,
            isRecording && styles.btnRecording,
          ]}
        >
          {isRecording ? (
            <Square color="#FFFFFF" size={size * 0.32} fill="#FFFFFF" />
          ) : (
            <Mic color="#FFFFFF" size={size * 0.42} />
          )}
        </Pressable>
      </View>
      <Text style={styles.label}>{label}</Text>
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", justifyContent: "center", gap: spacing.md },
  ringSlot: { alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  btn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  btnRecording: {
    backgroundColor: colors.risk.critical.border,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  label: { ...typography.title, color: colors.ink, marginTop: spacing.sm },
  hint: { ...typography.body, color: colors.inkSoft, textAlign: "center" },
});
