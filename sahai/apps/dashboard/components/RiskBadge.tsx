/**
 * Color-coded risk-level pill used across the dashboard.
 */
export function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    LOW: "bg-emerald-100 text-emerald-700",
    MODERATE: "bg-yellow-100 text-yellow-700",
    HIGH: "bg-orange-100 text-orange-800",
    CRITICAL: "bg-red-100 text-red-700",
  };
  const colorClass = map[level] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`rounded-md px-2.5 py-1 text-xs font-black ${colorClass}`}>
      {level}
    </span>
  );
}
