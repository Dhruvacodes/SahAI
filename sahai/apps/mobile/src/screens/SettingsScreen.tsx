import {
  Cloud,
  ChevronLeft,
  ChevronRight,
  Globe,
  Info,
  LogOut,
  Server,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LanguageChip } from "../components/LanguageChip";
import { useSettingsStore } from "../data/settingsStore";
import { flushSyncQueue, useSyncStore } from "../data/syncQueue";
import { UI_LANGUAGES } from "../i18n/strings";
import { useT } from "../i18n/useT";
import { colors, radius, spacing, tapTargets, typography } from "../theme";
import type { ScreenProps } from "../nav/routes";

export function SettingsScreen({ navigation }: ScreenProps<"Settings">) {
  const { t, lang, setLanguage } = useT();
  const ashaName = useSettingsStore((s) => s.ashaName);
  const backendUrl = useSettingsStore((s) => s.backendUrl);
  const setBackendUrl = useSettingsStore((s) => s.setBackendUrl);
  const reset = useSettingsStore((s) => s.reset);
  const setOnboarded = useSettingsStore((s) => s.setOnboarded);
  const setConsentHash = useSettingsStore((s) => s.setConsentHash);
  const isFlushing = useSyncStore((s) => s.isFlushing);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [urlInput, setUrlInput] = useState(backendUrl ?? "");

  const onSyncNow = async () => {
    const result = await flushSyncQueue();
    Alert.alert(
      t("settingsSyncNow"),
      `Patients: ${result.patientsSent}\nVisits: ${result.visitsSent}\nFailed: ${result.failed}`,
    );
  };

  const onSignOut = () => {
    Alert.alert(t("settingsSignOut"), "", [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("settingsSignOut"),
        style: "destructive",
        onPress: () => {
          reset();
          setOnboarded(false);
        },
      },
    ]);
  };

  const onWithdraw = () => {
    Alert.alert(t("settingsWithdraw"), t("consentBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("settingsWithdraw"),
        style: "destructive",
        onPress: () => {
          setConsentHash(undefined);
          reset();
          setOnboarded(false);
        },
      },
    ]);
  };

  const onSaveBackend = () => {
    setBackendUrl(urlInput.trim() || undefined);
    Alert.alert(t("settingsBackend"), t("saved"));
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityLabel={t("back")}
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <ChevronLeft color={colors.inkSoft} size={22} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("settings")}</Text>
          {!!ashaName && <Text style={styles.subtitle}>{ashaName}</Text>}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Globe color={colors.primaryDark} size={20} />
            <Text style={styles.sectionTitle}>{t("settingsLanguage")}</Text>
          </View>
          <View style={styles.langRow}>
            {UI_LANGUAGES.map((l) => (
              <LanguageChip
                key={l.code}
                nativeLabel={l.nativeLabel}
                englishLabel={l.englishLabel}
                selected={lang === l.code}
                onPress={() => setLanguage(l.code)}
              />
            ))}
          </View>
        </View>

        <Pressable
          onPress={onSyncNow}
          disabled={isFlushing}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.rowIcon}>
            <Cloud color={colors.primaryDark} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("settingsSyncNow")}</Text>
          </View>
          <ChevronRight color={colors.inkMuted} size={20} />
        </Pressable>

        <Pressable
          onPress={() => setShowAdvanced((s) => !s)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.rowIcon}>
            <Server color={colors.primaryDark} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("settingsBackend")}</Text>
            <Text style={styles.rowMeta}>{backendUrl ?? "default"}</Text>
          </View>
          <ChevronRight color={colors.inkMuted} size={20} />
        </Pressable>

        {showAdvanced && (
          <View style={styles.advancedBox}>
            <TextInput
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="http://192.168.1.10:8000"
              placeholderTextColor={colors.inkMuted}
              autoCapitalize="none"
              keyboardType="url"
              style={styles.input}
            />
            <Pressable
              onPress={onSaveBackend}
              style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
            >
              <Text style={styles.saveBtnText}>{t("save")}</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={() =>
            Alert.alert(t("settingsAbout"), `SahAI · ASHA voice co-pilot\n${t("tagline")}`)
          }
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.rowIcon}>
            <Info color={colors.primaryDark} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("settingsAbout")}</Text>
          </View>
          <ChevronRight color={colors.inkMuted} size={20} />
        </Pressable>

        <Pressable
          onPress={onSignOut}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.rowIcon}>
            <LogOut color={colors.danger} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.danger }]}>
              {t("settingsSignOut")}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={onWithdraw}
          style={({ pressed }) => [styles.withdraw, pressed && styles.pressed]}
        >
          <Text style={styles.withdrawText}>{t("settingsWithdraw")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  backBtn: {
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
  title: { ...typography.title, color: colors.ink },
  subtitle: { ...typography.body, color: colors.inkSoft },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  section: { gap: spacing.md },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionTitle: { ...typography.bodyStrong, color: colors.ink },
  langRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  rowTitle: { ...typography.bodyStrong, color: colors.ink },
  rowMeta: { ...typography.caption, color: colors.inkSoft, marginTop: 2 },
  advancedBox: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    gap: spacing.sm,
  },
  input: {
    minHeight: tapTargets.button,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.ink,
  },
  saveBtn: {
    minHeight: tapTargets.button,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: { ...typography.button, color: "#FFFFFF" },
  withdraw: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  withdrawText: { ...typography.caption, color: colors.inkMuted, textDecorationLine: "underline" },
});
