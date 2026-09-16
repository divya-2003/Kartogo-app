import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Boxes, Bike, ShoppingBag, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listPortalTargetsFn, openPortalAsAdminFn, type PortalTargets } from "@/lib/admin-portal.functions";

export const Route = createFileRoute("/admin/portals")({
  component: PortalsPage,
  head: () => ({ meta: [{ title: "Open other portals — Kartogo Admin" }] }),
});

function PortalsPage() {
  const nav = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [targets, setTargets] = useState<PortalTargets | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let t: string | null = null;
    try { t = JSON.parse(localStorage.getItem("qk_admin_token") || "null"); } catch { t = null; }
    setToken(t);
    if (!t) return;
    listPortalTargetsFn({ data: { token: t } })
      .then(setTargets)
      .catch(() => toast.error("Could not load the portals list"));
  }, []);

  const open = async (role: "supplier" | "delivery", refId: string) => {
    if (!token) return;
    setBusy(refId);
    try {
      const res = await openPortalAsAdminFn({ data: { token, role, refId } });
      if (res.role === "supplier") {
        localStorage.setItem("qk_supplier_token", JSON.stringify(res.token));
        localStorage.setItem("qk_supplier", JSON.stringify({ id: res.profile.id, name: res.profile.name }));
        nav({ to: "/supplier" });
      } else {
        localStorage.setItem("qk_delivery_token", res.token);
        localStorage.setItem("qk_delivery_driver", JSON.stringify(res.profile));
        nav({ to: "/delivery" });
      }
    } catch (err) {
      toast.error((err as Error).message || "Could not open that portal");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Open other portals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Step straight into a supplier or delivery partner view with your admin login — no extra accounts needed.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Boxes className="h-5 w-5 text-primary" /> Supplier portals</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(targets?.suppliers ?? []).map(s => (
            <Button key={s.id} variant="outline" disabled={busy === s.id} onClick={() => open("supplier", s.id)}>
              <ExternalLink /> {s.name}
            </Button>
          ))}
          {targets && targets.suppliers.length === 0 && <p className="text-sm text-muted-foreground">No suppliers configured.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Bike className="h-5 w-5 text-primary" /> Delivery partner portals</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(targets?.drivers ?? []).map(d => (
            <Button key={d.id} variant="outline" disabled={busy === d.id} onClick={() => open("delivery", d.id)}>
              <ExternalLink /> {d.name}
              <span className="ml-1 text-[11px] font-semibold text-muted-foreground">{d.active ? "active" : "paused"}</span>
            </Button>
          ))}
          {targets && targets.drivers.length === 0 && <p className="text-sm text-muted-foreground">No delivery partners yet.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><ShoppingBag className="h-5 w-5 text-primary" /> Customer app</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => nav({ to: "/" })}><ExternalLink /> Open customer home</Button>
          <Button variant="outline" onClick={() => nav({ to: "/categories" })}><ExternalLink /> Markets & categories</Button>
        </div>
      </section>
    </div>
  );
}
