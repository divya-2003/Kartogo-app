import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, Minus, Plus, Search, X, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTop } from "@/components/marketplace/Cards";
import { AddressField } from "@/components/marketplace/AddressField";
import { useAuth } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { KITCHENS, FOOD_DELIVERY_FEE, dishUnitPrice, type Dish, type Kitchen } from "@/lib/food";
import { createFoodOrderFn } from "@/lib/service-orders.functions";



type Line = { key: string; dish: Dish; qty: number; addons: string[] };

function VegMark({ veg }: { veg: boolean }) {
  return <span aria-label={veg ? "Veg" : "Non-veg"} className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border-2 ${veg ? "border-leaf" : "border-destructive"}`}><span className={`h-1.5 w-1.5 rounded-full ${veg ? "bg-leaf" : "bg-destructive"}`} /></span>;
}

export function FoodExperience({ embedded = false, initialQ = "" }: { embedded?: boolean; initialQ?: string }) {
  const { customerToken } = useAuth();
  const nav = useNavigate();
  const [kitchen, setKitchen] = useState<Kitchen | null>(null);
  const [vegOnly, setVegOnly] = useState(false);
  const [q, setQ] = useState(initialQ);
  const [lines, setLines] = useState<Line[]>([]);
  const [custom, setCustom] = useState<{ dish: Dish; addons: string[] } | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [address, setAddress] = useState<{ line: string; landmark?: string }>({ line: "" });
  const [busy, setBusy] = useState(false);
  const onAddr = useCallback((v: { line: string; landmark?: string }) => setAddress(v), []);

  const kitchens = useMemo(() => KITCHENS.filter(k =>
    (!vegOnly || k.dishes.some(d => d.veg)) &&
    (!q || (k.name + k.cuisine + k.dishes.map(d => d.name).join(" ")).toLowerCase().includes(q.toLowerCase()))), [vegOnly, q]);

  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + dishUnitPrice(l.dish, l.addons) * l.qty, 0);

  const add = (dish: Dish, addons: string[]) => {
    if (!customerToken) { toast("Please login to order"); nav({ to: "/login", search: { redirect: "/food" } }); return; }
    const key = dish.id + ":" + [...addons].sort().join(",");
    setLines(ls => ls.find(l => l.key === key) ? ls.map(l => l.key === key ? { ...l, qty: Math.min(10, l.qty + 1) } : l) : [...ls, { key, dish, qty: 1, addons }]);
  };
  const qtyOf = (id: string) => lines.filter(l => l.dish.id === id).reduce((s, l) => s + l.qty, 0);
  const dec = (id: string) => setLines(ls => {
    const idx = ls.map(l => l.dish.id).lastIndexOf(id);
    if (idx < 0) return ls;
    return ls.flatMap((l, i) => i !== idx ? [l] : l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : []);
  });
  const openKitchen = (k: Kitchen) => {
    if (lines.length && kitchen && kitchen.id !== k.id) { if (!confirm("Your basket has items from another kitchen. Clear it?")) return; setLines([]); }
    setKitchen(k); setCheckout(false);
  };

  const place = async () => {
    if (!customerToken) return;
    if (address.line.trim().length < 3) return void toast.error("Add a delivery address");
    setBusy(true);
    const r = await createFoodOrderFn({ data: { token: customerToken, address, items: lines.map(l => ({ dishId: l.dish.id, qty: l.qty, addons: l.addons })) } }).catch(() => null);
    setBusy(false);
    if (!r) return void toast.error("Network error, please try again");
    if (!r.ok) return void toast.error(r.error);
    toast.success(`Order ${r.code} placed`);
    setLines([]);
    nav({ to: "/orders", search: { tab: "bookings" } });
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      {!embedded && <PageTop title={kitchen ? kitchen.name : "Food"} />}
      {embedded && kitchen && <div className="flex items-center justify-between gap-3 pt-5"><Button variant="outline" onClick={() => { setKitchen(null); setCheckout(false); }}>Restaurants</Button><h2 className="font-display text-lg font-bold">{kitchen.name}</h2></div>}
      <div className={embedded ? "py-5" : "mx-auto max-w-2xl px-4 py-4"}>
        {!kitchen ? (
          <>
            <div className="border-b border-sec-food/30 bg-sec-food/15 px-5 py-6 text-foreground">
              <div className="text-xs font-bold uppercase tracking-wide opacity-80">Hot meals, fast</div>
              <h1 className="font-display text-2xl font-extrabold">What are you craving?</h1>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-foreground">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search biryani, dosa, thali…" className="w-full bg-transparent text-sm outline-none" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setVegOnly(v => !v)} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${vegOnly ? "border-leaf bg-leaf/10 text-leaf" : "border-border"}`}><VegMark veg /> Veg only</Button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {kitchens.map(k => (
                <Button variant="ghost" key={k.id} onClick={() => openKitchen(k)} className="block w-full overflow-hidden rounded-3xl border border-border bg-card text-left shadow-pop">
                  <div className="relative">
                    <img src={k.image} alt={k.name} loading="lazy" className="h-40 w-full object-cover" />
                    {k.tag && <span className="absolute left-3 top-3 rounded-md bg-accent px-2 py-1 text-[11px] font-extrabold text-accent-foreground">{k.tag}</span>}
                  </div>
                  <div className="flex items-start justify-between gap-2 p-4">
                    <div>
                      <div className="font-display text-lg font-extrabold">{k.name}</div>
                      <div className="text-sm text-muted-foreground">{k.cuisine}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        {k.pureVeg && <span className="flex items-center gap-1 font-bold text-leaf"><VegMark veg />Pure veg</span>}
                        <span className="rounded-full bg-secondary px-2 py-0.5 font-bold">New</span>
                      </div>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-sm font-bold"><Clock className="h-4 w-4" />{k.eta} min</span>
                  </div>
                </Button>
              ))}
              {kitchens.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No kitchens match your search.</p>}
            </div>
          </>
        ) : checkout ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-2 font-bold">Your order</div>
              {lines.map(l => (
                <div key={l.key} className="flex justify-between py-1 text-sm">
                  <span className="flex items-center gap-2"><VegMark veg={l.dish.veg} />{l.qty} × {l.dish.name}{l.addons.length > 0 && <span className="text-xs text-muted-foreground">(+{l.addons.length} add-on)</span>}</span>
                  <span className="font-semibold">{formatINR(dishUnitPrice(l.dish, l.addons) * l.qty)}</span>
                </div>
              ))}
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm"><span>Delivery fee</span><span>{formatINR(FOOD_DELIVERY_FEE)}</span></div>
              <div className="flex justify-between font-display text-lg font-extrabold"><span>Total</span><span>{formatINR(subtotal + FOOD_DELIVERY_FEE)}</span></div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4"><div className="mb-2 font-bold">Delivery address</div><AddressField value={address} onChange={onAddr} /></div>
            <p className="text-xs text-muted-foreground">Pay on delivery · Arrives in about {kitchen.eta} minutes.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3 text-sm">
              <span className="text-muted-foreground">{kitchen.cuisine}</span>
              <span className="flex items-center gap-1 font-bold"><Clock className="h-4 w-4" />{kitchen.eta} min</span>
            </div>
            {kitchen.dishes.filter(d => !vegOnly || d.veg).map(d => {
              const n = qtyOf(d.id);
              return (
                <article key={d.id} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><VegMark veg={d.veg} />{d.bestseller && <span className="text-[11px] font-extrabold text-accent">★ Bestseller</span>}</div>
                    <div className="mt-1 font-bold">{d.name}</div>
                    <div className="font-semibold">{formatINR(d.price)}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{d.desc}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end justify-center gap-1">
                    {n === 0 ? (
                      <Button variant="ghost" onClick={() => d.addons?.length ? setCustom({ dish: d, addons: [] }) : add(d, [])} className="rounded-lg border border-primary px-5 py-1.5 text-sm font-extrabold text-primary">ADD</Button>
                    ) : (
                      <div className="flex items-center gap-3 rounded-lg bg-primary px-2 py-1.5 text-primary-foreground">
                        <Button variant="ghost" aria-label="Decrease" onClick={() => dec(d.id)}><Minus className="h-4 w-4" /></Button><b className="text-sm">{n}</b>
                        <Button variant="ghost" aria-label="Increase" onClick={() => d.addons?.length ? setCustom({ dish: d, addons: [] }) : add(d, [])}><Plus className="h-4 w-4" /></Button>
                      </div>
                    )}
                    {d.addons?.length ? <span className="text-[10px] text-muted-foreground">Customisable</span> : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {custom && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40" onClick={() => setCustom(null)}>
          <div className="w-full max-w-2xl rounded-t-3xl bg-card p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><div className="font-display text-lg font-extrabold">{custom.dish.name}</div><Button variant="ghost" aria-label="Close" onClick={() => setCustom(null)}><X className="h-5 w-5" /></Button></div>
            <div className="mt-3 space-y-2">
              {(custom.dish.addons ?? []).map(a => (
                <label key={a.id} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
                  <span className="flex items-center gap-2"><input type="checkbox" checked={custom.addons.includes(a.id)} onChange={e => setCustom(c => c && ({ ...c, addons: e.target.checked ? [...c.addons, a.id] : c.addons.filter(x => x !== a.id) }))} />{a.name}</span>
                  <span>+{formatINR(a.price)}</span>
                </label>
              ))}
            </div>
            <Button variant="ghost" onClick={() => { add(custom.dish, custom.addons); setCustom(null); }} className="mt-4 h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground">Add item · {formatINR(dishUnitPrice(custom.dish, custom.addons))}</Button>
          </div>
        </div>
      )}

      {kitchen && count > 0 && (
        <div className={`fixed inset-x-0 ${embedded ? "bottom-[72px]" : "bottom-0"} z-40 border-t border-border bg-card/95 p-3 backdrop-blur`}>
          <div className="mx-auto flex max-w-2xl gap-2">
            {checkout && <Button variant="ghost" onClick={() => setCheckout(false)} className="h-12 flex-1 rounded-xl border border-border font-bold">Edit</Button>}
            <Button variant="ghost" disabled={busy} onClick={() => checkout ? place() : setCheckout(true)} className="flex h-12 flex-[2] items-center justify-between rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50">
              <span className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" />{count} item{count > 1 ? "s" : ""} · {formatINR(subtotal + (checkout ? FOOD_DELIVERY_FEE : 0))}</span>
              <span>{busy ? "Placing…" : checkout ? "Place order" : "Checkout"}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
