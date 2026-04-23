import * as SQLite from "expo-sqlite";
import type { ExtractedVitals, VisitRecord } from "../../../packages/shared-types";

export const db = SQLite.openDatabase("sahai.db");

const CREATE_VISITS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY,
    patientId TEXT NOT NULL,
    ashaId TEXT NOT NULL,
    visitDate TEXT NOT NULL,
    rawTranscript TEXT,
    extractedVitals TEXT,
    symptoms TEXT,
    riskScore INTEGER,
    riskLevel TEXT,
    referralText TEXT,
    followUpPlan TEXT,
    syncedToCloud INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL
  );
`;

const CREATE_PATIENTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ageYears INTEGER,
    isPregnant INTEGER DEFAULT 0,
    gestationalWeek INTEGER,
    village TEXT,
    ashaId TEXT,
    lastVisitDate TEXT
  );
`;

const DEFAULT_EXTRACTED_VITALS: ExtractedVitals = {
  bloodPressureSystolic: null,
  bloodPressureDiastolic: null,
  hemoglobinLevel: null,
  fetalMovements: null,
  oedema: null,
  temperature: null
};

type QueryValue = string | number | null;

interface VisitRow {
  id: string;
  patientId: string;
  ashaId: string;
  visitDate: string;
  rawTranscript: string | null;
  extractedVitals: string | null;
  symptoms: string | null;
  riskScore: number | null;
  riskLevel: string | null;
  referralText: string | null;
  followUpPlan: string | null;
  syncedToCloud: number | null;
}

/**
 * Creates local SQLite tables required for offline visit capture and sync.
 *
 * @returns A promise that resolves after the visits and patients tables exist.
 */
export async function initializeDatabase(): Promise<void> {
  await executeSql(CREATE_VISITS_TABLE_SQL);
  await executeSql(CREATE_PATIENTS_TABLE_SQL);
}

/**
 * Saves or replaces a visit record in the local SQLite cache.
 *
 * @param visit - Visit record to persist locally.
 * @returns A promise that resolves after the visit has been written.
 */
export async function saveVisit(visit: VisitRecord): Promise<void> {
  await executeSql(
    `
      INSERT OR REPLACE INTO visits (
        id,
        patientId,
        ashaId,
        visitDate,
        rawTranscript,
        extractedVitals,
        symptoms,
        riskScore,
        riskLevel,
        referralText,
        followUpPlan,
        syncedToCloud,
        createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      visit.id,
      visit.patientId,
      visit.ashaId,
      visit.visitDate,
      visit.rawTranscriptText,
      JSON.stringify(visit.extractedVitals),
      JSON.stringify(visit.symptoms),
      visit.riskScore,
      visit.riskLevel,
      getOptionalStringField(visit, "referralText"),
      visit.followUpPlan,
      visit.syncedToCloud ? 1 : 0,
      getOptionalStringField(visit, "createdAt") ?? new Date().toISOString()
    ]
  );
}

/**
 * Reads all visit records that have not yet been uploaded to the cloud.
 *
 * @returns Unsynced visit records ordered by newest visit first.
 */
export async function getUnsyncedVisits(): Promise<VisitRecord[]> {
  const result = await executeSql(
    "SELECT * FROM visits WHERE syncedToCloud = 0 ORDER BY visitDate DESC;"
  );
  return rowsToVisitRecords(result);
}

/**
 * Marks a local visit record as synced after a successful cloud upload.
 *
 * @param visitId - Identifier of the visit that was synced.
 * @returns A promise that resolves after the sync flag is updated.
 */
export async function markVisitSynced(visitId: string): Promise<void> {
  await executeSql("UPDATE visits SET syncedToCloud = 1 WHERE id = ?;", [visitId]);
}

/**
 * Reads local visit history for a patient in reverse chronological order.
 *
 * @param patientId - Identifier of the patient whose visits should be loaded.
 * @returns Visit records for the patient ordered by visit date descending.
 */
export async function getPatientVisitHistory(patientId: string): Promise<VisitRecord[]> {
  const result = await executeSql(
    "SELECT * FROM visits WHERE patientId = ? ORDER BY visitDate DESC;",
    [patientId]
  );
  return rowsToVisitRecords(result);
}

/**
 * Executes a SQLite statement and exposes the result as a promise.
 *
 * @param sql - SQL statement to execute.
 * @param params - Positional query parameters for the SQL statement.
 * @returns SQLite result set for the executed statement.
 */
function executeSql(
  sql: string,
  params: QueryValue[] = []
): Promise<SQLite.SQLResultSet> {
  return new Promise((resolve, reject) => {
    db.transaction((transaction) => {
      transaction.executeSql(
        sql,
        params,
        (_, result) => resolve(result),
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
}

/**
 * Converts a SQLite result set into shared VisitRecord objects.
 *
 * @param result - SQLite result containing visit rows.
 * @returns Parsed visit records.
 */
function rowsToVisitRecords(result: SQLite.SQLResultSet): VisitRecord[] {
  const visits: VisitRecord[] = [];

  for (let index = 0; index < result.rows.length; index += 1) {
    visits.push(rowToVisitRecord(result.rows.item(index) as VisitRow));
  }

  return visits;
}

/**
 * Converts a single SQLite visit row into the shared VisitRecord interface.
 *
 * @param row - SQLite row from the visits table.
 * @returns Parsed visit record.
 */
function rowToVisitRecord(row: VisitRow): VisitRecord {
  return {
    id: row.id,
    patientId: row.patientId,
    ashaId: row.ashaId,
    visitDate: row.visitDate,
    rawTranscriptText: row.rawTranscript ?? "",
    extractedVitals: parseExtractedVitals(row.extractedVitals),
    symptoms: parseStringArray(row.symptoms),
    riskScore: row.riskScore ?? 0,
    riskLevel: parseRiskLevel(row.riskLevel),
    referralGenerated: Boolean(row.referralText),
    followUpPlan: row.followUpPlan ?? "",
    syncedToCloud: row.syncedToCloud === 1
  };
}

/**
 * Parses serialized vitals JSON from SQLite.
 *
 * @param value - JSON string stored in the extractedVitals column.
 * @returns Extracted vitals with missing fields normalized to null.
 */
function parseExtractedVitals(value: string | null): ExtractedVitals {
  const parsedValue = parseJsonObject(value);

  return {
    bloodPressureSystolic: getNumberOrNull(parsedValue.bloodPressureSystolic),
    bloodPressureDiastolic: getNumberOrNull(parsedValue.bloodPressureDiastolic),
    hemoglobinLevel: getNumberOrNull(parsedValue.hemoglobinLevel),
    fetalMovements: getBooleanOrNull(parsedValue.fetalMovements),
    oedema: getBooleanOrNull(parsedValue.oedema),
    temperature: getNumberOrNull(parsedValue.temperature)
  };
}

/**
 * Parses a JSON array string into a string array.
 *
 * @param value - JSON string stored in the symptoms column.
 * @returns Parsed string array, or an empty array when invalid.
 */
function parseStringArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);
    return Array.isArray(parsedValue)
      ? parsedValue.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * Parses a JSON object string into a loose record.
 *
 * @param value - JSON string that should contain an object.
 * @returns Parsed object, or default vitals when invalid.
 */
function parseJsonObject(value: string | null): Record<string, unknown> {
  if (!value) {
    return { ...DEFAULT_EXTRACTED_VITALS };
  }

  try {
    const parsedValue = JSON.parse(value);
    return parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue)
      ? parsedValue
      : { ...DEFAULT_EXTRACTED_VITALS };
  } catch {
    return { ...DEFAULT_EXTRACTED_VITALS };
  }
}

/**
 * Converts unknown numeric input to a number or null.
 *
 * @param value - Value read from parsed JSON.
 * @returns Number value when valid, otherwise null.
 */
function getNumberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

/**
 * Converts unknown boolean input to a boolean or null.
 *
 * @param value - Value read from parsed JSON.
 * @returns Boolean value when valid, otherwise null.
 */
function getBooleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/**
 * Reads optional string metadata from a VisitRecord-compatible object.
 *
 * @param visit - Visit record with possible local extension fields.
 * @param fieldName - Field name to read from the record.
 * @returns String value when present, otherwise null.
 */
function getOptionalStringField(
  visit: VisitRecord,
  fieldName: "createdAt" | "referralText"
): string | null {
  const value = (visit as VisitRecord & Record<string, unknown>)[fieldName];
  return typeof value === "string" ? value : null;
}

/**
 * Normalizes stored risk level text into the shared VisitRecord union.
 *
 * @param riskLevel - Risk level text read from SQLite.
 * @returns A supported risk level value.
 */
function parseRiskLevel(
  riskLevel: string | null
): VisitRecord["riskLevel"] {
  if (
    riskLevel === "LOW" ||
    riskLevel === "MEDIUM" ||
    riskLevel === "HIGH" ||
    riskLevel === "CRITICAL"
  ) {
    return riskLevel;
  }

  return "LOW";
}
