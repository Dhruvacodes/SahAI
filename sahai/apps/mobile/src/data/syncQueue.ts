/**
 * Background sync queue.
 *
 * Watches NetInfo: when the device is online, it iterates over dirty patients
 * and visits and pushes them to the backend. Failures are tolerated silently —
 * the records remain in the dirty set and will be retried.
 */

import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { create } from "zustand";
import { syncVisit, upsertPatient } from "./api";
import { usePatientStore } from "./patientStore";
import { useVisitStore } from "./visitStore";

interface SyncState {
  isOnline: boolean;
  isFlushing: boolean;
  lastFlushAt?: string;
  setOnline: (value: boolean) => void;
  setFlushing: (value: boolean) => void;
  setLastFlushAt: (iso: string) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: true,
  isFlushing: false,
  lastFlushAt: undefined,
  setOnline: (value) => set({ isOnline: value }),
  setFlushing: (value) => set({ isFlushing: value }),
  setLastFlushAt: (iso) => set({ lastFlushAt: iso }),
}));

let unsubNetInfo: (() => void) | null = null;
let inFlight = false;

export async function flushSyncQueue(): Promise<{
  patientsSent: number;
  visitsSent: number;
  failed: number;
}> {
  if (inFlight) return { patientsSent: 0, visitsSent: 0, failed: 0 };
  inFlight = true;
  useSyncStore.getState().setFlushing(true);

  let patientsSent = 0;
  let visitsSent = 0;
  let failed = 0;

  try {
    const patientStore = usePatientStore.getState();
    const visitStore = useVisitStore.getState();

    for (const id of [...patientStore.dirtyIds]) {
      const patient = patientStore.patients.find((p) => p.id === id);
      if (!patient) {
        patientStore.markSynced(id);
        continue;
      }
      try {
        await upsertPatient(patient);
        patientStore.markSynced(id);
        patientsSent++;
      } catch {
        failed++;
      }
    }

    for (const id of [...visitStore.dirtyIds]) {
      const visit = visitStore.visits.find((v) => v.id === id);
      if (!visit) {
        visitStore.markSynced(id);
        continue;
      }
      try {
        await syncVisit(visit);
        visitStore.markSynced(id);
        visitsSent++;
      } catch {
        failed++;
      }
    }

    useSyncStore.getState().setLastFlushAt(new Date().toISOString());
  } finally {
    inFlight = false;
    useSyncStore.getState().setFlushing(false);
  }

  return { patientsSent, visitsSent, failed };
}

export function startSyncWatcher(): () => void {
  if (unsubNetInfo) return unsubNetInfo;
  unsubNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
    const online = !!state.isConnected && state.isInternetReachable !== false;
    useSyncStore.getState().setOnline(online);
    if (online) {
      void flushSyncQueue();
    }
  });
  return unsubNetInfo;
}

export function stopSyncWatcher(): void {
  unsubNetInfo?.();
  unsubNetInfo = null;
}

export function pendingCount(): number {
  return (
    usePatientStore.getState().dirtyIds.length +
    useVisitStore.getState().dirtyIds.length
  );
}
