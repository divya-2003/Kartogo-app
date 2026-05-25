import { createFileRoute, Outlet, Link, useRouterState, redirect } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { LayoutDashboard, Package2, Boxes, ClipboardList, Bike, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      try {
        const u = JSON.parse(localStorage.getItem("qk_user") || "null");
        if (!u || u.role !== "admin") throw redirect({ to: "/login" });
      } catch (e) {
        // re-throw redirects
        if ((e as { isRedirect?: boolean })?.isRedirect) throw e;
      }
    }
  },
  component: AdminLayout,
  head: () => ({ meta: [{ title: "Admin — QuickKart" }] }),
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/products", label: "Products", icon: Package2 },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/delivery", label: "Delivery", icon: Bike },
] as const;

function AdminLayout() {
  const path = useRouterState({ select: s => s.location.pathname });
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr] md:px-6">
        <aside className="h-fit rounded-2xl border border-border bg-card p-3 md:sticky md:top-24">
          <Link to="/" className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"><ArrowLeft className="h-3 w-3" /> Back to store</Link>
          <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
            {NAV.map(n => {
              const active = n.to === "/admin" ? path === "/admin" : path.startsWith(n.to);
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
    </div>
  );
}
