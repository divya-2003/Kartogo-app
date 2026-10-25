import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useCart, useCatalog, useWallet, useWishlist, useAuth } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { Plus, Minus, ShoppingBag, Zap, PackageCheck, Truck, Wallet, Ticket, ChevronDown, ChevronUp, Trash2, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RecommendationRow } from "@/components/RecommendationRow";
import { LocationPicker } from "@/components/LocationPicker";
import { useFrequentlyBoughtTogether, useCustomerTracking } from "@/hooks/use-recommendations";
import { tierOf, tierEta, TIER_LABEL, type DeliveryTier } from "@/lib/delivery-tier";
import { COUPONS } from "@/lib/promo";

const SEGMENTS: { tier: DeliveryTier }[] = [{ tier: "quick" }, { tier: "standard" }];

export const Route = createFileRoute("/cart")({
  component: CartPage,
  head: () => ({
    meta: [
      { title: "Cart — Kartogo" },
      { name: "description", content: "Review the items in your Kartogo cart, see your savings and price details, and proceed to buy." },
      { property: "og:title", content: "Cart — Kartogo" },
      { property: "og:description", content: "Review the items in your Kartogo cart, see your savings and price details, and proceed to buy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function CartPage() {
  const { items, setQty, remove, subtotal } = useCart();
  const { products } = useCatalog();
  const { balance } = useWallet();
  const { has: inWishlist, toggle: toggleWishlist } = useWishlist();
  const { user } = useAuth();
  const nav = useNavigate();
  const track = useCustomerTracking();
  const { items: alsoNeed } = useFrequentlyBoughtTogether(items.map(i => i.productId), 4);
  const [showFees, setShowFees] = useState(false);
  const [showDiscounts, setShowDiscounts] = useState(true);
  useEffect(() => { track.trackCartView(); }, [track]);

  const fee = subtotal === 0 ? 0 : subtotal >= 199 ? 0 : 25;
  const total = subtotal + fee;
  // MRP total: each line's MRP (falls back to selling price when no MRP is set).
  const mrpTotal = items.reduce((sum, i) => {
    const p = products.find(x => x.id === i.productId);
    if (!p) return sum;
    return sum + Math.max(p.mrp ?? p.price, p.price) * i.qty;
  }, 0);
  const mrpDiscount = Math.max(0, mrpTotal - subtotal);
  const savings = mrpDiscount;
  const coupons = Object.entries(COUPONS);
  const eligibleCoupons = coupons.filter(([, c]) => subtotal >= c.minSubtotal);

  const removeLine = (id: string) => { remove(id); track.trackRemoveFromCart(id); };
  const moveToWishlist = (id: string) => {
    if (!user) { nav({ to: "/login", search: { redirect: "/cart" } as never }); return; }
    if (!inWishlist(id)) toggleWishlist(id);
    removeLine(id);
    toast.success("Moved to your wishlist");
  };
  const applyCoupon = (code: string) => {
    try { localStorage.setItem("qk_promo_code", code); } catch { /* ignore */ }
    toast.success(`${code} will be applied at checkout`);
  };

  return (
    <div className="min-h-screen bg-secondary/40">
      <Header />
      {items.length === 0 ? (
        <div className="mx-auto max-w-2xl px-4 py-8">
          <h1 className="mb-6 font-display text-3xl font-bold">Your cart</h1>
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <div className="font-semibold">Your cart is empty</div>
            <p className="mb-4 text-sm text-muted-foreground">Add a few items to get started.</p>
            <Link to="/" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Browse products</Link>
          </div>
        </div>
      ) : (
        <>
          {/* One scrollable page; bottom padding keeps content clear of the fixed total bar. */}
          <div className="mx-auto max-w-2xl space-y-4 px-4 pb-44 pt-4 md:px-6">
            <div className="flex items-center justify-between gap-3">
              <h1 className="font-display text-2xl font-bold">Your cart <span className="text-base font-semibold text-muted-foreground">({items.length})</span></h1>
            </div>

            <div className="rounded-2xl border border-border bg-card p-2">
              <LocationPicker />
            </div>

            {/* Items, grouped by delivery speed */}
            {SEGMENTS.map(seg => {
              const rows = items
                .map(i => ({ i, p: products.find(p => p.id === i.productId) }))
                .filter((r): r is { i: typeof items[number]; p: NonNullable<typeof r.p> } => !!r.p && tierOf(r.p) === seg.tier);
              if (rows.length === 0) return null;
              return (
                <section key={seg.tier} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/40 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${seg.tier === "quick" ? "bg-leaf/15 text-leaf" : "bg-primary/10 text-primary"}`}>
                        {seg.tier === "quick" ? <Zap className="h-4 w-4" /> : <PackageCheck className="h-4 w-4" />}
                      </span>
                      <span className="truncate font-display text-sm font-extrabold">{TIER_LABEL[seg.tier]}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">({rows.length})</span>
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {rows.map(({ i, p }) => {
                      const mrp = Math.max(p.mrp ?? p.price, p.price);
                      const off = mrp > p.price ? Math.round(((mrp - p.price) / mrp) * 100) : 0;
                      return (
                        <div key={i.productId} className="space-y-3 p-4">
                          <div className="flex items-start gap-3">
                            <Link to="/product/$id" params={{ id: p.id }} className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-cream bg-grain text-3xl">
                              {p.image ? <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover" /> : p.emoji}
                            </Link>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold leading-tight">{p.name}</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">{p.unit}</div>
                              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                                {off > 0 && <span className="text-sm font-bold text-leaf">↓{off}%</span>}
                                {off > 0 && <span className="text-sm text-muted-foreground line-through">{formatINR(mrp * i.qty)}</span>}
                                <span className="font-display text-lg font-extrabold">{formatINR(p.price * i.qty)}</span>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border">
                              <button aria-label={`Decrease quantity of ${p.name}`} onClick={() => { setQty(p.id, i.qty - 1); if (i.qty === 1) track.trackRemoveFromCart(p.id); }} className="grid h-8 w-8 place-items-center hover:bg-secondary"><Minus className="h-3 w-3" /></button>
                              <span className="min-w-6 text-center text-sm font-bold">{i.qty}</span>
                              <button aria-label={`Increase quantity of ${p.name}`} onClick={() => setQty(p.id, i.qty + 1)} className="grid h-8 w-8 place-items-center hover:bg-secondary"><Plus className="h-3 w-3" /></button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2 text-sm">
                            <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="text-muted-foreground">Delivery</span>
                            <span className="font-bold">{tierEta(seg.tier)}</span>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => removeLine(p.id)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-sm font-bold hover:bg-secondary">
                              <Trash2 className="h-4 w-4" /> Remove
                            </button>
                            <button onClick={() => moveToWishlist(p.id)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-sm font-bold hover:bg-secondary">
                              <Heart className="h-4 w-4" /> Move to Wishlist
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {/* Savings zone */}
            <section className="space-y-3 rounded-2xl bg-primary/5 p-4">
              <div className="font-display text-lg font-extrabold">Savings zone</div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-muted-foreground">Pay using Kartogo Cash</div>
                  <Link to="/wallet" className="text-sm font-bold text-primary">View</Link>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Wallet className="h-5 w-5" /></span>
                  <div>
                    <div className="font-bold">Balance {formatINR(balance)}</div>
                    <div className="text-xs text-muted-foreground">Use it at checkout</div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Ticket className="h-4 w-4" /> Coupons</div>
                <div className="mt-2 space-y-2">
                  {coupons.map(([code, c]) => {
                    const ok = subtotal >= c.minSubtotal;
                    return (
                      <div key={code} className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2">
                        <div className="min-w-0">
                          <div className="font-bold">{code}</div>
                          <div className="truncate text-xs text-muted-foreground">{ok ? c.desc : `Add ${formatINR(c.minSubtotal - subtotal)} more to use`}</div>
                        </div>
                        <button disabled={!ok} onClick={() => applyCoupon(code)} className="shrink-0 text-sm font-bold text-primary disabled:text-muted-foreground">Apply</button>
                      </div>
                    );
                  })}
                </div>
                {eligibleCoupons.length === 0 && <div className="mt-2 text-xs text-muted-foreground">Coupons unlock as your cart grows.</div>}
              </div>
            </section>

            {/* Price details */}
            <section>
              <div className="mb-2 font-display text-lg font-extrabold">Price details</div>
              <div className="space-y-3 rounded-2xl border border-border bg-card p-4 text-sm">
                <Row label="MRP (incl. of all taxes)" value={formatINR(mrpTotal)} />
                <button onClick={() => setShowFees(v => !v)} className="flex w-full items-center justify-between">
                  <span className="flex items-center gap-1 font-semibold">Fees {showFees ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
                  <span className="font-semibold">{fee === 0 ? "FREE" : formatINR(fee)}</span>
                </button>
                {showFees && (
                  <div className="space-y-1 pl-3 text-muted-foreground">
                    <Row label="Delivery fee" value={fee === 0 ? "FREE" : formatINR(fee)} />
                    {fee > 0 && <div className="text-xs text-primary">Add {formatINR(199 - subtotal)} more for free delivery</div>}
                  </div>
                )}
                <div className="border-t border-dashed border-border" />
                <button onClick={() => setShowDiscounts(v => !v)} className="flex w-full items-center justify-between">
                  <span className="flex items-center gap-1 font-semibold">Discounts {showDiscounts ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
                  <span className="font-semibold text-leaf">−{formatINR(mrpDiscount)}</span>
                </button>
                {showDiscounts && (
                  <div className="pl-3">
                    <div className="flex justify-between text-muted-foreground"><span>Discount on MRP</span><span className="font-semibold text-leaf">−{formatINR(mrpDiscount)}</span></div>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="font-display text-base font-extrabold">Total amount</span>
                  <span className="font-display text-base font-extrabold">{formatINR(total)}</span>
                </div>
                <div className="text-xs text-muted-foreground">Coupons and Kartogo Cash are applied at checkout.</div>
              </div>
            </section>

            <RecommendationRow
              title="You may also need"
              subtitle="Often bought with what's in your cart."
              items={alsoNeed}
              limit={4}
              compact
            />
          </div>

          {/* Always-visible total bar — cannot be closed or scrolled away. */}
          <div className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto max-w-2xl px-3 pb-3">
              <div className="rounded-2xl border border-border bg-card p-3 shadow-pop">
                {savings > 0 && (
                  <div className="mb-2 rounded-xl bg-leaf/10 px-3 py-1.5 text-sm text-leaf">
                    You'll save <span className="font-extrabold">{formatINR(savings)}</span> on this order
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="min-w-0">
                    {mrpTotal > total && <div className="text-sm text-muted-foreground line-through">{formatINR(mrpTotal)}</div>}
                    <div className="font-display text-2xl font-extrabold leading-tight">{formatINR(total)}</div>
                  </div>
                  <button onClick={() => nav({ to: "/checkout" })} className="ml-auto flex-1 rounded-2xl bg-primary py-3.5 font-display text-base font-extrabold text-primary-foreground hover:bg-primary/90 sm:max-w-xs">
                    Proceed to buy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span>{label}</span><span className="font-semibold">{value}</span></div>;
}
