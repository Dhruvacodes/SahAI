import { Search, UserPlus, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PatientCard } from "../components/PatientCard";
import { usePatientStore } from "../data/patientStore";
import { useT } from "../i18n/useT";
import { colors, radius, spacing, tapTargets, typography } from "../theme";
import type { ScreenProps } from "../nav/routes";

export function PatientPickerScreen({ navigation }: ScreenProps<"PatientPicker">) {
  const { t } = useT();
  const patients = usePatientStore((s) => s.patients);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return patients;
    const q = query.trim().toLowerCase();
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.village ?? "").toLowerCase().includes(q),
    );
  }, [patients, query]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t("pickerTitle")}</Text>
            <Text style={styles.subtitle}>{t("pickerSubtitle")}</Text>
          </View>
          <Pressable
            accessibilityLabel={t("cancel")}
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          >
            <X color={colors.inkSoft} size={22} />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <Search color={colors.inkMuted} size={20} />
          <TextInput
            placeholder={t("pickerSearch")}
            placeholderTextColor={colors.inkMuted}
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
          />
        </View>

        <Pressable
          onPress={() => {
            navigation.replace("NewPatient");
          }}
          style={({ pressed }) => [styles.newRow, pressed && styles.pressed]}
        >
          <View style={styles.newIcon}>
            <UserPlus color="#FFFFFF" size={22} />
          </View>
          <Text style={styles.newLabel}>{t("pickerNew")}</Text>
        </Pressable>

        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <PatientCard
              patient={item}
              onPress={() =>
                navigation.replace("Recording", { patientId: item.id })
              }
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>{t("pickerEmpty")}</Text>
          }
        />
      </KeyboardAvoidingView>
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
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.xl,
    minHeight: tapTargets.button,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.ink, paddingVertical: spacing.md },
  newRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  newIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  newLabel: { ...typography.bodyStrong, color: colors.ink },
  list: { padding: spacing.xl, gap: spacing.md },
  empty: { ...typography.body, color: colors.inkMuted, textAlign: "center", marginTop: spacing.xl },
});
