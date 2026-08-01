import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useCatalog, useOrders, useAuth } from "@/lib/store";
import type { Order } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StaffAccountCard } from "@/components/StaffAccountCard";
import { IndianRupee, ShoppingBag, AlertTriangle, Truck, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

// --- Financial assumptions used to derive the P&L breakdown ---------------
// These rates make the cost/profit estimate transparent. Adjust here to match
// the real business numbers whenever they are known.
const COGS_RATE = 0.72;             // cost of goods = 72% of product sales
const DELIVERY_COST_PER_ORDER = 25; // ₹ logistics cost to fulfil each order
const GST_RATE = 0.05;              // 5% GST on net taxable profit
const INTEREST_RATE = 0;            // monthly interest on business debt (none by default)

type Breakdown = {
  orders: number;
  grossRevenue: number;
  productSales: number;
  deliveryFees: number;
  discounts: number;
  cogs: number;
  deliveryCost: number;
  operatingProfit: number;
  interest: number;
  profitBeforeTax: number;
  tax: number;
  netProfit: number;
};

function computeBreakdown(orders: Order[]): Breakdown {
  // Only fulfilled (non-cancelled) orders count toward earnings.
  const earned = orders.filter((o) => o.status !== "cancelled" && !o.refunded);
  const grossRevenue = earned.reduce((s, o) => s + o.total, 0);
  const productSales = earned.reduce((s, o) => s + o.subtotal, 0);
  const deliveryFees = earned.reduce((s, o) => s + o.deliveryFee, 0);
  const discounts = earned.reduce((s, o) => s + o.discount, 0);
  const cogs = Math.round(productSales * COGS_RATE);
  const deliveryCost = earned.length * DELIVERY_COST_PER_ORDER;
  const operatingProfit = grossRevenue - cogs - deliveryCost;
  const interest = Math.round(Math.max(0, operatingProfit) * INTEREST_RATE);
  const profitBeforeTax = operatingProfit - interest;
  const tax = Math.round(Math.max(0, profitBeforeTax) * GST_RATE);
  const netProfit = profitBeforeTax - tax;
  return {
    orders: earned.length,
    grossRevenue,
    productSales,
    deliveryFees,
    discounts,
    cogs,
    deliveryCost,
    operatingProfit,
    interest,
    profitBeforeTax,
    tax,
    netProfit,
  };
}

function Dashboard() {
  const { products } = useCatalog();
  const { orders } = useOrders();
  const { adminAudit } = useAuth();
  const [openPeriod, setOpenPeriod] = useState<null | "today" | "month" | "year">(null);

  const today = new Date(); today.setHours(0,0,0,0);
  const monthStart = new Date(); monthStart.setHours(0,0,0,0); monthStart.setDate(1);
  const yearStart = new Date(); yearStart.setHours(0,0,0,0); yearStart.setMonth(0, 1);
  const isRevenueOrder = (o: Order) => o.status !== "cancelled" && !o.refunded;
  const todays = orders.filter(o => o.createdAt >= today.getTime());
  const todaysRevenue = todays.filter(isRevenueOrder);
  const monthOrders = orders.filter(o => o.createdAt >= monthStart.getTime());
  const monthRevenueOrders = monthOrders.filter(isRevenueOrder);
  const yearOrders = orders.filter(o => o.createdAt >= yearStart.getTime());
  const yearRevenueOrders = yearOrders.filter(isRevenueOrder);
  const revenue = todaysRevenue.reduce((s, o) => s + o.total, 0);
  const monthlyRevenue = monthRevenueOrders.reduce((s, o) => s + o.total, 0);
  const yearlyRevenue = yearRevenueOrders.reduce((s, o) => s + o.total, 0);
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= 5);
  const pending = orders.filter(o => o.status !== "delivered" && o.status !== "cancelled");


  const periodLabel = openPeriod === "today" ? "Today" : openPeriod === "month" ? "This month" : "This year";
  const periodOrders = openPeriod === "today" ? todaysRevenue : openPeriod === "month" ? monthRevenueOrders : yearRevenueOrders;
  const breakdown = openPeriod ? computeBreakdown(periodOrders) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Today's snapshot for Kartogo Ongole</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={<IndianRupee className="h-5 w-5" />} label="Today's revenue" value={formatINR(revenue)} onClick={() => setOpenPeriod("today")} />
        <Stat icon={<ShoppingBag className="h-5 w-5" />} label="Today's orders" value={String(todays.length)} />
        <Stat icon={<Truck className="h-5 w-5" />} label="Pending orders" value={String(pending.length)} accent />
        <Stat icon={<AlertTriangle className="h-5 w-5" />} label="Low stock" value={String(lowStock.length)} warn />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<IndianRupee className="h-5 w-5" />} label="This month's revenue" value={formatINR(monthlyRevenue)} accent onClick={() => setOpenPeriod("month")} />
        <Stat icon={<IndianRupee className="h-5 w-5" />} label="This year's revenue" value={formatINR(yearlyRevenue)} accent onClick={() => setOpenPeriod("year")} />
      </div>

      <StaffAccountCard role="admin" />

      <Dialog open={openPeriod !== null} onOpenChange={(o) => !o && setOpenPeriod(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{periodLabel}'s revenue breakdown</DialogTitle>
            <DialogDescription>
              {breakdown ? `Based on ${breakdown.orders} fulfilled order${breakdown.orders === 1 ? "" : "s"}` : ""}
            </DialogDescription>
          </DialogHeader>
          {breakdown && (
            <div className="space-y-4 text-sm">
              <section className="rounded-xl border border-border bg-card p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Revenue collected</p>
                <Row label="Product sales" value={formatINR(breakdown.productSales)} />
                <Row label="Delivery fees" value={formatINR(breakdown.deliveryFees)} />
                <Row label="Discounts given" value={`– ${formatINR(breakdown.discounts)}`} muted />
                <Row label="Gross revenue" value={formatINR(breakdown.grossRevenue)} strong />
              </section>

              <section className="rounded-xl border border-border bg-card p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Costs</p>
                <Row label={`Cost of goods (${Math.round(COGS_RATE * 100)}%)`} value={`– ${formatINR(breakdown.cogs)}`} muted />
                <Row label={`Delivery / logistics (₹${DELIVERY_COST_PER_ORDER}/order)`} value={`– ${formatINR(breakdown.deliveryCost)}`} muted />
                <Row label="Operating profit (EBIT)" value={formatINR(breakdown.operatingProfit)} strong />
              </section>

              <section className="rounded-xl border border-border bg-card p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">After interest & tax</p>
                <Row label={`Interest${INTEREST_RATE === 0 ? " (none)" : ""}`} value={`– ${formatINR(breakdown.interest)}`} muted />
                <Row label="Profit before tax" value={formatINR(breakdown.profitBeforeTax)} />
                <Row label={`GST / tax (${Math.round(GST_RATE * 100)}%)`} value={`– ${formatINR(breakdown.tax)}`} muted />
                <Row label="Net profit after tax" value={formatINR(breakdown.netProfit)} strong accent />
              </section>

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Cost, interest and tax figures are estimates derived from configurable rates, since per-item purchase costs aren't recorded in the system.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>





      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Recent orders</h2>
            <Link to="/admin/orders" className="text-xs font-semibold text-primary">View all</Link>
          </div>
          {orders.slice(0, 5).length === 0 ? (
            <div className="text-sm text-muted-foreground">No orders yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {orders.slice(0, 5).map(o => (
                <li key={o.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-semibold">{o.id} · {o.customerName}</div>
                    <div className="text-xs text-muted-foreground">{o.items.length} item · {o.status.replace(/_/g, " ")}</div>
                  </div>
                  <div className="font-display font-bold">{formatINR(o.total)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Low stock alerts</h2>
            <Link to="/admin/inventory" className="text-xs font-semibold text-primary">Manage</Link>
          </div>
          {lowStock.length === 0 ? (
            <div className="text-sm text-muted-foreground">All items well-stocked. ✨</div>
          ) : (
            <ul className="divide-y divide-border">
              {lowStock.map(p => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2"><span className="text-xl">{p.emoji}</span><span className="font-semibold">{p.name}</span></div>
                  <span className="rounded-md bg-saffron/30 px-2 py-0.5 text-xs font-bold">{p.stock} left</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Admin login audit</h2>
          <span className="text-xs text-muted-foreground">{adminAudit.length} entries</span>
        </div>
        {adminAudit.length === 0 ? (
          <div className="text-sm text-muted-foreground">No admin logins recorded yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {adminAudit.slice(0, 8).map((e, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="font-mono font-semibold">+91 {e.phone}</span>
                <span className="text-muted-foreground">{new Date(e.at).toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ icon, label, value, accent, warn, onClick }: { icon: React.ReactNode; label: string; value: string; accent?: boolean; warn?: boolean; onClick?: () => void }) {
  const cls = `rounded-2xl border p-3 text-left md:p-4 ${warn ? "border-saffron bg-saffron/10" : accent ? "border-primary/40 bg-primary/5" : "border-border bg-card"} ${onClick ? "cursor-pointer transition hover:border-primary hover:shadow-sm" : ""}`;
  const inner = (
    <>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground md:text-xs">{icon} {label}</div>
      <div className="mt-1.5 font-display text-xl font-bold md:mt-2 md:text-2xl">{value}</div>
      {onClick && <div className="mt-1 text-[10px] font-semibold text-primary">Tap for breakdown →</div>}
    </>
  );
  if (onClick) return <button type="button" onClick={onClick} className={`${cls} w-full`}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

function Row({ label, value, strong, muted, accent }: { label: string; value: string; strong?: boolean; muted?: boolean; accent?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-1 ${strong ? "mt-1 border-t border-border pt-2" : ""}`}>
      <span className={`${muted ? "text-muted-foreground" : ""} ${strong ? "font-semibold" : ""}`}>{label}</span>
      <span className={`font-display tabular-nums ${strong ? "font-bold" : "font-semibold"} ${accent ? "text-primary" : ""}`}>{value}</span>
    </div>
  );
}

