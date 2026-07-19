import { createFileRoute, Outlet, Link, useRouterState, redirect, isRedirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { verifySupplierTokenFn } from "@/lib/supplier.functions";
import { findSupplierById } from "@/lib/suppliers";
import { SupplierContext, type SupplierInfo } from "@/lib/supplier-context";
import { Boxes, ClipboardList } from "lucide-react";

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
  { to: "/supplier/account", label: "Account", short: "Account", icon: User2 },
] as const;

function SupplierLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [info, setInfo] = useState<SupplierInfo | null>(null);
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

  return (
    <SupplierContext.Provider value={info}>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-28 pt-4 md:grid-cols-[220px_1fr] md:px-6 md:py-6 md:pb-6">
          {/* Desktop sidebar */}
          <aside className="hidden h-fit rounded-2xl border border-border bg-card p-3 md:sticky md:top-24 md:block">
            <div className="mb-3 px-3 pt-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supplier</div>
              <div className="mt-0.5 truncate text-sm font-bold">{info?.name ?? "…"}</div>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV.map((n) => {
                const active = isActive(n.to);
                return (
                  <Link key={n.to} to={n.to} className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
                    <n.icon className="h-4 w-4" /> {n.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <main><Outlet /></main>
        </div>

        {/* Mobile: sticky bottom tab bar */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-lg">
            {NAV.map((n) => {
              const active = isActive(n.to);
              return (
                <Link key={n.to} to={n.to} className={`relative flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-semibold transition ${active ? "text-primary" : "text-muted-foreground"}`}>
                  <span className={`grid h-8 w-8 place-items-center rounded-xl transition ${active ? "bg-primary/10" : ""}`}>
                    <n.icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="leading-none">{n.short}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </SupplierContext.Provider>
  );
}
