import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, Home, LayoutGrid, ShoppingBag, Package, Heart } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { enterCustomerMode as markCustomerMode, leaveCustomerMode } from "@/lib/portal-mode";

/** Marks this app run as "shopping as a customer" so Home doesn't bounce back to the portal. */
export function enterCustomerMode() {
  markCustomerMode();
  try { sessionStorage.setItem("qk_home_section", "shop"); } catch { /* unavailable */ }
}

/** Clears customer mode when a partner returns to their own portal. */
export function useLeaveCustomerMode() {
  useEffect(() => { leaveCustomerMode(); }, []);
}

const CUSTOMER_LINKS = [
  { to: "/", label: "Shop home", icon: Home },
  { to: "/categories", label: "Categories", icon: LayoutGrid },
  { to: "/cart", label: "Cart", icon: ShoppingBag },
  { to: "/orders", label: "My orders", icon: Package },
  { to: "/wishlist", label: "Wishlist", icon: Heart },
] as const;

/**
 * Three-line menu button for partner portals (seller, delivery). The side menu
 * holds the portal's own pages plus a "Shop as a customer" section.
 */
export function PartnerMenu({ title, children, closeKey }: { title: string; children: (close: () => void) => ReactNode; closeKey?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [closeKey]);
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-card hover:bg-secondary"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="truncate text-left font-display text-base font-bold">{title}</SheetTitle>
        </SheetHeader>
        <div className="max-h-[calc(100dvh-5rem)] space-y-5 overflow-y-auto p-3">
          <div>{children(close)}</div>
          <div>
            <div className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shop as a customer</div>
            <nav className="flex flex-col gap-1">
              {CUSTOMER_LINKS.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => { enterCustomerMode(); close(); }}
                  className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold hover:bg-secondary"
                >
                  <l.icon className="h-4 w-4" /> {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
