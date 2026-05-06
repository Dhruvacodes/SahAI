/**
 * Typography scale. Sizes are in scaled pixels (sp on Android, pt on iOS).
 * Line-heights err on the generous side so Devanagari and other Indic scripts
 * with high diacritics render cleanly.
 */

import { Platform } from "react-native";

const familySans = Platform.select({
  ios: "System",
  android: "Roboto",
  default: "System",
});

export const typography = {
  family: familySans,
  hero: { fontSize: 32, lineHeight: 42, fontWeight: "800" as const },
  title: { fontSize: 26, lineHeight: 36, fontWeight: "800" as const },
  section: { fontSize: 22, lineHeight: 30, fontWeight: "700" as const },
  body: { fontSize: 18, lineHeight: 26, fontWeight: "500" as const },
  bodyStrong: { fontSize: 18, lineHeight: 26, fontWeight: "700" as const },
  small: { fontSize: 15, lineHeight: 22, fontWeight: "500" as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "600" as const },
  button: { fontSize: 18, lineHeight: 24, fontWeight: "700" as const },
  number: { fontSize: 40, lineHeight: 48, fontWeight: "800" as const },
} as const;
