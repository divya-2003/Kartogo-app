import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { partnerServiceInsightsFn } from "@/lib/partner-manage.functions";
import { formatINR } from "@/lib/data";

/** AI insights for salons, home services, events and showrooms, from their own bookings. */
export function ServiceInsights() {
  const [data, setData] = useState<Awaited<ReturnType<typeof partnerServiceInsightsFn>> | undefined>(undefined);
  useEffect(() => {
    let token: string | null = null;
    try { token = JSON.parse(localStorage.getItem("qk_supplier_token") || "null"); } catch { token = null; }
    if (!token) { setData(null); return; }
    partnerServiceInsightsFn({ data: { token } }).then(setData).catch(() => setData(null));
  }, []);
  if (data === undefined) return <div className="h-24 animate-pulse rounded-2xl bg-secondary" />;
  if (!data) return null;
  const s = data.stats;
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Sparkles className="h-4 w-4 text-primary" />Bookings & services insights</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Bookings (90 days)", String(s.total)], ["Booking value", formatINR(s.revenue)], ["Completed", String(s.completed)], ["Cancellation rate", `${s.cancelRate}%`]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border p-3"><div className="text-xs text-muted-foreground">{k}</div><div className="font-display text-xl font-extrabold">{v}</div></div>
        ))}
      </div>
      {s.total === 0 ? <p className="text-sm text-muted-foreground">No bookings yet. Insights appear once customers start booking your services.</p> : (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border p-3 text-sm"><div className="mb-1 font-semibold">Most booked</div>{s.top.map(t => <div key={t.name} className="flex justify-between"><span className="truncate">{t.name}</span><span>{t.bookings}</span></div>)}</div>
          <div className="rounded-xl border border-border p-3 text-sm"><div className="mb-1 font-semibold">Peak hours</div>{s.peakHours.map(t => <div key={t.hour} className="flex justify-between"><span>{t.hour}</span><span>{t.bookings}</span></div>)}</div>
          <div className="rounded-xl border border-border p-3 text-sm"><div className="mb-1 font-semibold">Busiest days</div>{s.busyDays.map(t => <div key={t.day} className="flex justify-between"><span>{t.day}</span><span>{t.bookings}</span></div>)}</div>
        </div>
      )}
      {s.unused.length > 0 && <p className="text-sm text-muted-foreground">Not booked yet: {s.unused.join(", ")}</p>}
      {data.tips.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-primary/5 p-3 text-sm">{data.tips.map(t => <li key={t}>💡 {t}</li>)}</ul>
      )}
    </section>
  );
}
