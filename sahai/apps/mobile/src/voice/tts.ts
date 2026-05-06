/**
 * Text-to-speech wrapper around `expo-speech`.
 *
 * Maps SahAI language codes to BCP-47 TTS locales and exposes simple
 * `speak()` / `stop()` helpers used by ReadbackButton and OnboardingScreen.
 */

import * as Speech from "expo-speech";

export const TTS_LOCALE: Record<string, string> = {
  hi: "hi-IN",
  en: "en-IN",
  bn: "bn-IN",
  ta: "ta-IN",
  te: "te-IN",
  mr: "mr-IN",
  gu: "gu-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  pa: "pa-IN",
  or: "or-IN",
  ur: "ur-IN",
  as: "as-IN",
  ne: "ne-IN",
  sa: "sa-IN",
};

export function ttsLocaleFor(languageCode: string): string {
  return TTS_LOCALE[languageCode] ?? "hi-IN";
}

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onDone?: () => void;
  onError?: (error: unknown) => void;
}

export function speak(text: string, languageCode: string, options: SpeakOptions = {}): void {
  if (!text) return;
  Speech.stop();
  Speech.speak(text, {
    language: ttsLocaleFor(languageCode),
    rate: options.rate ?? 0.92,
    pitch: options.pitch ?? 1.0,
    onStart: options.onStart,
    onDone: options.onDone,
    onError: options.onError,
  });
}

export function stop(): void {
  Speech.stop();
}

export async function isSpeaking(): Promise<boolean> {
  return Speech.isSpeakingAsync();
}
