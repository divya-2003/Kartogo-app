import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useAuth, useOrders, DELIVERY_BOYS, type OrderStatus } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { CheckCircle2, Package, Truck, Clock, XCircle } from "lucide-react";

export const Route = createFileRoute("/orders")({
  component: OrdersPage,
  head: () => ({ meta: [{ title: "My orders — Kartigo" }] }),
});

const STEPS: { key: OrderStatus; label: string; icon: React.ReactNode }[] = [
  { key: "placed", label: "Placed", icon: <Clock className="h-4 w-4" /> },
  { key: "packed", label: "Packed", icon: <Package className="h-4 w-4" /> },
  { key: "out_for_delivery", label: "Out for delivery", icon: <Truck className="h-4 w-4" /> },
  { key: "delivered", label: "Delivered", icon: <CheckCircle2 className="h-4 w-4" /> },
];

function OrdersPage() {
  const { user, logout } = useAuth();
  const { orders } = useOrders();

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold">Please login</h1>
          <Link to="/login" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">Login with OTP</Link>
        </div>
      </div>
    );
  }

  const mine = orders.filter(o => o.customerPhone === user.phone);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">My orders</h1>
            <p className="text-sm text-muted-foreground">Signed in as {user.name || user.phone}</p>
          </div>
          <button onClick={logout} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary">Logout</button>
        </div>
        {mine.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <div className="font-semibold">No orders yet</div>
            <Link to="/" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Start shopping</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {mine.map(o => {
              const stepIdx = STEPS.findIndex(s => s.key === o.status);
              const cancelled = o.status === "cancelled";
              const boy = DELIVERY_BOYS.find(d => d.id === o.deliveryBoyId);
              return (
                <article key={o.id} className="rounded-2xl border border-border bg-card p-5 shadow-pop">
                  <header className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-display text-lg font-bold">{o.id}</div>
                      <div className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString("en-IN")}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-lg font-bold">{formatINR(o.total)}</div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">{o.paymentMethod === "cash" ? "Cash" : "UPI"} on delivery</div>
                    </div>
                  </header>

                  {cancelled ? (
                    <div className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><XCircle className="h-4 w-4" /> Order cancelled</div>
                  ) : (
                    <div className="mt-4 flex items-center gap-2">
                      {STEPS.map((s, i) => {
                        const done = i <= stepIdx;
                        return (
                          <div key={s.key} className="flex flex-1 items-center gap-2">
                            <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${done ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{s.icon}</div>
                            <div className={`text-xs font-semibold ${done ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</div>
                            {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 ${i < stepIdx ? "bg-primary" : "bg-border"}`} />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {boy && !cancelled && (
                    <div className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-sm">
                      Delivery partner: <span className="font-semibold">{boy.name}</span> · <a className="text-primary" href={`tel:${boy.phone}`}>{boy.phone}</a>
                    </div>
                  )}

                  <ul className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
                    {o.items.map(i => (
                      <li key={i.productId} className="flex justify-between text-muted-foreground">
                        <span>{i.name} × {i.qty}</span>
                        <span className="font-semibold text-foreground">{formatINR(i.price * i.qty)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 text-xs text-muted-foreground">Deliver to: {o.address}</div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
