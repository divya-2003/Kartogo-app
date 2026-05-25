import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ShoppingBag, Search, MapPin, User2, LayoutDashboard } from "lucide-react";
import { useState } from "react";
import { useCart, useAuth } from "@/lib/store";

export function Header() {
  const { count } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const location = useRouterState({ select: s => s.location.pathname });
  const isAdmin = location.startsWith("/admin");

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-display text-lg font-bold">Q</div>
          <div className="leading-tight">
            <div className="font-display text-lg font-bold tracking-tight">QuickKart</div>
            <div className="hidden text-[11px] text-muted-foreground md:flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Ongole, AP · 15 min
            </div>
          </div>
        </Link>

        {!isAdmin && (
          <form
            onSubmit={(e) => { e.preventDefault(); nav({ to: "/search", search: { q } }); }}
            className="ml-2 hidden flex-1 md:block"
          >
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-pop">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder='Search "avakaya", "maggi", "agarbatti"...'
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </form>
        )}

        <div className="ml-auto flex items-center gap-2">
          {user?.role === "admin" && !isAdmin && (
            <Link to="/admin" className="hidden items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary md:inline-flex">
              <LayoutDashboard className="h-4 w-4" /> Admin
            </Link>
          )}
          <Link to={user ? "/orders" : "/login"} className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary">
            <User2 className="h-4 w-4" />
            <span className="hidden sm:inline">{user ? (user.name || user.phone) : "Login"}</span>
          </Link>
          {!isAdmin && (
            <Link to="/cart" className="relative inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Cart</span>
              {count > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-saffron px-1 text-[11px] font-bold text-saffron-foreground">
                  {count}
                </span>
              )}
            </Link>
          )}
        </div>
      </div>

      {!isAdmin && (
        <form onSubmit={(e) => { e.preventDefault(); nav({ to: "/search", search: { q } }); }} className="px-4 pb-3 md:hidden">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products..." className="w-full bg-transparent text-sm outline-none" />
          </div>
        </form>
      )}
    </header>
  );
}
