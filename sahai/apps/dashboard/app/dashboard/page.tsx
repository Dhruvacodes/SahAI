"use client";

import Link from "next/link";
import useSWR from "swr";

const ANM_ID = process.env.NEXT_PUBLIC_ANM_ID ?? "anm-demo";

type DashboardSummary = {
  totalVisitsToday: number;
  criticalCases: number;
  highRiskCases: number;
  avgRiskScore: number;
  topRiskPatients: TopRiskPatient[];
};

type TopRiskPatient = {
  patientId: string;
  patientName: string;
  village: string;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  riskScore: number;
  lastVisitDate: string;
  topFlag: string;
};

const STAT_CARD_CONFIG = [
  ["Total Visits Today", "totalVisitsToday", "border-emerald-500", "text-emerald-700"],
  ["Critical Cases", "criticalCases", "border-red-500", "text-red-700"],
  ["High Risk Cases", "highRiskCases", "border-orange-500", "text-orange-700"],
  ["Avg Risk Score", "avgRiskScore", "border-sky-500", "text-sky-700"]
] as const;

/**
 * Renders the dashboard overview using live summary data from SWR.
 *
 * @returns Dashboard overview page with stat cards and high-risk patient table.
 */
export default function DashboardPage() {
  const { data, error, isLoading } = useSWR<DashboardSummary>(
    `/api/dashboard/summary?anmId=${encodeURIComponent(ANM_ID)}`,
    fetcher
  );

  return (
    <main className="space-y-8">
      <section>
        <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">
          Overview
        </p>
        <h2 className="mt-2 text-3xl font-black text-slate-950">
          Field health intelligence
        </h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Monitor visit activity, high-risk cases, and referral follow-up across
          supervised ASHA worker visits.
        </p>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          Unable to load dashboard summary.
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-4">
        {isLoading || !data
          ? STAT_CARD_CONFIG.map(([label]) => <StatCardSkeleton key={label} />)
          : STAT_CARD_CONFIG.map(([label, key, borderClass, textClass]) => (
              <article
                className={`rounded-lg border-l-4 ${borderClass} border-y border-r border-slate-200 bg-white p-5 shadow-sm`}
                key={label}
              >
                <p className="text-sm font-semibold text-slate-500">{label}</p>
                <p className={`mt-3 text-4xl font-black ${textClass}`}>
                  {data[key]}
                </p>
              </article>
            ))}
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h3 className="text-xl font-black text-slate-950">High Risk Patients</h3>
          <p className="mt-1 text-sm text-slate-600">Top five cases from the last 7 days</p>
        </div>

        {isLoading || !data ? (
          <TableSkeleton />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                <tr>
                  {[
                    "Patient Name",
                    "Village",
                    "Risk Level",
                    "Score",
                    "Last Visit",
                    "Top Warning",
                    "Action"
                  ].map((heading) => (
                    <th className="px-5 py-3" key={heading}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.topRiskPatients.map((patient) => (
                  <tr className="hover:bg-slate-50" key={patient.patientId}>
                    <td className="px-5 py-4 font-bold text-slate-950">
                      {patient.patientName}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{patient.village}</td>
                    <td className="px-5 py-4">
                      <RiskBadge level={patient.riskLevel} />
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-950">
                      {patient.riskScore}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatDate(patient.lastVisitDate)}
                    </td>
                    <td className="px-5 py-4 text-slate-700">{patient.topFlag}</td>
                    <td className="px-5 py-4">
                      <Link
                        className="rounded-md bg-slate-950 px-3 py-2 text-xs font-black text-white hover:bg-slate-800"
                        href={`/dashboard/patient/${patient.patientId}`}
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

/**
 * Fetches and parses JSON for SWR.
 *
 * @param url - Endpoint URL to request.
 * @returns Parsed JSON payload.
 */
async function fetcher(url: string): Promise<DashboardSummary> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Dashboard summary request failed.");
  }

  return response.json() as Promise<DashboardSummary>;
}

/**
 * Renders a loading placeholder for a stat card.
 *
 * @returns Skeleton card.
 */
function StatCardSkeleton() {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 h-10 w-20 animate-pulse rounded bg-slate-200" />
    </article>
  );
}

/**
 * Renders loading rows for the high-risk patient table.
 *
 * @returns Table skeleton.
 */
function TableSkeleton() {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: 5 }).map((_, index) => (
        <div className="grid grid-cols-7 gap-3" key={index}>
          {Array.from({ length: 7 }).map((__, cellIndex) => (
            <div
              className="h-8 animate-pulse rounded bg-slate-200"
              key={`${index}-${cellIndex}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Renders a color-coded risk level badge.
 *
 * @param props - Risk level to display.
 * @returns Badge element.
 */
function RiskBadge({ level }: { level: TopRiskPatient["riskLevel"] }) {
  const colorClass = {
    LOW: "bg-emerald-100 text-emerald-700",
    MODERATE: "bg-yellow-100 text-yellow-700",
    HIGH: "bg-orange-100 text-orange-700",
    CRITICAL: "bg-red-100 text-red-700"
  }[level];

  return (
    <span className={`rounded-md px-2.5 py-1 text-xs font-black ${colorClass}`}>
      {level}
    </span>
  );
}

/**
 * Formats an ISO date for table display.
 *
 * @param value - ISO date string.
 * @returns Human-readable date string.
 */
function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

