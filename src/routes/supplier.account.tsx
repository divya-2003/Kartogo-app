import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Building2, User2, Boxes, LogOut, CheckCircle2, RotateCcw, Clock, IndianRupee } from "lucide-react";
import { listSupplierOrdersFn, type SupplierOrder } from "@/lib/supplier.functions";
import { useSupplier } from "@/lib/supplier-context";
import { CATEGORIES, formatINR } from "@/lib/data";
import { toast } from "sonner";
import { StaffAccountCard } from "@/components/StaffAccountCard";

export const Route = createFileRoute("/supplier/account")({ component: SupplierAccount });

function SupplierAccount() {
  const supplier = useSupplier();
  const nav = useNavigate();
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let token: string | null = null;
      try { token = JSON.parse(localStorage.getItem("qk_supplier_token") || "null"); } catch { token = null; }
      if (!token) { setLoading(false); return; }
      try {
        const res = await listSupplierOrdersFn({ data: { token } });
        if (!cancelled) setOrders(res.orders);
      } catch { /* noop */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const delivered = orders.filter(o => o.status === "delivered");
    const returned = orders.filter(o => o.status === "cancelled" || o.refunded);
    const active = orders.filter(o => o.status !== "delivered" && o.status !== "cancelled");
    const revenue = delivered.reduce((s, o) => s + o.supplierTotal, 0);
    return { delivered: delivered.length, returned: returned.length, active: active.length, revenue };
  }, [orders]);

  const catNames = (supplier?.categories ?? [])
    .map(slug => CATEGORIES.find(c => c.slug === slug)?.name ?? slug)
    .join(", ");

  const onLogout = () => {
    try {
      localStorage.removeItem("qk_supplier_token");
      localStorage.removeItem("qk_supplier");
    } catch { /* noop */ }
    toast.success("Signed out");
    nav({ to: "/login" });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">Account</h1>
        <p className="text-sm text-muted-foreground">Your supplier profile and delivery performance.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={CheckCircle2} label="Successful" value={String(stats.delivered)} tone="primary" />
        <StatCard icon={RotateCcw} label="Returned" value={String(stats.returned)} tone="destructive" />
        <StatCard icon={Clock} label="In progress" value={String(stats.active)} tone="saffron" />
        <StatCard icon={IndianRupee} label="Delivered revenue" value={formatINR(stats.revenue)} tone="primary" />
      </div>

      <StaffAccountCard role="vendor" />

      {/* Account details */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold">
          <User2 className="h-5 w-5 text-primary" /> Account details
        </h2>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-3 p-4">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Supplier name</div>
              <div className="font-semibold">{supplier?.name ?? "—"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <Boxes className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Categories</div>
              <div className="font-semibold">{catNames || "—"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <User2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Supplier ID</div>
              <div className="font-semibold">{supplier?.id ?? "—"}</div>
            </div>
          </div>
        </div>
      </section>

      {loading && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Loading performance…
        </div>
      )}

      <button
        onClick={onLogout}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-card px-4 py-3 text-sm font-bold text-destructive hover:bg-destructive/10"
      >
        <LogOut className="h-4 w-4" /> Log out
      </button>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof CheckCircle2; label: string; value: string; tone: "primary" | "destructive" | "saffron" }) {
  const toneClass = tone === "destructive" ? "text-destructive" : tone === "saffron" ? "text-saffron-foreground" : "text-primary";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Icon className={`h-5 w-5 ${toneClass}`} />
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
