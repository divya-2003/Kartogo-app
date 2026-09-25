import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, Check, Home as HomeIcon, Store, MapPin } from "lucide-react";
import { getListingFn, getAvailabilityFn, createBookingFn } from "@/lib/marketplace.functions";
import { Rating, Thumb, FavButton, EmptyState, PageTop } from "@/components/marketplace/Cards";
import { AddressField, DatePicker, nextDays } from "@/components/marketplace/AddressField";
import { useAuth } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { fmtTime, type MpListing, type MpStaff, type ServiceMode } from "@/lib/marketplace";

export const Route = createFileRoute("/service/$id")({
  head: () => ({
    meta: [
      { title: "Book a service — Kartogo" },
      { name: "description", content: "See price, duration, what's included and book a salon or home service slot with a local professional." },
      { property: "og:title", content: "Book a local service — Kartogo" },
      { property: "og:description", content: "Pick a date, time and professional — confirmed in seconds." },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ServicePage,
});

function ServicePage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({ queryKey: ["mp-listing", id], queryFn: () => getListingFn({ data: { id } }) });
  const [booking, setBooking] = useState(false);
  if (isLoading) return <div className="min-h-screen bg-background"><PageTop title="Loading…" /><div className="mx-auto mt-4 h-64 max-w-2xl animate-pulse rounded-2xl bg-secondary" /></div>;
  if (!data) return <div className="min-h-screen bg-background"><PageTop title="Not found" /><div className="mx-auto max-w-2xl p-4"><EmptyState title="This service isn't available" /></div></div>;
  const l = data.listing as MpListing & { partner: { id: string; name: string; slug: string; address: string | null; service_area: string | null } };
  if (booking) return <BookingFlow listing={l} siblings={data.siblings as MpListing[]} onBack={() => setBooking(false)} />;

  return (
    <div className="min-h-screen bg-background pb-28">
      <PageTop title={l.name} />
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4 lg:max-w-4xl">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card">
          <Thumb images={l.images} icon={l.icon} className="aspect-[16/9] w-full text-7xl" />
          <FavButton type="listing" id={l.id} className="absolute right-3 top-3" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-extrabold">{l.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-display text-2xl font-extrabold">{formatINR(Number(l.price ?? l.starting_price ?? 0))}</span>
            {l.duration_min && <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock className="h-4 w-4" />{l.duration_min} minutes</span>}
            <Rating value={l.rating} count={l.review_count} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {l.service_modes.includes("AT_SALON") && <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 font-bold"><Store className="h-3 w-3" />At salon</span>}
            {l.service_modes.includes("HOME_SERVICE") && <span className="inline-flex items-center gap-1 rounded-full bg-saffron/20 px-2.5 py-1 font-bold"><HomeIcon className="h-3 w-3" />Home service{l.home_service_fee > 0 ? ` (+${formatINR(l.home_service_fee)})` : ""}</span>}
            {l.service_area && <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1"><MapPin className="h-3 w-3" />{l.service_area}</span>}
          </div>
        </div>
        {l.description && <p className="text-sm text-muted-foreground">{l.description}</p>}
        {l.includes.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-2 font-bold">What's included</h3>
            <ul className="space-y-1.5 text-sm">{l.includes.map(i => <li key={i} className="flex items-center gap-2"><Check className="h-4 w-4 text-leaf" />{i}</li>)}</ul>
          </section>
        )}
        <Link to="/store/$id" params={{ id: l.partner.slug }} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
          <div><div className="text-xs text-muted-foreground">Provider</div><div className="font-bold">{l.partner.name}</div></div>
          <span className="text-sm font-bold text-primary">View profile</span>
        </Link>
        <section>
          <h3 className="mb-2 font-bold">Reviews</h3>
          {(data.reviews as { id: string; customer_name: string; rating: number; comment: string | null }[]).map(r => (
            <div key={r.id} className="mb-2 rounded-xl border border-border bg-card p-3 text-sm">
              <div className="flex justify-between font-bold">{r.customer_name}<Rating value={r.rating} /></div>
              {r.comment && <p className="mt-1 text-muted-foreground">{r.comment}</p>}
            </div>
          ))}
        </section>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur">
        <button onClick={() => setBooking(true)} className="mx-auto flex h-12 w-full max-w-2xl items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">Book Now</button>
      </div>
    </div>
  );
}

type Slot = { time: string; staffIds: string[] };

function BookingFlow({ listing, siblings, onBack }: { listing: MpListing & { partner: { name: string; address: string | null } }; siblings: MpListing[]; onBack: () => void }) {
  const { customerToken } = useAuth();
  const nav = useNavigate();
  const services = [listing, ...siblings.filter(s => s.transaction_type === "SERVICE_BOOKING" || s.transaction_type === "HOME_SERVICE_BOOKING")];
  const isHomeOnly = listing.transaction_type === "HOME_SERVICE_BOOKING";
  const [svc, setSvc] = useState<MpListing>(listing);
  const modes = (svc.service_modes.length ? svc.service_modes : ["AT_SALON"]) as ServiceMode[];
  const [mode, setMode] = useState<ServiceMode>(isHomeOnly ? "HOME_SERVICE" : modes[0]);
  const [date, setDate] = useState(nextDays(1)[0].iso);
  const [time, setTime] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [address, setAddress] = useState<{ line: string; landmark?: string }>({ line: "" });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [staff, setStaff] = useState<MpStaff[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const onAddr = useCallback((v: { line: string; landmark?: string }) => setAddress(v), []);

  useEffect(() => { if (!modes.includes(mode)) setMode(modes[0]); }, [svc]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let alive = true;
    setLoadingSlots(true); setTime(null); setStaffId(null);
    getAvailabilityFn({ data: { listingId: svc.id, date } })
      .then(r => { if (alive) { setSlots(r.slots); setStaff(r.staff as MpStaff[]); } })
      .catch(() => alive && setSlots([]))
      .finally(() => alive && setLoadingSlots(false));
    return () => { alive = false; };
  }, [svc.id, date]);

  const slot = slots.find(s => s.time === time);
  const freeStaff = staff.filter(s => slot?.staffIds.includes(s.id));
  const fee = mode === "HOME_SERVICE" ? Number(svc.home_service_fee || 0) : 0;
  const price = Number(svc.price ?? 0);
  const needsAddress = mode === "HOME_SERVICE";
  // Home-service flow asks for the address first; salon flow asks at the end only if needed.
  const addressFirst = isHomeOnly;

  const confirm = async () => {
    if (!customerToken) { toast("Please login to confirm your booking"); nav({ to: "/login", search: { redirect: `/service/${listing.id}` } }); return; }
    if (!time) { toast.error("Choose a time slot"); return; }
    if (needsAddress && !address.line.trim()) { toast.error("Add the service address"); return; }
    setSubmitting(true);
    const r = await createBookingFn({ data: { token: customerToken, listingId: svc.id, serviceMode: mode, date, time, staffId, address: needsAddress ? address : null } }).catch(() => null);
    setSubmitting(false);
    if (!r) { toast.error("Network error, please try again"); return; }
    if (!r.ok) { toast.error(r.error); if (r.error.includes("taken") || r.error.includes("booked")) setDate(d => d); return; }
    nav({ to: "/booking/$id", params: { id: r.id }, search: { confirmed: true } });
  };

  const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 font-bold"><span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">{n}</span>{title}</h3>
      {children}
    </section>
  );
  let n = 0;
  const addressStep = needsAddress && <Step n={++n} title="Address"><AddressField value={address} onChange={onAddr} /></Step>;

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button onClick={onBack} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full border border-border">‹</button>
          <h1 className="font-display text-lg font-bold">Book {isHomeOnly ? "home service" : "appointment"}</h1>
        </div>
      </div>
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-4">
        <Step n={++n} title="Select service">
          <div className="space-y-2">
            {services.map(s => (
              <button key={s.id} onClick={() => setSvc(s)} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${svc.id === s.id ? "border-primary bg-primary/5" : "border-border"}`}>
                <div><div className="font-bold">{s.name}</div><div className="text-xs text-muted-foreground">{s.duration_min} minutes</div></div>
                <div className="font-display font-extrabold">{formatINR(Number(s.price ?? 0))}</div>
              </button>
            ))}
          </div>
        </Step>
        {!isHomeOnly && modes.length > 0 && (
          <Step n={++n} title="Service mode">
            <div className="flex gap-2">
              {modes.map(m => (
                <button key={m} onClick={() => setMode(m)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold ${mode === m ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                  {m === "AT_SALON" ? <><Store className="h-4 w-4" />At Salon</> : <><HomeIcon className="h-4 w-4" />Home Service</>}
                </button>
              ))}
            </div>
          </Step>
        )}
        {addressFirst && addressStep}
        <Step n={++n} title="Select date"><DatePicker value={date} onChange={setDate} /></Step>
        <Step n={++n} title="Select time">
          {loadingSlots ? <div className="h-20 animate-pulse rounded-xl bg-secondary" /> : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No slots left on this day. Please pick another date.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map(s => (
                <button key={s.time} onClick={() => { setTime(s.time); setStaffId(null); }} className={`rounded-lg border py-2 text-sm font-bold ${time === s.time ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{fmtTime(s.time)}</button>
              ))}
            </div>
          )}
        </Step>
        {time && (
          <Step n={++n} title="Select professional">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setStaffId(null)} className={`rounded-xl border px-3 py-2 text-sm font-bold ${staffId === null ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>Any available</button>
              {freeStaff.map(s => (
                <button key={s.id} onClick={() => setStaffId(s.id)} className={`rounded-xl border px-3 py-2 text-left text-sm ${staffId === s.id ? "border-primary bg-primary/10" : "border-border"}`}>
                  <div className="font-bold">{s.name}</div><div className="text-[11px] text-muted-foreground">{s.title} · ★ {s.rating}</div>
                </button>
              ))}
            </div>
          </Step>
        )}
        {!addressFirst && addressStep}
        <Step n={++n} title="Booking summary">
          <dl className="space-y-1.5 text-sm">
            <Row k="Service" v={svc.name} />
            <Row k="Date" v={new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} />
            <Row k="Time" v={time ? fmtTime(time) : "—"} />
            <Row k="Professional" v={staffId ? freeStaff.find(s => s.id === staffId)?.name ?? "—" : "Any available"} />
            <Row k="Location" v={needsAddress ? address.line || "—" : listing.partner.address ?? listing.partner.name} />
            <Row k="Service fee" v={formatINR(price)} />
            {fee > 0 && <Row k="Home service fee" v={formatINR(fee)} />}
            <div className="flex justify-between border-t border-border pt-2 font-display text-base font-extrabold"><span>Total</span><span>{formatINR(price + fee)}</span></div>
          </dl>
          <p className="mt-2 text-[11px] text-muted-foreground">Pay at the salon or to the professional after the service.</p>
        </Step>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur">
        <button disabled={submitting || !time} onClick={confirm} className="mx-auto flex h-12 w-full max-w-2xl items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50">
          {submitting ? "Confirming…" : "Confirm Booking"}
        </button>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>;
}
