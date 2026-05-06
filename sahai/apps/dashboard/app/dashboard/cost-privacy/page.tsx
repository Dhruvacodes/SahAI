"use client";

import { useEffect, useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type CostSummary = {
  todayINR: number;
  weekINR: number;
  perVisitINR: number;
  totalVisitsToday: number;
  modelSplit: Record<string, number>;
};

export default function CostPrivacyPage() {
  const [cost, setCost] = useState<CostSummary | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/dashboard/cost-summary`)
      .then((r) => r.json())
      .then(setCost)
      .catch(() => setCost(null));
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-black text-slate-900">
        Cost & Privacy Dashboard
      </h1>

      {/* Cost Cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <CostCard
          label="Today's Cost"
          value={cost ? `₹${cost.todayINR.toFixed(2)}` : "—"}
          sub="Total API spend today"
          color="emerald"
        />
        <CostCard
          label="This Week"
          value={cost ? `₹${cost.weekINR.toFixed(2)}` : "—"}
          sub="Last 7 days"
          color="teal"
        />
        <CostCard
          label="Per Visit"
          value={cost ? `₹${cost.perVisitINR.toFixed(2)}` : "—"}
          sub="Blended cost today"
          color="blue"
        />
        <CostCard
          label="Visits Today"
          value={cost ? String(cost.totalVisitsToday) : "—"}
          sub="Processed visits"
          color="purple"
        />
      </div>

      {/* Model Split */}
      {cost && Object.keys(cost.modelSplit).length > 0 && (
        <div className="mt-6 rounded-xl bg-white border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-4">
            Model Cost Split (Week)
          </h2>
          <div className="space-y-3">
            {Object.entries(cost.modelSplit).map(([provider, costINR]) => {
              const pct =
                cost.weekINR > 0
                  ? ((costINR / cost.weekINR) * 100).toFixed(0)
                  : "0";
              return (
                <div key={provider}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700 capitalize">
                      {provider}
                    </span>
                    <span className="text-slate-500">
                      ₹{costINR.toFixed(2)} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Privacy Posture */}
      <div className="mt-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">
          DPDP Privacy Posture
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PrivacyCard
            title="§6 — Data Minimization"
            items={[
              "Audio is NOT stored — only transcript hash",
              "PII regex-redacted before cloud sync",
              "Vitals stored anonymized in extractedVitals",
              "Audit logs contain metadata only",
            ]}
            status="COMPLIANT"
          />
          <PrivacyCard
            title="§11 — Right to Withdrawal"
            items={[
              "Consent withdrawal via /api/consent/withdraw",
              "Downstream calls return 403 CONSENT_WITHDRAWN",
              "Withdrawal reason recorded",
              "All linked data flagged",
            ]}
            status="COMPLIANT"
          />
          <PrivacyCard
            title="§8 — Notice & Purpose"
            items={[
              "Voice-first consent (no literacy required)",
              "11 languages supported",
              "SHA-256 receipt hash per consent",
              "DPDP notice version tracked",
            ]}
            status="COMPLIANT"
          />
        </div>
      </div>
    </div>
  );
}

function CostCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
      <p className={`text-xs font-bold uppercase tracking-wider text-${color}-600`}>
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

function PrivacyCard({
  title,
  items,
  status,
}: {
  title: string;
  items: string[];
  status: string;
}) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
          {status}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
            <span className="text-green-500 mt-0.5">✓</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
