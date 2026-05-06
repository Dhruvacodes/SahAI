"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/dashboard/alerts", label: "Severe Alerts", icon: "🚨" },
  { href: "/dashboard/heatmap", label: "Heatmap", icon: "🗺️" },
  { href: "/dashboard/cost-privacy", label: "Cost & Privacy", icon: "💰" },
];

/**
 * Dashboard shell with sidebar navigation and user info.
 */
export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6">
          <h2 className="text-xl font-black tracking-tight">SahAI</h2>
          <p className="text-xs text-slate-400 mt-1">ANM Supervisor Dashboard</p>
        </div>

        <nav className="flex-1 px-3">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-600/20 text-emerald-400"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div className="p-4 border-t border-slate-800">
          {user && (
            <div className="mb-3">
              <p className="text-sm font-semibold text-white">{user.name}</p>
              <p className="text-xs text-slate-400">{user.district} • {user.role}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full text-left text-xs text-slate-400 hover:text-red-400 transition-colors"
          >
            ← Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
