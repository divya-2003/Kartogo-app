import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChefHat, LogOut, Printer, CheckCircle2, Flame, ClipboardList, UtensilsCrossed, Plus, Pencil, Eye, Trash2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImagePicker } from "@/components/ImagePicker";
import { PartnerMenu, useLeaveCustomerMode } from "@/components/PartnerMenu";
import { useSignOut } from "@/hooks/use-sign-out";
import { enterCustomerMode } from "@/lib/portal-mode";
import { formatINR } from "@/lib/data";
import { kitchenOrdersFn, updateKitchenOrderFn } from "@/lib/kitchen.functions";
import { kitchenMenuFn, saveKitchenDishFn } from "@/lib/food-menu.functions";

function readKitchen(): { token: string | null; name: string; id: string | null } {
  try {
    const token = JSON.parse(localStorage.getItem("qk_kitchen_token") || "null");
    const k = JSON.parse(localStorage.getItem("qk_kitchen") || "null");
    return { token, name: k?.name ?? "Kitchen", id: k?.id ?? null };
  } catch { return { token: null, name: "Kitchen", id: null }; }
}

export const Route = createFileRoute("/kitchen")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!readKitchen().token) throw redirect({ to: "/login" });
  },
  component: KitchenPortal,
  head: () => ({ meta: [
    { title: "Kitchen orders & menu — Kartogo" },
    { name: "description", content: "Kitchen staff see, print and mark Kartogo food orders ready, and manage their menu." },
    { property: "og:title", content: "Kitchen orders & menu — Kartogo" },
    { property: "og:description", content: "Kitchen order board and menu for Kartogo partner kitchens." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

type Order = Awaited<ReturnType<typeof kitchenOrdersFn>>["orders"][number];
type Tab = "orders" | "menu";

function KitchenPortal() {
  useLeaveCustomerMode();
  // Read the saved kitchen after hydration so the server and browser render the same first frame.
  const [{ token, name, id: kitchenId }, setKitchenInfo] = useState<{ token: string | null; name: string; id: string | null }>({ token: null, name: "Kitchen", id: null });
  useEffect(() => { setKitchenInfo(readKitchen()); }, []);
  const [tab, setTab] = useState<Tab>("orders");
  const signOut = useSignOut();

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2 md:px-6">
          <PartnerMenu title={name} closeKey={tab}>
            {(close) => (
              <nav className="flex flex-col gap-1">
                <div className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kitchen portal</div>
                {([["orders", "Orders", ClipboardList], ["menu", "Menu", UtensilsCrossed]] as const).map(([key, label, Icon]) => (
                  <button key={key} type="button" onClick={() => { setTab(key); close(); }}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${tab === key ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
                {kitchenId && (
                  <Link to="/food" search={{ kitchen: kitchenId }} onClick={() => { enterCustomerMode(); close(); }}
                    className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold hover:bg-secondary">
                    <Store className="h-4 w-4" /> My kitchen as customers see it
                  </Link>
                )}
                <button type="button" onClick={signOut} className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-semibold text-destructive hover:bg-destructive/10">
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </nav>
            )}
          </PartnerMenu>
          <ChefHat className="h-5 w-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate font-display text-sm font-bold md:text-base">{name}</span>
          <div className="flex shrink-0 gap-1 rounded-xl bg-secondary p-1">
            <button type="button" onClick={() => setTab("orders")} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${tab === "orders" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Orders</button>
            <button type="button" onClick={() => setTab("menu")} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${tab === "menu" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Menu</button>
          </div>
        </div>
      </div>
      {token && (tab === "orders" ? <OrdersBoard token={token} name={name} /> : <MenuManager token={token} kitchenId={kitchenId} />)}
    </div>
  );
}

function OrdersBoard({ token, name }: { token: string; name: string }) {
  const nav = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [printing, setPrinting] = useState<Order | null>(null);
  const known = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await kitchenOrdersFn({ data: { token } });
      if (!res.ok) { nav({ to: "/login", replace: true }); return; }
      if (known.current) {
        const fresh = res.orders.filter((o) => !known.current!.has(o.id) && o.status !== "CANCELLED");
        if (fresh.length) toast.success(`${fresh.length} new order${fresh.length > 1 ? "s" : ""}`);
      }
      known.current = new Set(res.orders.map((o) => o.id));
      setOrders(res.orders);
    } catch { /* keep the board; retry next tick */ }
  }, [token, nav]);

  useEffect(() => { void load(); const t = window.setInterval(load, 10000); return () => window.clearInterval(t); }, [load]);

  const act = async (o: Order, action: "PREPARING" | "READY" | "PRINTED") => {
    const res = await updateKitchenOrderFn({ data: { token, id: o.id, action } });
    if (!res.ok) toast.error(res.error); else void load();
  };
  const print = (o: Order) => {
    setPrinting(o);
    setTimeout(() => { window.print(); void act(o, "PRINTED"); }, 50);
  };

  const active = orders.filter((o) => o.status !== "CANCELLED" && o.status !== "DELIVERED");
  const cols: { key: string; title: string; list: Order[] }[] = [
    { key: "NEW", title: "New", list: active.filter((o) => o.kitchenStatus === "NEW") },
    { key: "PREPARING", title: "Preparing", list: active.filter((o) => o.kitchenStatus === "PREPARING") },
    { key: "READY", title: "Ready", list: active.filter((o) => o.kitchenStatus === "READY") },
  ];
  const cancelled = orders.filter((o) => o.status === "CANCELLED");

  return (
    <>
      <main className="mx-auto grid max-w-7xl gap-4 p-4 print:hidden md:grid-cols-3">
        <p className="text-xs text-muted-foreground md:col-span-3">Today's orders · refreshes every 10 seconds</p>
        {cols.map((c) => (
          <section key={c.key} className="rounded-2xl border border-border bg-card p-3">
            <h2 className="mb-3 font-display text-base font-bold">{c.title} ({c.list.length})</h2>
            <div className="space-y-3">
              {c.list.length === 0 && <p className="text-sm text-muted-foreground">No orders.</p>}
              {c.list.map((o) => (
                <article key={o.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold">{o.code}</span>
                    <span className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{o.customer}{o.printed ? " · printed" : ""}</div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {o.items.map((it, i) => (
                      <li key={i}><b>{it.qty}×</b> {it.name}{it.addons?.length ? <span className="text-muted-foreground"> + {it.addons.join(", ")}</span> : null}</li>
                    ))}
                  </ul>
                  {o.note && <p className="mt-2 rounded-md bg-secondary px-2 py-1 text-xs">Note: {o.note}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => print(o)}><Printer /> Print</Button>
                    {o.kitchenStatus === "NEW" && <Button size="sm" variant="secondary" onClick={() => act(o, "PREPARING")}><Flame /> Start</Button>}
                    {o.kitchenStatus !== "READY" && <Button size="sm" onClick={() => act(o, "READY")}><CheckCircle2 /> Mark ready</Button>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
        {cancelled.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-3 md:col-span-3">
            <h2 className="mb-2 font-display text-base font-bold">Cancelled today — do not cook</h2>
            <p className="text-sm text-muted-foreground">{cancelled.map((o) => o.code).join(", ")}</p>
          </section>
        )}
      </main>
      {printing && (
        <div className="hidden p-4 font-mono text-sm print:block">
          <div className="text-center text-base font-bold">{name}</div>
          <div className="text-center">KITCHEN TICKET</div>
          <div className="mt-2">Order: {printing.code}</div>
          <div>Time: {new Date(printing.createdAt).toLocaleString()}</div>
          <div>Customer: {printing.customer}</div>
          <hr className="my-2" />
          {printing.items.map((it, i) => (
            <div key={i}>{it.qty} x {it.name}{it.addons?.length ? ` (+ ${it.addons.join(", ")})` : ""}</div>
          ))}
          {printing.note && <><hr className="my-2" /><div>Note: {printing.note}</div></>}
        </div>
      )}
    </>
  );
}

type MenuKitchen = Extract<Awaited<ReturnType<typeof kitchenMenuFn>>, { ok: true }>["kitchen"];
type MenuDish = MenuKitchen["dishes"][number];
type Draft = {
  id?: string; name: string; price: string; veg: boolean; description: string; image?: string;
  bestseller: boolean; available: boolean; addons: { id: string; name: string; price: string }[];
};
const emptyDraft = (): Draft => ({ name: "", price: "", veg: true, description: "", bestseller: false, available: true, addons: [] });
const toDraft = (d: MenuDish): Draft => ({
  id: d.id, name: d.name, price: String(d.price), veg: d.veg, description: d.desc ?? "", image: d.image ?? undefined,
  bestseller: !!d.bestseller, available: d.available, addons: (d.addons ?? []).map((a) => ({ id: a.id, name: a.name, price: String(a.price) })),
});

function VegMark({ veg }: { veg: boolean }) {
  return <span aria-label={veg ? "Veg" : "Non-veg"} className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2 ${veg ? "border-leaf" : "border-destructive"}`}><span className={`h-1.5 w-1.5 rounded-full ${veg ? "bg-leaf" : "bg-destructive"}`} /></span>;
}

function MenuManager({ token, kitchenId }: { token: string; kitchenId: string | null }) {
  const [kitchen, setKitchen] = useState<MenuKitchen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await kitchenMenuFn({ data: { token } });
      if (!res.ok) { setError(res.error); return; }
      setKitchen(res.kitchen); setError(null);
    } catch { setError("Couldn't load the menu. Check your connection."); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  const save = async (d: Draft, quiet = false) => {
    const price = Number(d.price);
    if (d.name.trim().length < 2) return void toast.error("Enter the dish name");
    if (!Number.isFinite(price) || price < 1) return void toast.error("Enter a valid price");
    const addons = d.addons.filter((a) => a.name.trim()).map((a, i) => ({ id: a.id || `x${i + 1}`, name: a.name.trim(), price: Math.max(0, Number(a.price) || 0) }));
    setSaving(true);
    try {
      const res = await saveKitchenDishFn({ data: { token, dish: {
        id: d.id, name: d.name.trim(), price, veg: d.veg, description: d.description.trim(), image: d.image ?? null,
        bestseller: d.bestseller, available: d.available, addons,
      } } });
      if (!res.ok) { toast.error(res.error); return; }
      if (!quiet) toast.success(d.id ? "Dish updated" : "Dish added to your menu");
      setDraft(null);
      await load();
    } catch { toast.error("Network error, please try again"); }
    finally { setSaving(false); }
  };

  if (error) return <p className="p-6 text-center text-sm text-destructive">{error}</p>;
  if (!kitchen) return <p className="p-6 text-center text-sm text-muted-foreground">Loading menu…</p>;
  const shown = kitchen.dishes.filter((d) => d.available).length;

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold">Menu</h1>
          <p className="text-xs text-muted-foreground">{kitchen.dishes.length} dishes · {shown} showing to customers · {kitchen.cuisine}</p>
        </div>
        {kitchenId && (
          <Button asChild variant="outline" size="sm">
            <Link to="/food" search={{ kitchen: kitchenId }} onClick={() => enterCustomerMode()}><Eye /> Customer view</Link>
          </Button>
        )}
        <Button size="sm" onClick={() => setDraft(emptyDraft())}><Plus /> Add dish</Button>
      </div>

      <div className="space-y-3">
        {kitchen.dishes.length === 0 && <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No dishes yet. Add your first dish.</p>}
        {kitchen.dishes.map((d) => (
          <article key={d.id} className={`flex gap-3 rounded-2xl border border-border bg-card p-3 ${d.available ? "" : "opacity-60"}`}>
            {d.image
              ? <img src={d.image} alt={d.name} className="h-20 w-20 shrink-0 rounded-xl object-cover" />
              : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground"><UtensilsCrossed className="h-6 w-6" /></div>}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <VegMark veg={d.veg} />
                <span className="font-bold">{d.name}</span>
                {d.bestseller && <span className="text-[11px] font-extrabold text-accent">★ Bestseller</span>}
                {!d.available && <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-bold">Hidden</span>}
              </div>
              <div className="text-sm font-semibold">{formatINR(d.price)}</div>
              {d.desc && <p className="mt-0.5 text-xs text-muted-foreground">{d.desc}</p>}
              {(d.addons ?? []).length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">Add-ons: {(d.addons ?? []).map((a) => `${a.name} (+${formatINR(a.price)})`).join(", ")}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end justify-between gap-2">
              <label className="flex items-center gap-2 text-xs font-semibold">
                {d.available ? "Available" : "Hidden"}
                <Switch checked={d.available} disabled={saving} aria-label={`Show ${d.name} to customers`} onCheckedChange={(v) => void save({ ...toDraft(d), available: v }, true)} />
              </label>
              <Button size="sm" variant="outline" onClick={() => setDraft(toDraft(d))}><Pencil /> Edit</Button>
            </div>
          </article>
        ))}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => { if (!o) setDraft(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit dish" : "Add a dish"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold">Dish name
                <Input className="mt-1" value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Chicken Fry Piece Biryani" />
              </label>
              <div className="flex gap-3">
                <label className="block flex-1 text-sm font-semibold">Price (₹)
                  <Input className="mt-1" inputMode="numeric" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/[^\d]/g, "").slice(0, 5) })} placeholder="199" />
                </label>
                <div className="flex-1 text-sm font-semibold">Type
                  <div className="mt-1 flex gap-2">
                    <Button type="button" size="sm" variant={draft.veg ? "default" : "outline"} onClick={() => setDraft({ ...draft, veg: true })}>Veg</Button>
                    <Button type="button" size="sm" variant={!draft.veg ? "default" : "outline"} onClick={() => setDraft({ ...draft, veg: false })}>Non-veg</Button>
                  </div>
                </div>
              </div>
              <label className="block text-sm font-semibold">Description
                <Textarea className="mt-1" rows={2} maxLength={300} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="What's in it, portion size, spice level" />
              </label>
              <div className="text-sm font-semibold">Photo
                <div className="mt-1"><ImagePicker value={draft.image} onChange={(v) => setDraft({ ...draft, image: v })} /></div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm font-semibold"><Switch checked={draft.bestseller} onCheckedChange={(v) => setDraft({ ...draft, bestseller: v })} /> Bestseller</label>
                <label className="flex items-center gap-2 text-sm font-semibold"><Switch checked={draft.available} onCheckedChange={(v) => setDraft({ ...draft, available: v })} /> Show to customers</label>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm font-semibold">Add-ons
                  {draft.addons.length < 8 && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setDraft({ ...draft, addons: [...draft.addons, { id: `x${Date.now().toString(36).slice(-6)}`, name: "", price: "" }] })}><Plus /> Add-on</Button>
                  )}
                </div>
                <div className="mt-1 space-y-2">
                  {draft.addons.map((a, i) => (
                    <div key={a.id} className="flex items-center gap-2">
                      <Input value={a.name} maxLength={60} placeholder="Extra raita" onChange={(e) => setDraft({ ...draft, addons: draft.addons.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} />
                      <Input className="w-24" inputMode="numeric" value={a.price} placeholder="₹20" onChange={(e) => setDraft({ ...draft, addons: draft.addons.map((x, j) => j === i ? { ...x, price: e.target.value.replace(/[^\d]/g, "").slice(0, 4) } : x) })} />
                      <Button type="button" size="icon" variant="ghost" aria-label="Remove add-on" onClick={() => setDraft({ ...draft, addons: draft.addons.filter((_, j) => j !== i) })}><Trash2 /></Button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setDraft(null)}>Cancel</Button>
                <Button className="flex-1" disabled={saving} onClick={() => void save(draft)}>{saving ? "Saving…" : draft.id ? "Save changes" : "Add to menu"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
