import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Truck, Wrench, Ruler, Layers, Minus, Plus, CalendarClock } from "lucide-react";
import { getListingFn, createBookingFn } from "@/lib/marketplace.functions";
import { Rating, Thumb, FavButton, EmptyState, PageTop } from "@/components/marketplace/Cards";
import { AddressField, DatePicker, nextDays } from "@/components/marketplace/AddressField";
import { useAuth } from "@/lib/store";
import { formatINR } from "@/lib/data";
import type { MpListing } from "@/lib/marketplace";

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
  const [install, setInstall] = useState(true);
  const [date, setDate] = useState(nextDays(3)[2].iso);
  const [address, setAddress] = useState<{ line: string; landmark?: string }>({ line: "" });
  const [checkout, setCheckout] = useState(false);
  const [busy, setBusy] = useState(false);
  const onAddr = useCallback((v: { line: string; landmark?: string }) => setAddress(v), []);

  if (isLoading) return <div className="min-h-screen bg-background"><PageTop title="Loading…" /><div className="mx-auto mt-4 h-72 max-w-2xl animate-pulse rounded-2xl bg-secondary" /></div>;
  if (!data) return <div className="min-h-screen bg-background"><PageTop title="Not found" /><div className="mx-auto max-w-2xl p-4"><EmptyState title="This item isn't available" /></div></div>;
  const l = data.listing as MpListing & { partner: { name: string; slug: string } };
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
            <div className="mt-1 text-sm font-semibold text-leaf">In stock</div>
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
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur">
        <button disabled={busy} onClick={buy} className="mx-auto flex h-12 w-full max-w-2xl items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50">
          {busy ? "Placing order…" : checkout ? "Place order" : "Buy Now"}
        </button>
      </div>
    </div>
  );
}
