import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, ChevronsLeft, ChevronsRight, LogOut, Store, User2 } from "lucide-react";
import { PartnerMenu, useLeaveCustomerMode } from "@/components/PartnerMenu";
import { StudioProvider, useStudio } from "@/components/studio/StudioContext";
import { STUDIO_NAV, pageForPath } from "@/components/studio/nav";
import { ErrorBox, Loading } from "@/components/studio/ui";
import { canUse, studioPages } from "@/lib/studio";
import { useSignOut } from "@/hooks/use-sign-out";

export const Route = createFileRoute("/supplier/studio")({
  component: StudioLayout,
  head: () => ({ meta: [
    { title: "Partner Studio — Kartogo" },
    { name: "description", content: "Manage your Kartogo business: inventory, services, appointments, enquiries and customers." },
    { name: "robots", content: "noindex" },
  ] }),
});

function StudioLayout() {
  useLeaveCustomerMode();
  return <StudioProvider><StudioShell /></StudioProvider>;
}

function NavList({ onPick, collapsed = false, dark = false }: { onPick?: () => void; collapsed?: boolean; dark?: boolean }) {
  const { me } = useStudio();
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (!me) return null;
  const current = pageForPath(path);
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Partner Studio">
      {studioPages(me.partner.kind).map((p) => {
        const n = STUDIO_NAV[p];
        const active = current === p;
        const tone = dark
          ? active ? "bg-brand-on-navy/15 text-brand-on-navy" : "text-brand-on-navy/75 hover:bg-brand-on-navy/10 hover:text-brand-on-navy"
          : active ? "bg-brand-navy text-brand-on-navy" : "hover:bg-secondary";
        return (
          <Link key={p} to={n.to} onClick={onPick} title={collapsed ? n.label : undefined}
            className={`flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${tone} ${collapsed ? "justify-center px-0" : ""}`}>
            <n.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="flex-1">{n.label}</span>}
            {!collapsed && p === "notifications" && me.unread > 0 && <span className="rounded-full bg-saffron px-1.5 text-[10px] font-bold text-saffron-foreground">{me.unread > 99 ? "99+" : me.unread}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function StudioShell() {
  const { me, loading, error, refresh, setPartnerId } = useStudio();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const signOut = useSignOut();
  const [collapsed, setCollapsed] = useState(false);
  const [studioOnly, setStudioOnly] = useState(true);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("qk_studio_collapsed") === "1"); } catch { /* noop */ }
    try { setStudioOnly(String(JSON.parse(localStorage.getItem("qk_supplier") || "{}")?.id ?? "").startsWith("studio:")); } catch { /* noop */ }
  }, []);
  const toggle = () => { setCollapsed(c => { try { localStorage.setItem("qk_studio_collapsed", c ? "0" : "1"); } catch { /* noop */ } return !c; }); };
  const page = pageForPath(path);
  const allowed = !me || canUse(me.partner.kind, page);

  return (
    <div className="font-studio flex min-h-screen bg-studio-surface text-foreground">
      {/* Desktop: collapsible dark-navy sidebar */}
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-brand-navy text-brand-on-navy transition-[width] md:flex ${collapsed ? "w-16" : "w-60"}`}>
        <div className={`flex h-14 items-center gap-2 border-b border-brand-on-navy/10 px-3 ${collapsed ? "justify-center" : ""}`}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-on-navy/10 text-lg">{me?.partner.icon ?? "🏪"}</span>
          {!collapsed && <div className="min-w-0"><div className="text-[11px] uppercase tracking-wider text-brand-on-navy/60">Partner Studio</div><div className="truncate text-sm font-semibold">{me?.partner.name ?? "Loading…"}</div></div>}
        </div>
        <div className="flex-1 overflow-y-auto p-2"><NavList collapsed={collapsed} dark /></div>
        <div className="space-y-1 border-t border-brand-on-navy/10 p-2">
          {!studioOnly && <Link to="/supplier/sales" title="Seller portal" className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand-on-navy/75 hover:bg-brand-on-navy/10 ${collapsed ? "justify-center px-0" : ""}`}><Store className="h-4 w-4" />{!collapsed && "Seller portal"}</Link>}
          <button onClick={signOut} title="Log out" className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand-on-navy/75 hover:bg-brand-on-navy/10 ${collapsed ? "justify-center px-0" : ""}`}><LogOut className="h-4 w-4" />{!collapsed && "Log out"}</button>
          <button onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand-on-navy/75 hover:bg-brand-on-navy/10 ${collapsed ? "justify-center px-0" : ""}`}>{collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" />Collapse</>}</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur md:px-6">
          <div className="md:hidden">
            <PartnerMenu title={me?.partner.name ?? "Partner Studio"} closeKey={path}>
              {(close) => (
                <div className="space-y-2">
                  <div className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Partner Studio</div>
                  <NavList onPick={close} />
                  {!studioOnly && <Link to="/supplier/sales" onClick={close} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary"><Store className="h-4 w-4" />Seller portal</Link>}
                  <button onClick={() => { close(); signOut(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary"><LogOut className="h-4 w-4" />Log out</button>
                </div>
              )}
            </PartnerMenu>
          </div>
          {me && me.partners.length > 1 ? (
            <select aria-label="Choose business" value={me.partner.id} onChange={e => setPartnerId(e.target.value)} className="min-w-0 max-w-[55vw] truncate rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-semibold">
              {me.partners.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
            </select>
          ) : <span className="min-w-0 truncate text-sm font-semibold md:text-base">{me?.partner.name ?? "Partner Studio"}</span>}
          <span className="hidden rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold sm:inline">{me ? (me.partner.kind === "furniture" ? "Furniture seller" : "Service provider") : ""}</span>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/supplier/studio/notifications" aria-label={`Notifications${me?.unread ? `, ${me.unread} unread` : ""}`} className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-card hover:bg-secondary">
              <Bell className="h-4 w-4" />
              {!!me?.unread && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-destructive" />}
            </Link>
            <Link to="/supplier/studio/profile" aria-label="Business profile" className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-border bg-card hover:bg-secondary">
              {me?.partner.logo_url ? <img src={me.partner.logo_url} alt="" className="h-full w-full object-cover" /> : <User2 className="h-4 w-4" />}
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 md:px-6 md:py-6">
          {me?.partner.account_status === "SUSPENDED" && <div className="mb-4"><ErrorBox message="Your account is suspended by Kartogo. You can view your data but changes are blocked. Please contact support." /></div>}
          {me && me.partner.verification_status !== "VERIFIED" && me.partner.account_status !== "SUSPENDED" && (
            <div className="mb-4 rounded-xl border border-saffron/50 bg-saffron/10 p-3 text-sm">{me.partner.verification_status === "REJECTED" ? "Kartogo couldn't verify your business. Update your business profile and contact support." : "Your business verification is pending with Kartogo. You can keep setting up your Studio."}</div>
          )}
          {error ? <ErrorBox message={error} onRetry={refresh} /> : loading || !me ? <Loading rows={6} /> : !allowed ? (
            <ErrorBox message="This section isn't available for your business type." />
          ) : <Outlet />}
        </main>
      </div>
    </div>
  );
}
