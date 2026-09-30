import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid, TrendingUp, Printer } from "lucide-react";

const ITEMS = [
  { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { to: "/categories", label: "Categories", icon: LayoutGrid, match: (p: string) => p.startsWith("/categories") || p.startsWith("/explore") },
  { to: "/search", label: "Trending", icon: TrendingUp, match: (p: string) => p.startsWith("/search") },
  { to: "/print", label: "Print Store", icon: Printer, match: (p: string) => p.startsWith("/print") },
] as const;

/** The four-tab customer navigation: Home, Categories, Trending, Print Store. */
export function BottomNav() {
  const path = useRouterState({ select: s => s.location.pathname });
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2 lg:max-w-7xl">
        {ITEMS.map(({ to, label, icon: Icon, match }) => {
          const active = match(path);
          return (
            <Link key={to} to={to} search={to === "/search" ? ({ q: "" } as never) : undefined} aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-center text-[11px] font-bold leading-tight transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-5 w-5" /> {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
