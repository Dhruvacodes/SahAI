/**
 * "Disagree with this band?" sheet.
 *
 * Lets the ASHA worker record a structured override of the engine's risk
 * band — a controlled-vocab reason plus an optional free-text note. The
 * record is sent to ``/api/asha-override`` which logs it as an
 * ``ASHA_OVERRIDE`` audit event for later protocol-rule tuning.
 */

import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { postAshaOverride } from "../data/api";
import { useT } from "../i18n/useT";
import { colors, radius, spacing, typography } from "../theme";
import type { RiskLevel } from "../types";

type ReasonCode = "PATIENT_LOOKS_WELL" | "WORSE_THAN_DATA" | "OTHER";

interface Props {
  visitId: string;
  patientId: string;
  ashaId: string;
  engineLevel: RiskLevel;
  languageCode?: string;
}

const REASON_LABELS: Record<ReasonCode, "overrideReasonLow" | "overrideReasonHigh" | "overrideReasonOther"> = {
  PATIENT_LOOKS_WELL: "overrideReasonLow",
  WORSE_THAN_DATA: "overrideReasonHigh",
  OTHER: "overrideReasonOther",
};

export function OverrideButton({
  visitId,
  patientId,
  ashaId,
  engineLevel,
  languageCode,
}: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReasonCode | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await postAshaOverride({
        visitId,
        patientId,
        ashaId,
        engineLevel,
        proposedLevel:
          reason === "PATIENT_LOOKS_WELL"
            ? "LOW"
            : reason === "WORSE_THAN_DATA"
              ? "CRITICAL"
              : undefined,
        reasonCode: reason,
        note: note.trim() || undefined,
        languageCode,
      });
      setSubmitted(true);
    } catch {
      /* swallow — audit endpoint is best-effort, mobile is offline-tolerant */
    } finally {
      setSubmitting(false);
    }
  };

  const onClose = () => {
    setOpen(false);
    setReason(null);
    setNote("");
    setSubmitted(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>{t("overrideButton")}</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.title}>{t("overrideTitle")}</Text>
            <Text style={styles.hint}>{t("overrideHint")}</Text>

            {submitted ? (
              <View style={styles.successWrap}>
                <Text style={styles.successText}>{t("overrideSaved")}</Text>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.primaryBtnText}>{t("done")}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.reasonList}>
                  {(Object.keys(REASON_LABELS) as ReasonCode[]).map((code) => {
                    const labelKey = REASON_LABELS[code];
                    const selected = reason === code;
                    return (
                      <Pressable
                        key={code}
                        onPress={() => setReason(code)}
                        style={({ pressed }) => [
                          styles.reasonRow,
                          pressed && styles.pressed,
                          selected && styles.reasonRowSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.reasonText,
                            selected && styles.reasonTextSelected,
                          ]}
                        >
                          {t(labelKey)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {reason === "OTHER" ? (
                  <TextInput
                    multiline
                    placeholder={t("overrideHint")}
                    placeholderTextColor={colors.inkMuted}
                    value={note}
                    onChangeText={setNote}
                    style={styles.input}
                  />
                ) : null}
                <View style={styles.actions}>
                  <Pressable
                    onPress={onClose}
                    style={({ pressed }) => [
                      styles.secondaryBtn,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.secondaryBtnText}>{t("cancel")}</Text>
                  </Pressable>
                  <Pressable
                    onPress={onSubmit}
                    disabled={!reason || submitting}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      (!reason || submitting) && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.primaryBtnText}>
                      {submitting ? "…" : t("overrideSubmit")}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.paper,
  },
  buttonText: { ...typography.caption, color: colors.inkSoft },
  pressed: { opacity: 0.85 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(31, 41, 51, 0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.section, color: colors.ink },
  hint: { ...typography.body, color: colors.inkSoft },
  reasonList: { gap: spacing.sm },
  reasonRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.paper,
  },
  reasonRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  reasonText: { ...typography.body, color: colors.ink },
  reasonTextSelected: { color: colors.primaryDark, fontWeight: "700" },
  input: {
    minHeight: 80,
    padding: spacing.md,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    textAlignVertical: "top",
    color: colors.ink,
  },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  primaryBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  primaryBtnText: { ...typography.button, color: "#FFFFFF" },
  secondaryBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.paper,
    alignItems: "center",
  },
  secondaryBtnText: { ...typography.button, color: colors.ink },
  disabled: { opacity: 0.5 },
  successWrap: { alignItems: "center", gap: spacing.md },
  successText: { ...typography.body, color: colors.success },
});
