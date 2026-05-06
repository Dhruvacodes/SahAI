/**
 * Visit store: local-first list of completed visits, persisted to AsyncStorage.
 *
 * A visit becomes "dirty" the moment it is appended; the sync queue flushes
 * it to /api/sync/visit when the network is up.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Visit } from "../types";
import { persistStorage } from "./persist";

interface VisitState {
  visits: Visit[];
  dirtyIds: string[];

  appendVisit: (visit: Visit) => void;
  markSynced: (id: string) => void;
  visitsForPatient: (patientId: string) => Visit[];
}

export const useVisitStore = create<VisitState>()(
  persist(
    (set, get) => ({
      visits: [],
      dirtyIds: [],
      appendVisit: (visit) =>
        set((state) => ({
          visits: [visit, ...state.visits],
          dirtyIds: [...state.dirtyIds, visit.id],
        })),
      markSynced: (id) =>
        set((state) => ({
          visits: state.visits.map((v) =>
            v.id === id ? { ...v, syncedToCloud: true } : v,
          ),
          dirtyIds: state.dirtyIds.filter((d) => d !== id),
        })),
      visitsForPatient: (patientId) =>
        get().visits.filter((v) => v.patientId === patientId),
    }),
    {
      name: "sahai_visits_v1",
      storage: persistStorage,
    },
  ),
);
