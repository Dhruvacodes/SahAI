/**
 * First-response checklist rendered on the visit summary.
 *
 * Items come from the protocol engine's ``firstResponseActions`` packet on
 * the extraction. Each item has a stable id; checked-state is persisted by
 * visit id in AsyncStorage so a worker can come back to the same visit and
 * see what she's already done.
 */

import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useT } from "../i18n/useT";
import { colors, radius, spacing, typography } from "../theme";
import type { ExtractResponse } from "../types";

interface Props {
  visitId: string;
  actions?: ExtractResponse["firstResponseActions"];
  languageCode: string;
}

const STORAGE_PREFIX = "sahai_checklist_v1:";

export function FirstResponseChecklist({
  visitId,
  actions,
  languageCode,
}: Props) {
  const { t } = useT();
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(`${STORAGE_PREFIX}${visitId}`).then((value) => {
      if (cancelled || !value) return;
      try {
        setChecked(JSON.parse(value));
      } catch {
        /* ignore */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visitId]);

  const persist = (next: Record<string, boolean>) => {
    setChecked(next);
    void AsyncStorage.setItem(
      `${STORAGE_PREFIX}${visitId}`,
      JSON.stringify(next),
    );
  };

  const items = (actions ?? []).filter(
    (a): a is { id: string; text: { en: string; [k: string]: string | undefined } } =>
      !!a && typeof a.id === "string",
  );

  if (items.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.title}>{t("checklistTitle")}</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{t("checklistEmpty")}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{t("checklistTitle")}</Text>
      <View style={styles.list}>
        {items.map((action) => {
          const text =
            action.text?.[languageCode] ??
            action.text?.en ??
            action.id;
          const isChecked = !!checked[action.id];
          return (
            <Pressable
              key={action.id}
              onPress={() => persist({ ...checked, [action.id]: !isChecked })}
              style={({ pressed }) => [
                styles.item,
                pressed && styles.pressed,
                isChecked && styles.itemDone,
              ]}
            >
              <View
                style={[styles.checkbox, isChecked && styles.checkboxDone]}
              >
                {isChecked ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <Text
                style={[styles.itemText, isChecked && styles.itemTextDone]}
              >
                {text}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  title: { ...typography.bodyStrong, color: colors.ink },
  list: { gap: spacing.sm },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  itemDone: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  pressed: { opacity: 0.85 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.inkSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkmark: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  itemText: { ...typography.body, color: colors.ink, flex: 1 },
  itemTextDone: { color: colors.inkSoft, textDecorationLine: "line-through" },
  emptyCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  emptyText: { ...typography.body, color: colors.inkMuted },
});
