import NetInfo from "@react-native-community/netinfo";
import {
  getUnsyncedVisits,
  markVisitSynced
} from "../db/database";
import type { VisitRecord } from "../../../packages/shared-types";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Summary of a visit sync attempt.
 */
export type SyncResult = {
  synced: number;
  failed: number;
  errors: string[];
};

/**
 * Syncs locally pending visits to the backend one at a time.
 *
 * @param ashaId - Identifier of the ASHA worker whose device is syncing visits.
 * @returns Counts for synced and failed visits with per-visit error messages.
 */
export async function syncPendingVisits(ashaId: string): Promise<SyncResult> {
  const unsyncedVisits = await getUnsyncedVisits();

  if (unsyncedVisits.length === 0) {
    return { synced: 0, failed: 0, errors: [] };
  }

  const isOnline = await checkConnectivity();
  if (!isOnline) {
    return { synced: 0, failed: 0, errors: ["Device is offline"] };
  }

  const result: SyncResult = { synced: 0, failed: 0, errors: [] };
  const visitsForAsha = unsyncedVisits.filter((visit) => visit.ashaId === ashaId);

  for (const visit of visitsForAsha) {
    try {
      await syncVisit(visit);
      await markVisitSynced(visit.id);
      result.synced += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(getSyncErrorMessage(visit.id, error));
    }
  }

  return result;
}

/**
 * Checks whether the device currently has internet access.
 *
 * @returns True when the device is connected and internet is reachable.
 */
export async function checkConnectivity(): Promise<boolean> {
  const networkState = await NetInfo.fetch();
  return Boolean(networkState.isConnected && networkState.isInternetReachable !== false);
}

/**
 * Sends one visit record to the backend sync endpoint.
 *
 * @param visit - Visit record to upload.
 * @returns A promise that resolves when the backend accepts the visit.
 */
async function syncVisit(visit: VisitRecord): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/sync/visit`, {
    body: JSON.stringify(visit),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(await getResponseErrorMessage(response));
  }
}

/**
 * Builds a readable sync error message for a failed visit.
 *
 * @param visitId - Identifier of the visit that failed to sync.
 * @param error - Error thrown during sync.
 * @returns Message suitable for the SyncResult errors array.
 */
function getSyncErrorMessage(visitId: string, error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown sync error";
  return `Visit ${visitId}: ${message}`;
}

/**
 * Extracts an error message from a failed HTTP response.
 *
 * @param response - Failed fetch response from the backend.
 * @returns Backend-provided error text or a status-based fallback message.
 */
async function getResponseErrorMessage(response: Response): Promise<string> {
  try {
    const responseText = await response.text();
    return responseText || `Sync failed with HTTP ${response.status}`;
  } catch {
    return `Sync failed with HTTP ${response.status}`;
  }
}
