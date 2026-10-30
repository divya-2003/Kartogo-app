import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid, ShoppingCart, Printer } from "lucide-react";
import { useCart } from "@/lib/store";

const ITEMS = [
  { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { to: "/categories", label: "Categories", icon: LayoutGrid, match: (p: string) => p.startsWith("/categories") || p.startsWith("/explore") },
  { to: "/cart", label: "Cart", icon: ShoppingCart, match: (p: string) => p.startsWith("/cart") },
  { to: "/print", label: "Print Store", icon: Printer, match: (p: string) => p.startsWith("/print") },
] as const;

/** The four-tab customer navigation: Home, Categories, Cart, Print Store. */
export function BottomNav() {
  const path = useRouterState({ select: s => s.location.pathname });
  const { count } = useCart();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2 lg:max-w-7xl">
        {ITEMS.map(({ to, label, icon: Icon, match }) => {
          const active = match(path);
          const badge = to === "/cart" && count > 0;
          return (
            <Link key={to} to={to} aria-current={active ? "page" : undefined}
              aria-label={badge ? `${label}, ${count} item${count === 1 ? "" : "s"}` : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-center text-[11px] font-bold leading-tight transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <span className="relative">
                <Icon className="h-5 w-5" />
                {badge && (
                  <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-extrabold text-destructive-foreground">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
