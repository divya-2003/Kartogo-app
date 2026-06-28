import { createFileRoute, Outlet, Link, useRouterState, redirect, isRedirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { useOrders } from "@/lib/store";
import { verifyAdminTokenFn } from "@/lib/auth.functions";
import { LayoutDashboard, Package2, Boxes, ClipboardList, Bike, ArrowLeft, PackageX } from "lucide-react";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    // The admin shell is gated on a SERVER-CONFIRMED identity check: we read the
    // token from localStorage but never trust it — the server cryptographically
    // verifies its HMAC signature. A spoofed value fails verification and the
    // user is redirected to /login before the admin UI is ever rendered.
    let token: string | null = null;
    try { token = JSON.parse(localStorage.getItem("qk_admin_token") || "null"); } catch { token = null; }
    if (!token) throw redirect({ to: "/login" });
    try {
      const { valid } = await verifyAdminTokenFn({ data: { token } });
      if (!valid) throw redirect({ to: "/login" });
    } catch (e) {
      // Re-throw redirects; treat any other failure as unauthorized.
      if (isRedirect(e)) throw e;
      throw redirect({ to: "/login" });
    }
  },
  component: AdminLayout,
  head: () => ({ meta: [{ title: "Admin — Kartigo" }] }),
});


const NAV = [
  { to: "/admin", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { to: "/admin/products", label: "Products", short: "Products", icon: Package2 },
  { to: "/admin/inventory", label: "Inventory", short: "Stock", icon: Boxes },
  { to: "/admin/orders", label: "Orders", short: "Orders", icon: ClipboardList },
  { to: "/admin/cancellations", label: "Cancellations", short: "Cancels", icon: PackageX },
  { to: "/admin/delivery", label: "Delivery", short: "Riders", icon: Bike },
] as const;

function AdminLayout() {
  const path = useRouterState({ select: s => s.location.pathname });
  const { orders } = useOrders();
  const [cancelSeen, setCancelSeen] = useState(false);
  const cancelledCount = orders.filter(o => o.status === "cancelled").length;
  const isActive = (to: string) => (to === "/admin" ? path === "/admin" : path.startsWith(to));

  useEffect(() => {
    setCancelSeen(localStorage.getItem("kartigo_cancel_seen") === "true");
  }, [path]);

  const markCancellationsSeen = () => {
    localStorage.setItem("kartigo_cancel_seen", "true");
    setCancelSeen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-28 pt-4 md:grid-cols-[220px_1fr] md:px-6 md:py-6 md:pb-6">
        {/* Desktop sidebar */}
        <aside className="hidden h-fit rounded-2xl border border-border bg-card p-3 md:sticky md:top-24 md:block">

          <nav className="flex flex-col gap-1">
            {NAV.map(n => {
              const active = isActive(n.to);
              const badge = n.to === "/admin/cancellations" && !cancelSeen && cancelledCount > 0 ? cancelledCount : null;
              return (
                <Link key={n.to} to={n.to} onClick={n.to === "/admin/cancellations" ? markCancellationsSeen : undefined} className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
                  <n.icon className="h-4 w-4" /> {n.label}
                  {badge !== null && (
                    <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-primary-foreground text-primary" : "bg-destructive text-destructive-foreground"}`}>{badge}</span>
                  )}
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
          {NAV.map(n => {
            const active = isActive(n.to);
            const badge = n.to === "/admin/cancellations" && !cancelSeen && cancelledCount > 0 ? cancelledCount : null;
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={n.to === "/admin/cancellations" ? markCancellationsSeen : undefined}
                className={`relative flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-semibold transition ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <span className={`grid h-8 w-8 place-items-center rounded-xl transition ${active ? "bg-primary/10" : ""}`}>
                  <n.icon className="h-[18px] w-[18px]" />
                </span>
                <span className="leading-none">{n.short}</span>
                {badge !== null && (
                  <span className="absolute right-2 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">{badge}</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
