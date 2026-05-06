"use client";

import { useEffect, useState } from "react";

import type { ProtocolRuleDoc } from "../types/alerts";

const ruleCache = new Map<string, ProtocolRuleDoc>();

/**
 * Chip that fetches a protocol rule on hover/click and surfaces its
 * rationale + source citation in a tooltip-style popover.
 */
export function RuleChip({ ruleId }: { ruleId: string }) {
  const [open, setOpen] = useState(false);
  const [rule, setRule] = useState<ProtocolRuleDoc | null>(
    ruleCache.get(ruleId) ?? null
  );

  useEffect(() => {
    if (rule || !open) return;
    let cancelled = false;
    fetch(`/api/protocols/rule/${encodeURIComponent(ruleId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ProtocolRuleDoc | null) => {
        if (cancelled || !data) return;
        ruleCache.set(ruleId, data);
        setRule(data);
      })
      .catch(() => {
        /* no-op — chip remains in id-only mode */
      });
    return () => {
      cancelled = true;
    };
  }, [open, rule, ruleId]);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-700 hover:border-slate-500"
      >
        {rule?.label?.en ?? ruleId}
      </button>
      {open && rule && (
        <span
          className="absolute left-0 top-full z-30 mt-1 w-72 rounded-md border border-slate-200 bg-white p-3 text-left text-xs text-slate-700 shadow-lg"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <p className="font-black uppercase tracking-wide text-slate-500">
            {rule.vertical} • {rule.escalates_to ?? rule.id}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-950">
            {rule.label?.en ?? rule.id}
          </p>
          {rule.rationale ? (
            <p className="mt-2 leading-snug text-slate-600">{rule.rationale}</p>
          ) : null}
          {rule.sourceDoc?.title ? (
            <p className="mt-2 text-[11px] font-semibold text-slate-500">
              Source: {rule.sourceDoc.title}
              {rule.sourceDoc.year ? ` (${rule.sourceDoc.year})` : ""}
              {rule.source?.section ? ` • § ${rule.source.section}` : ""}
            </p>
          ) : null}
        </span>
      )}
    </span>
  );
}
