/**
 * "Why this band?" expandable panel.
 *
 * Lists every protocol rule that fired for this visit, with its rationale
 * and the source-document citation (NHM / IMNCI / MoHFW etc.). When the
 * user expands a row, we lazily fetch the full rule doc from the backend
 * to show the populated source. Cached in-memory.
 */

import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fetchProtocolRule, type ProtocolRuleDoc } from "../data/api";
import { useT } from "../i18n/useT";
import { colors, radius, spacing, typography } from "../theme";
import type { FiredRuleSummary } from "../types";

const ruleCache = new Map<string, ProtocolRuleDoc>();

interface Props {
  firedRules?: FiredRuleSummary[];
  catalogVersion?: string;
}

export function WhyThisBandPanel({ firedRules, catalogVersion }: Props) {
  const { t, lang } = useT();
  const [openId, setOpenId] = useState<string | null>(null);

  if (!firedRules || firedRules.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.title}>{t("rationaleTitle")}</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{t("rationaleNoRules")}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t("rationaleTitle")}</Text>
        {catalogVersion ? (
          <Text style={styles.versionTag}>v{catalogVersion}</Text>
        ) : null}
      </View>
      <View style={styles.list}>
        {firedRules.map((rule) => {
          const isOpen = openId === rule.id;
          return (
            <RuleRow
              key={rule.id}
              rule={rule}
              isOpen={isOpen}
              onToggle={() => setOpenId(isOpen ? null : rule.id)}
              langCode={lang}
              sourceLabel={t("rationaleSource")}
            />
          );
        })}
      </View>
    </View>
  );
}

function RuleRow({
  rule,
  isOpen,
  onToggle,
  langCode,
  sourceLabel,
}: {
  rule: FiredRuleSummary;
  isOpen: boolean;
  onToggle: () => void;
  langCode: string;
  sourceLabel: string;
}) {
  const [doc, setDoc] = useState<ProtocolRuleDoc | null>(
    ruleCache.get(rule.id) ?? null,
  );

  useEffect(() => {
    if (!isOpen || doc) return;
    let cancelled = false;
    fetchProtocolRule(rule.id).then((data) => {
      if (cancelled || !data) return;
      ruleCache.set(rule.id, data);
      setDoc(data);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, doc, rule.id]);

  const label =
    doc?.label?.[langCode] ??
    doc?.label?.en ??
    rule.label ??
    rule.id;
  const rationale = doc?.rationale ?? rule.rationale;
  const sourceTitle = doc?.sourceDoc?.title ?? rule.source?.doc;
  const sourceSection = doc?.source?.section ?? rule.source?.section;
  const sourceYear = doc?.sourceDoc?.year;

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.pressed,
        isOpen && styles.rowOpen,
      ]}
    >
      <View style={styles.rowHeader}>
        <Text style={styles.ruleLabel}>{label}</Text>
        <Text style={styles.ruleId}>{rule.id}</Text>
      </View>
      {isOpen ? (
        <View style={styles.rowBody}>
          {rationale ? (
            <Text style={styles.rationale}>{rationale}</Text>
          ) : null}
          {sourceTitle ? (
            <Text style={styles.source}>
              {sourceLabel}: {sourceTitle}
              {sourceYear ? ` (${sourceYear})` : ""}
              {sourceSection ? ` § ${sourceSection}` : ""}
            </Text>
          ) : null}
          {rule.ttt_minutes ? (
            <Text style={styles.ttt}>TTT ≤ {rule.ttt_minutes} min</Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { ...typography.bodyStrong, color: colors.ink, flex: 1 },
  versionTag: { ...typography.caption, color: colors.inkMuted },
  list: { gap: spacing.sm },
  emptyCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  emptyText: { ...typography.body, color: colors.inkMuted },
  row: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: spacing.sm,
  },
  rowOpen: { borderColor: colors.primary },
  pressed: { opacity: 0.85 },
  rowHeader: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  ruleLabel: { ...typography.bodyStrong, color: colors.ink, flex: 1 },
  ruleId: { ...typography.caption, color: colors.inkMuted },
  rowBody: { gap: spacing.xs, paddingTop: spacing.xs },
  rationale: { ...typography.body, color: colors.ink, lineHeight: 22 },
  source: { ...typography.caption, color: colors.inkSoft },
  ttt: { ...typography.caption, color: colors.primary, fontWeight: "700" },
});
