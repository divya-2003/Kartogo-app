import { createFileRoute, Outlet, Link, useRouterState, redirect } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useOrders } from "@/lib/store";
import { LayoutDashboard, Package2, Boxes, ClipboardList, Bike, ArrowLeft, PackageX } from "lucide-react";

export const Route = createFileRoute("/admin")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    let u: { role?: string } | null = null;
    try { u = JSON.parse(localStorage.getItem("qk_user") || "null"); } catch { u = null; }
    if (!u || u.role !== "admin") throw redirect({ to: "/login" });
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
  const cancelledCount = orders.filter(o => o.status === "cancelled").length;
  const isActive = (to: string) => (to === "/admin" ? path === "/admin" : path.startsWith(to));

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Mobile: compact "back to store" bar */}
      <div className="border-b border-border bg-card px-4 py-2 md:hidden">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to store
        </Link>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-28 pt-4 md:grid-cols-[220px_1fr] md:px-6 md:py-6 md:pb-6">
        {/* Desktop sidebar */}
        <aside className="hidden h-fit rounded-2xl border border-border bg-card p-3 md:sticky md:top-24 md:block">
          <Link to="/" className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"><ArrowLeft className="h-3 w-3" /> Back to store</Link>
          <nav className="flex flex-col gap-1">
            {NAV.map(n => {
              const active = isActive(n.to);
              const badge = n.to === "/admin/cancellations" && cancelledCount > 0 ? cancelledCount : null;
              return (
                <Link key={n.to} to={n.to} className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
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
        <div className="mx-auto grid max-w-lg grid-cols-6">
          {NAV.map(n => {
            const active = isActive(n.to);
            const badge = n.to === "/admin/cancellations" && cancelledCount > 0 ? cancelledCount : null;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`relative flex flex-col items-center gap-1 py-2 text-[10px] font-semibold transition ${active ? "text-primary" : "text-muted-foreground"}`}
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
