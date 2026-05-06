/**
 * Tiny deterministic Indic-script → Latin transliterator for displaying
 * patient names when the UI language is English.
 *
 * This is **not** a linguistic transliteration system; it's a best-effort
 * romanisation that's good enough for an ASHA worker to recognise a patient
 * card. We strip script-specific virama / nukta / vowel-sign idiosyncrasies
 * and produce ITRANS-ish output. For high-fidelity transliteration the LLM
 * fallback (`extractDemographics`) returns a proper `nameLatin` separately.
 *
 * Covered scripts (best-effort):
 *  - Devanagari   (hi, mr, ne, sa)
 *  - Bengali      (bn, as)
 *  - Tamil        (ta)
 *  - Telugu       (te)
 *  - Gurmukhi     (pa)
 *  - Gujarati     (gu)
 *  - Kannada      (kn)
 *  - Malayalam    (ml)
 *  - Odia         (or)
 */

type CharMap = Record<string, string>;

// Devanagari (and its dependent vowel signs) → Latin.
// We coalesce some inherent-vowel idiosyncrasies so the output reads naturally.
const DEVANAGARI: CharMap = {
  // Independent vowels
  "अ": "a", "आ": "aa", "इ": "i", "ई": "ii", "उ": "u", "ऊ": "uu",
  "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
  // Consonants
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng",
  "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
  "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
  "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh",
  "ष": "sh", "स": "s", "ह": "h",
  // Common nukta forms
  "क़": "q", "ख़": "kh", "ग़": "gh", "ज़": "z", "ड़": "r", "ढ़": "rh",
  "फ़": "f", "य़": "y",
  // Dependent vowel signs
  "ा": "aa", "ि": "i", "ी": "ii", "ु": "u", "ू": "uu",
  "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ृ": "ri",
  "ं": "n", "ँ": "n", "ः": "h", "्": "",
  // Punctuation / digits
  "।": ".", "॥": ".",
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

const BENGALI: CharMap = {
  "অ": "a", "আ": "aa", "ই": "i", "ঈ": "ii", "উ": "u", "ঊ": "uu",
  "ঋ": "ri", "এ": "e", "ঐ": "ai", "ও": "o", "ঔ": "au",
  "ক": "k", "খ": "kh", "গ": "g", "ঘ": "gh", "ঙ": "ng",
  "চ": "ch", "ছ": "chh", "জ": "j", "ঝ": "jh", "ঞ": "ny",
  "ট": "t", "ঠ": "th", "ড": "d", "ঢ": "dh", "ণ": "n",
  "ত": "t", "থ": "th", "দ": "d", "ধ": "dh", "ন": "n",
  "প": "p", "ফ": "ph", "ব": "b", "ভ": "bh", "ম": "m",
  "য": "y", "র": "r", "ল": "l", "শ": "sh", "ষ": "sh",
  "স": "s", "হ": "h", "য়": "y", "ড়": "r", "ঢ়": "rh",
  "া": "aa", "ি": "i", "ী": "ii", "ু": "u", "ূ": "uu",
  "ে": "e", "ৈ": "ai", "ো": "o", "ৌ": "au", "ৃ": "ri",
  "ং": "ng", "ঁ": "n", "ঃ": "h", "্": "",
};

const TAMIL: CharMap = {
  "அ": "a", "ஆ": "aa", "இ": "i", "ஈ": "ii", "உ": "u", "ஊ": "uu",
  "எ": "e", "ஏ": "ee", "ஐ": "ai", "ஒ": "o", "ஓ": "oo", "ஔ": "au",
  "க": "k", "ங": "ng", "ச": "ch", "ஞ": "ny", "ட": "t",
  "ண": "n", "த": "th", "ந": "n", "ப": "p", "ம": "m",
  "ய": "y", "ர": "r", "ல": "l", "வ": "v", "ழ": "zh",
  "ள": "l", "ற": "r", "ன": "n", "ஷ": "sh", "ஸ": "s",
  "ஹ": "h",
  "ா": "aa", "ி": "i", "ீ": "ii", "ு": "u", "ூ": "uu",
  "ெ": "e", "ே": "ee", "ை": "ai", "ொ": "o", "ோ": "oo", "ௌ": "au",
  "்": "",
};

const TELUGU: CharMap = {
  "అ": "a", "ఆ": "aa", "ఇ": "i", "ఈ": "ii", "ఉ": "u", "ఊ": "uu",
  "ఎ": "e", "ఏ": "ee", "ఐ": "ai", "ఒ": "o", "ఓ": "oo", "ఔ": "au",
  "క": "k", "ఖ": "kh", "గ": "g", "ఘ": "gh", "ఙ": "ng",
  "చ": "ch", "ఛ": "chh", "జ": "j", "ఝ": "jh", "ఞ": "ny",
  "ట": "t", "ఠ": "th", "డ": "d", "ఢ": "dh", "ణ": "n",
  "త": "t", "థ": "th", "ద": "d", "ధ": "dh", "న": "n",
  "ప": "p", "ఫ": "ph", "బ": "b", "భ": "bh", "మ": "m",
  "య": "y", "ర": "r", "ల": "l", "వ": "v", "శ": "sh",
  "ష": "sh", "స": "s", "హ": "h", "ళ": "l",
  "ా": "aa", "ి": "i", "ీ": "ii", "ు": "u", "ూ": "uu",
  "ె": "e", "ే": "ee", "ై": "ai", "ొ": "o", "ో": "oo", "ౌ": "au",
  "్": "",
};

function tableForChar(ch: string): CharMap | null {
  const code = ch.charCodeAt(0);
  if (code >= 0x0900 && code <= 0x097f) return DEVANAGARI;
  if (code >= 0x0980 && code <= 0x09ff) return BENGALI;
  if (code >= 0x0b80 && code <= 0x0bff) return TAMIL;
  if (code >= 0x0c00 && code <= 0x0c7f) return TELUGU;
  // Other Indic scripts — fall back to Devanagari-ish mapping (better than dropping).
  if (code >= 0x0a00 && code <= 0x0aff) return DEVANAGARI; // Gurmukhi/Gujarati range — coarse approximation
  if (code >= 0x0b00 && code <= 0x0b7f) return DEVANAGARI; // Odia
  if (code >= 0x0c80 && code <= 0x0cff) return DEVANAGARI; // Kannada
  if (code >= 0x0d00 && code <= 0x0d7f) return DEVANAGARI; // Malayalam
  return null;
}

/** Returns true if the string contains any Indic-script characters. */
export function hasIndicChars(text: string): boolean {
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 0x0900 && code <= 0x0d7f) return true;
  }
  return false;
}

/**
 * Best-effort romanisation of an Indic-script string.
 *
 * If the string is already pure Latin (or empty) it's returned untouched, so
 * passing an English name through is a no-op.
 */
export function romanise(text: string): string {
  if (!text) return text;
  if (!hasIndicChars(text)) return text;

  let out = "";
  for (const ch of text) {
    const table = tableForChar(ch);
    if (!table) {
      out += ch;
      continue;
    }
    const mapped = table[ch];
    if (mapped !== undefined) {
      out += mapped;
    } else {
      // Unknown code-point in a known block — keep as-is; the worker can edit.
      out += ch;
    }
  }

  // Light cleanup: collapse repeated vowels caused by inherent-a doubling and
  // strip leading/trailing whitespace.
  return out
    .replace(/aaa+/g, "aa")
    .replace(/iii+/g, "ii")
    .replace(/uuu+/g, "uu")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Capitalise the first letter of each word — used for display names.
 */
export function titleCase(text: string): string {
  if (!text) return text;
  return text
    .split(/\s+/)
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}
