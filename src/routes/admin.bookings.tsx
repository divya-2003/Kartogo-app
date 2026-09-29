import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { adminListBookingsFn, adminUpdateBookingFn } from "@/lib/marketplace.functions";
import { useAuth } from "@/lib/store";
import { adminListMpPartnersFn, adminLinkPartnerPhoneFn } from "@/lib/partner-manage.functions";
import { formatINR } from "@/lib/data";
import { STATUS_LABELS, TX_LABELS, timelineFor, fmtDate, fmtTime, type Booking, type BookingStatus } from "@/lib/marketplace";

export const Route = createFileRoute("/admin/bookings")({
  head: () => ({ meta: [{ title: "Bookings & quotes — Kartogo Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminBookings,
});

function AdminBookings() {
  const { adminToken } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("open");
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-bookings", adminToken], queryFn: () => adminListBookingsFn({ data: { token: adminToken ?? undefined } }), enabled: !!adminToken, refetchInterval: 30_000 });
  const rows = (data as unknown as (Booking & { customer_name: string | null })[]).filter(b =>
    filter === "all" ? true : filter === "open" ? !["SERVICE_COMPLETED", "CANCELLED"].includes(b.status) : b.transaction_type === filter);

  const update = async (b: Booking, status: BookingStatus, extra?: { quoteAmount?: number; quoteNote?: string }) => {
    const r = await adminUpdateBookingFn({ data: { token: adminToken ?? "", id: b.id, status, ...extra } }).catch(() => null);
    if (!r?.ok) return void toast.error("Couldn't update");
    toast.success(`Marked ${STATUS_LABELS[status]}`);
    qc.invalidateQueries({ queryKey: ["admin-bookings"] });
  };

  return (
    <div className="space-y-4">
      <div><h1 className="font-display text-2xl font-bold">Bookings & quotes</h1><p className="text-sm text-muted-foreground">Service appointments, home services, events, quotes and scheduled furniture/electronics orders.</p></div>
      <div className="flex flex-wrap gap-2">
        {[["open", "Open"], ["all", "All"], ["SERVICE_BOOKING", "Appointments"], ["HOME_SERVICE_BOOKING", "Home services"], ["EVENT_BOOKING", "Events"], ["QUOTE_REQUEST", "Quotes"], ["PRODUCT_ORDER", "Scheduled orders"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 text-xs font-bold ${filter === k ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{l}</button>
        ))}
      </div>
      {isLoading ? <div className="h-32 animate-pulse rounded-2xl bg-secondary" /> : rows.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No bookings here.</div> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map(b => {
            const steps = timelineFor(b.transaction_type, b.service_mode);
            const next = steps[steps.indexOf(b.status) + 1];
            return (
              <div key={b.id} className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div><div className="font-bold">{b.listing?.name} <span className="text-muted-foreground">· {b.booking_code}</span></div><div className="text-xs text-muted-foreground">{TX_LABELS[b.transaction_type]} · {b.partner?.name}</div></div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${b.status === "CANCELLED" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{STATUS_LABELS[b.status]}</span>
                </div>
                <div className="text-xs text-muted-foreground">{b.customer_name ?? "Customer"} · {fmtDate(b.booking_date)} {fmtTime(b.start_time)} {b.staff ? `· ${b.staff.name}` : ""}</div>
                {b.address?.line && <div className="text-xs">📍 {b.address.line}</div>}
                {b.details?.requirements ? <div className="rounded-lg bg-secondary p-2 text-xs">{String(b.details.requirements)}</div> : null}
                <div className="font-bold">{b.transaction_type === "QUOTE_REQUEST" && b.quote_amount == null ? "Awaiting quote" : formatINR(Number(b.amount) + Number(b.fee))}</div>
                {!["SERVICE_COMPLETED", "CANCELLED"].includes(b.status) && (
                  <div className="flex flex-wrap gap-2">
                    {b.transaction_type === "QUOTE_REQUEST" && b.status === "BOOKING_REQUESTED" ? (
                      <button onClick={() => { const a = prompt("Quote amount (₹)"); if (!a) return; const note = prompt("Note for customer (optional)") ?? undefined; void update(b, "QUOTE_SENT", { quoteAmount: Number(a) || 0, quoteNote: note || undefined }); }} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Send quote</button>
                    ) : next && <button onClick={() => update(b, next)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Mark {STATUS_LABELS[next]}</button>}
                    <button onClick={() => confirm("Cancel this booking?") && update(b, "CANCELLED")} className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-bold text-destructive">Cancel</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <PartnerOwners token={adminToken ?? ""} />
    </div>
  );
}

function PartnerOwners({ token }: { token: string }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["mp-partner-owners", token], queryFn: () => adminListMpPartnersFn({ data: { token } }), enabled: !!token });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const save = async (id: string) => {
    const v = (draft[id] ?? "").trim();
    if (v && !/^\d{10}$/.test(v)) return void toast.error("Enter a 10-digit number");
    const r = await adminLinkPartnerPhoneFn({ data: { token, partnerId: id, phone: v || null } });
    if (r.ok) { toast.success("Partner login updated"); qc.invalidateQueries({ queryKey: ["mp-partner-owners"] }); } else toast.error("Couldn't update");
  };
  return (
    <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
      <h2 className="font-display text-lg font-bold">Partner self-service logins</h2>
      <p className="text-xs text-muted-foreground">Link a partner to a supplier mobile number. They can then manage their listings, staff and availability under "My services". Bookings stay with Kartogo.</p>
      {data.map(p => (
        <div key={p.id} className="flex flex-wrap items-center gap-2 border-t border-border pt-2 text-sm">
          <div className="min-w-0 flex-1 truncate font-semibold">{p.name}</div>
          <input className="w-36 rounded-md border border-border bg-background px-2 py-1" placeholder="Mobile" value={draft[p.id] ?? p.supplier_phone ?? ""} onChange={e => setDraft({ ...draft, [p.id]: e.target.value })} />
          <button onClick={() => save(p.id)} className="rounded-md bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">Save</button>
        </div>
      ))}
    </section>
  );
}
