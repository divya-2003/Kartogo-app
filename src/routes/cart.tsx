import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useCart, useCatalog } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import { useEffect } from "react";
import { RecommendationRow } from "@/components/RecommendationRow";
import { useFrequentlyBoughtTogether, useCustomerTracking } from "@/hooks/use-recommendations";

export const Route = createFileRoute("/cart")({
  component: CartPage,
  head: () => ({ meta: [{ title: "Cart — Kartogo" }] }),
});

function CartPage() {
  const { items, setQty, remove, subtotal } = useCart();
  const { products } = useCatalog();
  const nav = useNavigate();
  const track = useCustomerTracking();
  const { items: alsoNeed } = useFrequentlyBoughtTogether(items.map(i => i.productId), 4);
  useEffect(() => { track.trackCartView(); }, [track]);
  const fee = subtotal === 0 ? 0 : subtotal >= 199 ? 0 : 25;
  const total = subtotal + fee;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <h1 className="mb-6 font-display text-3xl font-bold">Your cart</h1>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <div className="font-semibold">Your cart is empty</div>
            <p className="mb-4 text-sm text-muted-foreground">Add a few items to get started.</p>
            <Link to="/" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Browse products</Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_320px]">
            <div className="divide-y divide-border rounded-2xl border border-border bg-card">
              {items.map(i => {
                const p = products.find(p => p.id === i.productId);
                if (!p) return null;
                return (
                  <div key={i.productId} className="flex items-start gap-3 p-3 sm:p-4">
                    <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-cream bg-grain text-2xl sm:h-16 sm:w-16 sm:text-3xl">{p.image ? <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover" /> : p.emoji}</div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold leading-tight">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.unit} · {formatINR(p.price)}</div>
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:justify-end sm:gap-3">
                        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border">
                          <button aria-label={`Decrease quantity of ${p.name}`} onClick={() => setQty(p.id, i.qty - 1)} className="grid h-8 w-8 place-items-center hover:bg-secondary"><Minus className="h-3 w-3" /></button>
                          <span className="min-w-6 text-center text-sm font-bold">{i.qty}</span>
                          <button aria-label={`Increase quantity of ${p.name}`} onClick={() => setQty(p.id, i.qty + 1)} className="grid h-8 w-8 place-items-center hover:bg-secondary"><Plus className="h-3 w-3" /></button>
                        </div>
                        <div className="shrink-0 whitespace-nowrap text-right font-bold sm:w-20">{formatINR(p.price * i.qty)}</div>
                        <button onClick={() => remove(p.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>

                );
              })}
            </div>
            <aside className="h-fit rounded-2xl border border-border bg-card p-5">
              <div className="font-display text-lg font-bold">Bill summary</div>
              <div className="my-4 space-y-2 text-sm">
                <Row label="Subtotal" value={formatINR(subtotal)} />
                <Row label="Delivery fee" value={fee === 0 ? "FREE" : formatINR(fee)} />
                {fee > 0 && <div className="text-xs text-primary">Add {formatINR(199 - subtotal)} more for free delivery</div>}
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <div className="font-semibold">Total</div>
                <div className="font-display text-xl font-bold">{formatINR(total)}</div>
              </div>
              <button onClick={() => nav({ to: "/checkout" })} className="mt-5 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90">Proceed to checkout</button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{value}</span></div>;
}
