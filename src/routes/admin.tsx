import { createFileRoute, Outlet, Link, useRouterState, redirect, isRedirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { useOrders } from "@/lib/store";
import { verifyAdminTokenFn } from "@/lib/auth.functions";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sparkles, LayoutDashboard, Boxes, ClipboardList, Bike, PackageX, Star, Flame, BadgeIndianRupee, Menu, Store, Inbox, Sheet as SheetIcon, CalendarDays, Package, BarChart3, Printer, UserRound, BellRing } from "lucide-react";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    let token: string | null = null;
    try { token = JSON.parse(localStorage.getItem("qk_admin_token") || "null"); } catch { token = null; }
    if (!token) throw redirect({ to: "/login" });
    try {
      const { valid } = await verifyAdminTokenFn({ data: { token } });
      if (!valid) throw redirect({ to: "/login" });
    } catch (e) {
      if (isRedirect(e)) throw e;
      throw redirect({ to: "/login" });
    }
  },
  component: AdminLayout,
  head: () => ({ meta: [{ title: "Admin — Kartogo" }] }),
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  
  { to: "/admin/inventory", label: "Inventory", icon: Boxes },
  { to: "/admin/wims", label: "Warehouse (WIMS)", icon: Boxes },
  { to: "/admin/ai", label: "AI assistant", icon: Sparkles },
  { to: "/admin/ai-alerts", label: "AI inventory alerts", icon: BellRing },
  { to: "/admin/alerts", label: "Alert settings", icon: BellRing },

  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/cancellations", label: "Cancellations", icon: PackageX },
  { to: "/admin/refund-requests", label: "Refund requests", icon: BadgeIndianRupee },
  { to: "/admin/feedback", label: "Feedback", icon: Star },
  { to: "/admin/delivery", label: "Delivery", icon: Bike },
  { to: "/admin/logistics", label: "Live logistics", icon: Bike },
  { to: "/admin/print", label: "Print queue", icon: Printer },
  { to: "/admin/partners", label: "Partner markets", icon: Store },
  { to: "/admin/combos", label: "Combo bundles", icon: Package },
  
  { to: "/admin/promos", label: "Promo codes", icon: BadgeIndianRupee },

  { to: "/admin/stock-alerts", label: "Restock requests", icon: Inbox },
  { to: "/admin/surge", label: "Surge pricing", icon: Flame },
  { to: "/admin/unserviceable", label: "Area requests", icon: Inbox },
  { to: "/admin/sales", label: "Sales dataset", icon: SheetIcon },
  { to: "/admin/reports-daily", label: "Daily summary", icon: CalendarDays },
  { to: "/admin/reports-products", label: "Product analytics", icon: Package },
  { to: "/admin/reports-vendors", label: "Vendor report", icon: BarChart3 },
  { to: "/admin/reports-riders", label: "Rider report", icon: Bike },
  { to: "/admin/recommendations", label: "Recommendations", icon: Sparkles },
  { to: "/admin/account", label: "Account", icon: UserRound },
] as const;


function AdminLayout() {
  const path = useRouterState({ select: s => s.location.pathname });
  const { orders } = useOrders();
  const [cancelSeenCount, setCancelSeenCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const cancelledCount = orders.filter(o => o.status === "cancelled").length;
  const isActive = (to: string) => (to === "/admin" ? path === "/admin" : path.startsWith(to));
  const unseenCancellations = Math.max(0, cancelledCount - cancelSeenCount);

  useEffect(() => {
    const stored = Number(localStorage.getItem("kartigo_cancel_seen_count"));
    setCancelSeenCount(Number.isFinite(stored) ? stored : 0);
  }, [path]);

  useEffect(() => {
    if (path.startsWith("/admin/cancellations")) {
      localStorage.setItem("kartigo_cancel_seen_count", String(cancelledCount));
      setCancelSeenCount(cancelledCount);
    }
  }, [path, cancelledCount]);

  // Auto-close the mobile sheet whenever the route changes.
  useEffect(() => { setMobileOpen(false); }, [path]);

  const markCancellationsSeen = () => {
    localStorage.setItem("kartigo_cancel_seen_count", String(cancelledCount));
    setCancelSeenCount(cancelledCount);
  };

  const NavList = ({ inSheet = false }: { inSheet?: boolean }) => (
    <nav className="flex flex-col gap-1">
      {NAV.map(n => {
        const active = isActive(n.to);
        const badge = n.to === "/admin/cancellations" && unseenCancellations > 0 ? unseenCancellations : null;
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={() => {
              if (n.to === "/admin/cancellations") markCancellationsSeen();
              if (inSheet) setMobileOpen(false);
            }}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
          >
            <n.icon className="h-4 w-4" /> {n.label}
            {badge !== null && (
              <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-primary-foreground text-primary" : "bg-destructive text-destructive-foreground"}`}>{badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Mobile top bar with hamburger */}
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-card/95 px-3 py-2 backdrop-blur md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button
              aria-label={mobileOpen ? "Close admin menu" : "Open admin menu"}
              className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-card hover:bg-secondary"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b border-border p-4">
              <SheetTitle className="text-left font-display text-base font-bold">Admin menu</SheetTitle>
            </SheetHeader>
            <div className="max-h-[calc(100vh-5rem)] overflow-y-auto p-3">
              <NavList inSheet />
            </div>
          </SheetContent>
        </Sheet>
        <span className="font-display text-sm font-bold">Admin</span>
        <div className="ml-auto flex items-center gap-2">
          {unseenCancellations > 0 && (
            <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
              {unseenCancellations} new cancel
            </span>
          )}
          <Link
            to="/admin/account"
            aria-label="Admin account"
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card hover:bg-secondary"
          >
            <UserRound className="h-4 w-4" />
          </Link>
        </div>
      </div>


      <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-6 pt-4 md:grid-cols-[220px_minmax(0,1fr)] md:px-6 md:py-6">
        {/* Desktop sidebar */}
        <aside className="hidden h-fit max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-border bg-card p-3 md:sticky md:top-24 md:block">
          <NavList />
        </aside>

        <main className="min-w-0"><Outlet /></main>
      </div>
    </div>
  );
}
