export type AlertStatus = "NEW" | "ACKNOWLEDGED" | "DISPATCHED" | "RESOLVED";
export type AlertRiskLevel = "HIGH" | "CRITICAL";

export interface SevereAlert {
  id: string;
  visitId: string;
  patientId: string;
  ashaId: string;
  anmId: string | null;
  district: string | null;
  village: string | null;
  patientName: string | null;
  visitType: string | null;
  languageCode: string | null;
  riskLevel: AlertRiskLevel;
  riskScore: number;
  urgencyScore: number;
  tttMinutes: number | null;
  slaDueAt: string | null;
  chiefComplaint: string | null;
  firedRuleIds: string[];
  flags: string[];
  vitals: Record<string, unknown>;
  payload: Record<string, unknown>;
  protocolVersion: string | null;
  status: AlertStatus;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  dispatchedAt: string | null;
  dispatchedBy: string | null;
  dispatchEtaMinutes: number | null;
  dispatchNotes: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlertListResponse {
  alerts: SevereAlert[];
  count: number;
}

export interface AlertDetailResponse {
  alert: SevereAlert;
}

export interface ProtocolRuleDoc {
  id: string;
  vertical: string;
  label: Record<string, string>;
  rationale?: string;
  source?: { doc?: string; section?: string; year?: number };
  sourceDoc?: { id: string; title: string; url?: string; year?: number };
  ttt_minutes?: number;
  escalates_to?: string;
  first_response_actions?: Array<{ id?: string; text?: Record<string, string> }>;
}
