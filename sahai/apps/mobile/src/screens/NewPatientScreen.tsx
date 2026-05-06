import * as Haptics from "expo-haptics";
import { Mic, X } from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "../components/PrimaryButton";
import { extractDemographics, transcribeAudio } from "../data/api";
import { buildPatient, usePatientStore } from "../data/patientStore";
import { useSettingsStore } from "../data/settingsStore";
import { flushSyncQueue, useSyncStore } from "../data/syncQueue";
import { uuidv4 } from "../data/uuid";
import { useT } from "../i18n/useT";
import {
  ensureMicPermission,
  startRecording,
  stopRecording,
  type ActiveRecording,
} from "../voice/recorder";
import { isParseConfident, parseDemographics } from "../voice/parseDemographics";
import { colors, radius, spacing, tapTargets, typography } from "../theme";
import type { ScreenProps } from "../nav/routes";
import type { ConsentSnapshot } from "../types";

export function NewPatientScreen({ navigation }: ScreenProps<"NewPatient">) {
  const { t, lang } = useT();
  const ashaId = useSettingsStore((s) => s.ashaId);
  const consentHash = useSettingsStore((s) => s.globalConsentReceiptHash);
  const upsertPatient = usePatientStore((s) => s.upsertPatient);
  const isOnline = useSyncStore((s) => s.isOnline);

  const [recording, setRecording] = useState<ActiveRecording | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [nameLatin, setNameLatin] = useState<string | undefined>(undefined);
  const [age, setAge] = useState("");
  const [village, setVillage] = useState("");
  const [phone, setPhone] = useState("");
  const [pregnant, setPregnant] = useState(false);
  const [weeks, setWeeks] = useState("");

  const onMicPress = async () => {
    setError(null);
    if (recording) {
      await handleStop();
    } else {
      await handleStart();
    }
  };

  const handleStart = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const granted = await ensureMicPermission();
    if (!granted) {
      setError(t("recordingMicDenied"));
      return;
    }
    try {
      const active = await startRecording();
      setRecording(active);
    } catch (err) {
      setError(t("recordingError"));
    }
  };

  const handleStop = async () => {
    if (!recording) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setProcessing(true);
    try {
      const { uri } = await stopRecording(recording);
      setRecording(null);
      const consent: ConsentSnapshot = {
        consentGranted: true,
        scopeAgreed: ["transcription", "clinical_visit"],
        languageCode: lang,
        timestamp: new Date().toISOString(),
        witnessPresent: false,
        patientId: "new",
        ashaId,
        receiptHash: consentHash,
      };
      // Always tell Sarvam to auto-detect the spoken language for the
      // demographics flow. The UI language ("hi"/"en") describes which strings
      // the worker reads on screen, NOT what they will speak. Forcing "hi-IN"
      // when the worker actually spoke English makes Saarika emit Devanagari
      // transliteration ("द पेशेंट्स नेम…"), which then defeats the parser.
      const { transcriptText } = await transcribeAudio(uri, "auto", consent);

      // Tier 1 (free): on-device regex parser.
      let parsed = parseDemographics(transcriptText);

      // Tier 2 (cheap LLM fallback): only when the regex couldn't recover a
      // name/phone — i.e. ambiguous or transliterated speech. One short
      // Claude Haiku call (~$0.0005), bounded to 256 output tokens.
      if (!isParseConfident(parsed) && transcriptText.trim().length > 0) {
        try {
          const llm = await extractDemographics(transcriptText, lang);
          parsed = {
            name: parsed.name ?? llm.name ?? undefined,
            nameLatin: parsed.nameLatin ?? llm.nameLatin ?? undefined,
            ageYears: parsed.ageYears ?? llm.ageYears ?? undefined,
            village: parsed.village ?? llm.village ?? undefined,
            phone: parsed.phone ?? llm.phone ?? undefined,
            isPregnant:
              parsed.isPregnant ?? llm.isPregnant ?? undefined,
            gestationalWeeks:
              parsed.gestationalWeeks ?? llm.gestationalWeeks ?? undefined,
          };
        } catch {
          // Network/LLM failure is non-fatal: keep whatever regex got and
          // let the worker finish the form by hand.
        }
      }

      if (parsed.name) setName(parsed.name);
      if (parsed.nameLatin) setNameLatin(parsed.nameLatin);
      if (parsed.ageYears != null) setAge(String(parsed.ageYears));
      if (parsed.village) setVillage(parsed.village);
      if (parsed.phone) setPhone(parsed.phone);
      if (parsed.isPregnant) setPregnant(true);
      if (parsed.gestationalWeeks != null) setWeeks(String(parsed.gestationalWeeks));
    } catch (err: any) {
      const detail =
        err?.body
          ? `${err.status}: ${err.body.slice(0, 120)}`
          : err?.message
            ? err.message.slice(0, 120)
            : t("errorNetwork");
      setError(detail);
    } finally {
      setProcessing(false);
    }
  };

  const onSave = async () => {
    if (!name.trim()) {
      setError(t("newPatientName"));
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const patient = buildPatient({
      id: uuidv4(),
      ashaId: ashaId || "asha-local",
      name: name.trim(),
      nameLatin: nameLatin?.trim() || undefined,
      ageYears: parseIntSafe(age),
      isPregnant: pregnant,
      gestationalWeeks: parseIntSafe(weeks),
      village: village.trim() || undefined,
      phone: phone.trim() || undefined,
      languageCode: lang,
    });
    upsertPatient(patient);
    if (isOnline) void flushSyncQueue();
    navigation.replace("Recording", { patientId: patient.id });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t("homeNewPatient")}</Text>
            <Text style={styles.subtitle}>{t("newPatientSpeakAll")}</Text>
          </View>
          <Pressable
            accessibilityLabel={t("cancel")}
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          >
            <X color={colors.inkSoft} size={22} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={onMicPress}
            disabled={processing}
            style={({ pressed }) => [
              styles.micRow,
              recording && styles.micRowActive,
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.micCircle,
                recording && styles.micCircleActive,
              ]}
            >
              {processing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Mic color="#FFFFFF" size={26} />
              )}
            </View>
            <Text style={styles.micLabel}>
              {processing
                ? t("recordingProcessing")
                : recording
                  ? t("recordingTapStop")
                  : t("recordingSpeak")}
            </Text>
          </Pressable>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.field}>
            <Text style={styles.label}>{t("newPatientName")}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("newPatientName")}
              placeholderTextColor={colors.inkMuted}
              style={styles.input}
              autoCapitalize="words"
            />
          </View>
          <View style={styles.fieldRow}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>{t("newPatientAge")}</Text>
              <TextInput
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor={colors.inkMuted}
                style={styles.input}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>{t("newPatientVillage")}</Text>
              <TextInput
                value={village}
                onChangeText={setVillage}
                placeholder="—"
                placeholderTextColor={colors.inkMuted}
                style={styles.input}
              />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>{t("newPatientPhone")}</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="—"
              placeholderTextColor={colors.inkMuted}
              style={styles.input}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.label}>{t("newPatientPregnant")}</Text>
            <Switch
              value={pregnant}
              onValueChange={setPregnant}
              trackColor={{ false: colors.divider, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          {pregnant && (
            <View style={styles.field}>
              <Text style={styles.label}>{t("newPatientWeeks")}</Text>
              <TextInput
                value={weeks}
                onChangeText={setWeeks}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor={colors.inkMuted}
                style={styles.input}
              />
            </View>
          )}

          <PrimaryButton label={t("newPatientCreate")} onPress={onSave} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function parseIntSafe(value: string): number | undefined {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: { ...typography.title, color: colors.ink },
  subtitle: { ...typography.body, color: colors.inkSoft },
  closeBtn: {
    width: tapTargets.iconButton,
    height: tapTargets.iconButton,
    borderRadius: tapTargets.iconButton / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  pressed: { opacity: 0.85 },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  micRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  micRowActive: { backgroundColor: colors.dangerSoft },
  micCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  micCircleActive: { backgroundColor: colors.risk.critical.border },
  micLabel: { ...typography.bodyStrong, color: colors.ink, flex: 1 },
  errorText: { ...typography.body, color: colors.danger },
  field: { gap: spacing.xs },
  fieldRow: { flexDirection: "row", gap: spacing.md },
  label: { ...typography.caption, color: colors.inkSoft, textTransform: "uppercase" },
  input: {
    minHeight: tapTargets.button,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.ink,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
  },
});
