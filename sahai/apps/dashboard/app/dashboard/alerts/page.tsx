"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import useSWR, { mutate } from "swr";

import { CountdownPill } from "../../../components/CountdownPill";
import { RiskBadge } from "../../../components/RiskBadge";
import { RuleChip } from "../../../components/RuleChip";
import type {
  AlertListResponse,
  AlertStatus,
  SevereAlert,
} from "../../../types/alerts";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const STATUS_OPTIONS: AlertStatus[] = [
  "NEW",
  "ACKNOWLEDGED",
  "DISPATCHED",
  "RESOLVED",
];

const fetcher = async (url: string): Promise<AlertListResponse> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("alerts request failed");
  return res.json();
};

/**
 * Severe-case alert queue. Sorted by composite urgency score, with live
 * SSE updates and one-click ack/dispatch/resolve actions.
 */
export default function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState<AlertStatus | "ALL">("NEW");
  const [selected, setSelected] = useState<SevereAlert | null>(null);

  const listKey = useMemo(() => {
    const params = new URLSearchParams({ order: "urgency", limit: "200" });
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    return `/api/alerts?${params.toString()}`;
  }, [statusFilter]);

  const { data, error, isLoading } = useSWR<AlertListResponse>(
    listKey,
    fetcher,
    { refreshInterval: 30_000 }
  );

  // Live updates via SSE — token is unwrapped from the httpOnly cookie via a
  // tiny server route, then passed as `?token=` because EventSource cannot
  // send custom headers in the browser.
  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;
    (async () => {
      const tokenRes = await fetch("/api/alerts/sse-token");
      if (!tokenRes.ok || cancelled) return;
      const { token } = (await tokenRes.json()) as { token?: string };
      if (!token || cancelled) return;
      source = new EventSource(
        `${BACKEND_URL}/api/alerts/stream?token=${encodeURIComponent(token)}`
      );
      const refresh = () => mutate(listKey);
      source.addEventListener("alert.created", refresh);
      source.addEventListener("alert.updated", refresh);
      source.onerror = () => {
        // The browser auto-retries; nothing to do here.
      };
    })();
    return () => {
      cancelled = true;
      source?.close();
    };
  }, [listKey]);

  const alerts = data?.alerts ?? [];

  const onActionDone = useCallback(
    (updated: SevereAlert) => {
      setSelected(updated);
      void mutate(listKey);
    },
    [listKey]
  );

  return (
    <main className="space-y-6 p-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-bold uppercase tracking-wider text-red-700">
          Severe alerts
        </p>
        <h2 className="text-3xl font-black text-slate-950">Urgent cases queue</h2>
        <p className="max-w-3xl text-sm text-slate-600">
          High and critical cases flagged in real time by the protocol engine.
          Each card shows the composite urgency score, time-to-treatment
          countdown, and a citation for every fired rule.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-2">
        {(["ALL", ...STATUS_OPTIONS] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => setStatusFilter(opt)}
            className={`rounded-md px-3 py-1.5 text-xs font-black ${
              statusFilter === opt
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
            }`}
          >
            {opt}
          </button>
        ))}
        <span className="ml-auto text-xs font-semibold text-slate-500">
          {data?.count ?? 0} alerts
        </span>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          Could not load alerts.
        </div>
      ) : null}

      {isLoading && !data ? (
        <ListSkeleton />
      ) : alerts.length === 0 ? (
        <EmptyState status={statusFilter} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onSelect={() => setSelected(alert)}
              isSelected={selected?.id === alert.id}
            />
          ))}
        </div>
      )}

      {selected ? (
        <ActionDrawer
          alert={selected}
          onClose={() => setSelected(null)}
          onActionDone={onActionDone}
        />
      ) : null}
    </main>
  );
}

function AlertCard({
  alert,
  onSelect,
  isSelected,
}: {
  alert: SevereAlert;
  onSelect: () => void;
  isSelected: boolean;
}) {
  return (
    <article
      onClick={onSelect}
      className={`cursor-pointer rounded-lg border bg-white p-5 shadow-sm transition-all hover:border-slate-400 ${
        isSelected ? "border-slate-900 ring-2 ring-slate-900" : "border-slate-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <RiskBadge level={alert.riskLevel} />
            <span className="rounded-md bg-slate-900 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">
              {alert.status}
            </span>
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
              U {Math.round(alert.urgencyScore)}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-black text-slate-950">
            {alert.patientName ?? alert.patientId}
          </h3>
          <p className="text-xs font-semibold text-slate-500">
            {alert.village ?? "—"} • ASHA {alert.ashaId} • {alert.visitType ?? ""}
          </p>
        </div>
        <CountdownPill dueAt={alert.slaDueAt} />
      </div>

      {alert.chiefComplaint ? (
        <p className="mt-3 text-sm leading-snug text-slate-700">
          {alert.chiefComplaint}
        </p>
      ) : null}

      {alert.firedRuleIds.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {alert.firedRuleIds.map((rid) => (
            <RuleChip key={rid} ruleId={rid} />
          ))}
        </div>
      ) : null}

      <footer className="mt-4 flex items-center justify-between text-[11px] font-semibold text-slate-500">
        <span>Risk score {Math.round(alert.riskScore)}</span>
        <span>
          Synced{" "}
          {new Date(alert.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </footer>
    </article>
  );
}

function EmptyState({ status }: { status: AlertStatus | "ALL" }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
      No {status === "ALL" ? "" : status.toLowerCase()} alerts in your queue.
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-lg border border-slate-200 bg-white"
        />
      ))}
    </div>
  );
}

// ─── action drawer ──────────────────────────────────────────────────────────

function ActionDrawer({
  alert,
  onClose,
  onActionDone,
}: {
  alert: SevereAlert;
  onClose: () => void;
  onActionDone: (updated: SevereAlert) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [eta, setEta] = useState<string>(String(alert.dispatchEtaMinutes ?? ""));
  const [dispatchNotes, setDispatchNotes] = useState<string>(
    alert.dispatchNotes ?? ""
  );
  const [resolveNotes, setResolveNotes] = useState<string>(
    alert.resolutionNotes ?? ""
  );
  const [error, setError] = useState<string | null>(null);

  const callAction = async (
    action: "ack" | "dispatch" | "resolve",
    body?: Record<string, unknown>
  ) => {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(
        `/api/alerts/${encodeURIComponent(alert.id)}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json?.detail ?? json?.error ?? "Action failed");
      } else if (json?.alert) {
        onActionDone(json.alert as SevereAlert);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const status = alert.status;
  const firstResponse = (alert.payload?.firstResponseActions as
    | Array<{ id?: string; text?: Record<string, string> }>
    | undefined) ?? [];

  return (
    <div className="fixed inset-0 z-40 flex">
      <button
        aria-label="Close"
        onClick={onClose}
        className="flex-1 bg-slate-900/50"
      />
      <aside className="flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl">
        <header className="border-b border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-950">
              {alert.patientName ?? alert.patientId}
            </h3>
            <button
              onClick={onClose}
              className="text-sm font-bold text-slate-500 hover:text-slate-900"
            >
              Close
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <RiskBadge level={alert.riskLevel} />
            <span className="rounded-md bg-slate-900 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">
              {status}
            </span>
            <CountdownPill dueAt={alert.slaDueAt} />
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            ASHA {alert.ashaId} • {alert.village ?? "village unknown"}
          </p>
        </header>

        <div className="space-y-5 p-5 text-sm">
          {alert.chiefComplaint ? (
            <Section title="Chief complaint">
              <p className="text-slate-700">{alert.chiefComplaint}</p>
            </Section>
          ) : null}

          {alert.firedRuleIds.length ? (
            <Section title="Fired protocol rules">
              <div className="flex flex-wrap gap-1.5">
                {alert.firedRuleIds.map((rid) => (
                  <RuleChip key={rid} ruleId={rid} />
                ))}
              </div>
            </Section>
          ) : null}

          {firstResponse.length ? (
            <Section title="First-response checklist (ASHA)">
              <ol className="list-decimal space-y-1 pl-5 text-slate-700">
                {firstResponse.map((a, idx) => (
                  <li key={a.id ?? idx}>{a.text?.en ?? a.text?.hi ?? a.id}</li>
                ))}
              </ol>
            </Section>
          ) : null}

          {Object.keys(alert.vitals ?? {}).length ? (
            <Section title="Vitals snapshot">
              <ul className="grid grid-cols-2 gap-1 text-slate-700">
                {Object.entries(alert.vitals).map(([k, v]) =>
                  v == null ? null : (
                    <li key={k} className="text-xs">
                      <span className="font-bold text-slate-500">{k}: </span>
                      <span>{String(v)}</span>
                    </li>
                  )
                )}
              </ul>
            </Section>
          ) : null}

          <Section title="Take action">
            {error ? (
              <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                {error}
              </p>
            ) : null}

            <div className="space-y-3">
              {status === "NEW" ? (
                <button
                  disabled={busy !== null}
                  onClick={() => callAction("ack")}
                  className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-black text-white disabled:opacity-60"
                >
                  {busy === "ack" ? "Acknowledging…" : "Acknowledge"}
                </button>
              ) : null}

              {status !== "RESOLVED" ? (
                <div className="rounded-md border border-slate-200 p-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Dispatch ETA (minutes)
                  </label>
                  <input
                    type="number"
                    value={eta}
                    onChange={(e) => setEta(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    placeholder="e.g. 20"
                  />
                  <label className="mt-2 block text-xs font-bold text-slate-700">
                    Dispatch notes
                  </label>
                  <textarea
                    value={dispatchNotes}
                    onChange={(e) => setDispatchNotes(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    placeholder="ANM en route with 108 ambulance"
                  />
                  <button
                    disabled={busy !== null}
                    onClick={() =>
                      callAction("dispatch", {
                        etaMinutes: eta ? Number(eta) : undefined,
                        notes: dispatchNotes || undefined,
                      })
                    }
                    className="mt-2 w-full rounded-md bg-orange-600 px-3 py-2 text-sm font-black text-white disabled:opacity-60"
                  >
                    {busy === "dispatch" ? "Dispatching…" : "Dispatch care"}
                  </button>
                </div>
              ) : null}

              {status !== "RESOLVED" ? (
                <div className="rounded-md border border-slate-200 p-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Resolution notes
                  </label>
                  <textarea
                    value={resolveNotes}
                    onChange={(e) => setResolveNotes(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    placeholder="Patient stabilised at CHC"
                  />
                  <button
                    disabled={busy !== null}
                    onClick={() =>
                      callAction("resolve", { notes: resolveNotes || undefined })
                    }
                    className="mt-2 w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-black text-white disabled:opacity-60"
                  >
                    {busy === "resolve" ? "Resolving…" : "Resolve"}
                  </button>
                </div>
              ) : null}
            </div>
          </Section>

          {alert.acknowledgedAt ? (
            <p className="text-[11px] text-slate-500">
              Acknowledged at {new Date(alert.acknowledgedAt).toLocaleString()} by{" "}
              {alert.acknowledgedBy}
            </p>
          ) : null}
          {alert.dispatchedAt ? (
            <p className="text-[11px] text-slate-500">
              Dispatched at {new Date(alert.dispatchedAt).toLocaleString()} by{" "}
              {alert.dispatchedBy}
              {alert.dispatchEtaMinutes ? ` • ETA ${alert.dispatchEtaMinutes}m` : ""}
            </p>
          ) : null}
          {alert.resolvedAt ? (
            <p className="text-[11px] text-slate-500">
              Resolved at {new Date(alert.resolvedAt).toLocaleString()} by{" "}
              {alert.resolvedBy}
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-[11px] font-black uppercase tracking-wide text-slate-500">
        {title}
      </h4>
      <div>{children}</div>
    </section>
  );
}
