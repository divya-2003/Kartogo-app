import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { myBookingsFn } from "@/lib/marketplace.functions";
import { myServiceOrdersFn, cancelServiceOrderFn } from "@/lib/service-orders.functions";
import { useAuth } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { TX_LABELS, fmtDate, fmtTime, bookingStatusLabel, type Booking } from "@/lib/marketplace";

export function OrdersTabs({ tab }: { tab: "all" | "orders" | "bookings" }) {
  return (
    <div className="mb-4 flex gap-2" role="tablist">
      {(["all", "orders", "bookings"] as const).map(t => (
        <Link key={t} to="/orders" search={{ tab: t }} role="tab" aria-selected={tab === t}
          className={`flex-1 rounded-full border py-2 text-center text-sm font-bold capitalize ${tab === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{t}</Link>
      ))}
    </div>
  );
}

const TONE: Record<string, string> = { CANCELLED: "bg-destructive/10 text-destructive", SERVICE_COMPLETED: "bg-leaf/15 text-leaf" };

export function BookingsList({ compact = false }: { compact?: boolean }) {
  const { customerToken } = useAuth();
  const { data = [], isLoading } = useQuery({ queryKey: ["mp-my-bookings", customerToken], queryFn: () => myBookingsFn({ data: { token: customerToken ?? undefined } }), enabled: !!customerToken, refetchInterval: 30_000 });
  const rows = data as unknown as Booking[];
  if (isLoading) return <div className="mb-4 h-24 animate-pulse rounded-2xl bg-secondary" />;
  if (!rows.length) return compact ? null : (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <div className="font-semibold">No bookings yet</div>
      <Link to="/categories" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Explore services</Link>
    </div>
  );
  return (
    <div className="mb-2">
      {compact && <h2 className="mb-2 font-display text-lg font-bold">Bookings</h2>}
      <div className="space-y-3">
        {rows.map(b => (
          <article key={b.id} className="rounded-2xl border border-border bg-card p-4 shadow-pop">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-bold text-muted-foreground">{TX_LABELS[b.transaction_type]} · #{b.booking_code}</div>
                <div className="truncate font-bold">{b.listing?.icon} {b.listing?.name}</div>
                <div className="text-xs text-muted-foreground">{b.partner?.name}{b.booking_date ? ` · ${fmtDate(b.booking_date)}` : ""}{b.start_time ? ` • ${fmtTime(b.start_time)}` : ""}</div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${TONE[b.status] ?? "bg-primary/10 text-primary"}`}>{bookingStatusLabel(b)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="font-display font-extrabold">{b.transaction_type === "QUOTE_REQUEST" && b.quote_amount == null ? "Awaiting quote" : formatINR(Number(b.amount) + Number(b.fee))}</span>
              <Link to="/booking/$id" params={{ id: b.id }} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">View Booking</Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

const SO_LABEL: Record<string, string> = { PLACED: "Order placed", SEARCHING: "Finding driver", ACCEPTED: "Partner assigned", PICKED_UP: "On the way", ARRIVED: "Driver arrived", IN_TRIP: "On trip", CANCELLED: "Cancelled", DELIVERED: "Delivered", COMPLETED: "Completed" };

/** Food delivery orders and ride bookings. */
export function ServiceOrdersList() {
  const { customerToken } = useAuth();
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["service-orders", customerToken], queryFn: () => myServiceOrdersFn({ data: { token: customerToken ?? undefined } }), enabled: !!customerToken, refetchInterval: 30_000 });
  if (!data.length) return null;
  const cancel = async (id: string) => {
    const r = await cancelServiceOrderFn({ data: { token: customerToken!, id } }).catch(() => null);
    if (r?.ok) { toast("Cancelled"); qc.invalidateQueries({ queryKey: ["service-orders"] }); } else toast.error(r?.error ?? "Couldn't cancel");
  };
  return (
    <div className="mb-4">
      <h2 className="mb-2 font-display text-lg font-bold">Food & rides</h2>
      <div className="space-y-3">
        {data.map(o => (
          <article key={o.id} className="rounded-2xl border border-border bg-card p-4 shadow-pop">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-bold text-muted-foreground">{o.kind === "FOOD" ? "Food order" : "Ride"} · #{o.order_code}</div>
                <div className="truncate font-bold">{o.kind === "FOOD" ? "🍛" : "🛺"} {o.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {o.kind === "FOOD"
                    ? (o.details.items ?? []).map((i: any) => `${i.qty}× ${i.name}`).join(", ")
                    : `${o.details.pickup?.label} → ${o.details.drop?.label}`}
                </div>
                {(o as any).driver_name && <div className="mt-1 text-xs font-semibold text-leaf">🛵 {(o as any).driver_name}{(o as any).driver_phone ? ` · ${(o as any).driver_phone}` : ""}</div>}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${TONE[o.status] ?? "bg-primary/10 text-primary"}`}>{SO_LABEL[o.status] ?? o.status}</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="font-display font-extrabold">{formatINR(Number(o.amount))}</span>
              {(o.status === "PLACED" || o.status === "SEARCHING") && <button onClick={() => cancel(o.id)} className="rounded-lg border border-destructive px-3 py-1.5 text-xs font-bold text-destructive">Cancel</button>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
