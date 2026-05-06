import { Square, Volume2 } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { speak, stop as stopTts } from "../voice/tts";
import { colors, radius, spacing, tapTargets, typography } from "../theme";

interface ReadbackButtonProps {
  text: string;
  languageCode: string;
  playLabel: string;
  stopLabel: string;
  /** Auto-play once on mount. */
  autoplay?: boolean;
}

export function ReadbackButton({
  text,
  languageCode,
  playLabel,
  stopLabel,
  autoplay = false,
}: ReadbackButtonProps) {
  const [speaking, setSpeaking] = useState(false);

  const start = () => {
    setSpeaking(true);
    speak(text, languageCode, {
      onDone: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const halt = () => {
    stopTts();
    setSpeaking(false);
  };

  React.useEffect(() => {
    if (autoplay) {
      const timer = setTimeout(() => start(), 250);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    return () => {
      stopTts();
    };
  }, []);

  return (
    <Pressable
      onPress={speaking ? halt : start}
      style={({ pressed }) => [
        styles.btn,
        speaking && styles.speakingBtn,
        pressed && styles.pressed,
      ]}
    >
      {speaking ? (
        <Square color="#FFFFFF" size={22} fill="#FFFFFF" />
      ) : (
        <Volume2 color="#FFFFFF" size={22} />
      )}
      <Text style={styles.label}>{speaking ? stopLabel : playLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: tapTargets.button,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    width: "100%",
  },
  speakingBtn: { backgroundColor: colors.accent },
  pressed: { opacity: 0.9 },
  label: { ...typography.button, color: "#FFFFFF" },
});
