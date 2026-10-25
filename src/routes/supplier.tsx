import { createFileRoute, Outlet, Link, useRouter, useRouterState, redirect, isRedirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { verifySupplierTokenFn } from "@/lib/supplier.functions";
import { findSupplierById } from "@/lib/suppliers";
import { SupplierContext, type SupplierInfo } from "@/lib/supplier-context";
import { CalendarCheck, CalendarClock, Boxes, ClipboardList, User2, BarChart3, Sparkles, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { renewSessions } from "@/lib/session-keeper";
import { PartnerMenu, useLeaveCustomerMode } from "@/components/PartnerMenu";


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
      let { valid } = await verifySupplierTokenFn({ data: { token } });
      if (!valid) {
        // An old session is silently re-signed before anyone is signed out.
        const renewed = await renewSessions(true);
        const fresh = renewed.supplier;
        if (fresh) valid = (await verifySupplierTokenFn({ data: { token: fresh } })).valid;
      }
      if (!valid) throw redirect({ to: "/login" });
    } catch (e) {
      if (isRedirect(e)) throw e;
      // Network or server hiccup: keep the session and let the portal load.
    }
  },
  component: SupplierLayout,
  head: () => ({ meta: [{ title: "Supplier Portal — Kartogo" }] }),
});

// Sales analysis comes first — it's the seller's landing page.
const NAV = [
  { to: "/supplier/sales", label: "Sales analysis", icon: BarChart3 },
  { to: "/supplier", label: "Inventory", icon: Boxes },
  { to: "/supplier/orders", label: "Orders", icon: ClipboardList },
  { to: "/supplier/bookings", label: "Bookings", icon: CalendarCheck },
  { to: "/supplier/services", label: "My services", icon: CalendarClock },
  { to: "/supplier/ai", label: "AI insights", icon: Sparkles },
  { to: "/supplier/account", label: "Account", icon: User2 },
] as const;

function SupplierLayout() {
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [info, setInfo] = useState<SupplierInfo | null>(null);
  const isActive = (to: string) => (to === "/supplier" ? path === "/supplier" : path.startsWith(to));
  useLeaveCustomerMode();

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("qk_supplier") || "null");
      if (raw?.id) {
        const s = findSupplierById(raw.id);
        if (s) setInfo({ id: s.id, name: s.name, categories: s.categories });
      }
    } catch { /* noop */ }
  }, []);

  return (
    <SupplierContext.Provider value={info}>
      <div className="min-h-screen bg-background">
        {/* Top bar — the side menu lives inside the three-line button on every screen size */}
        <div className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2 md:px-6">
            <PartnerMenu title={info?.name ?? "Supplier"} closeKey={path}>
              {(close) => (
                <nav className="flex flex-col gap-1">
                  <div className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seller portal</div>
                  {NAV.map((n) => (
                    <Link
                      key={n.to}
                      to={n.to}
                      onClick={close}
                      className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive(n.to) ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                    >
                      <n.icon className="h-4 w-4" /> {n.label}
                    </Link>
                  ))}
                </nav>
              )}
            </PartnerMenu>
            {path !== "/supplier/sales" && (
              <Button type="button" variant="outline" size="icon" aria-label="Go back" onClick={() => router.history.back()}>
                <ChevronLeft />
              </Button>
            )}
            <span className="min-w-0 truncate font-display text-sm font-bold md:text-base">{info?.name ?? "Supplier"}</span>
            <Link
              to="/supplier/account"
              aria-label="Supplier account"
              className="ml-auto grid h-9 w-9 place-items-center rounded-full border border-border bg-card hover:bg-secondary"
            >
              <User2 className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-6 pt-4 md:px-6 md:py-6">
          <main className="min-w-0"><Outlet /></main>
        </div>
      </div>
    </SupplierContext.Provider>
  );
}
