/**
 * Patient store: local-first patient list. Mutations are recorded immediately
 * and a background sync flushes them to /api/patient when the device is online.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LanguageCode, Patient } from "../types";
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
  ageYears?: number;
  sex?: "F" | "M" | "O";
  isPregnant?: boolean;
  gestationalWeeks?: number;
  village?: string;
  phone?: string;
  languageCode: LanguageCode;
}): Patient {
  const now = new Date().toISOString();
  return {
    id: args.id,
    ashaId: args.ashaId,
    name: args.name,
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
