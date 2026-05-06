/**
 * Patient store: local-first patient list. Mutations are recorded immediately
 * and a background sync flushes them to /api/patient when the device is online.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LanguageCode, Patient } from "../types";
import { hasIndicChars, romanise, titleCase } from "../voice/transliterate";
import { persistStorage } from "./persist";

interface PatientState {
  patients: Patient[];
  /** Set of patient ids that still need to be POSTed to /api/patient. */
  dirtyIds: string[];

  upsertPatient: (patient: Patient) => void;
  markSynced: (id: string) => void;
  removePatient: (id: string) => void;
  getById: (id: string) => Patient | undefined;
}

export const usePatientStore = create<PatientState>()(
  persist(
    (set, get) => ({
      patients: [],
      dirtyIds: [],
      upsertPatient: (patient) =>
        set((state) => {
          const exists = state.patients.find((p) => p.id === patient.id);
          const next = exists
            ? state.patients.map((p) => (p.id === patient.id ? patient : p))
            : [patient, ...state.patients];
          const dirtySet = new Set(state.dirtyIds);
          dirtySet.add(patient.id);
          return { patients: next, dirtyIds: Array.from(dirtySet) };
        }),
      markSynced: (id) =>
        set((state) => ({
          dirtyIds: state.dirtyIds.filter((d) => d !== id),
        })),
      removePatient: (id) =>
        set((state) => ({
          patients: state.patients.filter((p) => p.id !== id),
          dirtyIds: state.dirtyIds.filter((d) => d !== id),
        })),
      getById: (id) => get().patients.find((p) => p.id === id),
    }),
    {
      name: "sahai_patients_v1",
      storage: persistStorage,
    },
  ),
);

/** Build a fresh patient record (UUID-less; caller must supply id). */
export function buildPatient(args: {
  id: string;
  ashaId: string;
  name: string;
  /** Roman/Latin transliteration of `name`. Auto-derived if not provided. */
  nameLatin?: string;
  ageYears?: number;
  sex?: "F" | "M" | "O";
  isPregnant?: boolean;
  gestationalWeeks?: number;
  village?: string;
  phone?: string;
  languageCode: LanguageCode;
}): Patient {
  const now = new Date().toISOString();
  // Derive a Latin form deterministically when one wasn't supplied so English
  // UI can still render the patient card recognisably.
  const derivedLatin = args.nameLatin ?? deriveNameLatin(args.name);
  return {
    id: args.id,
    ashaId: args.ashaId,
    name: args.name,
    nameLatin: derivedLatin,
    ageYears: args.ageYears,
    sex: args.sex ?? "F",
    isPregnant: args.isPregnant ?? false,
    gestationalWeeks: args.gestationalWeeks,
    isPostpartum: false,
    village: args.village,
    phone: args.phone,
    languageCode: args.languageCode,
    createdAt: now,
    updatedAt: now,
  };
}

function deriveNameLatin(name: string): string | undefined {
  if (!name) return undefined;
  if (!hasIndicChars(name)) return undefined; // already Latin
  return titleCase(romanise(name));
}

/**
 * Pick which form of a patient's name to display, given the active UI lang.
 *
 * Rule: when UI is English and we have a Latin form, render that. Otherwise
 * render the original (native-script) name.
 */
export function getDisplayName(
  patient: Pick<Patient, "name" | "nameLatin">,
  uiLang: string,
): string {
  if (uiLang === "en" && patient.nameLatin && patient.nameLatin.trim().length > 0) {
    return patient.nameLatin;
  }
  return patient.name;
}
