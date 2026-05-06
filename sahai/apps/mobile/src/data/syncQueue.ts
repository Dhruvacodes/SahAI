/**
 * Background sync queue.
 *
 * Watches NetInfo: when the device is online, it iterates over dirty patients
 * and visits and pushes them to the backend. Failures are tolerated and the
 * record stays in the dirty set for retry, but the failure (status code +
 * truncated body) is captured into `lastErrors` so the Settings screen can
 * show *why* a sync failed instead of a useless "Failed: 2".
 */

import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { create } from "zustand";
import { ApiError, syncVisit, upsertPatient } from "./api";
import { usePatientStore } from "./patientStore";
import { useVisitStore } from "./visitStore";

export interface SyncResult {
  patientsSent: number;
  visitsSent: number;
  failed: number;
  attempted: number;
}

export interface SyncErrorEntry {
  /** ISO timestamp when the failure was captured. */
  at: string;
  /** Which step failed: which record kind and id. */
  kind: "patient" | "visit";
  id: string;
  /** HTTP status if it was an HTTP error, else 0. */
  status: number;
  /** Short, human-readable reason — e.g. `HTTP 500: no such table: patients`. */
  message: string;
}

interface SyncState {
  isOnline: boolean;
  isFlushing: boolean;
  lastFlushAt?: string;
  lastResult?: SyncResult;
  lastErrors: SyncErrorEntry[];
  setOnline: (value: boolean) => void;
  setFlushing: (value: boolean) => void;
  setLastFlushAt: (iso: string) => void;
  setLastResult: (result: SyncResult) => void;
  pushError: (entry: SyncErrorEntry) => void;
  clearErrors: () => void;
}

const MAX_ERRORS_RETAINED = 10;

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: true,
  isFlushing: false,
  lastFlushAt: undefined,
  lastResult: undefined,
  lastErrors: [],
  setOnline: (value) => set({ isOnline: value }),
  setFlushing: (value) => set({ isFlushing: value }),
  setLastFlushAt: (iso) => set({ lastFlushAt: iso }),
  setLastResult: (result) => set({ lastResult: result }),
  pushError: (entry) =>
    set((state) => ({
      lastErrors: [entry, ...state.lastErrors].slice(0, MAX_ERRORS_RETAINED),
    })),
  clearErrors: () => set({ lastErrors: [] }),
}));

let unsubNetInfo: (() => void) | null = null;
let inFlight = false;

function summarizeError(err: unknown): { status: number; message: string } {
  if (err instanceof ApiError) {
    const trimmedBody = err.body ? err.body.replace(/\s+/g, " ").slice(0, 240) : "";
    return {
      status: err.status,
      message: trimmedBody ? `HTTP ${err.status}: ${trimmedBody}` : `HTTP ${err.status}`,
    };
  }
  if (err instanceof Error) {
    return { status: 0, message: err.message || "Network error" };
  }
  return { status: 0, message: "Unknown error" };
}

/**
 * Push everything dirty to the backend.
 *
 * If a flush is already running, returns the *previous* result rather than a
 * misleading 0/0/0 — callers (e.g. the Settings alert) can then show "still
 * syncing" instead of pretending nothing was queued.
 */
export async function flushSyncQueue(): Promise<SyncResult> {
  if (inFlight) {
    return (
      useSyncStore.getState().lastResult ?? {
        patientsSent: 0,
        visitsSent: 0,
        failed: 0,
        attempted: 0,
      }
    );
  }
  inFlight = true;
  useSyncStore.getState().setFlushing(true);

  let patientsSent = 0;
  let visitsSent = 0;
  let failed = 0;
  let attempted = 0;

  try {
    const patientStore = usePatientStore.getState();
    const visitStore = useVisitStore.getState();

    for (const id of [...patientStore.dirtyIds]) {
      attempted++;
      const patient = patientStore.patients.find((p) => p.id === id);
      if (!patient) {
        patientStore.markSynced(id);
        continue;
      }
      try {
        await upsertPatient(patient);
        patientStore.markSynced(id);
        patientsSent++;
      } catch (err) {
        const { status, message } = summarizeError(err);
        // eslint-disable-next-line no-console
        console.warn("[sync] upsertPatient failed", id, status, message);
        useSyncStore.getState().pushError({
          at: new Date().toISOString(),
          kind: "patient",
          id,
          status,
          message,
        });
        failed++;
      }
    }

    for (const id of [...visitStore.dirtyIds]) {
      attempted++;
      const visit = visitStore.visits.find((v) => v.id === id);
      if (!visit) {
        visitStore.markSynced(id);
        continue;
      }
      try {
        await syncVisit(visit);
        visitStore.markSynced(id);
        visitsSent++;
      } catch (err) {
        const { status, message } = summarizeError(err);
        // eslint-disable-next-line no-console
        console.warn("[sync] syncVisit failed", id, status, message);
        useSyncStore.getState().pushError({
          at: new Date().toISOString(),
          kind: "visit",
          id,
          status,
          message,
        });
        failed++;
      }
    }

    const finishedAt = new Date().toISOString();
    const result: SyncResult = { patientsSent, visitsSent, failed, attempted };
    useSyncStore.getState().setLastFlushAt(finishedAt);
    useSyncStore.getState().setLastResult(result);
    return result;
  } finally {
    inFlight = false;
    useSyncStore.getState().setFlushing(false);
  }
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
