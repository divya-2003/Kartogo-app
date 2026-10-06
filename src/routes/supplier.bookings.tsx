import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { myPartnerBookingsFn, partnerUpdateBookingFn } from "@/lib/partner-manage.functions";
import { bookingStatusLabel, fmtDate, fmtTime } from "@/lib/marketplace";
import { formatINR } from "@/lib/data";

export const Route = createFileRoute("/supplier/bookings")({
  component: PartnerBookings,
  head: () => ({ meta: [{ title: "Bookings — Kartogo Partner" }] }),
});

const getToken = () => { try { return JSON.parse(localStorage.getItem("qk_supplier_token") || "null") as string | null; } catch { return null; } };
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
type Tab = "confirm" | "ongoing" | "today" | "cancelled";
const TABS: { id: Tab; label: string }[] = [
  { id: "confirm", label: "To confirm" }, { id: "ongoing", label: "Ongoing" },
  { id: "today", label: "Today's appointments" }, { id: "cancelled", label: "Cancelled" },
];

function PartnerBookings() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [tab, setTab] = useState<Tab>("confirm");
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    const token = getToken();
    setRows(token ? await myPartnerBookingsFn({ data: { token } }).catch(() => []) : []);
  }, []);
  useEffect(() => { void load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const groups = useMemo(() => {
    const r = rows ?? [], today = todayStr();
    return {
      confirm: r.filter(b => b.status === "BOOKING_REQUESTED"),
      ongoing: r.filter(b => !["BOOKING_REQUESTED", "CANCELLED", "SERVICE_COMPLETED"].includes(b.status)),
      today: r.filter(b => b.booking_date === today && b.status !== "CANCELLED"),
      cancelled: r.filter(b => b.status === "CANCELLED"),
    } as Record<Tab, any[]>;
  }, [rows]);

  const update = async (id: string, status: "PROVIDER_CONFIRMED" | "SERVICE_STARTED" | "SERVICE_COMPLETED" | "CANCELLED") => {
    if (status === "CANCELLED" && !confirm("Cancel this booking?")) return;
    setBusy(id);
    const r = await partnerUpdateBookingFn({ data: { token: getToken()!, id, status } }).catch(() => ({ ok: false, error: "Network error" }));
    setBusy(null);
    if (r.ok) { toast.success("Booking updated"); void load(); } else toast.error((r as any).error ?? "Failed");
  };

  if (!rows) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const list = groups[tab];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Bookings</h1>
        <p className="text-sm text-muted-foreground">Confirm new bookings, follow today's appointments and see cancellations.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === t.id ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
            {t.label} ({groups[t.id].length})
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">Nothing here right now.</div>
      ) : list.map(b => {
        const closed = b.status === "CANCELLED" || b.status === "SERVICE_COMPLETED";
        return (
          <article key={b.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-bold text-muted-foreground">#{b.booking_code} · {b.partner_name}</div>
                <div className="truncate font-bold">{b.listing?.icon} {b.listing?.name ?? b.details?.package ?? "Booking"}</div>
                <div className="text-xs text-muted-foreground">
                  {b.customer_name ?? "Customer"}{b.customer_phone ? ` · ${b.customer_phone}` : ""}
                  {b.booking_date ? ` · ${fmtDate(b.booking_date)}` : ""}{b.start_time ? ` • ${fmtTime(b.start_time)}` : ""}
                  {b.staff?.name ? ` · ${b.staff.name}` : ""}
                </div>
                {b.address?.line && <div className="text-xs text-muted-foreground">📍 {b.address.line}</div>}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${b.status === "CANCELLED" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{bookingStatusLabel(b)}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="mr-auto font-display font-extrabold">{formatINR(Number(b.amount) + Number(b.fee ?? 0))}</span>
              {b.status === "BOOKING_REQUESTED" && (
                <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-bold">
                  <input type="checkbox" disabled={busy === b.id} onChange={() => update(b.id, "PROVIDER_CONFIRMED")} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                  Confirm booking
                </label>
              )}
              {b.status === "PROVIDER_CONFIRMED" && <button disabled={busy === b.id} onClick={() => update(b.id, "SERVICE_STARTED")} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Start</button>}
              {!closed && b.status !== "BOOKING_REQUESTED" && <button disabled={busy === b.id} onClick={() => update(b.id, "SERVICE_COMPLETED")} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold">Mark completed</button>}
              {!closed && <button disabled={busy === b.id} onClick={() => update(b.id, "CANCELLED")} className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-bold text-destructive">Cancel</button>}
            </div>
          </article>
        );
      })}
    </div>
  );
}
