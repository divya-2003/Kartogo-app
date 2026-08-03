import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, Heart, BellRing, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Product } from "@/lib/data";
import { formatINR } from "@/lib/data";
import { useCart, useAuth, useWishlist } from "@/lib/store";
import { useProductOffers, OFFER_TONE_CLASS } from "@/lib/use-offers";
import { createStockAlertFn } from "@/lib/stock-alerts.functions";

export function ProductCard({ p, bestseller }: { p: Product; bestseller?: boolean }) {
  const { items, add, setQty } = useCart();
  const { user } = useAuth();
  const { has, toggle } = useWishlist();
  const nav = useNavigate();
  const offers = useProductOffers(p.id);
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);
  const inCart = items.find(i => i.productId === p.id);
  const wished = has(p.id);
  const out = p.stock <= 0;

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(p.id);
    toast.success(wished ? "Removed from wishlist" : "Added to wishlist");
  };

  const handleAdd = () => {
    add(p.id);
    if (!user) {
      toast.info("Please login to add items to your cart");
      nav({ to: "/login", search: { redirect: "/" } });
    }
  };

  // Out-of-stock → raise a restock request with the admin (product + markets).
  const handleNotify = async () => {
    setNotifying(true);
    try {
      await createStockAlertFn({ data: {
        productId: p.id,
        productName: p.name,
        category: p.category,
        customerPhone: user?.phone ?? null,
        customerName: user?.name ?? null,
      } });
      setNotified(true);
      toast.success("We'll notify you when it's back");
    } catch {
      toast.error("Couldn't register your request");
    } finally { setNotifying(false); }
  };




  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:shadow-pop">
      <Link to="/product/$id" params={{ id: p.id }} className="relative grid aspect-square place-items-center overflow-hidden bg-cream bg-grain">
        {p.image ? (
          <img src={p.image} alt={p.name} loading="lazy" width={768} height={768} className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="text-6xl transition group-hover:scale-110">{p.emoji}</div>
        )}
        {(bestseller || (p.mrp && p.mrp > p.price)) && (
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {bestseller && (
              <span className="rounded-md bg-saffron px-2 py-0.5 text-[11px] font-bold text-foreground shadow-pop">
                BESTSELLER
              </span>
            )}
            {p.mrp && p.mrp > p.price && (
              <span className="w-fit rounded-md bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                {Math.round((1 - p.price / p.mrp) * 100)}% OFF
              </span>
            )}
          </div>
        )}
        {out && <span className="absolute right-11 top-2 rounded-md bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground">Out</span>}
        <button
          onClick={handleWishlist}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={wished}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-card/90 shadow-pop backdrop-blur transition hover:bg-card"
        >
          <Heart className={`h-4 w-4 ${wished ? "fill-primary text-primary" : "text-muted-foreground"}`} />
        </button>
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <Link to="/product/$id" params={{ id: p.id }} className="line-clamp-2 text-sm font-semibold leading-snug hover:text-primary">
          {p.name}
        </Link>
        <div className="text-xs text-muted-foreground">{p.unit}</div>
        {offers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {offers.slice(0, 2).map(o => (
              <span key={o.id} className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${OFFER_TONE_CLASS[o.tone] ?? OFFER_TONE_CLASS.primary}`}>
                {o.badge || o.title}
              </span>
            ))}
          </div>
        )}
        <div className="mt-1 flex items-end justify-between gap-2">
          <div>
            <div className="font-display text-base font-bold">{formatINR(p.price)}</div>
            {p.mrp && p.mrp > p.price && <div className="text-xs text-muted-foreground line-through">{formatINR(p.mrp)}</div>}
          </div>
          {out ? (
            <button
              onClick={() => void handleNotify()}
              disabled={notifying || notified}
              className="inline-flex items-center gap-1 rounded-lg border border-saffron bg-saffron/15 px-2.5 py-1.5 text-xs font-bold text-foreground transition hover:bg-saffron/30 disabled:opacity-70"
            >
              <BellRing className="h-3 w-3" /> {notified ? "NOTIFYING" : notifying ? "…" : "NOTIFY ME"}
            </button>
          ) : !inCart ? (
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary hover:text-primary-foreground"
            >
              <Plus className="h-3 w-3" /> ADD
            </button>
          ) : null}
        </div>

        {/* Same flow as the product page: quantity stepper + a plain "Go to cart" button */}
        {!out && inCart && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-primary p-0.5">
              <button onClick={() => setQty(p.id, inCart.qty - 1)} aria-label="Decrease quantity" className="grid h-7 w-7 place-items-center rounded-lg text-primary hover:bg-primary/10">−</button>
              <span className="min-w-5 text-center text-sm font-bold">{inCart.qty}</span>
              <button onClick={() => setQty(p.id, inCart.qty + 1)} aria-label="Increase quantity" className="grid h-7 w-7 place-items-center rounded-lg text-primary hover:bg-primary/10">+</button>
            </div>
            <Link
              to="/cart"
              className="flex-1 rounded-xl border border-border px-2 py-2 text-center text-xs font-bold hover:bg-secondary"
            >
              Go to cart
            </Link>
          </div>
        )}


      </div>
    </div>
  );
}
