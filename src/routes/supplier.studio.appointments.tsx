import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MapPin, Plus, Store, User2 } from "lucide-react";
import { listAppointmentsFn, listInventoryFn, listServicesFn } from "@/lib/studio.functions";
import { APPOINTMENT_STATUSES, STATUS_LABEL, type AppointmentStatus } from "@/lib/studio";
import { useStudio, useStudioQuery, unwrap } from "@/components/studio/StudioContext";
import { AppointmentActions, NewAppointmentDialog } from "@/components/studio/AppointmentActions";
import { Empty, ErrorBox, Loading, PageHeader, StatusBadge, addDays, btnOutline, btnPrimary, fmtDate, fmtTime, inputCls, inr, isoToday } from "@/components/studio/ui";

export const Route = createFileRoute("/supplier/studio/appointments")({
  component: Appointments,
  head: () => ({ meta: [{ title: "Appointments — Partner Studio" }, { name: "description", content: "Calendar, list and pending appointment requests." }] }),
});

type View = "calendar" | "list" | "pending";
type Span = "day" | "week" | "month";

function rangeFor(anchor: string, span: Span) {
  if (span === "day") return { from: anchor, to: anchor };
  const d = new Date(`${anchor}T00:00:00Z`);
  if (span === "week") { const start = addDays(anchor, -d.getUTCDay()); return { from: start, to: addDays(start, 6) }; }
  const first = `${anchor.slice(0, 8)}01`;
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  return { from: first, to: last };
}

function Appointments() {
  const { me, token, partnerId } = useStudio();
  const qc = useQueryClient();
  const [view, setView] = useState<View>("calendar");
  const [span, setSpan] = useState<Span>("week");
  const [anchor, setAnchor] = useState(isoToday());
  const [status, setStatus] = useState<"" | AppointmentStatus>("");
  const [term, setTerm] = useState("");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const range = view === "calendar" ? rangeFor(anchor, span) : { from: undefined, to: undefined };
  const q = useStudioQuery("appointments", (a) => listAppointmentsFn({ data: { ...a, ...range } }), [view, range.from, range.to], { refetchInterval: 30_000 });
  const listings = useQuery({
    queryKey: ["studio-listings-lite", partnerId, me?.partner.kind],
    queryFn: async () => me?.partner.kind === "furniture"
      ? (await unwrap(listInventoryFn({ data: { token, partnerId } }))).products
      : (await unwrap(listServicesFn({ data: { token, partnerId } }))).services,
    enabled: creating && !!me,
  });
  const reload = () => { qc.invalidateQueries({ queryKey: ["studio-appointments"] }); qc.invalidateQueries({ queryKey: ["studio-overview"] }); qc.invalidateQueries({ queryKey: ["studio-slots"] }); };
  const staff = q.data?.staff ?? [];

  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (q.data?.appointments ?? []).filter((b: any) =>
      (view !== "pending" || b.appointment_status === "PENDING") && (!status || b.appointment_status === status) &&
      (!t || `${b.customer_name ?? ""} ${b.booking_code} ${b.listing?.name ?? ""} ${b.appointment_type ?? ""}`.toLowerCase().includes(t)));
  }, [q.data, view, status, term]);

  const shift = (n: number) => setAnchor(a => span === "day" ? addDays(a, n) : span === "week" ? addDays(a, 7 * n) : (() => { const d = new Date(`${a}T00:00:00Z`); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)).toISOString().slice(0, 10); })());
  const pendingCount = (q.data?.appointments ?? []).filter((b: any) => b.appointment_status === "PENDING").length;

  return (
    <div>
      <PageHeader title="Appointments" crumb="Appointments" sub={`Booking mode: ${me?.bookingMode === "INSTANT" ? "instant booking" : me?.bookingMode === "BOOKING_REQUEST" ? "booking requests" : "your approval needed"} (set by Kartogo)`}>
        <button className={btnPrimary} onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New appointment</button>
      </PageHeader>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border bg-card p-0.5" role="tablist">
          {(["calendar", "list", "pending"] as View[]).map(v => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === v ? "bg-brand-navy text-brand-on-navy" : ""}`}>{v === "calendar" ? "Calendar" : v === "list" ? "List" : `Pending requests${view !== "pending" && pendingCount ? ` (${pendingCount})` : ""}`}</button>
          ))}
        </div>
        {view === "calendar" && (
          <>
            <div className="flex rounded-lg border border-border bg-card p-0.5">{(["day", "week", "month"] as Span[]).map(s => <button key={s} onClick={() => setSpan(s)} className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize ${span === s ? "bg-secondary" : ""}`}>{s}</button>)}</div>
            <div className="flex items-center gap-1">
              <button aria-label="Previous" className={btnOutline} onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></button>
              <button className={btnOutline} onClick={() => setAnchor(isoToday())}>Today</button>
              <button aria-label="Next" className={btnOutline} onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></button>
            </div>
            <span className="text-sm font-semibold">{span === "day" ? fmtDate(range.from) : `${fmtDate(range.from)} – ${fmtDate(range.to)}`}</span>
          </>
        )}
        <div className="ml-auto flex gap-2">
          <input aria-label="Search appointments" placeholder="Search customer or code" value={term} onChange={e => setTerm(e.target.value)} className={`${inputCls} w-48`} />
          {view !== "pending" && <select aria-label="Status filter" value={status} onChange={e => setStatus(e.target.value as never)} className={`${inputCls} w-36`}><option value="">All statuses</option>{APPOINTMENT_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>}
        </div>
      </div>

      {q.isLoading ? <Loading /> : q.error ? <ErrorBox message={(q.error as Error).message} onRetry={() => q.refetch()} /> : view === "calendar" ? (
        <CalendarGrid rows={rows} range={range as { from: string; to: string }} span={span} onOpen={id => setOpen(id)} />
      ) : rows.length === 0 ? <Empty title={view === "pending" ? "No pending requests" : "No appointments"} body={view === "pending" ? "New requests that need your answer appear here." : undefined} /> : (
        <ul className="space-y-2">{rows.map((b: any) => <AppointmentRow key={b.id} b={b} staff={staff} onDone={reload} />)}</ul>
      )}

      {view === "calendar" && open && (() => { const b = rows.find((x: any) => x.id === open); return b ? <div className="mt-4"><AppointmentRow b={b} staff={staff} onDone={reload} expanded /></div> : null; })()}
      {creating && <NewAppointmentDialog listings={(listings.data ?? []) as any[]} staff={staff} onClose={() => setCreating(false)} onDone={() => { setCreating(false); reload(); }} />}
    </div>
  );
}

function AppointmentRow({ b, staff, onDone, expanded = false }: { b: any; staff: any[]; onDone: () => void; expanded?: boolean }) {
  const [show, setShow] = useState(expanded);
  const atCustomer = b.location_type === "CUSTOMER";
  return (
    <li className="list-none rounded-xl border border-border bg-card p-3">
      <button className="flex w-full flex-wrap items-center gap-3 text-left" onClick={() => setShow(s => !s)} aria-expanded={show}>
        <div className="w-24 shrink-0"><div className="text-sm font-bold">{fmtDate(b.booking_date)}</div><div className="text-xs text-muted-foreground">{fmtTime(b.start_time) || "Time to confirm"}</div></div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{b.customer_name || "Customer"} · {b.appointment_type ?? (b.details?.store_visit ? "Showroom Visit" : "Booking")}</div>
          <div className="truncate text-xs text-muted-foreground">{b.listing?.name ?? "General"} · {b.booking_code}{b.staff?.name ? ` · ${b.staff.name}` : ""}</div>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">{atCustomer ? <MapPin className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}{atCustomer ? "Customer's place" : "At business"}</span>
        <StatusBadge s={b.appointment_status} />
      </button>
      {show && (
        <div className="mt-3 space-y-3 border-t border-border pt-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div><div className="text-xs text-muted-foreground">Customer</div><div className="flex items-center gap-1"><User2 className="h-3.5 w-3.5" />{b.customer_name || "Customer"} · {b.customer_phone ?? "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Location</div><div>{atCustomer ? (b.address?.line ?? "Customer's address") : "Your business location"}</div></div>
            <div><div className="text-xs text-muted-foreground">Amount · payment</div><div>{b.amount > 0 ? `${inr(Number(b.amount) + Number(b.fee ?? 0))} · ${String(b.payment_status ?? "UNPAID").toLowerCase().replace("_", " ")}` : "Free"}</div></div>
            <div><div className="text-xs text-muted-foreground">Professional</div><div>{b.staff?.name ?? "Unassigned"}</div></div>
          </div>
          {(b.customer_notes || b.details?.variant) && <p className="rounded-lg bg-secondary/50 p-2 text-sm"><b>Customer notes:</b> {[b.customer_notes, b.details?.variant ? `Variant: ${b.details.variant}` : ""].filter(Boolean).join(" · ")}</p>}
          <AppointmentActions b={b} staff={staff} onDone={onDone} />
          <p className="text-xs text-muted-foreground">Contact the customer through Kartogo's masked calling from the booking — numbers stay private.</p>
        </div>
      )}
    </li>
  );
}

function CalendarGrid({ rows, range, span, onOpen }: { rows: any[]; range: { from: string; to: string }; span: Span; onOpen: (id: string) => void }) {
  const days: string[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) days.push(d);
  const lead = span === "month" ? new Date(`${range.from}T00:00:00Z`).getUTCDay() : 0;
  const by = (d: string) => rows.filter(b => b.booking_date === d).sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
  const today = isoToday();
  if (span === "day") {
    const list = by(range.from);
    return list.length === 0 ? <Empty title="Nothing booked on this day" /> : (
      <div className="divide-y divide-border rounded-xl border border-border bg-card">{list.map(b => (
        <button key={b.id} onClick={() => onOpen(b.id)} className="flex w-full items-center gap-3 p-3 text-left text-sm hover:bg-secondary/40">
          <span className="w-20 font-semibold tabular-nums">{fmtTime(b.start_time) || "—"}</span><span className="min-w-0 flex-1 truncate">{b.customer_name || "Customer"} · {b.appointment_type ?? b.listing?.name}</span><StatusBadge s={b.appointment_status} />
        </button>))}</div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <div className={`grid min-w-[700px] grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border`}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className="bg-secondary/60 p-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>)}
        {Array.from({ length: lead }).map((_, i) => <div key={`l${i}`} className="bg-card/60" />)}
        {days.map(d => {
          const list = by(d);
          return (
            <div key={d} className={`bg-card p-1.5 ${span === "week" ? "min-h-48" : "min-h-24"}`}>
              <div className={`mb-1 text-xs font-semibold ${d === today ? "text-primary" : "text-muted-foreground"}`}>{Number(d.slice(8))}</div>
              <div className="space-y-1">
                {list.slice(0, span === "week" ? 8 : 3).map(b => (
                  <button key={b.id} onClick={() => onOpen(b.id)} className="block w-full truncate rounded-md bg-secondary px-1.5 py-1 text-left text-[11px] hover:bg-secondary/70">
                    <b>{fmtTime(b.start_time)}</b> {b.customer_name || "Customer"}
                    <span className={`ml-1 inline-block h-1.5 w-1.5 rounded-full ${b.appointment_status === "PENDING" ? "bg-saffron" : b.appointment_status === "COMPLETED" ? "bg-leaf" : ["CANCELLED", "REJECTED", "NO_SHOW"].includes(b.appointment_status) ? "bg-destructive" : "bg-primary"}`} />
                  </button>
                ))}
                {list.length > (span === "week" ? 8 : 3) && <div className="text-[11px] text-muted-foreground">+{list.length - (span === "week" ? 8 : 3)} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
