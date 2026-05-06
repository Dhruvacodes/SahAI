/**
 * Vernacular readback construction.
 *
 * Two-stage strategy:
 *  1. Prefer the LLM-supplied `patientInstruction` from /api/extract — it is
 *     already in the patient's language and tuned for plain-language delivery.
 *  2. If empty (e.g. offline fallback path), assemble a deterministic readback
 *     from local templates so the worker still gets a clear spoken summary.
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
};

function fallbackHeadline(languageCode: string, riskLevel: RiskLevel): string {
  return (RISK_HEADLINE[languageCode] ?? RISK_HEADLINE.hi)[riskLevel];
}

/**
 * Build the readback string the worker hears on the Visit Summary screen.
 *
 * The order is:
 *   1. Risk headline ("All is well" / "Refer immediately" etc.)
 *   2. Patient instruction from the LLM (if any)
 *
 * If the LLM instruction is empty, we keep just the headline.
 */
export function buildReadback(
  extraction: ExtractResponse,
  languageCode: string,
): string {
  const headline = fallbackHeadline(languageCode, extraction.riskLevel);
  const instruction = (extraction.patientInstruction ?? "").trim();

  if (instruction.length > 0) {
    return `${headline} ${instruction}`.trim();
  }

  return headline;
}
