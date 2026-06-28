import { useRouterState, Link } from "@tanstack/react-router";
import { ShoppingBag, Truck } from "lucide-react";
import { useCart } from "@/lib/store";
import { formatINR } from "@/lib/data";

const FREE_DELIVERY_THRESHOLD = 199;

export function FloatingCartBar() {
  const { items, count, subtotal } = useCart();
  const location = useRouterState({ select: (s) => s.location.pathname });

  const isAdmin = location.startsWith("/admin");
  const isCheckout = location.startsWith("/checkout");
  const isOrders = location.startsWith("/orders");
  const isCart = location.startsWith("/cart");
  const hide = isAdmin || isCheckout || isOrders || isCart;

  if (items.length === 0 || hide) return null;

  const remaining = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
  const unlocked = remaining === 0;
  const progress = Math.min(100, Math.round((subtotal / FREE_DELIVERY_THRESHOLD) * 100));

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-pop">
        <div className="mb-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <ShoppingBag className="h-4 w-4 text-primary" />
            <span>{count} item{count === 1 ? "" : "s"}</span>
          </div>
          <div className="font-display font-bold">{formatINR(subtotal)}</div>
        </div>

        <div className="mb-3 flex items-center gap-2 text-xs">
          <Truck className={`h-4 w-4 ${unlocked ? "text-leaf" : "text-muted-foreground"}`} />
          <span className={unlocked ? "font-semibold text-leaf" : "text-muted-foreground"}>
            {unlocked
              ? "Free delivery unlocked"
              : `Add ${formatINR(remaining)} more for free delivery`}
          </span>
        </div>

        {!unlocked && (
          <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-saffron transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <Link
          to="/cart"
          className="block w-full rounded-xl bg-primary py-2.5 text-center text-sm font-bold text-primary-foreground hover:bg-primary/90"
        >
          View cart
        </Link>
      </div>
    </div>
  );
}
