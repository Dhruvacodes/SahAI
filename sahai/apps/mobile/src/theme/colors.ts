/**
 * SahAI color palette.
 *
 * Warm, calming, culturally resonant. Designed for an ASHA worker in rural
 * India who needs to read it in bright sunlight and at the end of a long day.
 */

export const colors = {
  cream: "#FFF8F0",
  paper: "#FFFFFF",
  ink: "#1F2933",
  inkSoft: "#52606D",
  inkMuted: "#7B8794",
  divider: "#E4E7EB",

  primary: "#0E6B6E",
  primaryDark: "#0A4F52",
  primarySoft: "#D6EEF0",

  accent: "#E07A1F",
  accentSoft: "#FCE6D2",

  risk: {
    low: { fg: "#15803D", bg: "#DCFCE7", border: "#16A34A" },
    moderate: { fg: "#A16207", bg: "#FEF3C7", border: "#CA8A04" },
    high: { fg: "#9A3412", bg: "#FFEDD5", border: "#EA580C" },
    critical: { fg: "#991B1B", bg: "#FEE2E2", border: "#DC2626" },
  },

  success: "#15803D",
  successSoft: "#DCFCE7",
  warning: "#A16207",
  warningSoft: "#FEF3C7",
  danger: "#991B1B",
  dangerSoft: "#FEE2E2",
  info: "#1D4ED8",
  infoSoft: "#DBEAFE",
} as const;

export type RiskColor = keyof typeof colors.risk;
