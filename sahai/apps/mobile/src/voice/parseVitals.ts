/**
 * On-device first-pass vitals parser.
 *
 * The backend `/api/extract` LLM produces the canonical structured vitals.
 * This parser is a deterministic safety net so a vital the LLM dropped on the
 * first attempt (e.g. it fixated on the chief complaint instead of "BP 120 by
 * 80") is still recovered without making the worker re-record. We merge
 * server-extracted vitals over these regex hits — backend wins where it has a
 * value, this module fills gaps.
 *
 * Coverage: BP, heart rate, SpO2, temperature (°C and °F), weight (kg),
 * haemoglobin (g/dL), MUAC (mm or cm), respiratory rate. Recognises both
 * Devanagari and ASCII digits and a range of Hindi/English spoken phrasings.
 */

import type { Vitals } from "../types";

// ─── digit normalisation ────────────────────────────────────────────────────

const DEV_DIGITS_RE = /[\u0966-\u096F]/g;

/** Map Devanagari digits ०-९ to ASCII so the regexes work on both. */
function normaliseDigits(input: string): string {
  return input.replace(DEV_DIGITS_RE, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x0966 + 0x30),
  );
}

// ─── plausibility ranges (mirror backend extraction_service.RANGES) ─────────

const RANGES: Record<keyof Vitals, [number, number]> = {
  systolicBP: [50, 250],
  diastolicBP: [30, 150],
  heartRate: [30, 200],
  spO2: [50, 100],
  temperature: [34.0, 42.0],
  weight: [1, 200],
  haemoglobin: [3.0, 20.0],
  muacMm: [50, 200],
  respiratoryRate: [10, 80],
};

function plausible<K extends keyof Vitals>(field: K, value: number): boolean {
  const [lo, hi] = RANGES[field];
  return Number.isFinite(value) && value >= lo && value <= hi;
}

function fToC(f: number): number {
  return ((f - 32) * 5) / 9;
}

// ─── parse ──────────────────────────────────────────────────────────────────

/**
 * Pull whatever vitals we can from a free-text transcript. Unparseable values
 * are skipped (no exceptions). Out-of-range values are dropped so we never
 * fight the backend's authoritative extraction.
 */
export function parseVitals(transcript: string): Partial<Vitals> {
  if (!transcript) return {};
  const text = normaliseDigits(transcript).toLowerCase();
  const out: Partial<Vitals> = {};

  // Blood pressure: "BP 120/80", "120 / 80", "बीपी 120 बाई 80",
  // "blood pressure 130 over 90", "120 by 80"
  const bp =
    text.match(/\b(?:b\.?p\.?|blood\s*pressure|बीपी|बी\.?\s*पी\.?)\s*[:\s]?\s*(\d{2,3})\s*(?:\/|over|by|बाई|पर|उपर)\s*(\d{2,3})/) ||
    text.match(/\b(\d{2,3})\s*(?:\/|over|by|बाई|पर)\s*(\d{2,3})\b/);
  if (bp) {
    const sys = parseInt(bp[1], 10);
    const dia = parseInt(bp[2], 10);
    if (plausible("systolicBP", sys)) out.systolicBP = sys;
    if (plausible("diastolicBP", dia)) out.diastolicBP = dia;
  }

  // Heart rate / pulse: "HR 96", "pulse 88", "नब्ज 90", "heart rate 102 bpm"
  const hr = text.match(
    /\b(?:h\.?r\.?|pulse|heart\s*rate|नब्ज|पल्स|दिल\s*की\s*धड़कन)\s*[:\s]?\s*(\d{2,3})\s*(?:bpm|प्रति\s*मिनट|\/min)?/,
  );
  if (hr) {
    const v = parseInt(hr[1], 10);
    if (plausible("heartRate", v)) out.heartRate = v;
  }

  // SpO2: "SpO2 96", "saturation 92%", "ऑक्सीजन 88"
  const spo2 = text.match(
    /\b(?:sp[\u00a0\s]*o\s*2|spo2|saturation|sats?|ऑक्सीजन|ऑक्सिजन|oxygen)\s*[:\s]?\s*(\d{2,3})\s*%?/,
  );
  if (spo2) {
    const v = parseInt(spo2[1], 10);
    if (plausible("spO2", v)) out.spO2 = v;
  }

  // Temperature in °C: "temp 38.4", "बुखार 39 डिग्री", "38.5 c"
  const tempC = text.match(
    /\b(?:temp(?:erature)?|बुखार|टेम्प|tapman|fever)\s*[:\s]?\s*(\d{2,3}(?:\.\d)?)\s*(?:°?\s*c|डिग्री)?\b/,
  );
  if (tempC) {
    const v = parseFloat(tempC[1]);
    if (plausible("temperature", v)) out.temperature = v;
  }

  // Temperature in °F: "102 F", "fever 101.4 F"
  if (out.temperature == null) {
    const tempF = text.match(
      /\b(?:temp(?:erature)?|बुखार|fever)?\s*[:\s]?\s*(\d{2,3}(?:\.\d)?)\s*°?\s*f\b/,
    );
    if (tempF) {
      const v = parseFloat(tempF[1]);
      const c = fToC(v);
      if (plausible("temperature", c)) out.temperature = Number(c.toFixed(1));
    }
  }

  // Weight in kg: "weight 6 kg", "वज़न 8 किलो", "55 kilos"
  const weight = text.match(
    /\b(?:weight|wt|वज़न|वजन|भार)\s*[:\s]?\s*(\d{1,3}(?:\.\d)?)\s*(?:kg|kgs|kilo|kilos|किलो|किग्रा)/,
  );
  if (weight) {
    const v = parseFloat(weight[1]);
    if (plausible("weight", v)) out.weight = v;
  }

  // Haemoglobin: "Hb 9.2", "हीमोग्लोबिन 8", "haemoglobin 11.5 g/dl"
  const hb = text.match(
    /\b(?:h\.?b\.?|hb|haemoglobin|hemoglobin|हीमोग्लोबिन|हिमोग्लोबिन)\s*[:\s]?\s*(\d{1,2}(?:\.\d)?)\s*(?:g\/?dl|g)?/,
  );
  if (hb) {
    const v = parseFloat(hb[1]);
    if (plausible("haemoglobin", v)) out.haemoglobin = v;
  }

  // MUAC: explicit mm form, e.g. "MUAC 110 mm", "मुएक 105 मिमी"
  const muacMm = text.match(
    /\b(?:muac|मुएक)\s*[:\s]?\s*(\d{2,3})\s*(?:mm|मिमी)/,
  );
  if (muacMm) {
    const v = parseInt(muacMm[1], 10);
    if (plausible("muacMm", v)) out.muacMm = v;
  } else {
    // cm form, e.g. "MUAC 11.5 cm" → convert to mm
    const muacCm = text.match(
      /\b(?:muac|मुएक)\s*[:\s]?\s*(\d{1,2}(?:\.\d)?)\s*(?:cm|सेमी)/,
    );
    if (muacCm) {
      const mm = Math.round(parseFloat(muacCm[1]) * 10);
      if (plausible("muacMm", mm)) out.muacMm = mm;
    }
  }

  // Respiratory rate: "RR 24", "respiratory rate 30", "साँस 28 प्रति मिनट"
  const rr = text.match(
    /\b(?:r\.?r\.?|rr|resp(?:iratory)?(?:\s*rate)?|साँस|श्वास|breaths?\s*per\s*min)\s*[:\s]?\s*(\d{2,3})\b/,
  );
  if (rr) {
    const v = parseInt(rr[1], 10);
    if (plausible("respiratoryRate", v)) out.respiratoryRate = v;
  }

  return out;
}

/**
 * Merge LLM extraction with regex extraction so the backend's value wins
 * wherever it's non-null, and the regex fills any gaps.
 */
export function mergeVitals(server: Vitals, local: Partial<Vitals>): Vitals {
  const merged: Vitals = { ...server };
  for (const key of Object.keys(local) as (keyof Vitals)[]) {
    if (merged[key] == null && local[key] != null) {
      merged[key] = local[key] as never;
    }
  }
  return merged;
}
