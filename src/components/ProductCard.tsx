import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, Heart, BellRing, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Product } from "@/lib/data";
import { formatINR } from "@/lib/data";
import { useCart, useAuth, useWishlist } from "@/lib/store";
import { HighlightText } from "@/components/HighlightText";

import { createStockAlertFn } from "@/lib/stock-alerts.functions";
import { customerEventService } from "@/lib/recommendations.tracking";

export function ProductCard({ p, bestseller, recommendationType, onProductOpen, highlight }: {
  p: Product;
  bestseller?: boolean;
  recommendationType?: string;
  onProductOpen?: (productId: string) => void;
  /** Search query whose matching characters should be emphasised in the title. */
  highlight?: string;
}) {
  const { items, add } = useCart();
  const { user } = useAuth();
  const { has, toggle } = useWishlist();
  const nav = useNavigate();
  
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);
  const inCart = items.find(i => i.productId === p.id);
  const wished = has(p.id);
  const out = p.stock <= 0;

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(p.id);
    customerEventService.trackProductFavorite(p.id, !wished);
    toast.success(wished ? "Removed from wishlist" : "Added to wishlist");
  };

  const handleAdd = () => {
    add(p.id);
    customerEventService.trackAddToCart(p.id);
    if (recommendationType) customerEventService.trackRecommendationAddedToCart(p.id, recommendationType);
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
      <Link onClick={() => onProductOpen?.(p.id)} to="/product/$id" params={{ id: p.id }} className="relative grid aspect-square place-items-center overflow-hidden bg-cream bg-grain">
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
        <Link onClick={() => onProductOpen?.(p.id)} to="/product/$id" params={{ id: p.id }} className="line-clamp-2 text-sm font-semibold leading-snug hover:text-primary">
          {highlight ? <HighlightText text={p.name} query={highlight} /> : p.name}
        </Link>
        <div className="text-xs text-muted-foreground">{p.unit}</div>
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
          ) : inCart ? (
            /* Once added, the card offers a direct route to the cart with the
               quantity shown underneath — no cramped stepper. */
            <div className="flex min-w-0 shrink flex-col items-end gap-0.5">
              <Link
                to="/cart"
                className="inline-flex max-w-full items-center gap-1 truncate rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
              >
                <ShoppingCart className="h-3 w-3 shrink-0" /> Go to cart
              </Link>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {inCart.qty} in cart
              </span>
            </div>

          ) : (
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary hover:text-primary-foreground"
            >
              <Plus className="h-3 w-3" /> ADD
            </button>
          )}
        </div>
        {!out && !!p.maxPerOrder && (
          <div className="mt-1 text-[11px] font-semibold text-muted-foreground">Max {p.maxPerOrder} per order</div>
        )}




      </div>
    </div>
  );
}
