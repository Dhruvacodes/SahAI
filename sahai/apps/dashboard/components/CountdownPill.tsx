"use client";

import { useEffect, useState } from "react";

/**
 * Live countdown to the SLA due time for a severe-case alert.
 * Updates every second; turns red when overdue.
 */
export function CountdownPill({ dueAt }: { dueAt: string | null }) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!dueAt) {
    return <span className="text-xs font-bold text-slate-400">—</span>;
  }

  const dueMs = new Date(dueAt).getTime();
  if (Number.isNaN(dueMs)) {
    return <span className="text-xs font-bold text-slate-400">—</span>;
  }

  const diff = dueMs - now;
  const overdue = diff < 0;
  const totalSec = Math.floor(Math.abs(diff) / 1000);
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  const formatted = hh > 0 ? `${hh}h ${mm}m` : `${mm}m ${ss.toString().padStart(2, "0")}s`;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-black ${
        overdue
          ? "bg-red-100 text-red-700"
          : diff < 5 * 60 * 1000
          ? "bg-orange-100 text-orange-700"
          : "bg-emerald-100 text-emerald-700"
      }`}
      title={overdue ? "SLA overdue" : "Time to treatment"}
    >
      {overdue ? "Overdue " : ""}
      {formatted}
    </span>
  );
}
