import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Phone, MessageCircle, MapPin, CalendarPlus, Bike, Star } from "lucide-react";
import { getBookingFn, cancelBookingFn } from "@/lib/marketplace.functions";
import { EmptyState, PageTop } from "@/components/marketplace/Cards";
import { useAuth } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { STATUS_LABELS, TX_LABELS, timelineFor, canCustomerCancel, fmtDate, fmtTime, type Booking } from "@/lib/marketplace";

export const Route = createFileRoute("/booking/$id")({
  validateSearch: (s: Record<string, unknown>): { confirmed?: boolean } => ({ confirmed: s.confirmed === true || s.confirmed === "true" ? true : undefined }),
  head: () => ({
    meta: [
      { title: "Your booking — Kartogo" },
      { name: "description", content: "Booking status, timeline, professional and location for your Kartogo service or event booking." },
      { property: "og:title", content: "Your Kartogo booking" },
      { property: "og:description", content: "Track your booking from request to completion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookingPage,
});

const SUPPORT_PHONE = "+919110310034";

function icsFor(b: Booking) {
  if (!b.booking_date) return null;
  const start = `${b.booking_date.replace(/-/g, "")}T${(b.start_time ?? "10:00").slice(0, 5).replace(":", "")}00`;
  const end = `${b.booking_date.replace(/-/g, "")}T${(b.end_time ?? b.start_time ?? "11:00").slice(0, 5).replace(":", "")}00`;
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kartogo//EN", "BEGIN:VEVENT", `UID:${b.id}@kartogo`, `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${b.listing?.name ?? "Kartogo booking"} (${b.booking_code})`, `LOCATION:${b.address?.line ?? b.partner?.address ?? ""}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  return URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
}

function BookingPage() {
  const { id } = Route.useParams();
  const { confirmed } = Route.useSearch();
  const { customerToken } = useAuth();
  const qc = useQueryClient();
  const [cancelling, setCancelling] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["mp-booking", id, customerToken],
    queryFn: () => getBookingFn({ data: { token: customerToken ?? undefined, id } }),
    enabled: !!customerToken,
    refetchInterval: 20_000,
  });
  if (!customerToken) return <div className="min-h-screen bg-background"><PageTop title="Booking" /><div className="mx-auto max-w-2xl p-4"><EmptyState title="Please login to view this booking"><Link to="/login" search={{ redirect: `/booking/${id}` }} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Login</Link></EmptyState></div></div>;
  if (isLoading) return <div className="min-h-screen bg-background"><PageTop title="Booking" /><div className="mx-auto mt-4 h-64 max-w-2xl animate-pulse rounded-2xl bg-secondary" /></div>;
  if (!data) return <div className="min-h-screen bg-background"><PageTop title="Booking" /><div className="mx-auto max-w-2xl p-4"><EmptyState title="Booking not found" /></div></div>;
  const b = data as unknown as Booking;
  const steps = timelineFor(b.transaction_type, b.service_mode);
  const reached = new Set((b.history ?? []).map(h => h.status));
  const curIdx = steps.indexOf(b.status);
  const isQuote = b.transaction_type === "QUOTE_REQUEST";
  const travelling = b.status === "PROFESSIONAL_TRAVELLING" || b.status === "ARRIVED";
  const title = confirmed ? (isQuote ? "Quote Requested" : b.transaction_type === "PRODUCT_ORDER" ? "Order Placed" : b.transaction_type === "EVENT_BOOKING" ? "Booking Requested" : "Booking Confirmed") : TX_LABELS[b.transaction_type];

  const cancel = async () => {
    if (!confirm("Cancel this booking?")) return;
    setCancelling(true);
    const r = await cancelBookingFn({ data: { token: customerToken, id } }).catch(() => null);
    setCancelling(false);
    if (!r?.ok) return void toast.error(r?.error ?? "Couldn't cancel");
    toast.success("Booking cancelled");
    qc.invalidateQueries({ queryKey: ["mp-booking", id] });
  };
  const ics = icsFor(b);

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageTop title={title} back="/orders" />
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {confirmed && (
          <div className="rounded-3xl bg-leaf/10 p-5 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-leaf" />
            <div className="mt-2 font-display text-xl font-extrabold">{title}</div>
            <div className="text-sm text-muted-foreground">Booking ID {b.booking_code}</div>
          </div>
        )}

        {travelling && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 font-display text-lg font-bold"><Bike className="h-5 w-5 text-primary" />{b.status === "ARRIVED" ? "Your professional has arrived" : "Your professional is on the way"}</div>
            {b.staff && (
              <div className="mt-3 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 font-display text-lg font-bold text-primary">{b.staff.name[0]}</div>
                <div><div className="font-bold">{b.staff.name}</div><div className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Star className="h-3 w-3 fill-saffron text-saffron" />{b.staff.rating} · ETA ~15 min</div></div>
              </div>
            )}
          </div>
        )}

        <section className="rounded-2xl border border-border bg-card p-4">
          <dl className="space-y-1.5 text-sm">
            <R k="Booking ID" v={b.booking_code} />
            <R k="Service" v={b.listing?.name ?? "—"} />
            <R k="Provider" v={b.partner?.name ?? "—"} />
            {b.booking_date && <R k="Date" v={fmtDate(b.booking_date)} />}
            {b.start_time && <R k="Time" v={fmtTime(b.start_time)} />}
            {b.staff && <R k="Professional" v={b.staff.name} />}
            <R k="Location" v={b.address?.line ?? b.partner?.address ?? "—"} />
            {typeof b.details?.package === "string" && b.details.package && <R k="Package" v={String(b.details.package)} />}
            {b.details?.guests ? <R k="Guests" v={String(b.details.guests)} /> : null}
            {b.details?.variant ? <R k="Variant" v={String(b.details.variant)} /> : null}
            {b.details?.installation ? <R k="Installation" v="Included" /> : null}
            <div className="flex justify-between border-t border-border pt-2 font-display text-base font-extrabold">
              <span>Amount</span><span>{isQuote && b.quote_amount == null ? "Awaiting quote" : formatINR(Number(b.amount) + Number(b.fee))}</span>
            </div>
          </dl>
          {b.quote_note && <p className="mt-2 rounded-lg bg-secondary p-2 text-sm"><b>Provider note:</b> {b.quote_note}</p>}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 font-bold">Status</h3>
          {b.status === "CANCELLED" ? <div className="font-bold text-destructive">Cancelled</div> : (
            <ol className="space-y-3">
              {steps.map((s, i) => {
                const done = i <= curIdx || reached.has(s);
                return (
                  <li key={s} className="flex items-center gap-3">
                    <span className={`h-3 w-3 shrink-0 rounded-full ${done ? "bg-leaf" : "border-2 border-border"}`} />
                    <span className={`text-sm ${done ? "font-bold" : "text-muted-foreground"}`}>{STATUS_LABELS[s]}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div className="flex flex-wrap gap-2">
          <a href={`tel:${SUPPORT_PHONE}`} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-bold"><Phone className="h-4 w-4" />Call</a>
          <Link to="/support" className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-bold"><MessageCircle className="h-4 w-4" />Chat</Link>
          <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address?.line ?? b.partner?.address ?? "Ongole")}`} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-bold"><MapPin className="h-4 w-4" />Location</a>
        </div>
        <div className="flex gap-2">
          {ics && <a href={ics} download={`kartogo-${b.booking_code}.ics`} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"><CalendarPlus className="h-4 w-4" />Add to Calendar</a>}
          <Link to="/orders" search={{ tab: "bookings" } as never} className="flex flex-1 items-center justify-center rounded-xl border border-border bg-card py-3 text-sm font-bold">All bookings</Link>
        </div>
        {canCustomerCancel(b.status) && <button disabled={cancelling} onClick={cancel} className="w-full rounded-xl border border-destructive/40 py-3 text-sm font-bold text-destructive">{cancelling ? "Cancelling…" : "Cancel booking"}</button>}
      </div>
    </div>
  );
}

function R({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>;
}
