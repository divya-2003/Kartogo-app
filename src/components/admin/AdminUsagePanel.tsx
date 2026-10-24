import { useEffect, useState } from "react";
import { Activity, LogIn, LogOut } from "lucide-react";
import { adminUsageAnalyticsFn, type AdminUsage } from "@/lib/admin-activity.functions";

const PERIODS = [7, 30, 90] as const;

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");
const pageName = (path: string) => path === "/admin" ? "Dashboard" : path.replace("/admin/", "").replace(/-/g, " ");

/** Sub-admin usage: sign-ins, sign-outs, pages opened and last activity. */
export function AdminUsagePanel({ token }: { token: string | null }) {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [data, setData] = useState<AdminUsage | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setError(false);
    adminUsageAnalyticsFn({ data: { token, days } })
      .then(d => { if (alive) setData(d); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [token, days]);

  const rows = data?.rows ?? [];
  const totals = rows.reduce((t, r) => ({ logins: t.logins + r.logins, logouts: t.logouts + r.logouts, views: t.views + r.pageViews }), { logins: 0, logouts: 0, views: 0 });

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Activity className="h-4 w-4 text-primary" /> Admin usage analytics</h2>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button key={p} onClick={() => setDays(p)} className={`rounded-full border px-3 py-1 text-xs font-bold ${days === p ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{p} days</button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-muted-foreground">Couldn't load usage right now.</p> : !data ? <p className="text-sm text-muted-foreground">Loading…</p> : <>
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Logins" value={totals.logins} />
          <Tile label="Logouts" value={totals.logouts} />
          <Tile label="Pages opened" value={totals.views} />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Admin</th>
                <th className="py-2 pr-3 font-semibold">Logins</th>
                <th className="py-2 pr-3 font-semibold">Logouts</th>
                <th className="py-2 pr-3 font-semibold">Pages</th>
                <th className="py-2 pr-3 font-semibold">Active days</th>
                <th className="py-2 pr-3 font-semibold">Last login</th>
                <th className="py-2 pr-3 font-semibold">Last logout</th>
                <th className="py-2 font-semibold">Most used</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(r => (
                <tr key={r.id} className="align-top">
                  <td className="py-2 pr-3">
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.isSuperAdmin ? "Main admin" : "Sub-admin"}{r.phone !== "—" ? ` · +91 ${r.phone}` : ""}{r.status === "inactive" ? " · inactive" : ""}</div>
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{r.logins}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.logouts}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.pageViews}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.activeDays}</td>
                  <td className="py-2 pr-3 text-xs">{when(r.lastLogin)}</td>
                  <td className="py-2 pr-3 text-xs">{when(r.lastLogout)}</td>
                  <td className="py-2 text-xs capitalize">{r.topPages.length ? r.topPages.map(p => `${pageName(p.path)} (${p.views})`).join(", ") : "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="py-4 text-sm text-muted-foreground">No admin accounts yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <h3 className="mb-2 mt-5 text-sm font-bold">Recent sign-ins and sign-outs</h3>
        {data.recent.length === 0 ? <p className="text-sm text-muted-foreground">Nothing recorded in this period yet.</p> : (
          <ul className="divide-y divide-border">
            {data.recent.slice(0, 12).map(e => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  {e.action === "login" ? <LogIn className="h-4 w-4 shrink-0 text-primary" /> : <LogOut className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="truncate font-semibold">{e.name}</span>
                  <span className="text-muted-foreground">{e.action === "login" ? "logged in" : "logged out"}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{when(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </>}
    </section>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
