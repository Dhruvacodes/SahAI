import * as Haptics from "expo-haptics";
import { Settings as SettingsIcon, UserPlus } from "lucide-react-native";
import React, { useMemo } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnmInbox } from "../components/AnmInbox";
import { BigMicButton } from "../components/BigMicButton";
import { PatientCard } from "../components/PatientCard";
import { SyncPill } from "../components/SyncPill";
import { usePatientStore } from "../data/patientStore";
import { useSettingsStore } from "../data/settingsStore";
import { useVisitStore } from "../data/visitStore";
import { useT } from "../i18n/useT";
import { colors, radius, shadows, spacing, tapTargets, typography } from "../theme";
import type { ScreenProps } from "../nav/routes";

export function HomeScreen({ navigation }: ScreenProps<"Home">) {
  const { t } = useT();
  const ashaName = useSettingsStore((s) => s.ashaName);
  const patients = usePatientStore((s) => s.patients);
  const dirtyPatients = usePatientStore((s) => s.dirtyIds.length);
  const dirtyVisits = useVisitStore((s) => s.dirtyIds.length);
  const pending = dirtyPatients + dirtyVisits;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t("homeGreetingMorning");
    if (hour < 17) return t("homeGreetingAfternoon");
    return t("homeGreetingEvening");
  }, [t]);

  const recents = patients.slice(0, 6);

  const onMicPress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (patients.length === 0) {
      navigation.navigate("NewPatient");
    } else {
      navigation.navigate("PatientPicker");
    }
  };

  const onNewPatient = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("NewPatient");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting}</Text>
          {!!ashaName && <Text style={styles.name}>{ashaName}</Text>}
        </View>
        <SyncPill pendingCount={pending} />
        <Pressable
          accessibilityLabel={t("settings")}
          onPress={() => navigation.navigate("Settings")}
          style={({ pressed }) => [styles.gear, pressed && styles.pressed]}
        >
          <SettingsIcon color={colors.inkSoft} size={22} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.micWrap}>
          <BigMicButton
            onPress={onMicPress}
            label={t("homeMicLabel")}
            hint={t("homeMicHint")}
          />
        </View>

        <Pressable
          onPress={onNewPatient}
          style={({ pressed }) => [styles.newPatient, shadows.card, pressed && styles.pressed]}
        >
          <View style={styles.plusCircle}>
            <UserPlus color="#FFFFFF" size={22} />
          </View>
          <Text style={styles.newPatientLabel}>{t("homeNewPatient")}</Text>
        </Pressable>

        <AnmInbox
          onPressItem={(_visitId, patientId) =>
            navigation.navigate("PatientProfile", { patientId })
          }
        />

        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>{t("homeRecentPatients")}</Text>
          {recents.length === 0 ? (
            <Text style={styles.emptyText}>{t("homeNoPatients")}</Text>
          ) : (
            <FlatList
              data={recents}
              horizontal
              keyExtractor={(p) => p.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentList}
              renderItem={({ item }) => (
                <PatientCard
                  patient={item}
                  compact
                  onPress={() =>
                    navigation.navigate("PatientProfile", { patientId: item.id })
                  }
                />
              )}
            />
          )}
        </View>
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
  greeting: { ...typography.body, color: colors.inkSoft },
  name: { ...typography.section, color: colors.ink },
  gear: {
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
  scroll: { paddingBottom: spacing.xxl, gap: spacing.xl },
  micWrap: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xl },
  newPatient: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginHorizontal: spacing.xl,
  },
  plusCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  newPatientLabel: { ...typography.bodyStrong, color: colors.ink, flex: 1 },
  recentSection: { gap: spacing.md, marginTop: spacing.sm },
  sectionTitle: {
    ...typography.section,
    color: colors.ink,
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.inkMuted,
    paddingHorizontal: spacing.xl,
  },
  recentList: { paddingHorizontal: spacing.xl, gap: spacing.md },
});
