import { createFileRoute, Outlet, Link, useRouterState, redirect, isRedirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { verifySupplierTokenFn } from "@/lib/supplier.functions";
import { findSupplierById } from "@/lib/suppliers";
import { SupplierContext, type SupplierInfo } from "@/lib/supplier-context";
import { Boxes, ClipboardList, User2, BarChart3, Sparkles, Menu } from "lucide-react";


export const Route = createFileRoute("/supplier")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    // Supplier portal is gated on a SERVER-CONFIRMED identity check. The token is
    // read from localStorage but never trusted — the server verifies its HMAC
    // signature. A spoofed value fails and the user is bounced to /login.
    let token: string | null = null;
    try { token = JSON.parse(localStorage.getItem("qk_supplier_token") || "null"); } catch { token = null; }
    if (!token) throw redirect({ to: "/login" });
    try {
      const { valid } = await verifySupplierTokenFn({ data: { token } });
      if (!valid) throw redirect({ to: "/login" });
    } catch (e) {
      if (isRedirect(e)) throw e;
      throw redirect({ to: "/login" });
    }
  },
  component: SupplierLayout,
  head: () => ({ meta: [{ title: "Supplier Portal — Kartogo" }] }),
});

const NAV = [
  { to: "/supplier", label: "Inventory", short: "Stock", icon: Boxes },
  { to: "/supplier/orders", label: "Orders", short: "Orders", icon: ClipboardList },
  { to: "/supplier/sales", label: "Sales", short: "Sales", icon: BarChart3 },
  { to: "/supplier/ai", label: "AI insights", short: "AI", icon: Sparkles },
  { to: "/supplier/account", label: "Account", short: "Account", icon: User2 },
] as const;

function SupplierLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [info, setInfo] = useState<SupplierInfo | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isActive = (to: string) => (to === "/supplier" ? path === "/supplier" : path.startsWith(to));

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("qk_supplier") || "null");
      if (raw?.id) {
        const s = findSupplierById(raw.id);
        if (s) setInfo({ id: s.id, name: s.name, categories: s.categories });
      }
    } catch { /* noop */ }
  }, []);

  // Close the mobile sheet whenever the route changes.
  useEffect(() => { setMobileOpen(false); }, [path]);

  const NavList = ({ inSheet = false }: { inSheet?: boolean }) => (
    <nav className="flex flex-col gap-1">
      {NAV.map((n) => {
        const active = isActive(n.to);
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={() => { if (inSheet) setMobileOpen(false); }}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
          >
            <n.icon className="h-4 w-4" /> {n.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <SupplierContext.Provider value={info}>
      <div className="min-h-screen bg-background">
        {/* Mobile top bar with hamburger — mirrors the admin layout */}
        <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-card/95 px-3 py-2 backdrop-blur md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                aria-label={mobileOpen ? "Close supplier menu" : "Open supplier menu"}
                className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-card hover:bg-secondary"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b border-border p-4">
                <SheetTitle className="text-left font-display text-base font-bold">
                  {info?.name ?? "Supplier"}
                </SheetTitle>
              </SheetHeader>
              <div className="max-h-[calc(100vh-5rem)] overflow-y-auto p-3">
                <NavList inSheet />
              </div>
            </SheetContent>
          </Sheet>
          <span className="min-w-0 truncate font-display text-sm font-bold">{info?.name ?? "Supplier"}</span>
          <Link
            to="/supplier/account"
            aria-label="Supplier account"
            className="ml-auto grid h-9 w-9 place-items-center rounded-full border border-border bg-card hover:bg-secondary"
          >
            <User2 className="h-4 w-4" />
          </Link>
        </div>

        <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-6 pt-4 md:grid-cols-[220px_minmax(0,1fr)] md:px-6 md:py-6">
          {/* Desktop sidebar */}
          <aside className="hidden h-fit max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-border bg-card p-3 md:sticky md:top-4 md:block">
            <div className="mb-3 px-3 pt-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supplier</div>
              <div className="mt-0.5 truncate text-sm font-bold">{info?.name ?? "…"}</div>
            </div>
            <NavList />
          </aside>

          <main className="min-w-0"><Outlet /></main>
        </div>
      </div>
    </SupplierContext.Provider>
  );

}
