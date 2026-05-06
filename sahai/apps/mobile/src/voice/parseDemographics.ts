/**
 * Heuristic parser that turns a free-form transcript into best-guess
 * patient demographics.
 *
 * Handles three input shapes:
 *   1. Pure English   ("the patient's name is Savita, 23 years old, from Pune…")
 *   2. Pure Indic     ("मरीज़ का नाम सावित्री है, उम्र 30 साल, चेन्नई से")
 *   3. Devanagari-transliterated English — what Sarvam Saarika returns when
 *      Indian-accented English is forced into hi-IN, e.g.
 *      "द पेशेंट्स नेम इज सविता शी इज ट्वेंटी थ्री ईयर्स ओल्ड फ्रॉम पुणे
 *       फोन नंबर 8999745672 शी इज प्रेग्नेंट"
 *
 * The parser is intentionally cheap (no network, no LLM): the main backend
 * pipeline is responsible for fixing the upstream STT script issue. This is
 * a fast, free first pass — an LLM fallback runs only when this returns no
 * name.
 */

export interface ParsedDemographics {
  name?: string;
  ageYears?: number;
  village?: string;
  phone?: string;
  isPregnant?: boolean;
  gestationalWeeks?: number;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const DEV_RE = /[\u0900-\u097F]/;

// Map Devanagari digits ०-९ to ASCII so the same number regexes work on both.
function normalizeDigits(input: string): string {
  return input.replace(/[\u0966-\u096F]/g, (ch) =>
    String((ch.charCodeAt(0) - 0x0966).toString()),
  );
}

// Devanagari-transliterated English keyword forms, normalised to ASCII tags
// using a tiny phrasebook. We do NOT try to be exhaustive — only the words
// the demographic prompt actually uses.
const DEVA_TO_TAG: Array<[RegExp, string]> = [
  [/नेम(?:\s+इज)?/g, " name is "],          // "name (is)"
  [/नंबर/g, " number "],
  [/फ़ोन|फोन/g, " phone "],
  [/एज\s+इज|एज/g, " age "],
  [/ईयर्स?\s*ओल्ड|ईयर्स?|यर्स?/g, " years old "],
  [/ओल्ड\b/g, " old "],
  [/फ्रॉम|फ्राम/g, " from "],
  [/विलेज/g, " village "],
  [/प्रेग्नेंट|प्रेगनेंट/g, " pregnant "],
  [/पेशेंट्स?|पेशंट्स?/g, " patient "],
  [/शी\s+इज|ही\s+इज|शी'ज|ही'ज/g, " "],
  [/इज\b/g, " is "],
  [/एंड\b/g, " and "],
  [/हर\b|हिज\b/g, " "],
  [/द\b/g, " "],
];

// English number words → digits (10..99 covers all realistic ages).
const NUM_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};
// Devanagari transliteration of the same words ("ट्वेंटी थ्री" → 23).
const NUM_WORDS_DEVA: Record<string, number> = {
  जीरो: 0, वन: 1, टू: 2, थ्री: 3, फोर: 4, फाइव: 5, सिक्स: 6, सेवन: 7,
  एट: 8, नाइन: 9, टेन: 10, इलेवन: 11, ट्वेल्व: 12, थर्टीन: 13, फोर्टीन: 14,
  फिफ्टीन: 15, सिक्सटीन: 16, सेवनटीन: 17, ऐटीन: 18, नाइनटीन: 19,
  ट्वेंटी: 20, थर्टी: 30, फोर्टी: 40, फिफ्टी: 50, सिक्सटी: 60,
  सेवंटी: 70, ऐटी: 80, नाइंटी: 90,
};

function wordsToNumber(text: string): number | undefined {
  const tokens = text.toLowerCase().split(/[\s\-]+/).filter(Boolean);
  let total = 0;
  let any = false;
  for (const tok of tokens) {
    const v = NUM_WORDS[tok] ?? NUM_WORDS_DEVA[tok];
    if (v == null) continue;
    total += v;
    any = true;
  }
  return any && total > 0 && total < 130 ? total : undefined;
}

// Replace standalone "twenty three" / "ट्वेंटी थ्री" sequences with digits.
function inlineNumberWords(text: string): string {
  // English: tens + ones
  text = text.replace(
    /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]*(one|two|three|four|five|six|seven|eight|nine)?\b/gi,
    (_m, t: string, o?: string) => {
      const n = (NUM_WORDS[t.toLowerCase()] || 0) + (o ? NUM_WORDS[o.toLowerCase()] || 0 : 0);
      return n ? String(n) : _m;
    },
  );
  // English: 10–19
  text = text.replace(
    /\b(ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/gi,
    (_m, w: string) => String(NUM_WORDS[w.toLowerCase()] ?? 0),
  );
  // Devanagari tens + ones
  text = text.replace(
    /(ट्वेंटी|थर्टी|फोर्टी|फिफ्टी|सिक्सटी|सेवंटी|ऐटी|नाइंटी)\s*(वन|टू|थ्री|फोर|फाइव|सिक्स|सेवन|एट|नाइन)?/g,
    (_m, t: string, o?: string) => {
      const n = (NUM_WORDS_DEVA[t] || 0) + (o ? NUM_WORDS_DEVA[o] || 0 : 0);
      return n ? String(n) : _m;
    },
  );
  return text;
}

// ─── main export ─────────────────────────────────────────────────────────────

export function parseDemographics(rawText: string | null | undefined): ParsedDemographics {
  if (!rawText) return {};

  // 1. Normalise punctuation, digits, and Devanagari-transliterated keywords.
  let text = normalizeDigits(rawText);
  text = text.replace(/[,।!?:;]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return {};

  let working = text;
  for (const [re, sub] of DEVA_TO_TAG) {
    working = working.replace(re, sub);
  }
  working = inlineNumberWords(working).replace(/\s+/g, " ").trim();
  const lower = working.toLowerCase();
  const result: ParsedDemographics = {};

  // ── NAME ──────────────────────────────────────────────────────────────────
  // 1. English "name is X" — also catches translated/transliterated path.
  const enNameRe = /\bname\s+(?:is\s+)?([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)?)/;
  const enNameMatch = working.match(enNameRe);

  // 2. Hindi "नाम है X" / "नाम X"
  const hiNameRe = /नाम\s+(?:है\s+|हैं\s+|का\s+)?([\u0900-\u097F][^\s\d]*)/u;
  const hiNameMatch = rawText.match(hiNameRe);

  // 3. Devanagari-transliterated "name is X" where X may also be Devanagari.
  const tagNameDevaRe = /\bname\s+is\s+([\u0900-\u097F][^\s\d]*)/u;
  const tagNameDevaMatch = working.match(tagNameDevaRe);

  const skipWords = new Set([
    "the", "a", "an", "patient", "patients", "her", "his", "she", "he",
    "this", "that", "my", "our", "its", "is", "are", "was", "were",
    "from", "of", "in", "at", "and", "or", "but", "with", "to",
    "name", "phone", "age", "old", "number", "years", "year",
    "village", "city", "town", "called",
    "गाँव", "गांव", "साल", "वर्ष", "हफ्ते", "नाम", "उम्र", "फ़ोन",
  ]);

  if (enNameMatch) {
    result.name = enNameMatch[1].trim();
  } else if (tagNameDevaMatch) {
    result.name = tagNameDevaMatch[1].replace(/[,।.]/g, "").trim();
  } else if (hiNameMatch) {
    result.name = hiNameMatch[1].replace(/[,।.]/g, "").trim();
  } else {
    // Fallback: first 1–3 leading capitalised or Devanagari tokens that
    // aren't filler words. Operates on the *original* text (not the
    // tag-rewritten one) so we don't pick up our own injected English tags.
    const tokens = text.split(/\s+/);
    const nameTokens: string[] = [];
    for (const tok of tokens) {
      const lc = tok.toLowerCase().replace(/[',]/g, "");
      if (skipWords.has(lc)) {
        if (nameTokens.length > 0) break;
        continue;
      }
      if (/^\d/.test(tok)) break;
      if (/^[A-Z]/.test(tok) || DEV_RE.test(tok)) {
        nameTokens.push(tok.replace(/[',।.]/g, ""));
        if (nameTokens.length >= 3) break;
      } else if (nameTokens.length > 0) {
        break;
      }
    }
    if (nameTokens.length > 0) {
      result.name = nameTokens.join(" ").trim();
    }
  }

  // ── AGE ───────────────────────────────────────────────────────────────────
  const ageRe = /(\d{1,3})\s*(?:years?\s*(?:old)?|साल|वर्ष|साला|yr\.?s?|yo)\b/i;
  const agedRe = /\baged?\s+(\d{1,3})\b/i;
  const ageLabelRe = /\bage\s+(?:is\s+)?(\d{1,3})\b/i;
  const ageMatch =
    lower.match(ageRe) || lower.match(agedRe) || lower.match(ageLabelRe);
  if (ageMatch) {
    const n = parseInt(ageMatch[1], 10);
    if (n > 0 && n < 120) result.ageYears = n;
  } else {
    // Last resort: number words by themselves near "old" / "years".
    const wordy = working.match(
      /\b((?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\s-](?:one|two|three|four|five|six|seven|eight|nine))?|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\s*(?:years?\s*old|years?|old)/i,
    );
    if (wordy) {
      const n = wordsToNumber(wordy[1]);
      if (n) result.ageYears = n;
    }
  }

  // ── VILLAGE / CITY ────────────────────────────────────────────────────────
  const fromEnRe = /\bfrom\s+(?:village\s+|city\s+|town\s+)?([A-Z][a-zA-Z]+)/;
  const fromHiRe = /(?:गाँव|गांव|गाव)\s+([^\s\d,।]+)/u;
  const fromHiPostRe = /([^\s\d,।]+)\s+से\b/u;
  const cityLabelRe = /\b(?:city|town|tehsil|district|place|village)\s+(?:is\s+)?([A-Z][a-zA-Z]+)/i;
  const fromTagDevaRe = /\bfrom\s+([\u0900-\u097F][^\s\d,।]*)/u;

  const fromEnMatch = working.match(fromEnRe);
  const fromHiMatch = rawText.match(fromHiRe);
  const cityLabelMatch = working.match(cityLabelRe);
  const fromHiPostMatch = rawText.match(fromHiPostRe);
  const fromTagDevaMatch = working.match(fromTagDevaRe);

  if (fromEnMatch) {
    result.village = cap(fromEnMatch[1]);
  } else if (fromTagDevaMatch) {
    result.village = fromTagDevaMatch[1].replace(/[,।.]/g, "").trim();
  } else if (fromHiMatch) {
    result.village = fromHiMatch[1].replace(/[,।.]/g, "").trim();
  } else if (cityLabelMatch) {
    result.village = cap(cityLabelMatch[1]);
  } else if (fromHiPostMatch) {
    const candidate = fromHiPostMatch[1].replace(/[,।.]/g, "").trim();
    if (DEV_RE.test(candidate) || /^[A-Z]/.test(candidate)) {
      result.village = candidate;
    }
  }

  // ── PHONE ─────────────────────────────────────────────────────────────────
  // Indian mobile numbers: 10 digits starting with 6–9.
  // We already converted Devanagari digits to ASCII at normalizeDigits().
  const phoneRe = /\b([6-9]\d{9})\b/;
  const phoneSpacedRe = /\b([6-9](?:[\s\-]?\d){9})\b/;
  const phoneMatch = text.match(phoneRe);
  if (phoneMatch) {
    result.phone = phoneMatch[1];
  } else {
    const spaced = text.match(phoneSpacedRe);
    if (spaced) {
      const digits = spaced[1].replace(/[\s\-]/g, "");
      if (digits.length === 10) result.phone = digits;
    }
  }

  // ── PREGNANT ──────────────────────────────────────────────────────────────
  if (/गर्भवती|pregnant|pregnancy|गर्भ|प्रेग्नेंट|प्रेगनेंट/i.test(rawText + " " + working)) {
    result.isPregnant = true;
  }

  // ── GESTATIONAL WEEKS ─────────────────────────────────────────────────────
  const weeksRe = /(\d{1,2})\s*(?:हफ्ते?|week|weeks|वीक्स?)/i;
  const weeksMatch = lower.match(weeksRe);
  if (weeksMatch) {
    result.gestationalWeeks = parseInt(weeksMatch[1], 10);
    result.isPregnant = true;
  }

  return result;
}

/**
 * Heuristic check for "did the cheap parser actually understand this?".
 *
 * If false, the caller should fall back to the LLM extractor. We require at
 * minimum a name OR a phone — those are the irreplaceable identifying fields
 * a worker speaks for a new patient.
 */
export function isParseConfident(parsed: ParsedDemographics): boolean {
  if (parsed.name && parsed.name.trim().length >= 2) return true;
  if (parsed.phone && parsed.phone.length === 10) return true;
  return false;
}
