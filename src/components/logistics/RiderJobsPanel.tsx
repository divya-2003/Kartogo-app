import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, Navigation, Loader2 } from "lucide-react";
import { formatINR } from "@/lib/data";
import { listRiderJobsFn, acceptRiderJobFn, advanceRiderJobFn, updateRiderLocationFn, NEXT_STATUS } from "@/lib/rider-jobs.functions";

const LABEL: Record<string, string> = {
  PLACED: "New", SEARCHING: "New request", ACCEPTED: "Accepted", PICKED_UP: "Picked up", ARRIVED: "At pickup",
  IN_TRIP: "On trip", DELIVERED: "Delivered", COMPLETED: "Completed", CANCELLED: "Cancelled",
};
const ACTION: Record<string, string> = {
  PICKED_UP: "Mark picked up", DELIVERED: "Mark delivered", ARRIVED: "I've arrived at pickup", IN_TRIP: "Start ride", COMPLETED: "Complete ride",
};

function JobDetails({ o }: { o: any }) {
  const d = o.details ?? {};
  if (o.kind === "RIDE") return (
    <div className="mt-2 space-y-1 text-sm">
      <div className="flex gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-leaf" />{d.pickup?.label}</div>
      <div className="flex gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-sm bg-destructive" />{d.drop?.label}</div>
      <div className="text-xs text-muted-foreground">{d.vehicle} · {d.km} km · ~{d.minutes} min · {d.payment}</div>
    </div>
  );
  return (
    <div className="mt-2 space-y-1 text-sm">
      <div className="text-xs text-muted-foreground">{(d.items ?? []).map((i: any) => `${i.qty}× ${i.name}`).join(", ")}</div>
      <div className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />{d.address?.line}{d.address?.landmark ? ` (${d.address.landmark})` : ""}</div>
      <div className="text-xs text-muted-foreground">Pay on delivery · collect {formatINR(Number(o.amount))}</div>
    </div>
  );
}

/** Food deliveries and ride requests for delivery partners. */
export function RiderJobsPanel({ token }: { token: string }) {
  const [jobs, setJobs] = useState<{ open: any[]; mine: any[] }>({ open: [], mine: [] });
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setJobs(await listRiderJobsFn({ data: { token } })); } catch { /* ignore */ }
  }, [token]);
  useEffect(() => { void load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const active = jobs.mine.filter(o => NEXT_STATUS[o.kind]?.[o.status]);
  // Share live location while on a job.
  useEffect(() => {
    if (!active.length || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      p => { void updateRiderLocationFn({ data: { token, lat: p.coords.latitude, lng: p.coords.longitude } }).catch(() => {}); },
      () => {}, { enableHighAccuracy: true, maximumAge: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active.length, token]);

  const run = async (id: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(id);
    const r = await fn().catch(e => ({ ok: false, error: String(e?.message ?? e) }));
    setBusy(null);
    if (!r.ok) toast.error(r.error ?? "Failed"); else void load();
  };

  return (
    <section className="mb-4 space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Food & ride requests</h2>
        <span className="text-xs text-muted-foreground">{jobs.open.length} waiting</span>
      </div>

      {active.map(o => {
        const next = NEXT_STATUS[o.kind][o.status];
        const d = o.details ?? {};
        const dest = o.kind === "RIDE" ? (o.status === "IN_TRIP" ? d.drop : d.pickup) : null;
        return (
          <article key={o.id} className="rounded-xl border-2 border-primary bg-primary/5 p-3">
            <div className="flex items-center justify-between text-xs font-bold"><span>{o.kind === "RIDE" ? "🛺 Ride" : "🍛 Food"} · #{o.order_code}</span><span className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground">{LABEL[o.status]}</span></div>
            <div className="mt-1 font-semibold">{o.title} · {o.customer_name ?? "Customer"}</div>
            <JobDetails o={o} />
            <div className="mt-3 flex gap-2">
              {dest?.lat != null && (
                <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-bold"><Navigation className="h-4 w-4" />Navigate</a>
              )}
              <button disabled={busy === o.id} onClick={() => run(o.id, () => advanceRiderJobFn({ data: { token, id: o.id } }))} className="flex flex-1 items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
                {busy === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : ACTION[next]}
              </button>
            </div>
          </article>
        );
      })}

      {jobs.open.length === 0 && !active.length && <p className="text-sm text-muted-foreground">No food or ride requests right now. They show up here automatically.</p>}
      {jobs.open.map(o => (
        <article key={o.id} className="rounded-xl border border-border p-3">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground"><span>{o.kind === "RIDE" ? "🛺 Ride request" : "🍛 Food delivery"} · #{o.order_code}</span><span>{new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
          <div className="mt-1 flex items-center justify-between font-semibold"><span>{o.title}</span><span>{formatINR(Number(o.amount))}</span></div>
          <JobDetails o={o} />
          <button disabled={busy === o.id || active.length > 0} onClick={() => run(o.id, () => acceptRiderJobFn({ data: { token, id: o.id } }))} className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {active.length ? "Finish current job first" : busy === o.id ? "Accepting…" : "Accept"}
          </button>
        </article>
      ))}

      {jobs.mine.filter(o => !NEXT_STATUS[o.kind]?.[o.status]).length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">Past food & rides</summary>
          <ul className="mt-2 space-y-1">
            {jobs.mine.filter(o => !NEXT_STATUS[o.kind]?.[o.status]).map(o => (
              <li key={o.id} className="flex justify-between border-t border-border pt-1"><span>#{o.order_code} · {o.title}</span><span>{LABEL[o.status] ?? o.status} · {formatINR(Number(o.amount))}</span></li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
