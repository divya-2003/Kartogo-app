import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChefHat, LogOut, Printer, CheckCircle2, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { kitchenOrdersFn, updateKitchenOrderFn } from "@/lib/kitchen.functions";

function readKitchen(): { token: string | null; name: string } {
  try {
    const token = JSON.parse(localStorage.getItem("qk_kitchen_token") || "null");
    const k = JSON.parse(localStorage.getItem("qk_kitchen") || "null");
    return { token, name: k?.name ?? "Kitchen" };
  } catch { return { token: null, name: "Kitchen" }; }
}

export const Route = createFileRoute("/kitchen")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!readKitchen().token) throw redirect({ to: "/login" });
  },
  component: KitchenPortal,
  head: () => ({ meta: [
    { title: "Kitchen orders — Kartogo" },
    { name: "description", content: "Kitchen staff see, print and mark Kartogo food orders ready." },
    { property: "og:title", content: "Kitchen orders — Kartogo" },
    { property: "og:description", content: "Kitchen order board for Kartogo partner kitchens." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

type Order = Awaited<ReturnType<typeof kitchenOrdersFn>>["orders"][number];

function KitchenPortal() {
  const nav = useNavigate();
  const [{ token, name }] = useState(readKitchen);
  const [orders, setOrders] = useState<Order[]>([]);
  const [printing, setPrinting] = useState<Order | null>(null);
  const known = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
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
    const res = await updateKitchenOrderFn({ data: { token: token!, id: o.id, action } });
    if (!res.ok) toast.error(res.error); else void load();
  };
  const print = (o: Order) => {
    setPrinting(o);
    setTimeout(() => { window.print(); void act(o, "PRINTED"); }, 50);
  };
  const logout = () => {
    try { localStorage.removeItem("qk_kitchen_token"); localStorage.removeItem("qk_kitchen"); } catch { /* noop */ }
    nav({ to: "/login", replace: true });
  };

  const active = orders.filter((o) => o.status !== "CANCELLED" && o.status !== "DELIVERED");
  const cols: { key: string; title: string; list: Order[] }[] = [
    { key: "NEW", title: "New", list: active.filter((o) => o.kitchenStatus === "NEW") },
    { key: "PREPARING", title: "Preparing", list: active.filter((o) => o.kitchenStatus === "PREPARING") },
    { key: "READY", title: "Ready", list: active.filter((o) => o.kitchenStatus === "READY") },
  ];
  const cancelled = orders.filter((o) => o.status === "CANCELLED");

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <ChefHat className="h-6 w-6 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-lg font-bold">{name}</div>
            <div className="text-xs text-muted-foreground">Kitchen orders · refreshes every 10 seconds</div>
          </div>
          <Button variant="outline" size="sm" onClick={logout}><LogOut /> Log out</Button>
        </header>
        <main className="mx-auto grid max-w-7xl gap-4 p-4 md:grid-cols-3">
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
      </div>
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
    </div>
  );
}
