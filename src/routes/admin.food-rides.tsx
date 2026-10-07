import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { adminServiceOrdersFn, adminCancelServiceOrderFn } from "@/lib/rider-jobs.functions";
import { formatINR } from "@/lib/data";

export const Route = createFileRoute("/admin/food-rides")({
  component: AdminFoodRides,
  head: () => ({ meta: [{ title: "Food & rides — Kartogo Admin" }] }),
});

const LABEL: Record<string, string> = {
  PLACED: "Waiting for rider", SEARCHING: "Finding driver", ACCEPTED: "Partner assigned", PICKED_UP: "Picked up",
  ARRIVED: "Driver at pickup", IN_TRIP: "On trip", DELIVERED: "Delivered", COMPLETED: "Completed", CANCELLED: "Cancelled",
};
const ACTIVE = ["PLACED", "SEARCHING", "ACCEPTED", "PICKED_UP", "ARRIVED", "IN_TRIP"];
const token = () => { try { return JSON.parse(localStorage.getItem("qk_admin_token") || "null") ?? ""; } catch { return ""; } };

function AdminFoodRides() {
  const [rows, setRows] = useState<any[]>([]);
  const [tab, setTab] = useState<"active" | "food" | "rides" | "closed">("active");
  const load = useCallback(async () => { setRows(await adminServiceOrdersFn({ data: { token: token() } }).catch(() => [])); }, []);
  useEffect(() => { void load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  const list = rows.filter(r => tab === "active" ? ACTIVE.includes(r.status) : tab === "food" ? r.kind === "FOOD" : tab === "rides" ? r.kind === "RIDE" : !ACTIVE.includes(r.status));
  const cancel = async (id: string) => {
    if (!confirm("Cancel this order?")) return;
    await adminCancelServiceOrderFn({ data: { token: token(), id } });
    toast.success("Cancelled"); void load();
  };
  return (
    <div className="space-y-4">
      <div><h1 className="font-display text-2xl font-bold">Food & rides</h1><p className="text-sm text-muted-foreground">Live food orders and ride bookings, and which partner is handling them.</p></div>
      <div className="flex flex-wrap gap-2">
        {(["active", "food", "rides", "closed"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${tab === t ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>{t}</button>
        ))}
      </div>
      {list.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">Nothing here.</div> : (
        <div className="space-y-3">
          {list.map(o => (
            <article key={o.id} className="rounded-2xl border border-border bg-card p-4" data-search-item>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-muted-foreground">{o.kind === "FOOD" ? "🍛 Food" : "🛺 Ride"} · #{o.order_code} · {new Date(o.created_at).toLocaleString()}</div>
                  <div className="font-bold">{o.title} · {o.customer_name ?? o.customer_phone}</div>
                  <div className="truncate text-xs text-muted-foreground">{o.kind === "FOOD" ? (o.details?.items ?? []).map((i: any) => `${i.qty}× ${i.name}`).join(", ") : `${o.details?.pickup?.label} → ${o.details?.drop?.label}`}</div>
                  <div className="mt-1 text-xs">{o.driver_name ? `Partner: ${o.driver_name}${o.driver_phone ? ` · ${o.driver_phone}` : ""}` : "No partner yet"}{o.driver_location_at ? ` · location ${new Date(o.driver_location_at).toLocaleTimeString()}` : ""}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${o.status === "CANCELLED" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{LABEL[o.status] ?? o.status}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-display font-extrabold">{formatINR(Number(o.amount))}</span>
                {ACTIVE.includes(o.status) && <button onClick={() => cancel(o.id)} className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-bold text-destructive">Cancel</button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
