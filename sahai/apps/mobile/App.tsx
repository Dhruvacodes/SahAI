import { StatusBar } from "expo-status-bar";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Screen = "home" | "patients" | "analysis" | "history";
type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type Patient = {
  id: string;
  name: string;
  age: number;
  village: string;
  weeks: number;
  note: string;
  risk: RiskLevel;
};

type Visit = {
  id: string;
  patientName: string;
  village: string;
  risk: RiskLevel;
  summary: string;
  createdAt: string;
};

const PATIENTS: Patient[] = [
  {
    id: "p1",
    name: "Sunita Devi",
    age: 26,
    village: "Chandpur",
    weeks: 32,
    note: "BP 165/110, swelling, reduced fetal movement",
    risk: "CRITICAL",
  },
  {
    id: "p2",
    name: "Geeta Rani",
    age: 19,
    village: "Rampur",
    weeks: 28,
    note: "Low hemoglobin, fatigue, mild swelling",
    risk: "HIGH",
  },
  {
    id: "p3",
    name: "Kamala Devi",
    age: 30,
    village: "Sitapur",
    weeks: 22,
    note: "Routine antenatal review, stable vitals",
    risk: "LOW",
  },
];

const RISK_COPY: Record<RiskLevel, { score: number; summary: string; action: string }> = {
  LOW: {
    score: 18,
    summary: "Routine review with stable maternal status.",
    action: "Continue normal follow-up in 4 weeks.",
  },
  MEDIUM: {
    score: 44,
    summary: "Needs closer observation for developing risk factors.",
    action: "Repeat check within 7 days and inform ANM.",
  },
  HIGH: {
    score: 67,
    summary: "Important warning signs detected.",
    action: "Refer to PHC within 48 hours.",
  },
  CRITICAL: {
    score: 91,
    summary: "Emergency maternal risk detected.",
    action: "Immediate referral and urgent escalation.",
  },
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [savedVisits, setSavedVisits] = useState<Visit[]>([]);

  const todaysCount = savedVisits.length;
  const criticalCount = savedVisits.filter((visit) => visit.risk === "CRITICAL").length;

  const currentResult = useMemo(() => {
    if (!selectedPatient) return null;
    return RISK_COPY[selectedPatient.risk];
  }, [selectedPatient]);

  const saveCurrentVisit = () => {
    if (!selectedPatient || !currentResult) return;

    const visit: Visit = {
      id: `visit-${Date.now()}`,
      patientName: selectedPatient.name,
      village: selectedPatient.village,
      risk: selectedPatient.risk,
      summary: currentResult.summary,
      createdAt: new Date().toLocaleString(),
    };

    setSavedVisits((current) => [visit, ...current]);
    setScreen("history");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.shell}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.eyebrow}>SahAI Prototype</Text>
            <Text style={styles.heading}>ASHA helper demo</Text>
          </View>
          <Pressable style={styles.navButton} onPress={() => setScreen("home")}>
            <Text style={styles.navButtonText}>Home</Text>
          </Pressable>
        </View>

        {screen === "home" && (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.hero}>
              <Text style={styles.heroTitle}>Simple field workflow</Text>
              <Text style={styles.heroText}>
                This prototype runs fully with mock data. No backend, login, sync, or recording is
                required to demo it.
              </Text>
            </View>

            <View style={styles.statsRow}>
              <StatCard label="Visits today" value={String(todaysCount)} />
              <StatCard label="Critical" value={String(criticalCount)} tone="critical" />
            </View>

            <Pressable style={styles.primaryAction} onPress={() => setScreen("patients")}>
              <Text style={styles.primaryActionTitle}>Start New Visit</Text>
              <Text style={styles.primaryActionText}>Choose a demo patient and generate risk.</Text>
            </Pressable>

            <Pressable style={styles.secondaryAction} onPress={() => setScreen("history")}>
              <Text style={styles.secondaryActionTitle}>Open Saved Visits</Text>
              <Text style={styles.secondaryActionText}>Review the local demo history.</Text>
            </Pressable>
          </ScrollView>
        )}

        {screen === "patients" && (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.sectionTitle}>Demo patients</Text>
            {PATIENTS.map((patient) => (
              <Pressable
                key={patient.id}
                style={styles.patientCard}
                onPress={() => {
                  setSelectedPatient(patient);
                  setScreen("analysis");
                }}
              >
                <View style={styles.patientHeader}>
                  <Text style={styles.patientName}>{patient.name}</Text>
                  <RiskBadge level={patient.risk} />
                </View>
                <Text style={styles.patientMeta}>
                  {patient.age} years • {patient.weeks} weeks • {patient.village}
                </Text>
                <Text style={styles.patientNote}>{patient.note}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {screen === "analysis" && selectedPatient && currentResult && (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.analysisCard}>
              <Text style={styles.sectionTitle}>{selectedPatient.name}</Text>
              <Text style={styles.analysisMeta}>
                {selectedPatient.village} • {selectedPatient.weeks} weeks pregnant
              </Text>
              <View style={styles.scoreRow}>
                <RiskBadge level={selectedPatient.risk} large />
                <View>
                  <Text style={styles.scoreLabel}>Risk score</Text>
                  <Text style={styles.scoreValue}>{currentResult.score}</Text>
                </View>
              </View>
              <Text style={styles.summaryTitle}>Observed summary</Text>
              <Text style={styles.summaryText}>{selectedPatient.note}</Text>
              <Text style={styles.summaryTitle}>AI assessment</Text>
              <Text style={styles.summaryText}>{currentResult.summary}</Text>
              <Text style={styles.summaryTitle}>Recommended action</Text>
              <Text style={styles.summaryText}>{currentResult.action}</Text>
            </View>

            <Pressable style={styles.primaryAction} onPress={saveCurrentVisit}>
              <Text style={styles.primaryActionTitle}>Save Demo Visit</Text>
              <Text style={styles.primaryActionText}>Store this visit in the in-app mock history.</Text>
            </Pressable>

            <Pressable style={styles.secondaryAction} onPress={() => setScreen("patients")}>
              <Text style={styles.secondaryActionTitle}>Choose Another Patient</Text>
              <Text style={styles.secondaryActionText}>Go back to the patient list.</Text>
            </Pressable>
          </ScrollView>
        )}

        {screen === "history" && (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.sectionTitle}>Saved visits</Text>
            {savedVisits.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No visits saved yet</Text>
                <Text style={styles.emptyText}>Start a demo visit to populate this screen.</Text>
              </View>
            ) : (
              savedVisits.map((visit) => (
                <View key={visit.id} style={styles.historyCard}>
                  <View style={styles.patientHeader}>
                    <Text style={styles.patientName}>{visit.patientName}</Text>
                    <RiskBadge level={visit.risk} />
                  </View>
                  <Text style={styles.patientMeta}>{visit.village}</Text>
                  <Text style={styles.patientNote}>{visit.summary}</Text>
                  <Text style={styles.historyDate}>{visit.createdAt}</Text>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "critical";
}) {
  return (
    <View style={[styles.statCard, tone === "critical" && styles.statCardCritical]}>
      <Text style={[styles.statValue, tone === "critical" && styles.criticalText]}>{value}</Text>
      <Text style={[styles.statLabel, tone === "critical" && styles.criticalText]}>{label}</Text>
    </View>
  );
}

function RiskBadge({ level, large }: { level: RiskLevel; large?: boolean }) {
  const badgeStyle =
    level === "CRITICAL"
      ? styles.badgeCritical
      : level === "HIGH"
        ? styles.badgeHigh
        : level === "MEDIUM"
          ? styles.badgeMedium
          : styles.badgeLow;

  return (
    <View style={[styles.badgeBase, badgeStyle, large && styles.badgeLarge]}>
      <Text style={[styles.badgeText, large && styles.badgeTextLarge]}>{level}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5efe3",
  },
  shell: {
    flex: 1,
    backgroundColor: "#f5efe3",
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },
  eyebrow: {
    color: "#9d5a19",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  heading: {
    color: "#24160b",
    fontSize: 26,
    fontWeight: "800",
    marginTop: 2,
  },
  navButton: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  navButtonText: {
    color: "#24160b",
    fontSize: 13,
    fontWeight: "700",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  hero: {
    backgroundColor: "#24160b",
    borderRadius: 20,
    padding: 20,
  },
  heroTitle: {
    color: "#fff8ef",
    fontSize: 28,
    fontWeight: "800",
  },
  heroText: {
    color: "#e8dcca",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  statCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    flex: 1,
    padding: 16,
  },
  statCardCritical: {
    backgroundColor: "#fde8e7",
  },
  statValue: {
    color: "#24160b",
    fontSize: 26,
    fontWeight: "800",
  },
  statLabel: {
    color: "#6f5947",
    fontSize: 13,
    marginTop: 4,
  },
  criticalText: {
    color: "#b7352f",
  },
  primaryAction: {
    backgroundColor: "#d96f1f",
    borderRadius: 18,
    marginTop: 18,
    padding: 18,
  },
  primaryActionTitle: {
    color: "#fffaf4",
    fontSize: 20,
    fontWeight: "800",
  },
  primaryActionText: {
    color: "#fff0de",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  secondaryAction: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    marginTop: 12,
    padding: 18,
  },
  secondaryActionTitle: {
    color: "#24160b",
    fontSize: 18,
    fontWeight: "800",
  },
  secondaryActionText: {
    color: "#6f5947",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  sectionTitle: {
    color: "#24160b",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 14,
  },
  patientCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    marginBottom: 12,
    padding: 16,
  },
  patientHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  patientName: {
    color: "#24160b",
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    marginRight: 12,
  },
  patientMeta: {
    color: "#6f5947",
    fontSize: 13,
    marginTop: 6,
  },
  patientNote: {
    color: "#35261a",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 10,
  },
  badgeBase: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeLarge: {
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  badgeCritical: {
    backgroundColor: "#fdd9d7",
  },
  badgeHigh: {
    backgroundColor: "#ffe4c4",
  },
  badgeMedium: {
    backgroundColor: "#dcecff",
  },
  badgeLow: {
    backgroundColor: "#dcf6e8",
  },
  badgeText: {
    color: "#24160b",
    fontSize: 11,
    fontWeight: "800",
  },
  badgeTextLarge: {
    fontSize: 13,
  },
  analysisCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
  },
  analysisMeta: {
    color: "#6f5947",
    fontSize: 14,
    marginTop: -4,
  },
  scoreRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    marginTop: 18,
    marginBottom: 10,
  },
  scoreLabel: {
    color: "#6f5947",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  scoreValue: {
    color: "#24160b",
    fontSize: 40,
    fontWeight: "800",
    marginTop: 2,
  },
  summaryTitle: {
    color: "#24160b",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 16,
    textTransform: "uppercase",
  },
  summaryText: {
    color: "#35261a",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  emptyState: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 20,
  },
  emptyTitle: {
    color: "#24160b",
    fontSize: 20,
    fontWeight: "800",
  },
  emptyText: {
    color: "#6f5947",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  historyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    marginBottom: 12,
    padding: 16,
  },
  historyDate: {
    color: "#8b7563",
    fontSize: 12,
    marginTop: 10,
  },
});
