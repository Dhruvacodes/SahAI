import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LanguageChip } from "../components/LanguageChip";
import { PrimaryButton } from "../components/PrimaryButton";
import { ReadbackButton } from "../components/ReadbackButton";
import { captureOnboardingConsent } from "../data/consent";
import { useSettingsStore } from "../data/settingsStore";
import { UI_LANGUAGES, getStrings } from "../i18n/strings";
import { useT } from "../i18n/useT";
import { colors, radius, spacing, typography } from "../theme";
import type { ScreenProps } from "../nav/routes";

type Step = "language" | "consent" | "profile";

export function OnboardingScreen(_props: ScreenProps<"Onboarding">) {
  const [step, setStep] = useState<Step>("language");
  const { t, lang } = useT();
  const setUiLanguage = useSettingsStore((s) => s.setUiLanguage);
  const setAsha = useSettingsStore((s) => s.setAsha);
  const setOnboarded = useSettingsStore((s) => s.setOnboarded);

  const [name, setName] = useState("");
  const [ashaIdInput, setAshaIdInput] = useState("");

  useEffect(() => {
    void Haptics.selectionAsync();
  }, [step]);

  const consentBody = useMemo(() => getStrings(lang).consentBody, [lang]);

  const goNext = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === "language") setStep("consent");
    else if (step === "consent") setStep("profile");
  };

  const finish = async () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const finalName = name.trim() || (lang === "hi" ? "आशा कार्यकर्ता" : "ASHA worker");
    const generatedId =
      ashaIdInput.trim() || `asha-${Date.now().toString(36)}`;
    setAsha(finalName, generatedId);
    await captureOnboardingConsent({ ashaId: generatedId, languageCode: lang });
    setOnboarded(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <Text style={styles.brandTitle}>SahAI</Text>
            <Text style={styles.brandTagline}>{t("tagline")}</Text>
          </View>

          {step === "language" && (
            <View style={styles.stepBlock}>
              <Text style={styles.stepTitle}>{t("welcomeTitle")}</Text>
              <Text style={styles.stepSubtitle}>{t("welcomeSubtitle")}</Text>
              <Text style={styles.sectionLabel}>{t("chooseLanguage")}</Text>
              <View style={styles.langRow}>
                {UI_LANGUAGES.map((l) => (
                  <LanguageChip
                    key={l.code}
                    nativeLabel={l.nativeLabel}
                    englishLabel={l.englishLabel}
                    selected={lang === l.code}
                    onPress={() => setUiLanguage(l.code)}
                  />
                ))}
              </View>
              <PrimaryButton label={t("next")} onPress={goNext} />
            </View>
          )}

          {step === "consent" && (
            <View style={styles.stepBlock}>
              <Text style={styles.stepTitle}>{t("consentTitle")}</Text>
              <View style={styles.consentBox}>
                <Text style={styles.consentText}>{consentBody}</Text>
              </View>
              <ReadbackButton
                text={consentBody}
                languageCode={lang}
                playLabel={t("summaryRepeatReadback")}
                stopLabel={t("summaryStop")}
                autoplay
              />
              <PrimaryButton label={t("consentAgreeBig")} onPress={goNext} />
            </View>
          )}

          {step === "profile" && (
            <View style={styles.stepBlock}>
              <Text style={styles.stepTitle}>{t("ashaNameTitle")}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t("ashaNamePlaceholder")}
                placeholderTextColor={colors.inkMuted}
                style={styles.input}
                autoCapitalize="words"
                returnKeyType="next"
              />
              <TextInput
                value={ashaIdInput}
                onChangeText={setAshaIdInput}
                placeholder={t("ashaIdPlaceholder")}
                placeholderTextColor={colors.inkMuted}
                style={styles.input}
                autoCapitalize="none"
                returnKeyType="done"
              />
              <PrimaryButton label={t("ashaSubmit")} onPress={finish} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  scroll: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxl },
  brand: { gap: 4, marginBottom: spacing.lg },
  brandTitle: { ...typography.hero, color: colors.primaryDark },
  brandTagline: { ...typography.body, color: colors.inkSoft },
  stepBlock: { gap: spacing.lg },
  stepTitle: { ...typography.title, color: colors.ink },
  stepSubtitle: { ...typography.body, color: colors.inkSoft },
  sectionLabel: { ...typography.bodyStrong, color: colors.ink, marginTop: spacing.sm },
  langRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  consentBox: {
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
  },
  consentText: { ...typography.body, color: colors.ink },
  input: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.ink,
  },
});
