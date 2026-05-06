"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type Visit = {
  id: string;
  visitDate: string;
  riskLevel: string;
  riskScore: number;
  symptoms: string[];
  vitals: Record<string, any>;
  referralGenerated: boolean;
  outcomeStatus: string;
};

export default function PatientDetailPage() {
  const params = useParams();
  const patientId = params.id as string;
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/dashboard/patient/${patientId}/visits`)
      .then((r) => r.json())
      .then((data) => setVisits(data.visits || []))
      .catch(() => setVisits([]))
      .finally(() => setLoading(false));
  }, [patientId]);

  const riskColor = (level: string) => {
    const map: Record<string, string> = {
      LOW: "bg-green-100 text-green-800",
      MODERATE: "bg-yellow-100 text-yellow-800",
      HIGH: "bg-orange-100 text-orange-800",
      CRITICAL: "bg-red-100 text-red-800",
    };
    return map[level] || "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse h-8 w-48 bg-slate-200 rounded mb-4" />
        <div className="animate-pulse h-64 bg-slate-100 rounded" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-black text-slate-900">
        Patient: {patientId}
      </h1>
      <p className="text-sm text-slate-500 mt-1">
        {visits.length} visits on record
      </p>

      {/* BP Trend */}
      {visits.length > 1 && (
        <div className="mt-6 rounded-xl bg-white border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-3">BP Trend</h2>
          <div className="flex items-end gap-2 h-32">
            {visits
              .slice()
              .reverse()
              .map((v, i) => {
                const sbp = v.vitals?.systolicBP || 0;
                const height = Math.max((sbp / 200) * 100, 5);
                return (
                  <div key={i} className="flex flex-col items-center flex-1">
                    <span className="text-xs font-bold text-slate-600">
                      {sbp || "—"}
                    </span>
                    <div
                      className="w-full rounded-t bg-emerald-500 mt-1 transition-all"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-xs text-slate-400 mt-1">
                      {v.visitDate?.slice(5)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Visit History */}
      <div className="mt-6">
        <h2 className="text-lg font-bold text-slate-800 mb-3">
          Visit History
        </h2>
        <div className="space-y-3">
          {visits.map((v) => (
            <div
              key={v.id}
              className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-slate-500">
                    {v.visitDate}
                  </span>
                  <span
                    className={`ml-3 px-2 py-0.5 rounded-full text-xs font-bold ${riskColor(
                      v.riskLevel
                    )}`}
                  >
                    {v.riskLevel}
                  </span>
                </div>
                <span className="text-sm text-slate-400">
                  Score: {(v.riskScore * 100).toFixed(0)}%
                </span>
              </div>
              {v.symptoms && v.symptoms.length > 0 && (
                <p className="mt-2 text-sm text-slate-600">
                  <span className="font-semibold">Symptoms:</span>{" "}
                  {v.symptoms.join(", ")}
                </p>
              )}
              {v.vitals && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {v.vitals.systolicBP != null && (
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded">
                      BP: {v.vitals.systolicBP}/{v.vitals.diastolicBP}
                    </span>
                  )}
                  {v.vitals.temperature != null && (
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded">
                      Temp: {v.vitals.temperature}°C
                    </span>
                  )}
                  {v.vitals.weight != null && (
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded">
                      Weight: {v.vitals.weight}kg
                    </span>
                  )}
                </div>
              )}
              <div className="mt-2 flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    v.outcomeStatus === "PENDING"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-green-50 text-green-700"
                  }`}
                >
                  Outcome: {v.outcomeStatus || "PENDING"}
                </span>
                {v.referralGenerated && (
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                    Referral generated
                  </span>
                )}
              </div>
            </div>
          ))}
          {visits.length === 0 && (
            <p className="text-slate-400 text-sm">No visits recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
}
