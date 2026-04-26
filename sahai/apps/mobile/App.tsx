import { StatusBar } from "expo-status-bar";
import * as Speech from "expo-speech";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Screen = "consent" | "visit" | "results" | "privacy";
type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type Language = {
  code: string;
  name: string;
  nativeName: string;
  ttsLocale: string;
  readback: string;
};

type Patient = {
  id: string;
  name: string;
  age: number;
  village: string;
  weeks: number;
  transcript: string;
  risk: RiskLevel;
};

const CONSENT_VERSION = "sahai-consent-v1";
const MODEL_LABEL = "Claude Sonnet 4.6";
const ESTIMATED_VISIT_COST_USD = "$0.025";

const DATA_SCOPES = [
  "transcription",
  "ai_extraction",
  "risk_assessment",
  "referral_generation",
  "same_language_readback",
];

const LANGUAGES: Language[] = [
  {
    code: "as",
    name: "Assamese",
    nativeName: "Assamese",
    ttsLocale: "as-IN",
    readback: "এতিয়াই PHC লৈ যাওক। 108 লৈ ফোন কৰক।",
  },
  {
    code: "bn",
    name: "Bengali",
    nativeName: "Bangla",
    ttsLocale: "bn-IN",
    readback: "তৎক্ষণাৎ PHC-তে যান। ১০৮-এ কল করুন।",
  },
  {
    code: "brx",
    name: "Bodo",
    nativeName: "Bodo",
    ttsLocale: "brx-IN",
    readback: "Daow PHC sim thang. 108 ao call khalam.",
  },
  {
    code: "doi",
    name: "Dogri",
    nativeName: "Dogri",
    ttsLocale: "doi-IN",
    readback: "Hune PHC jao. 108 te phone karo.",
  },
  {
    code: "gu",
    name: "Gujarati",
    nativeName: "Gujarati",
    ttsLocale: "gu-IN",
    readback: "તાત્કાલિક PHC પર જાઓ. 108 પર કૉલ કરો.",
  },
  {
    code: "hi",
    name: "Hindi",
    nativeName: "Hindi",
    ttsLocale: "hi-IN",
    readback: "तुरंत PHC जाएं। 108 पर कॉल करें।",
  },
  {
    code: "kn",
    name: "Kannada",
    nativeName: "Kannada",
    ttsLocale: "kn-IN",
    readback: "ತಕ್ಷಣ PHC ಗೆ ಹೋಗಿ. 108 ಗೆ ಕರೆ ಮಾಡಿ.",
  },
  {
    code: "ks",
    name: "Kashmiri",
    nativeName: "Kashmiri",
    ttsLocale: "ks-IN",
    readback: "Foran PHC gav. 108 pyeth call kariv.",
  },
  {
    code: "kok",
    name: "Konkani",
    nativeName: "Konkani",
    ttsLocale: "kok-IN",
    readback: "Rokdech PHC-ak vos. 108-ak call kor.",
  },
  {
    code: "mai",
    name: "Maithili",
    nativeName: "Maithili",
    ttsLocale: "mai-IN",
    readback: "तुरंत PHC जाउ। 108 पर फोन करू।",
  },
  {
    code: "ml",
    name: "Malayalam",
    nativeName: "Malayalam",
    ttsLocale: "ml-IN",
    readback: "ഉടൻ PHCയിലേക്ക് പോകുക. 108-ൽ വിളിക്കുക.",
  },
  {
    code: "mni",
    name: "Manipuri",
    nativeName: "Manipuri",
    ttsLocale: "mni-IN",
    readback: "Thuna PHC-da chatlu. 108-da call tou.",
  },
  {
    code: "mr",
    name: "Marathi",
    nativeName: "Marathi",
    ttsLocale: "mr-IN",
    readback: "ताबडतोब PHC ला जा. 108 वर कॉल करा.",
  },
  {
    code: "ne",
    name: "Nepali",
    nativeName: "Nepali",
    ttsLocale: "ne-IN",
    readback: "तुरुन्त PHC जानुहोस्। 108 मा फोन गर्नुहोस्।",
  },
  {
    code: "or",
    name: "Odia",
    nativeName: "Odia",
    ttsLocale: "or-IN",
    readback: "ତୁରନ୍ତ PHC କୁ ଯାଆନ୍ତୁ। 108 କୁ ଫୋନ କରନ୍ତୁ।",
  },
  {
    code: "pa",
    name: "Punjabi",
    nativeName: "Punjabi",
    ttsLocale: "pa-IN",
    readback: "ਤੁਰੰਤ PHC ਜਾਓ। 108 ਤੇ ਕਾਲ ਕਰੋ।",
  },
  {
    code: "sa",
    name: "Sanskrit",
    nativeName: "Sanskrit",
    ttsLocale: "sa-IN",
    readback: "शीघ्रं PHC गच्छतु। 108 इति दूरवाणीं कुरुत।",
  },
  {
    code: "sat",
    name: "Santali",
    nativeName: "Santali",
    ttsLocale: "sat-IN",
    readback: "Nitok PHC te senok. 108 re phone me.",
  },
  {
    code: "sd",
    name: "Sindhi",
    nativeName: "Sindhi",
    ttsLocale: "sd-IN",
    readback: "فوري PHC وڃو. 108 تي ڪال ڪريو.",
  },
  {
    code: "ta",
    name: "Tamil",
    nativeName: "Tamil",
    ttsLocale: "ta-IN",
    readback: "உடனே PHC-க்கு செல்லவும். 108-க்கு அழைக்கவும்.",
  },
  {
    code: "te",
    name: "Telugu",
    nativeName: "Telugu",
    ttsLocale: "te-IN",
    readback: "వెంటనే PHCకి వెళ్లండి. 108కి కాల్ చేయండి.",
  },
  {
    code: "ur",
    name: "Urdu",
    nativeName: "Urdu",
    ttsLocale: "ur-IN",
    readback: "فوراً PHC جائیں۔ 108 پر کال کریں۔",
  },
];

const PATIENTS: Patient[] = [
  {
    id: "p1",
    name: "Sunita Devi",
    age: 26,
    village: "Chandpur",
    weeks: 32,
    transcript:
      "BP 165/110 hai. Pair aur haath mein sujan hai. Do din se bacche ki harkat kam hai.",
    risk: "CRITICAL",
  },
  {
    id: "p2",
    name: "Geeta Rani",
    age: 19,
    village: "Rampur",
    weeks: 28,
    transcript: "Hemoglobin 8.4 hai. Thakan hai, chakkar aate hain, halka sujan hai.",
    risk: "HIGH",
  },
  {
    id: "p3",
    name: "Kamala Devi",
    age: 30,
    village: "Sitapur",
    weeks: 22,
    transcript: "Routine ANC visit. BP 118/76 hai. Bukhar nahi hai. Koi sujan nahi.",
    risk: "LOW",
  },
];

const RISK_COPY: Record<
  RiskLevel,
  { score: number; summary: string; action: string; color: string; background: string }
> = {
  LOW: {
    score: 18,
    summary: "Stable routine antenatal visit.",
    action: "Routine follow-up in 4 weeks.",
    color: "#146c43",
    background: "#e7f7ef",
  },
  MEDIUM: {
    score: 44,
    summary: "Developing risk factors need closer observation.",
    action: "Repeat check within 7 days and inform ANM.",
    color: "#8a5a00",
    background: "#fff2cc",
  },
  HIGH: {
    score: 67,
    summary: "Important warning signs detected.",
    action: "Refer to PHC within 48 hours.",
    color: "#9a3412",
    background: "#ffedd5",
  },
  CRITICAL: {
    score: 91,
    summary: "Emergency maternal risk detected.",
    action: "Immediate referral. Call 108.",
    color: "#b91c1c",
    background: "#fee2e2",
  },
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("consent");
  const [languageCode, setLanguageCode] = useState("hi");
  const [selectedPatientId, setSelectedPatientId] = useState(PATIENTS[0].id);
  const [transcript, setTranscript] = useState(PATIENTS[0].transcript);
  const [consentGiven, setConsentGiven] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [approvedScopes, setApprovedScopes] = useState(DATA_SCOPES);

  const language = useMemo(
    () => LANGUAGES.find((item) => item.code === languageCode) ?? LANGUAGES[5],
    [languageCode],
  );
  const selectedPatient = useMemo(
    () => PATIENTS.find((patient) => patient.id === selectedPatientId) ?? PATIENTS[0],
    [selectedPatientId],
  );
  const risk = RISK_COPY[selectedPatient.risk];
  const consentReady =
    consentGiven &&
    privacyAccepted &&
    DATA_SCOPES.every((scope) => approvedScopes.includes(scope));

  const choosePatient = (patient: Patient) => {
    setSelectedPatientId(patient.id);
    setTranscript(patient.transcript);
  };

  const toggleScope = (scope: string) => {
    setApprovedScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    );
  };

  const startAnalysis = () => {
    if (!consentReady) {
      setScreen("consent");
      return;
    }

    setScreen("results");
  };

  const speakReadback = () => {
    Speech.stop();
    Speech.speak(language.readback, {
      language: language.ttsLocale,
      rate: 0.9,
      pitch: 1,
    });
  };

  const withdrawConsent = () => {
    Speech.stop();
    setConsentGiven(false);
    setPrivacyAccepted(false);
    setApprovedScopes([]);
    setScreen("consent");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.appShell}>
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.eyebrow}>SahAI field console</Text>
            <Text style={styles.title}>Consent-led visit</Text>
          </View>
          <View style={[styles.statusPill, consentReady ? styles.statusReady : styles.statusHold]}>
            <Text style={styles.statusText}>{consentReady ? "Consent live" : "Consent needed"}</Text>
          </View>
        </View>

        <View style={styles.tabs}>
          {(["consent", "visit", "results", "privacy"] as Screen[]).map((tab) => (
            <Pressable
              key={tab}
              style={[styles.tab, screen === tab && styles.tabActive]}
              onPress={() => setScreen(tab)}
            >
              <Text style={[styles.tabText, screen === tab && styles.tabTextActive]}>
                {tab[0].toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {screen === "consent" && (
          <ScrollView contentContainerStyle={styles.content}>
            <Section title="Language">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.languageRow}>
                  {LANGUAGES.map((item) => (
                    <Pressable
                      key={item.code}
                      style={[styles.languageChip, item.code === languageCode && styles.chipActive]}
                      onPress={() => setLanguageCode(item.code)}
                    >
                      <Text
                        style={[styles.languageCode, item.code === languageCode && styles.chipTextActive]}
                      >
                        {item.code.toUpperCase()}
                      </Text>
                      <Text
                        style={[styles.languageName, item.code === languageCode && styles.chipTextActive]}
                      >
                        {item.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
              <Text style={styles.helperText}>
                {LANGUAGES.length} Indian languages configured. Readback is set to {language.name}.
              </Text>
            </Section>

            <Section title="Patient Consent">
              <ConsentToggle
                label="Patient agreed to AI-assisted visit processing"
                value={consentGiven}
                onPress={() => setConsentGiven((current) => !current)}
              />
              <ConsentToggle
                label="Privacy notice explained in the selected language"
                value={privacyAccepted}
                onPress={() => setPrivacyAccepted((current) => !current)}
              />
              <View style={styles.scopeGrid}>
                {DATA_SCOPES.map((scope) => (
                  <Pressable
                    key={scope}
                    style={[styles.scopeChip, approvedScopes.includes(scope) && styles.scopeChipActive]}
                    onPress={() => toggleScope(scope)}
                  >
                    <Text
                      style={[
                        styles.scopeText,
                        approvedScopes.includes(scope) && styles.scopeTextActive,
                      ]}
                    >
                      {scope.replace(/_/g, " ")}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Section>

            <Section title="Consent Receipt">
              <InfoRow label="Version" value={CONSENT_VERSION} />
              <InfoRow label="Language" value={`${language.name} (${language.code})`} />
              <InfoRow label="Raw audio" value="Not stored by default" />
              <InfoRow label="Withdrawal" value="Available before sync" />
            </Section>

            <PrimaryButton
              label="Continue To Visit"
              disabled={!consentReady}
              onPress={() => setScreen("visit")}
            />
          </ScrollView>
        )}

        {screen === "visit" && (
          <ScrollView contentContainerStyle={styles.content}>
            <Section title="Patient">
              {PATIENTS.map((patient) => (
                <Pressable
                  key={patient.id}
                  style={[
                    styles.patientRow,
                    selectedPatientId === patient.id && styles.patientRowActive,
                  ]}
                  onPress={() => choosePatient(patient)}
                >
                  <View style={styles.patientCopy}>
                    <Text style={styles.patientName}>{patient.name}</Text>
                    <Text style={styles.patientMeta}>
                      {patient.age} years | {patient.weeks} weeks | {patient.village}
                    </Text>
                  </View>
                  <RiskBadge level={patient.risk} />
                </Pressable>
              ))}
            </Section>

            <Section title="Transcript">
              <TextInput
                multiline
                value={transcript}
                onChangeText={setTranscript}
                style={styles.transcriptInput}
                textAlignVertical="top"
              />
            </Section>

            <Section title="Guards">
              <InfoRow label="Consent" value={consentReady ? "Ready" : "Blocked"} />
              <InfoRow label="Prompt injection" value="Transcript treated as data" />
              <InfoRow label="Clinical risk" value="Rule-based after extraction" />
            </Section>

            <PrimaryButton label="Analyze Visit" disabled={!consentReady} onPress={startAnalysis} />
          </ScrollView>
        )}

        {screen === "results" && (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={[styles.resultBand, { backgroundColor: risk.background }]}>
              <View style={styles.resultHeader}>
                <View>
                  <Text style={styles.resultLabel}>Risk score</Text>
                  <Text style={[styles.resultScore, { color: risk.color }]}>{risk.score}</Text>
                </View>
                <RiskBadge level={selectedPatient.risk} large />
              </View>
              <Text style={styles.resultSummary}>{risk.summary}</Text>
              <Text style={styles.resultAction}>{risk.action}</Text>
            </View>

            <Section title="Same-Language Readback">
              <Text style={styles.readbackText}>{language.readback}</Text>
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={speakReadback}>
                  <Text style={styles.smallButtonText}>Read Back</Text>
                </Pressable>
                <Pressable style={styles.smallButtonSecondary} onPress={() => Speech.stop()}>
                  <Text style={styles.smallButtonSecondaryText}>Stop</Text>
                </Pressable>
              </View>
            </Section>

            <Section title="Inference Cost">
              <InfoRow label="Model" value={MODEL_LABEL} />
              <InfoRow label="Visit estimate" value={ESTIMATED_VISIT_COST_USD} />
              <InfoRow label="Why this model" value="Safer multilingual JSON and referral quality" />
            </Section>
          </ScrollView>
        )}

        {screen === "privacy" && (
          <ScrollView contentContainerStyle={styles.content}>
            <Section title="Privacy Posture">
              <InfoRow label="Consent first" value={consentReady ? "Active" : "Needed"} />
              <InfoRow label="Data minimization" value="Transcript and vitals only" />
              <InfoRow label="Patient rights" value="Access, correction, erasure, grievance" />
              <InfoRow label="Emergency care" value="In-person referral remains primary" />
            </Section>

            <Section title="Government Protocol Checks">
              <InfoRow label="DPDP" value="Purpose, consent, withdrawal, safeguards" />
              <InfoRow label="ABDM" value="Consent-based sharing, no third-party transfer" />
              <InfoRow label="Telemedicine" value="Identity, consent, records, referral" />
            </Section>

            <Pressable style={styles.dangerButton} onPress={withdrawConsent}>
              <Text style={styles.dangerButtonText}>Withdraw Consent</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ConsentToggle({
  label,
  value,
  onPress,
}: {
  label: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.toggleRow} onPress={onPress}>
      <View style={[styles.checkbox, value && styles.checkboxChecked]}>
        <Text style={styles.checkboxText}>{value ? "✓" : ""}</Text>
      </View>
      <Text style={styles.toggleLabel}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function PrimaryButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.primaryButton, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.primaryButtonText, disabled && styles.buttonDisabledText]}>{label}</Text>
    </Pressable>
  );
}

function RiskBadge({ level, large }: { level: RiskLevel; large?: boolean }) {
  const risk = RISK_COPY[level];
  return (
    <View
      style={[
        styles.riskBadge,
        large && styles.riskBadgeLarge,
        { backgroundColor: risk.background, borderColor: risk.color },
      ]}
    >
      <Text style={[styles.riskBadgeText, large && styles.riskBadgeTextLarge, { color: risk.color }]}>
        {level}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  appShell: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerTitleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  eyebrow: {
    color: "#0f766e",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 2,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusReady: {
    backgroundColor: "#dcfce7",
  },
  statusHold: {
    backgroundColor: "#fee2e2",
  },
  statusText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "800",
  },
  tabs: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  tab: {
    alignItems: "center",
    backgroundColor: "#e2e8f0",
    borderRadius: 8,
    flex: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  tabActive: {
    backgroundColor: "#0f172a",
  },
  tabText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
  },
  tabTextActive: {
    color: "#ffffff",
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  section: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 12,
  },
  languageRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 16,
  },
  languageChip: {
    backgroundColor: "#f1f5f9",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 90,
    padding: 10,
  },
  chipActive: {
    backgroundColor: "#0f766e",
    borderColor: "#0f766e",
  },
  languageCode: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "900",
  },
  languageName: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  chipTextActive: {
    color: "#ffffff",
  },
  helperText: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  toggleRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 10,
  },
  checkbox: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#94a3b8",
    borderRadius: 6,
    borderWidth: 2,
    height: 24,
    justifyContent: "center",
    marginRight: 10,
    width: 24,
  },
  checkboxChecked: {
    backgroundColor: "#0f766e",
    borderColor: "#0f766e",
  },
  checkboxText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  toggleLabel: {
    color: "#0f172a",
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  scopeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  scopeChip: {
    backgroundColor: "#f1f5f9",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  scopeChipActive: {
    backgroundColor: "#e0f2fe",
    borderColor: "#0284c7",
  },
  scopeText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
  },
  scopeTextActive: {
    color: "#075985",
  },
  infoRow: {
    alignItems: "flex-start",
    borderTopColor: "#e2e8f0",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
  },
  infoLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "800",
    width: 108,
  },
  infoValue: {
    color: "#0f172a",
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#0f766e",
    borderRadius: 8,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  buttonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  buttonDisabledText: {
    color: "#64748b",
  },
  patientRow: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 8,
    padding: 12,
  },
  patientRowActive: {
    borderColor: "#0f766e",
  },
  patientCopy: {
    flex: 1,
    paddingRight: 10,
  },
  patientName: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "900",
  },
  patientMeta: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 3,
  },
  transcriptInput: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 22,
    minHeight: 130,
    padding: 12,
  },
  resultBand: {
    borderRadius: 8,
    marginBottom: 12,
    padding: 16,
  },
  resultHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  resultLabel: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  resultScore: {
    fontSize: 48,
    fontWeight: "900",
    marginTop: 2,
  },
  resultSummary: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
    marginTop: 8,
  },
  resultAction: {
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  riskBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  riskBadgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  riskBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },
  riskBadgeTextLarge: {
    fontSize: 13,
  },
  readbackText: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 30,
  },
  inlineActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  smallButton: {
    alignItems: "center",
    backgroundColor: "#0f766e",
    borderRadius: 8,
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  smallButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  smallButtonSecondary: {
    alignItems: "center",
    backgroundColor: "#e2e8f0",
    borderRadius: 8,
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  smallButtonSecondaryText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "900",
  },
  dangerButton: {
    alignItems: "center",
    backgroundColor: "#fee2e2",
    borderColor: "#ef4444",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 50,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  dangerButtonText: {
    color: "#991b1b",
    fontSize: 15,
    fontWeight: "900",
  },
});
