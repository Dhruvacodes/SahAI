"use client";

import { useEffect, useMemo, useState } from "react";

type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

type DistrictRow = {
  name: string;
  avgRiskScore: number;
  criticalCount: number;
  totalVisits: number;
  dominantRisk: RiskLevel;
};

type DistrictHeatmapResponse = {
  districts: DistrictRow[];
};

type SortKey =
  | "name"
  | "avgRiskScore"
  | "criticalCount"
  | "totalVisits"
  | "dominantRisk";

type SortDirection = "asc" | "desc";

/**
 * Renders a sortable district-level risk heatmap table.
 *
 * @returns District heatmap page for dashboard users.
 */
export default function DashboardHeatmapPage() {
  const [data, setData] = useState<DistrictHeatmapResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("avgRiskScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    void loadHeatmap();
  }, []);

  /**
   * Fetches district heatmap data from the dashboard API.
   */
  async function loadHeatmap() {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const response = await fetch("/api/dashboard/district-heatmap");
      if (!response.ok) {
        throw new Error("Unable to load district heatmap.");
      }

      const payload = (await response.json()) as DistrictHeatmapResponse;
      setData(payload);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load district heatmap."
      );
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Updates sort state for the selected column.
   *
   * @param key - Column key to sort by.
   */
  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "name" ? "asc" : "desc");
  }

  const sortedDistricts = useMemo(() => {
    const districts = [...(data?.districts ?? [])];
    const severityOrder: Record<RiskLevel, number> = {
      LOW: 0,
      MODERATE: 1,
      HIGH: 2,
      CRITICAL: 3
    };

    districts.sort((left, right) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      if (sortKey === "dominantRisk") {
        return (
          (severityOrder[left.dominantRisk] - severityOrder[right.dominantRisk]) *
          direction
        );
      }

      if (sortKey === "name") {
        return left.name.localeCompare(right.name) * direction;
      }

      return ((left[sortKey] as number) - (right[sortKey] as number)) * direction;
    });

    return districts;
  }, [data?.districts, sortDirection, sortKey]);

  return (
    <main className="space-y-8">
      <section>
        <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">
          District Heatmap
        </p>
        <h2 className="mt-2 text-3xl font-black text-slate-950">
          District-level risk view
        </h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Compare district averages, critical case counts, and dominant risk patterns
          to prioritize field response.
        </p>
      </section>

      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h3 className="text-xl font-black text-slate-950">District Risk Table</h3>
          <p className="mt-1 text-sm text-slate-600">Recent visits grouped by district</p>
        </div>

        {isLoading ? (
          <HeatmapTableSkeleton />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <SortableHeader
                    activeKey={sortKey}
                    direction={sortDirection}
                    label="District"
                    onSort={handleSort}
                    sortKey="name"
                  />
                  <SortableHeader
                    activeKey={sortKey}
                    direction={sortDirection}
                    label="Avg Risk Score"
                    onSort={handleSort}
                    sortKey="avgRiskScore"
                  />
                  <SortableHeader
                    activeKey={sortKey}
                    direction={sortDirection}
                    label="Critical Cases"
                    onSort={handleSort}
                    sortKey="criticalCount"
                  />
                  <SortableHeader
                    activeKey={sortKey}
                    direction={sortDirection}
                    label="Total Visits"
                    onSort={handleSort}
                    sortKey="totalVisits"
                  />
                  <SortableHeader
                    activeKey={sortKey}
                    direction={sortDirection}
                    label="Dominant Risk"
                    onSort={handleSort}
                    sortKey="dominantRisk"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedDistricts.map((district) => (
                  <tr className={getRowBackgroundClass(district.dominantRisk)} key={district.name}>
                    <td className="px-5 py-4 font-bold text-slate-950">{district.name}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-2.5 w-36 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${getProgressFillClass(
                              district.dominantRisk
                            )}`}
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(district.avgRiskScore, 100)
                              )}%`
                            }}
                          />
                        </div>
                        <span className="font-bold text-slate-950">
                          {district.avgRiskScore.toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-950">
                      {district.criticalCount}
                    </td>
                    <td className="px-5 py-4 text-slate-700">{district.totalVisits}</td>
                    <td className="px-5 py-4">
                      <RiskBadge level={district.dominantRisk} />
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
 * Renders one sortable table header cell.
 *
 * @param props - Label, current sort state, and click handler.
 * @returns Sortable header cell.
 */
function SortableHeader({
  activeKey,
  direction,
  label,
  onSort,
  sortKey
}: {
  activeKey: SortKey;
  direction: SortDirection;
  label: string;
  onSort: (key: SortKey) => void;
  sortKey: SortKey;
}) {
  const indicator =
    activeKey === sortKey ? (direction === "asc" ? "↑" : "↓") : "↕";

  return (
    <th className="px-5 py-3">
      <button
        className="flex items-center gap-2 text-left"
        onClick={() => onSort(sortKey)}
        type="button"
      >
        <span>{label}</span>
        <span>{indicator}</span>
      </button>
    </th>
  );
}

/**
 * Renders a badge for dominant risk labels.
 *
 * @param props - Dominant risk level to display.
 * @returns Risk badge.
 */
function RiskBadge({ level }: { level: RiskLevel }) {
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
 * Renders loading placeholders for the heatmap table.
 *
 * @returns Table skeleton.
 */
function HeatmapTableSkeleton() {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: 6 }).map((_, rowIndex) => (
        <div className="grid grid-cols-5 gap-3" key={rowIndex}>
          {Array.from({ length: 5 }).map((__, cellIndex) => (
            <div
              className="h-9 animate-pulse rounded bg-slate-200"
              key={`${rowIndex}-${cellIndex}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Maps dominant risk levels to row background colors.
 *
 * @param level - Dominant risk level.
 * @returns Tailwind row background class.
 */
function getRowBackgroundClass(level: RiskLevel): string {
  return {
    LOW: "bg-green-50",
    MODERATE: "bg-yellow-50",
    HIGH: "bg-orange-50",
    CRITICAL: "bg-red-50"
  }[level];
}

/**
 * Maps dominant risk levels to progress bar colors.
 *
 * @param level - Dominant risk level.
 * @returns Tailwind progress fill class.
 */
function getProgressFillClass(level: RiskLevel): string {
  return {
    LOW: "bg-emerald-500",
    MODERATE: "bg-yellow-500",
    HIGH: "bg-orange-500",
    CRITICAL: "bg-red-500"
  }[level];
}

