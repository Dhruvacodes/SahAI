/**
 * Renders the dashboard overview with operational summary cards.
 *
 * @returns The SahAI dashboard overview page.
 */
export default function Home() {
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
          Monitor visit activity, review high-risk cases, and track referral follow-up
          across ASHA worker coverage areas.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["High risk cases", "18", "Needs ANM review"],
          ["Visits today", "124", "Across 9 blocks"],
          ["Pending referrals", "7", "PHC action needed"],
          ["Sync completion", "92%", "Mobile uploads"]
        ].map(([label, value, caption]) => (
          <article
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            key={label}
          >
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
            <p className="mt-2 text-sm text-slate-600">{caption}</p>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-950">High Risk Cases</h3>
            <p className="mt-1 text-sm text-slate-600">Newest critical visits first</p>
          </div>
          <span className="rounded-md bg-red-100 px-3 py-1 text-sm font-bold text-red-700">
            Critical watch
          </span>
        </div>

        <div className="mt-6 divide-y divide-slate-100">
          {[
            ["Sita Devi", "Rampur", "CRITICAL", "Absent fetal movement"],
            ["Mina Kumari", "Basantpur", "HIGH", "Hypertension detected"],
            ["Asha Bano", "Devnagar", "HIGH", "Severe anaemia"]
          ].map(([name, village, level, reason]) => (
            <div className="grid gap-3 py-4 md:grid-cols-4" key={`${name}-${reason}`}>
              <p className="font-bold text-slate-950">{name}</p>
              <p className="text-slate-600">{village}</p>
              <p className="font-bold text-orange-700">{level}</p>
              <p className="text-slate-700">{reason}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
