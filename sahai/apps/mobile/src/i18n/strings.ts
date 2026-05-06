/**
 * UI strings for SahAI.
 *
 * v1 ships with Hindi (default) and English (fallback). ASR/TTS supports the
 * other 20 Indian languages today; their UI strings are added incrementally.
 *
 * Keep keys flat and short. Comments above each group describe the surface.
 */

export type StringKey =
  // App-wide
  | "appName"
  | "tagline"
  | "back"
  | "cancel"
  | "save"
  | "saved"
  | "retry"
  | "next"
  | "done"
  | "yes"
  | "no"
  | "agree"
  | "settings"
  // Onboarding
  | "welcomeTitle"
  | "welcomeSubtitle"
  | "chooseLanguage"
  | "consentTitle"
  | "consentBody"
  | "consentAgreeBig"
  | "ashaNameTitle"
  | "ashaNamePlaceholder"
  | "ashaIdPlaceholder"
  | "ashaSubmit"
  // Home
  | "homeGreetingMorning"
  | "homeGreetingAfternoon"
  | "homeGreetingEvening"
  | "homeMicLabel"
  | "homeMicHint"
  | "homeNewPatient"
  | "homeRecentPatients"
  | "homeNoPatients"
  | "syncOnline"
  | "syncOffline"
  | "syncPending"
  // Patient picker
  | "pickerTitle"
  | "pickerSubtitle"
  | "pickerNew"
  | "pickerSearch"
  | "pickerEmpty"
  // Recording
  | "recordingPrompt"
  | "recordingSpeak"
  | "recordingTapStop"
  | "recordingProcessing"
  | "recordingMicDenied"
  | "recordingMicDeniedHelp"
  | "recordingError"
  // Visit summary
  | "summaryTitle"
  | "summaryRiskLow"
  | "summaryRiskModerate"
  | "summaryRiskHigh"
  | "summaryRiskCritical"
  | "summaryRiskLowAction"
  | "summaryRiskModerateAction"
  | "summaryRiskHighAction"
  | "summaryRiskCriticalAction"
  | "summaryReadback"
  | "summaryRepeatReadback"
  | "summaryStop"
  | "summaryVitals"
  | "summarySymptoms"
  | "summaryNoVitals"
  | "summaryNoSymptoms"
  | "summaryGenerateReferral"
  | "summarySaveVisit"
  | "summaryUnclearTitle"
  | "summaryUnclearBody"
  | "summaryRetryRecord"
  | "summaryCall108"
  // Vitals labels
  | "vitalBP"
  | "vitalHR"
  | "vitalSpO2"
  | "vitalTemp"
  | "vitalWeight"
  | "vitalHb"
  | "vitalMUAC"
  | "vitalRR"
  // Referral
  | "referralTitle"
  | "referralFor"
  | "referralFacility"
  | "referralFollowUp"
  | "referralFirstActions"
  | "referralShare"
  | "referralBack"
  // Patient profile
  | "profileVisits"
  | "profileNoVisits"
  | "profileNewVisit"
  | "profileEdit"
  | "profileAge"
  | "profileVillage"
  | "profilePhone"
  | "profilePregnancy"
  | "profileWeeks"
  // Settings
  | "settingsLanguage"
  | "settingsSyncNow"
  | "settingsSignOut"
  | "settingsAbout"
  | "settingsWithdraw"
  | "settingsBackend"
  // New patient prompt
  | "newPatientName"
  | "newPatientAge"
  | "newPatientVillage"
  | "newPatientPhone"
  | "newPatientPregnant"
  | "newPatientWeeks"
  | "newPatientCreate"
  | "newPatientSpeakAll"
  // Errors
  | "errorNetwork"
  | "errorTryAgain";

type Strings = Record<StringKey, string>;

const hi: Strings = {
  appName: "SahAI",
  tagline: "आपकी सहायक",
  back: "वापस",
  cancel: "रद्द करें",
  save: "सहेजें",
  saved: "सहेज लिया गया",
  retry: "फिर से कोशिश करें",
  next: "आगे",
  done: "हो गया",
  yes: "हाँ",
  no: "नहीं",
  agree: "मैं सहमत हूँ",
  settings: "सेटिंग्स",

  welcomeTitle: "नमस्ते",
  welcomeSubtitle: "SahAI में आपका स्वागत है। चलिए शुरू करते हैं।",
  chooseLanguage: "अपनी भाषा चुनिए",
  consentTitle: "एक छोटी सी बात",
  consentBody:
    "SahAI आपके दौरों को आवाज़ से समझता है, जोखिम पहचानता है, और आपको रेफरल बनाने में मदद करता है। मरीज़ की सहमति के बिना कोई जानकारी सहेजी या भेजी नहीं जाती। कच्ची आवाज़ संग्रहीत नहीं होती।",
  consentAgreeBig: "मैं समझ गई हूँ। शुरू करें।",
  ashaNameTitle: "आपका नाम क्या है?",
  ashaNamePlaceholder: "जैसे: सावित्री देवी",
  ashaIdPlaceholder: "ASHA ID (वैकल्पिक)",
  ashaSubmit: "तैयार हैं",

  homeGreetingMorning: "सुप्रभात",
  homeGreetingAfternoon: "नमस्ते",
  homeGreetingEvening: "शुभ संध्या",
  homeMicLabel: "बोलें",
  homeMicHint: "नया दौरा शुरू करने के लिए दबाएँ",
  homeNewPatient: "नया मरीज़",
  homeRecentPatients: "हाल के मरीज़",
  homeNoPatients: "अभी तक कोई मरीज़ नहीं। ‘नया मरीज़’ दबाकर शुरू करें।",
  syncOnline: "ऑनलाइन",
  syncOffline: "ऑफलाइन",
  syncPending: "{count} भेजने बाक़ी",

  pickerTitle: "किसके लिए?",
  pickerSubtitle: "मरीज़ चुनें या नया जोड़ें",
  pickerNew: "+ नया मरीज़",
  pickerSearch: "नाम या गाँव खोजें",
  pickerEmpty: "कोई मरीज़ नहीं मिला",

  recordingPrompt: "बोलिए",
  recordingSpeak: "मरीज़ की हालत बताएँ",
  recordingTapStop: "रोकने के लिए दबाएँ",
  recordingProcessing: "समझ रही हूँ…",
  recordingMicDenied: "माइक्रोफोन की अनुमति चाहिए",
  recordingMicDeniedHelp:
    "सेटिंग्स में जाकर SahAI को माइक्रोफोन की अनुमति दीजिए।",
  recordingError: "रिकॉर्डिंग में गड़बड़ी हुई। फिर से कोशिश करें।",

  summaryTitle: "दौरे का सार",
  summaryRiskLow: "ठीक है",
  summaryRiskModerate: "ध्यान रखें",
  summaryRiskHigh: "जल्दी डॉक्टर को दिखाएँ",
  summaryRiskCritical: "तुरंत अस्पताल भेजें",
  summaryRiskLowAction: "नियमित जाँच जारी रखें।",
  summaryRiskModerateAction: "एक हफ़्ते में फिर जाँच करें।",
  summaryRiskHighAction: "48 घंटे में PHC ले जाएँ।",
  summaryRiskCriticalAction: "108 पर कॉल करें। तुरंत PHC ले जाएँ।",
  summaryReadback: "मैंने यह सुना",
  summaryRepeatReadback: "फिर से सुनें",
  summaryStop: "रोकें",
  summaryVitals: "जांच के नंबर",
  summarySymptoms: "लक्षण",
  summaryNoVitals: "कोई वाइटल्स नहीं मिले",
  summaryNoSymptoms: "कोई लक्षण नहीं बताए गए",
  summaryGenerateReferral: "रेफरल बनाएँ",
  summarySaveVisit: "सहेजें",
  summaryUnclearTitle: "मैं ठीक से नहीं समझ पाई",
  summaryUnclearBody: "कृपया फिर से रिकॉर्ड करें।",
  summaryRetryRecord: "फिर से रिकॉर्ड करें",
  summaryCall108: "108 कॉल करें",

  vitalBP: "BP",
  vitalHR: "धड़कन",
  vitalSpO2: "SpO₂",
  vitalTemp: "बुखार",
  vitalWeight: "वज़न",
  vitalHb: "हीमोग्लोबिन",
  vitalMUAC: "MUAC",
  vitalRR: "साँस",

  referralTitle: "रेफरल",
  referralFor: "के लिए",
  referralFacility: "कहाँ भेजें",
  referralFollowUp: "अगली जाँच",
  referralFirstActions: "पहले ये करें",
  referralShare: "साझा करें",
  referralBack: "वापस",

  profileVisits: "पिछले दौरे",
  profileNoVisits: "अभी तक कोई दौरा नहीं",
  profileNewVisit: "+ नया दौरा",
  profileEdit: "बदलें",
  profileAge: "उम्र",
  profileVillage: "गाँव",
  profilePhone: "फ़ोन",
  profilePregnancy: "गर्भवती",
  profileWeeks: "हफ्ते",

  settingsLanguage: "भाषा",
  settingsSyncNow: "अभी सिंक करें",
  settingsSignOut: "साइन आउट",
  settingsAbout: "SahAI के बारे में",
  settingsWithdraw: "सहमति वापस लें",
  settingsBackend: "सर्वर पता",

  newPatientName: "मरीज़ का नाम",
  newPatientAge: "उम्र",
  newPatientVillage: "गाँव",
  newPatientPhone: "फ़ोन",
  newPatientPregnant: "गर्भवती?",
  newPatientWeeks: "कितने हफ्ते",
  newPatientCreate: "मरीज़ जोड़ें",
  newPatientSpeakAll:
    "मरीज़ का नाम, उम्र, गाँव, और हालत एक साथ बोलिए।",

  errorNetwork: "इंटरनेट से नहीं जुड़ पा रही। ऑफ़लाइन सहेजा गया।",
  errorTryAgain: "कुछ गड़बड़ हुई। फिर से कोशिश करें।",
};

const en: Strings = {
  appName: "SahAI",
  tagline: "Your assistant",
  back: "Back",
  cancel: "Cancel",
  save: "Save",
  saved: "Saved",
  retry: "Try again",
  next: "Next",
  done: "Done",
  yes: "Yes",
  no: "No",
  agree: "I agree",
  settings: "Settings",

  welcomeTitle: "Namaste",
  welcomeSubtitle: "Welcome to SahAI. Let's begin.",
  chooseLanguage: "Choose your language",
  consentTitle: "One small thing",
  consentBody:
    "SahAI listens to your visits in your voice, flags risks, and helps you write referrals. Nothing is saved or sent without the patient's consent. Raw audio is never stored.",
  consentAgreeBig: "I understand. Let's start.",
  ashaNameTitle: "What is your name?",
  ashaNamePlaceholder: "e.g. Savitri Devi",
  ashaIdPlaceholder: "ASHA ID (optional)",
  ashaSubmit: "Ready",

  homeGreetingMorning: "Good morning",
  homeGreetingAfternoon: "Namaste",
  homeGreetingEvening: "Good evening",
  homeMicLabel: "Speak",
  homeMicHint: "Tap to start a new visit",
  homeNewPatient: "New patient",
  homeRecentPatients: "Recent patients",
  homeNoPatients: "No patients yet. Tap 'New patient' to begin.",
  syncOnline: "Online",
  syncOffline: "Offline",
  syncPending: "{count} to send",

  pickerTitle: "Who is this for?",
  pickerSubtitle: "Pick a patient or add a new one",
  pickerNew: "+ New patient",
  pickerSearch: "Search by name or village",
  pickerEmpty: "No patients found",

  recordingPrompt: "Speak now",
  recordingSpeak: "Tell me about the patient",
  recordingTapStop: "Tap to stop",
  recordingProcessing: "Listening…",
  recordingMicDenied: "Microphone permission needed",
  recordingMicDeniedHelp: "Please allow SahAI to use the microphone in Settings.",
  recordingError: "Recording failed. Please try again.",

  summaryTitle: "Visit summary",
  summaryRiskLow: "All is well",
  summaryRiskModerate: "Watch closely",
  summaryRiskHigh: "See a doctor soon",
  summaryRiskCritical: "Refer to hospital now",
  summaryRiskLowAction: "Continue routine care.",
  summaryRiskModerateAction: "Recheck within a week.",
  summaryRiskHighAction: "Take to PHC within 48 hours.",
  summaryRiskCriticalAction: "Call 108. Take to PHC immediately.",
  summaryReadback: "What I heard",
  summaryRepeatReadback: "Listen again",
  summaryStop: "Stop",
  summaryVitals: "Readings",
  summarySymptoms: "Symptoms",
  summaryNoVitals: "No vitals captured",
  summaryNoSymptoms: "No symptoms reported",
  summaryGenerateReferral: "Create referral",
  summarySaveVisit: "Save visit",
  summaryUnclearTitle: "I couldn't hear that clearly",
  summaryUnclearBody: "Please record the visit again.",
  summaryRetryRecord: "Record again",
  summaryCall108: "Call 108",

  vitalBP: "BP",
  vitalHR: "Pulse",
  vitalSpO2: "SpO₂",
  vitalTemp: "Temp",
  vitalWeight: "Weight",
  vitalHb: "Hb",
  vitalMUAC: "MUAC",
  vitalRR: "Resp",

  referralTitle: "Referral",
  referralFor: "for",
  referralFacility: "Refer to",
  referralFollowUp: "Follow-up",
  referralFirstActions: "First actions",
  referralShare: "Share",
  referralBack: "Back",

  profileVisits: "Past visits",
  profileNoVisits: "No visits yet",
  profileNewVisit: "+ New visit",
  profileEdit: "Edit",
  profileAge: "Age",
  profileVillage: "Village",
  profilePhone: "Phone",
  profilePregnancy: "Pregnant",
  profileWeeks: "weeks",

  settingsLanguage: "Language",
  settingsSyncNow: "Sync now",
  settingsSignOut: "Sign out",
  settingsAbout: "About SahAI",
  settingsWithdraw: "Withdraw consent",
  settingsBackend: "Server URL",

  newPatientName: "Patient name",
  newPatientAge: "Age",
  newPatientVillage: "Village",
  newPatientPhone: "Phone",
  newPatientPregnant: "Pregnant?",
  newPatientWeeks: "Weeks",
  newPatientCreate: "Add patient",
  newPatientSpeakAll: "Say the patient's name, age, village, and condition together.",

  errorNetwork: "Cannot reach the server. Saved offline.",
  errorTryAgain: "Something went wrong. Try again.",
};

export const STRINGS: Record<"hi" | "en", Strings> = { hi, en };

export function getStrings(languageCode: string): Strings {
  if (languageCode === "en") return en;
  return hi;
}

/** Languages exposed on the onboarding picker. */
export const UI_LANGUAGES: ReadonlyArray<{
  code: "hi" | "en";
  nativeLabel: string;
  englishLabel: string;
  ttsLocale: string;
}> = [
  { code: "hi", nativeLabel: "हिन्दी", englishLabel: "Hindi", ttsLocale: "hi-IN" },
  { code: "en", nativeLabel: "English", englishLabel: "English", ttsLocale: "en-IN" },
];
