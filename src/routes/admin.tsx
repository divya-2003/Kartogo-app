import { createFileRoute, Outlet, Link, useRouter, useRouterState, redirect, isRedirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useOrders } from "@/lib/store";
import { verifyAdminAccessFn, type AdminSessionAccess } from "@/lib/admin-access.functions";
import { permissionForAdminPath, type AdminPermission } from "@/lib/admin-access.shared";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sparkles, LayoutDashboard, Boxes, ClipboardList, Bike, PackageX, Star, Flame, BadgeIndianRupee, Menu, Store, Inbox, Sheet as SheetIcon, CalendarDays, Package, BarChart3, Printer, UserRound, BellRing, UsersRound, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// Remembers the last successful admin-token verification for this tab so the
// admin area doesn't re-hit the server on every single navigation.
const adminSessionCache: { token: string | null; checkedAt: number; access: AdminSessionAccess | null } = { token: null, checkedAt: 0, access: null };

export const Route = createFileRoute("/admin")({

  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    let token: string | null = null;
    try { token = JSON.parse(localStorage.getItem("qk_admin_token") || "null"); } catch { token = null; }
    if (!token) throw redirect({ to: "/login" });

    // Verify at most once every 10 minutes and keep the result in memory, so
    // navigating inside the admin area never waits on a network round-trip.
    const now = Date.now();
    if (adminSessionCache.token === token && adminSessionCache.access && now - adminSessionCache.checkedAt < 10 * 60_000) {
      const allowed = adminSessionCache.access.isSuperAdmin || adminSessionCache.access.permissions.includes(permissionForAdminPath(location.pathname));
      if (!allowed) throw redirect({ to: firstAdminPath(adminSessionCache.access.permissions) });
      return adminSessionCache.access;
    }

    try {
      const access = await verifyAdminAccessFn({ data: { token, path: location.pathname } });
      // Only a definitive "invalid" logs the admin out. A network/server hiccup
      // must never bounce them to the login screen mid-work.
      if (!access.valid) {
        adminSessionCache.token = null;
        adminSessionCache.access = null;
        throw redirect({ to: "/login" });
      }
      if (!access.allowed) throw redirect({ to: firstAdminPath(access.permissions) });
      adminSessionCache.token = token;
      adminSessionCache.checkedAt = now;
      adminSessionCache.access = access;
      return access;
    } catch (e) {
      if (isRedirect(e)) throw e;
      // keep the session; retry on the next navigation
    }
  },

  component: AdminLayout,
  head: () => ({ meta: [{ title: "Admin — Kartogo" }] }),
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard" },
  
  { to: "/admin/inventory", label: "Inventory", icon: Boxes, permission: "inventory" },
  { to: "/admin/wims", label: "Warehouse (WIMS)", icon: Boxes, permission: "warehouse" },
  { to: "/admin/ai", label: "AI assistant", icon: Sparkles, permission: "ai" },
  { to: "/admin/ai-alerts", label: "AI inventory alerts", icon: BellRing, permission: "ai" },
  { to: "/admin/alerts", label: "Alert settings", icon: BellRing, permission: "alerts" },
  { to: "/admin/notifications", label: "Push notifications", icon: BellRing, permission: "notifications" },

  { to: "/admin/orders", label: "Orders", icon: ClipboardList, permission: "orders" },
  { to: "/admin/cancellations", label: "Cancellations", icon: PackageX, permission: "orders" },
  { to: "/admin/refund-requests", label: "Refund requests", icon: BadgeIndianRupee, permission: "refunds" },
  { to: "/admin/feedback", label: "Feedback", icon: Star, permission: "feedback" },
  { to: "/admin/delivery", label: "Delivery", icon: Bike, permission: "delivery" },
  { to: "/admin/logistics", label: "Live logistics", icon: Bike, permission: "logistics" },
  { to: "/admin/print", label: "Print queue", icon: Printer, permission: "print" },
  { to: "/admin/partners", label: "Partner markets", icon: Store, permission: "partners" },
  { to: "/admin/combos", label: "Combo bundles", icon: Package, permission: "combos" },
  
  { to: "/admin/promos", label: "Promo codes", icon: BadgeIndianRupee, permission: "promos" },

  { to: "/admin/stock-alerts", label: "Restock requests", icon: Inbox, permission: "alerts" },
  { to: "/admin/surge", label: "Surge pricing", icon: Flame, permission: "promos" },
  { to: "/admin/unserviceable", label: "Area requests", icon: Inbox, permission: "requests" },
  { to: "/admin/sales", label: "Sales dataset", icon: SheetIcon, permission: "sales" },
  { to: "/admin/reports-daily", label: "Daily summary", icon: CalendarDays, permission: "reports" },
  { to: "/admin/reports-products", label: "Product analytics", icon: Package, permission: "reports" },
  { to: "/admin/reports-vendors", label: "Vendor report", icon: BarChart3, permission: "reports" },
  { to: "/admin/reports-riders", label: "Rider report", icon: Bike, permission: "reports" },
  { to: "/admin/recommendations", label: "Recommendations", icon: Sparkles, permission: "recommendations" },
  { to: "/admin/sub-admins", label: "Sub-admins", icon: UsersRound, permission: "sub_admins" },
  { to: "/admin/account", label: "Account", icon: UserRound, permission: "account" },
] as const;

function firstAdminPath(permissions: AdminPermission[]) {
  return NAV.find((item) => permissions.includes(item.permission))?.to ?? "/admin/account";
}


function AdminLayout() {
  const routeAccess = Route.useRouteContext() as AdminSessionAccess | undefined;
  const router = useRouter();
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
      {NAV.filter((n) => routeAccess?.isSuperAdmin || routeAccess?.permissions.includes(n.permission)).map(n => {
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
      {/* Mobile top bar with hamburger */}
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-card/95 px-3 py-2 backdrop-blur md:hidden">
        {path !== "/admin" && (
          <Button type="button" variant="outline" size="icon" aria-label="Go back" onClick={() => router.history.back()}>
            <ChevronLeft />
          </Button>
        )}
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
         <aside className="hidden h-fit max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-border bg-card p-3 md:sticky md:top-4 md:block">
          <NavList />
        </aside>

        <main className="min-w-0"><Outlet /></main>
      </div>
    </div>
  );
}
