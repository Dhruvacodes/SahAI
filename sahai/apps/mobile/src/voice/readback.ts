/**
 * Worker-facing readback construction.
 *
 * The Visit Summary screen plays a short spoken summary the ASHA worker hears
 * to confirm what was extracted. That readback is in *her* UI language — not
 * the patient's recorded language. Patient-facing audio (when the worker hands
 * the phone to the patient) is generated separately on the Referral screen
 * and follows `patient.languageCode`.
 *
 * Strategy:
 *  1. Risk headline in the worker's UI language (deterministic table below).
 *  2. If the LLM extraction came back with a `patientInstruction` and we have
 *     reason to believe it's in the same language as the readback (i.e. it
 *     was requested in that language), we append it. Otherwise we keep just
 *     the headline so the worker doesn't hear a mismatched-language sentence.
 */

import type { ExtractResponse, RiskLevel } from "../types";

const RISK_HEADLINE: Record<string, Record<RiskLevel, string>> = {
  hi: {
    LOW: "सब ठीक है।",
    MODERATE: "थोड़ा ध्यान रखें।",
    HIGH: "जल्दी डॉक्टर को दिखाएं।",
    CRITICAL: "तुरंत अस्पताल भेजें। 108 पर कॉल करें।",
  },
  en: {
    LOW: "All is well.",
    MODERATE: "Watch closely.",
    HIGH: "See a doctor soon.",
    CRITICAL: "Refer to hospital immediately. Call 108.",
  },
  bn: {
    LOW: "সব ঠিক আছে।",
    MODERATE: "একটু লক্ষ্য রাখুন।",
    HIGH: "শীঘ্রই ডাক্তার দেখান।",
    CRITICAL: "এখনই হাসপাতালে নিয়ে যান। ১০৮ এ কল করুন।",
  },
  ta: {
    LOW: "எல்லாம் நலம்.",
    MODERATE: "கவனமாக கவனியுங்கள்.",
    HIGH: "விரைவில் மருத்துவரிடம் காட்டுங்கள்.",
    CRITICAL: "உடனே மருத்துவமனைக்கு அழைத்துச் செல்லுங்கள். 108-ஐ அழைக்கவும்.",
  },
  te: {
    LOW: "అంతా బాగానే ఉంది.",
    MODERATE: "జాగ్రత్తగా గమనించండి.",
    HIGH: "త్వరగా వైద్యుడిని చూడండి.",
    CRITICAL: "వెంటనే ఆసుపత్రికి తీసుకెళ్లండి. 108కి కాల్ చేయండి.",
  },
  mr: {
    LOW: "सर्व ठीक आहे.",
    MODERATE: "थोडी काळजी घ्या.",
    HIGH: "लवकर डॉक्टरांना दाखवा.",
    CRITICAL: "ताबडतोब रुग्णालयात न्या. 108 वर कॉल करा.",
  },
};

function fallbackHeadline(languageCode: string, riskLevel: RiskLevel): string {
  return (RISK_HEADLINE[languageCode] ?? RISK_HEADLINE.en)[riskLevel];
}

/**
 * Build the readback string the worker hears on the Visit Summary screen.
 *
 * @param extraction  Extraction response from /api/extract.
 * @param uiLang      The worker's active UI language. The headline (and TTS
 *                    locale at the call-site) follow this. The LLM
 *                    `patientInstruction` is appended only if the request was
 *                    issued in this same language.
 */
export function buildReadback(
  extraction: ExtractResponse,
  uiLang: string,
): string {
  const headline = fallbackHeadline(uiLang, extraction.riskLevel);
  const instruction = (extraction.patientInstruction ?? "").trim();

  // If the extraction was requested in `uiLang`, the LLM instruction is in the
  // same language and can be appended safely. We don't have an explicit field
  // for the request language, but RecordingScreen.tsx now always sends `lang`
  // (the UI language) to /extract, so this is a safe assumption.
  if (instruction.length > 0) {
    return `${headline} ${instruction}`.trim();
  }

  return headline;
}
