/**
 * Feedback store: tail of severe-case alerts (`/api/alerts/feedback`) showing
 * each HIGH/CRITICAL visit's current status with the supervising ANM.
 *
 * The store is persisted so the worker sees the last-known state offline,
 * and a periodic poller (`startFeedbackWatcher`) refreshes it whenever the
 * device is online and an `ashaId` is configured.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { fetchAlertFeedback, type AlertFeedbackItem } from "./api";
import { persistStorage } from "./persist";
import { useSyncStore } from "./syncQueue";

interface FeedbackState {
  items: AlertFeedbackItem[];
  lastFetchedAt?: string;
  lastError?: string;
  isFetching: boolean;
  setItems: (items: AlertFeedbackItem[]) => void;
  upsertItems: (items: AlertFeedbackItem[]) => void;
  setError: (msg?: string) => void;
  setFetching: (v: boolean) => void;
  setLastFetchedAt: (iso: string) => void;
  itemForVisit: (visitId: string) => AlertFeedbackItem | undefined;
  unresolvedCount: () => number;
}

export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set, get) => ({
      items: [],
      isFetching: false,
      setItems: (items) => set({ items }),
      upsertItems: (next) =>
        set((state) => {
          const byId = new Map<string, AlertFeedbackItem>();
          for (const item of state.items) byId.set(item.alertId, item);
          for (const item of next) byId.set(item.alertId, item);
          return {
            items: Array.from(byId.values()).sort((a, b) =>
              (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
            ),
          };
        }),
      setError: (msg) => set({ lastError: msg }),
      setFetching: (v) => set({ isFetching: v }),
      setLastFetchedAt: (iso) => set({ lastFetchedAt: iso }),
      itemForVisit: (visitId) =>
        get().items.find((item) => item.visitId === visitId),
      unresolvedCount: () =>
        get().items.filter((item) => item.status !== "RESOLVED").length,
    }),
    {
      name: "sahai_feedback_v1",
      storage: persistStorage,
    },
  ),
);

export async function refreshFeedback(ashaId: string): Promise<void> {
  if (!ashaId) return;
  const store = useFeedbackStore.getState();
  if (store.isFetching) return;
  store.setFetching(true);
  try {
    const response = await fetchAlertFeedback({
      ashaId,
      since: store.lastFetchedAt,
    });
    store.upsertItems(response.items ?? []);
    store.setLastFetchedAt(response.fetchedAt);
    store.setError(undefined);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    store.setError(message);
  } finally {
    store.setFetching(false);
  }
}

let timer: ReturnType<typeof setInterval> | undefined;

/**
 * Start a periodic feedback poller. Polls every `intervalMs` (default 60s)
 * but only when the device is online (we read the global sync store's
 * `isOnline` flag). Returns a stop fn.
 */
export function startFeedbackWatcher(
  ashaId: string,
  intervalMs = 60_000,
): () => void {
  stopFeedbackWatcher();
  if (!ashaId) {
    return () => undefined;
  }
  const tick = async () => {
    const isOnline = useSyncStore.getState().isOnline;
    if (!isOnline) return;
    await refreshFeedback(ashaId);
  };
  // Immediate fire so the inbox populates on app launch.
  void tick();
  timer = setInterval(tick, intervalMs);
  return () => stopFeedbackWatcher();
}

export function stopFeedbackWatcher(): void {
  if (timer !== undefined) {
    clearInterval(timer);
    timer = undefined;
  }
}
