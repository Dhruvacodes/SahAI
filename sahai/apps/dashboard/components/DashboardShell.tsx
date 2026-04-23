"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = ["Overview", "High Risk Cases", "Visit Log", "Settings"];

/**
 * Renders the authenticated dashboard frame with sidebar and top bar.
 *
 * @param props - Shell props containing routed page content.
 * @param props.children - Page content rendered inside the main dashboard area.
 * @returns Dashboard layout chrome or a plain login layout for auth routes.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (pathname === "/login") {
    return <main className="min-h-screen bg-slate-100">{children}</main>;
  }

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-950">
      <aside className="flex w-64 shrink-0 flex-col bg-[#0f0f23] px-5 py-6 text-white">
        <Link className="text-2xl font-black tracking-wide" href="/dashboard">
          SahAI
        </Link>
        <nav className="mt-10 space-y-2">
          {NAV_ITEMS.map((item) => (
            <Link
              className="block rounded-md px-3 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
              href={item === "Overview" ? "/dashboard" : "#"}
              key={item}
            >
              {item}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              SahAI Dashboard
            </p>
            <h1 className="text-lg font-black text-slate-950">Operations Console</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-slate-700">
              {user?.name ?? "Dashboard User"}
            </span>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              onClick={() => void logout()}
              type="button"
            >
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}

