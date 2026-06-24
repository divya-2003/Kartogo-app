import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, Check } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/lib/data";
import { formatINR } from "@/lib/data";
import { useCart, useAuth } from "@/lib/store";

export function ProductCard({ p, bestseller }: { p: Product; bestseller?: boolean }) {
  const { items, add, setQty } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const inCart = items.find(i => i.productId === p.id);
  const out = p.stock <= 0;

  const handleAdd = () => {
    add(p.id);
    if (!user) {
      toast.info("Please login to add items to your cart");
      nav({ to: "/login", search: { redirect: "/" } });
    }
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
        {out && <span className="absolute right-2 top-2 rounded-md bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground">Out</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <Link to="/product/$id" params={{ id: p.id }} className="line-clamp-2 text-sm font-semibold leading-snug hover:text-primary">
          {p.name}
        </Link>
        <div className="text-xs text-muted-foreground">{p.unit}</div>
        <div className="mt-1 flex items-end justify-between gap-2">
          <div>
            <div className="font-display text-base font-bold">{formatINR(p.price)}</div>
            {p.mrp && p.mrp > p.price && <div className="text-xs text-muted-foreground line-through">{formatINR(p.mrp)}</div>}
          </div>
          {inCart ? (
            <div className="flex items-center overflow-hidden rounded-lg border border-primary">
              <button onClick={() => setQty(p.id, inCart.qty - 1)} className="px-2 py-1 text-primary hover:bg-primary/10">−</button>
              <span className="min-w-6 text-center text-sm font-semibold">{inCart.qty}</span>
              <button onClick={() => setQty(p.id, inCart.qty + 1)} className="px-2 py-1 text-primary hover:bg-primary/10">+</button>
            </div>
          ) : (
            <button
              disabled={out}
              onClick={handleAdd}
              className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary hover:text-primary-foreground disabled:border-border disabled:text-muted-foreground"
            >
              {out ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />} ADD
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
