import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Truck, Wrench, Ruler, Layers, Minus, Plus, CalendarClock, Store, MapPin, MessageSquare, Home } from "lucide-react";
import { getListingFn, createBookingFn } from "@/lib/marketplace.functions";
import { appointmentOptionsFn, createEnquiryFn, myEnquiriesFn } from "@/lib/studio.functions";
import { CUSTOMER_LOCATION_TYPES, stockState } from "@/lib/studio";
import { Rating, Thumb, FavButton, EmptyState, PageTop } from "@/components/marketplace/Cards";
import { AddressField, DatePicker, nextDays } from "@/components/marketplace/AddressField";
import { useAuth } from "@/lib/store";
import { useRestockNotify, RestockSnackbar } from "@/components/RestockNotify";
import { formatINR } from "@/lib/data";
import type { MpListing } from "@/lib/marketplace";

const timeLabel = (t: string) => { if (!t) return ""; const h = Number(t.slice(0, 2)); return `${h % 12 || 12}:${t.slice(3, 5)} ${h < 12 ? "AM" : "PM"}`; };

// Marketplace products (furniture, electronics) sold by local sellers. These
// use scheduled delivery rather than the quick grocery cart.
export const Route = createFileRoute("/item/$id")({
  head: () => ({
    meta: [
      { title: "Furniture & electronics from local sellers — Kartogo" },
      { name: "description", content: "Choose a variant, schedule delivery and add installation from trusted Ongole sellers." },
      { property: "og:title", content: "Shop local furniture & electronics — Kartogo" },
      { property: "og:description", content: "Scheduled delivery with optional installation." },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ItemPage,
});

function ItemPage() {
  const { id } = Route.useParams();
  const { customerToken } = useAuth();
  const nav = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["mp-listing", id], queryFn: () => getListingFn({ data: { id } }) });
  const [variant, setVariant] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const restock = useRestockNotify({ id: `mp:${id}`, name: data?.listing?.name ?? "", category: data?.listing?.category_slug ?? "", returnTo: `/item/${id}` });
  const [install, setInstall] = useState(true);
  const [date, setDate] = useState(nextDays(3)[2].iso);
  const [address, setAddress] = useState<{ line: string; landmark?: string }>({ line: "" });
  const [checkout, setCheckout] = useState(false);
  const [busy, setBusy] = useState(false);
  const onAddr = useCallback((v: { line: string; landmark?: string }) => setAddress(v), []);

  // Showroom visit flow (furniture & electronics): pick a day and a slot.
  const [visit, setVisit] = useState(false);
  const [visitDate, setVisitDate] = useState(nextDays(3)[1].iso);
  const [visitTime, setVisitTime] = useState("");
  const [apptType, setApptType] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [visitAddress, setVisitAddress] = useState<{ line: string; landmark?: string }>({ line: "" });
  const onVisitAddr = useCallback((v: { line: string; landmark?: string }) => setVisitAddress(v), []);
  const opts = useQuery({ queryKey: ["appt-options", id, visitDate], queryFn: () => appointmentOptionsFn({ data: { listingId: id, date: visitDate } }), enabled: visit });
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  // The shopper's own questions about this item and the seller's replies.
  const myQuestions = useQuery({
    queryKey: ["my-enquiries", id, customerToken],
    queryFn: () => myEnquiriesFn({ data: { token: customerToken!, listingId: id } }),
    enabled: !!customerToken,
  });

  if (isLoading) return <div className="min-h-screen bg-background"><PageTop title="Loading…" /><div className="mx-auto mt-4 h-72 max-w-2xl animate-pulse rounded-2xl bg-secondary" /></div>;
  if (!data) return <div className="min-h-screen bg-background"><PageTop title="Not found" /><div className="mx-auto max-w-2xl p-4"><EmptyState title="This item isn't available" /></div></div>;
  const l = data.listing as MpListing & { partner: { name: string; slug: string; address?: string | null } };
  const a = l.attributes ?? {};
  const isFurniture = l.category_slug === "furniture";
  const v = variant ?? a.variants?.[0] ?? null;
  const price = Number(l.price ?? 0);
  const discount = l.mrp ? Math.round((1 - price / Number(l.mrp)) * 100) : 0;

  const buy = async () => {
    if (!customerToken) { toast("Please login to buy"); nav({ to: "/login", search: { redirect: `/item/${l.id}` } }); return; }
    if (!checkout) { setCheckout(true); return; }
    if (!address.line.trim()) { toast.error("Add a delivery address"); return; }
    setBusy(true);
    const r = await createBookingFn({ data: { token: customerToken, listingId: l.id, date, address, details: { quantity: qty, variant: v ?? "", installation: !!(a.installation && install) } } }).catch(() => null);
    setBusy(false);
    if (!r) return void toast.error("Network error, please try again");
    if (!r.ok) return void toast.error(r.error);
    nav({ to: "/booking/$id", params: { id: r.id }, search: { confirmed: true } });
  };

  const types = (opts.data?.types ?? []).filter(t => CUSTOMER_LOCATION_TYPES.includes(t) ? opts.data?.allowCustomer : opts.data?.allowBusiness !== false);
  const chosenType = types.includes(apptType) ? apptType : (types[0] ?? "Showroom Visit");
  const atCustomer = CUSTOMER_LOCATION_TYPES.includes(chosenType);
  const freeTimes = opts.data?.slots ?? [];
  const chosenTime = freeTimes.includes(visitTime) ? visitTime : "";

  const bookVisit = async () => {
    if (!customerToken) { toast("Please login to book a visit"); nav({ to: "/login", search: { redirect: `/item/${l.id}` } }); return; }
    if (!chosenTime) return void toast.error("Pick a free time");
    if (atCustomer && !visitAddress.line.trim()) return void toast.error("Add the address for the home visit");
    setBusy(true);
    const r = await createBookingFn({ data: {
      token: customerToken, listingId: l.id, storeVisit: true, date: visitDate, time: chosenTime,
      appointmentType: chosenType, atCustomer, address: atCustomer ? visitAddress : null, customerNotes: visitNotes.trim() || undefined,
      details: { variant: v ?? "", visit_store: l.partner.name },
    } }).catch(() => null);
    setBusy(false);
    if (!r) return void toast.error("Network error, please try again");
    if (!r.ok) { opts.refetch(); return void toast.error(r.error); }
    toast.success(opts.data?.mode === "INSTANT" ? "Appointment confirmed" : "Appointment requested — the seller will confirm");
    nav({ to: "/booking/$id", params: { id: r.id }, search: { confirmed: true } });
  };

  const sendQuestion = async () => {
    if (!customerToken) return;
    if (question.trim().length < 5) return void toast.error("Write a few words about what you need");
    setSending(true);
    const r = await createEnquiryFn({ data: { token: customerToken, listingId: l.id, message: question.trim() } }).catch(() => null);
    setSending(false);
    if (!r) return void toast.error("Network error, please try again");
    if (!r.ok) return void toast.error(r.error);
    toast.success("Enquiry sent. The seller will reply soon.");
    setQuestion(""); setAsking(false);
    myQuestions.refetch();
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <PageTop title={l.name} />
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4 lg:grid lg:max-w-5xl lg:grid-cols-2 lg:gap-6 lg:space-y-0">
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-3xl border border-border">
            <Thumb images={l.images} icon={l.icon} className="aspect-square w-full text-8xl" />
            <FavButton type="listing" id={l.id} className="absolute right-3 top-3" />
            {discount > 0 && <span className="absolute left-3 top-3 rounded-md bg-leaf px-2 py-1 text-xs font-extrabold text-primary-foreground">{discount}% OFF</span>}
          </div>
          {l.images.length > 1 && <div className="flex gap-2 overflow-x-auto">{l.images.map(src => <img key={src} src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />)}</div>}
        </div>
        <div className="space-y-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold">{l.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-display text-2xl font-extrabold">{formatINR(price)}</span>
              {l.mrp && <span className="text-muted-foreground line-through">{formatINR(Number(l.mrp))}</span>}
              <Rating value={l.rating} count={l.review_count} />
            </div>
            {(() => { const st = stockState(l.stock_qty ?? null, l.low_stock_threshold ?? 3); return st === "out" ? <div className="mt-1 text-sm font-semibold text-destructive">Out of stock</div> : st === "low" ? <div className="mt-1 text-sm font-semibold text-saffron-foreground">Only {l.stock_qty} left</div> : <div className="mt-1 text-sm font-semibold text-leaf">In stock</div>; })()}
          </div>
          {a.variants && a.variants.length > 0 && (
            <div><div className="mb-1 text-sm font-bold">Colour / variant</div>
              <div className="flex flex-wrap gap-2">{a.variants.map(x => <button key={x} onClick={() => setVariant(x)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${v === x ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{x}</button>)}</div>
            </div>
          )}
          <div className="grid gap-2 text-sm">
            {a.material && <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-muted-foreground" /><b>Material:</b> {a.material}</div>}
            {a.dimensions && <div className="flex items-center gap-2"><Ruler className="h-4 w-4 text-muted-foreground" /><b>Dimensions:</b> {a.dimensions}</div>}
            {a.delivery && <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground" />{a.delivery}</div>}
            <div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-muted-foreground" />{a.installation ? "Installation available" : "No installation needed"}</div>
          </div>
          {l.description && <p className="text-sm text-muted-foreground">{l.description}</p>}
          <Link to="/store/$id" params={{ id: l.partner.slug }} className="flex justify-between rounded-2xl border border-border bg-card p-3 text-sm"><span>Sold by <b>{l.partner.name}</b></span><span className="font-bold text-primary">View store</span></Link>
          {isFurniture && (asking ? (
            <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center gap-1.5 text-sm font-bold"><MessageSquare className="h-4 w-4" />Ask {l.partner.name}</div>
              <textarea aria-label="Your question" rows={3} value={question} onChange={e => setQuestion(e.target.value)} placeholder="e.g. Is this available in walnut? Can you deliver to Kurnool Road?" className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <button onClick={() => setAsking(false)} className="h-10 flex-1 rounded-xl border border-border text-sm font-bold">Cancel</button>
                <button disabled={sending} onClick={sendQuestion} className="h-10 flex-1 rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50">{sending ? "Sending…" : "Send enquiry"}</button>
              </div>
              <p className="text-[11px] text-muted-foreground">You'll get a notification when the seller replies, and can read the reply here. Your number stays private.</p>
            </div>
          ) : (
            <button onClick={() => { if (!customerToken) { toast("Please login to ask the seller"); nav({ to: "/login", search: { redirect: `/item/${l.id}` } }); return; } setAsking(true); }} className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-border bg-card p-3 text-sm font-bold text-primary"><MessageSquare className="h-4 w-4" />Ask the seller</button>
          ))}
          {isFurniture && (myQuestions.data?.length ?? 0) > 0 && (
            <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center gap-1.5 text-sm font-bold"><MessageSquare className="h-4 w-4" />Your questions</div>
              {myQuestions.data!.map((q: { id: string; events: { actor: string; message: string; created_at: string }[] }) => (
                <div key={q.id} className="space-y-1.5 border-t border-border pt-2 first:border-t-0 first:pt-0">
                  {q.events.map((ev, i) => (
                    <div key={i} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${ev.actor === "SELLER" ? "bg-secondary text-foreground" : "ml-auto bg-primary/10 text-foreground"}`}>
                      <div className="text-[10px] font-bold uppercase text-muted-foreground">{ev.actor === "SELLER" ? l.partner.name : "You"}</div>
                      <div className="whitespace-pre-wrap break-words">{ev.message}</div>
                    </div>
                  ))}
                  {!q.events.some((ev) => ev.actor === "SELLER") && <div className="text-xs text-muted-foreground">Waiting for the seller to reply.</div>}
                </div>
              ))}
            </div>
          )}

          {checkout && (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between"><span className="font-bold">Quantity</span>
                <div className="flex items-center gap-3 rounded-lg border border-border px-2 py-1">
                  <button aria-label="Decrease" onClick={() => setQty(q => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></button><b>{qty}</b>
                  <button aria-label="Increase" onClick={() => setQty(q => Math.min(5, q + 1))}><Plus className="h-4 w-4" /></button>
                </div>
              </div>
              <div><div className="mb-2 flex items-center gap-1 font-bold"><CalendarClock className="h-4 w-4" />Scheduled delivery date</div><DatePicker value={date} onChange={setDate} start={isFurniture ? 2 : 0} /></div>
              {a.installation && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={install} onChange={e => setInstall(e.target.checked)} />Add free installation on delivery</label>}
              <div><div className="mb-2 font-bold">Delivery address</div><AddressField value={address} onChange={onAddr} /></div>
              <div className="flex justify-between border-t border-border pt-2 font-display text-lg font-extrabold"><span>Total</span><span>{formatINR(price * qty)}</span></div>
              <p className="text-[11px] text-muted-foreground">Pay on delivery. The seller confirms your delivery slot.</p>
            </div>
          )}

          {visit && (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 font-bold"><Store className="h-4 w-4" />Book an appointment</div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span><b className="text-foreground">{l.partner.name}</b>{l.partner.address ? ` · ${l.partner.address}` : ""}</span></div>
              {types.length > 1 && (
                <div>
                  <div className="mb-2 font-bold">Appointment type</div>
                  <div className="flex flex-wrap gap-2">{types.map(t => (
                    <button key={t} onClick={() => setApptType(t)} className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold ${chosenType === t ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{CUSTOMER_LOCATION_TYPES.includes(t) ? <Home className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}{t}</button>
                  ))}</div>
                </div>
              )}
              <div><div className="mb-2 flex items-center gap-1 font-bold"><CalendarClock className="h-4 w-4" />{atCustomer ? "Visit date" : "Appointment date"}</div><DatePicker value={visitDate} onChange={d => { setVisitDate(d); setVisitTime(""); }} start={0} /></div>
              <div>
                <div className="mb-2 font-bold">Time</div>
                {opts.isLoading ? <div className="h-9 animate-pulse rounded-full bg-secondary" /> : freeTimes.length === 0 ? <p className="text-sm text-muted-foreground">No free times on this day. Please pick another date.</p> : (
                  <div className="flex flex-wrap gap-2">
                    {freeTimes.map(t => (
                      <button key={t} onClick={() => setVisitTime(t)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${chosenTime === t ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{timeLabel(t)}</button>
                    ))}
                  </div>
                )}
              </div>
              {atCustomer && <div><div className="mb-2 font-bold">Address for the visit</div><AddressField value={visitAddress} onChange={onVisitAddr} /></div>}
              <textarea aria-label="Notes for the seller" rows={2} value={visitNotes} onChange={e => setVisitNotes(e.target.value)} placeholder="Notes for the seller (optional)" className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
              <p className="text-[11px] text-muted-foreground">Free visit. Your appointment pass appears in My Orders → Bookings.</p>
            </div>
          )}
        </div>
      </div>
      <div className="above-bnav fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur">
        <RestockSnackbar open={restock.open} className="absolute inset-x-3 bottom-full mx-auto mb-2 max-w-2xl" />
        <div className="mx-auto flex max-w-2xl gap-2">
          {visit ? (
            <>
              <button disabled={busy} onClick={() => setVisit(false)} className="h-12 flex-1 rounded-xl border border-border font-bold">Back</button>
              <button disabled={busy} onClick={bookVisit} className="h-12 flex-[2] rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50">{busy ? "Booking…" : chosenTime ? `Book · ${timeLabel(chosenTime)}` : "Pick a time"}</button>
            </>
          ) : (
            <>
              {!checkout && (
                <button onClick={() => setVisit(true)} className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-primary font-bold text-primary">
                  <Store className="h-4 w-4" /> Visit store
                </button>
              )}
              {l.stock_qty != null && l.stock_qty <= 0 ? (
                <button disabled={restock.busy} onClick={() => void restock.notify()} className="h-12 flex-1 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50">
                  {restock.busy ? "Please wait…" : "Notify Me"}
                </button>
              ) : (
                <button disabled={busy} onClick={buy} className="h-12 flex-1 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50">
                  {busy ? "Placing order…" : checkout ? "Place order" : "Buy Now"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>

  );
}
