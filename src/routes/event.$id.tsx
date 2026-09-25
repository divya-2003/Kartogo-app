import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { getListingFn, createBookingFn } from "@/lib/marketplace.functions";
import { Rating, Thumb, FavButton, EmptyState, PageTop } from "@/components/marketplace/Cards";
import { AddressField, DatePicker, nextDays } from "@/components/marketplace/AddressField";
import { useAuth } from "@/lib/store";
import { formatINR } from "@/lib/data";
import type { MpListing } from "@/lib/marketplace";

export const Route = createFileRoute("/event/$id")({
  head: () => ({
    meta: [
      { title: "Event packages & quotes — Kartogo" },
      { name: "description", content: "Compare Basic, Premium and Custom event packages, check availability or request a quote from local event providers." },
      { property: "og:title", content: "Book events locally — Kartogo" },
      { property: "og:description", content: "Decorations, catering, photography, DJs and venues in Ongole." },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EventPage,
});

const EVENT_TYPES = ["Birthday", "Wedding", "Engagement", "Anniversary", "Baby shower", "Corporate", "Housewarming", "Other"];

function EventPage() {
  const { id } = Route.useParams();
  const { customerToken } = useAuth();
  const nav = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["mp-listing", id], queryFn: () => getListingFn({ data: { id } }) });
  const [step, setStep] = useState<"detail" | "form">("detail");
  const [pkg, setPkg] = useState<string | null>(null);
  const [eventType, setEventType] = useState("Birthday");
  const [date, setDate] = useState(nextDays(3)[2].iso);
  const [time, setTime] = useState("18:00");
  const [guests, setGuests] = useState("50");
  const [req, setReq] = useState("");
  const [address, setAddress] = useState<{ line: string; landmark?: string }>({ line: "" });
  const [busy, setBusy] = useState(false);
  const onAddr = useCallback((v: { line: string; landmark?: string }) => setAddress(v), []);

  if (isLoading) return <div className="min-h-screen bg-background"><PageTop title="Loading…" /><div className="mx-auto mt-4 h-64 max-w-2xl animate-pulse rounded-2xl bg-secondary" /></div>;
  if (!data) return <div className="min-h-screen bg-background"><PageTop title="Not found" /><div className="mx-auto max-w-2xl p-4"><EmptyState title="This package isn't available" /></div></div>;
  const l = data.listing as MpListing & { partner: { name: string; slug: string; service_area: string | null } };
  const isQuote = l.transaction_type === "QUOTE_REQUEST";
  const chosen = l.packages.find(p => p.name === pkg);
  const custom = isQuote || (chosen && chosen.price == null);

  const submit = async () => {
    if (!customerToken) { toast("Please login to send your request"); nav({ to: "/login", search: { redirect: `/event/${l.id}` } }); return; }
    if (!address.line.trim()) { toast.error("Add the event location"); return; }
    if (!isQuote && !pkg) { toast.error("Choose a package"); return; }
    setBusy(true);
    const r = await createBookingFn({ data: {
      token: customerToken, listingId: l.id, date, time, address, packageName: pkg,
      details: { event_type: eventType, guests: Number(guests) || 0, requirements: req.slice(0, 1000), custom: !!custom },
    } }).catch(() => null);
    setBusy(false);
    if (!r) return void toast.error("Network error, please try again");
    if (!r.ok) return void toast.error(r.error);
    nav({ to: "/booking/$id", params: { id: r.id }, search: { confirmed: true } });
  };

  if (step === "form") return (
    <div className="min-h-screen bg-background pb-32">
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button onClick={() => setStep("detail")} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full border border-border">‹</button>
          <h1 className="font-display text-lg font-bold">{custom ? "Request a quote" : "Request booking"}</h1>
        </div>
      </div>
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-4">
        <div className="rounded-2xl border border-border bg-card p-4 text-sm"><b>{l.name}</b>{pkg && <> · {pkg}</>}<div className="text-muted-foreground">{l.partner.name}</div></div>
        <Field label="Event type">
          <div className="flex flex-wrap gap-2">{EVENT_TYPES.map(t => <button key={t} onClick={() => setEventType(t)} className={`rounded-full border px-3 py-1 text-xs font-bold ${eventType === t ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{t}</button>)}</div>
        </Field>
        <Field label="Event date"><DatePicker value={date} onChange={setDate} start={1} /></Field>
        <div className="flex gap-3">
          <Field label="Event time"><input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" /></Field>
          <Field label="Guest count"><input inputMode="numeric" value={guests} onChange={e => setGuests(e.target.value.replace(/\D/g, "").slice(0, 5))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" /></Field>
        </div>
        <Field label="Event location"><AddressField value={address} onChange={onAddr} /></Field>
        <Field label="Special requirements">
          <textarea rows={3} value={req} onChange={e => setReq(e.target.value)} placeholder="Theme, colours, menu preferences, timings…" className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
        </Field>
        <p className="text-xs text-muted-foreground">{custom ? "The provider will review your details and send you a quote." : "The provider will confirm availability. No payment is taken now."}</p>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur">
        <button disabled={busy} onClick={submit} className="mx-auto flex h-12 w-full max-w-2xl items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50">{busy ? "Sending…" : custom ? "Request Quote" : "Request Booking"}</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-28">
      <PageTop title={l.name} />
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4 lg:max-w-4xl">
        <div className="relative overflow-hidden rounded-3xl border border-border">
          <Thumb images={l.images} icon={l.icon} className="aspect-[16/9] w-full text-7xl" />
          <FavButton type="listing" id={l.id} className="absolute right-3 top-3" />
        </div>
        {l.images.length > 1 && <div className="flex gap-2 overflow-x-auto">{l.images.slice(1).map(src => <img key={src} src={src} alt="" className="h-20 w-28 rounded-xl object-cover" />)}</div>}
        <div>
          <h2 className="font-display text-2xl font-extrabold">{l.name}</h2>
          <div className="mt-1 flex items-center gap-3">
            {l.starting_price != null ? <span className="font-display text-xl font-extrabold">Starting {formatINR(Number(l.starting_price))}</span> : <span className="font-bold text-muted-foreground">Price on quote</span>}
            <Rating value={l.rating} count={l.review_count} />
          </div>
        </div>
        {l.description && <p className="text-sm text-muted-foreground">{l.description}</p>}
        {l.includes.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-2 font-bold">What's included</h3>
            <ul className="space-y-1.5 text-sm">{l.includes.map(i => <li key={i} className="flex gap-2"><Check className="h-4 w-4 text-leaf" />{i}</li>)}</ul>
          </section>
        )}
        {l.packages.length > 0 && (
          <section>
            <h3 className="mb-2 font-bold">Packages</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {l.packages.map(p => (
                <button key={p.name} onClick={() => setPkg(p.name)} className={`rounded-2xl border p-4 text-left ${pkg === p.name ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border bg-card"}`}>
                  <div className="font-display font-extrabold">{p.name}</div>
                  <div className="text-lg font-extrabold">{p.price != null ? formatINR(p.price) : "Custom quote"}</div>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{p.items.map(i => <li key={i}>• {i}</li>)}</ul>
                </button>
              ))}
            </div>
          </section>
        )}
        <Link to="/store/$id" params={{ id: l.partner.slug }} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
          <div><div className="text-xs text-muted-foreground">Provider · Portfolio & reviews</div><div className="font-bold">{l.partner.name}</div>{l.partner.service_area && <div className="text-xs text-muted-foreground">Serves {l.partner.service_area}</div>}</div>
          <span className="text-sm font-bold text-primary">View</span>
        </Link>
        <section>
          <h3 className="mb-2 font-bold">Reviews</h3>
          {(data.reviews as { id: string; customer_name: string; rating: number; comment: string | null }[]).map(r => (
            <div key={r.id} className="mb-2 rounded-xl border border-border bg-card p-3 text-sm"><div className="flex justify-between font-bold">{r.customer_name}<Rating value={r.rating} /></div>{r.comment && <p className="mt-1 text-muted-foreground">{r.comment}</p>}</div>
          ))}
        </section>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur">
        <button onClick={() => { if (!isQuote && l.packages.length && !pkg) { setPkg(l.packages[0].name); } setStep("form"); }} className="mx-auto flex h-12 w-full max-w-2xl items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">
          {isQuote ? "Request Quote" : "Check Availability"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block flex-1 rounded-2xl border border-border bg-card p-4"><span className="mb-2 block text-sm font-bold">{label}</span>{children}</label>;
}
