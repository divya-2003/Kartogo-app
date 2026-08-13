import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgePercent, Plus, Trash2, Save, X } from "lucide-react";
import {
  listAdminPromosFn,
  savePromoFn,
  deletePromoFn,
  type AdminPromo,
} from "@/lib/promo.functions";

export const Route = createFileRoute("/admin/promos")({
  component: AdminPromosPage,
  head: () => ({
    meta: [
      { title: "Promo codes — Kartogo admin" },
      { name: "description", content: "Create and manage Kartogo promo codes, validity windows and usage limits." },
    ],
  }),
});

type Draft = {
  id: string | null;
  code: string;
  description: string;
  discountType: "flat" | "pct";
  discountValue: number;
  minSubtotal: number;
  maxDiscount: string;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  perCustomerLimit: number;
  firstOrderOnly: boolean;
  isActive: boolean;
};

const blank = (): Draft => ({
  id: null,
  code: "",
  description: "",
  discountType: "flat",
  discountValue: 50,
  minSubtotal: 499,
  maxDiscount: "",
  startsAt: "",
  endsAt: "",
  usageLimit: "",
  perCustomerLimit: 1,
  firstOrderOnly: false,
  isActive: true,
});

const toDraft = (p: AdminPromo): Draft => ({
  id: p.id,
  code: p.code,
  description: p.description,
  discountType: p.discountType,
  discountValue: p.discountValue,
  minSubtotal: p.minSubtotal,
  maxDiscount: p.maxDiscount == null ? "" : String(p.maxDiscount),
  startsAt: p.startsAt ? p.startsAt.slice(0, 10) : "",
  endsAt: p.endsAt ? p.endsAt.slice(0, 10) : "",
  usageLimit: p.usageLimit == null ? "" : String(p.usageLimit),
  perCustomerLimit: p.perCustomerLimit,
  firstOrderOnly: p.firstOrderOnly,
  isActive: p.isActive,
});

const adminToken = () => {
  try { return JSON.parse(localStorage.getItem("qk_admin_token") || "null") ?? ""; } catch { return ""; }
};

function AdminPromosPage() {
  const [promos, setPromos] = useState<AdminPromo[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setPromos(await listAdminPromosFn({ data: { adminToken: adminToken() } }));
    } catch {
      toast.error("Could not load promo codes");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await savePromoFn({
        data: {
          adminToken: adminToken(),
          promo: {
            id: draft.id,
            code: draft.code.trim().toUpperCase(),
            description: draft.description.trim(),
            discountType: draft.discountType,
            discountValue: Number(draft.discountValue) || 0,
            minSubtotal: Number(draft.minSubtotal) || 0,
            maxDiscount: draft.maxDiscount === "" ? null : Number(draft.maxDiscount),
            startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : null,
            endsAt: draft.endsAt ? new Date(`${draft.endsAt}T23:59:59`).toISOString() : null,
            usageLimit: draft.usageLimit === "" ? null : Number(draft.usageLimit),
            perCustomerLimit: Number(draft.perCustomerLimit) || 1,
            firstOrderOnly: draft.firstOrderOnly,
            isActive: draft.isActive,
          },
        },
      });
      toast.success("Promo code saved");
      setDraft(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save this code");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deletePromoFn({ data: { adminToken: adminToken(), id } });
      toast.success("Promo code deleted");
      await load();
    } catch {
      toast.error("Could not delete this code");
    }
  };

  const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold"><BadgePercent className="h-5 w-5 text-primary" /> Promo codes</h1>
          <p className="text-sm text-muted-foreground">Discounts, validity windows and usage caps — enforced at order time.</p>
        </div>
        <button
          onClick={() => setDraft(blank())}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New code
        </button>
      </div>

      {draft && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">{draft.id ? "Edit code" : "New code"}</h2>
            <button onClick={() => setDraft(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Code
              <input className={`${field} mt-1 uppercase`} value={draft.code} maxLength={24}
                onChange={e => setDraft({ ...draft, code: e.target.value.toUpperCase() })} />
            </label>
            <label className="text-xs font-semibold uppercase text-muted-foreground sm:col-span-2">Description
              <input className={`${field} mt-1`} value={draft.description} maxLength={160}
                onChange={e => setDraft({ ...draft, description: e.target.value })} />
            </label>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Type
              <select className={`${field} mt-1`} value={draft.discountType}
                onChange={e => setDraft({ ...draft, discountType: e.target.value as "flat" | "pct" })}>
                <option value="flat">Flat ₹ off</option>
                <option value="pct">% off</option>
              </select>
            </label>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Value
              <input type="number" className={`${field} mt-1`} value={draft.discountValue}
                onChange={e => setDraft({ ...draft, discountValue: Number(e.target.value) })} />
            </label>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Max discount (₹)
              <input type="number" className={`${field} mt-1`} value={draft.maxDiscount} placeholder="No cap"
                onChange={e => setDraft({ ...draft, maxDiscount: e.target.value })} />
            </label>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Minimum order (₹)
              <input type="number" className={`${field} mt-1`} value={draft.minSubtotal}
                onChange={e => setDraft({ ...draft, minSubtotal: Number(e.target.value) })} />
            </label>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Starts
              <input type="date" className={`${field} mt-1`} value={draft.startsAt}
                onChange={e => setDraft({ ...draft, startsAt: e.target.value })} />
            </label>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Ends
              <input type="date" className={`${field} mt-1`} value={draft.endsAt}
                onChange={e => setDraft({ ...draft, endsAt: e.target.value })} />
            </label>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Total uses
              <input type="number" className={`${field} mt-1`} value={draft.usageLimit} placeholder="Unlimited"
                onChange={e => setDraft({ ...draft, usageLimit: e.target.value })} />
            </label>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Uses per customer
              <input type="number" className={`${field} mt-1`} value={draft.perCustomerLimit}
                onChange={e => setDraft({ ...draft, perCustomerLimit: Number(e.target.value) })} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.firstOrderOnly}
                onChange={e => setDraft({ ...draft, firstOrderOnly: e.target.checked })} />
              First order only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.isActive}
                onChange={e => setDraft({ ...draft, isActive: e.target.checked })} />
              Active
            </label>
            <button onClick={save} disabled={busy}
              className="ml-auto flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save code"}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {promos.map(p => (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold text-primary">{p.code}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${p.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {p.isActive ? "Active" : "Paused"}
                  </span>
                  {p.firstOrderOnly && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">First order</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.description || "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setDraft(toDraft(p))} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Edit</button>
                <button onClick={() => remove(p.id)} className="rounded-lg border border-border px-2 py-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
              <span>{p.discountType === "flat" ? `₹${p.discountValue} off` : `${p.discountValue}% off`}</span>
              <span>Min ₹{p.minSubtotal}</span>
              <span>Used {p.used}{p.usageLimit ? ` / ${p.usageLimit}` : ""}</span>
              <span>{p.endsAt ? `Ends ${new Date(p.endsAt).toLocaleDateString()}` : "No end date"}</span>
            </div>
          </div>
        ))}
        {promos.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No promo codes yet. Create your first one.
          </p>
        )}
      </div>
    </div>
  );
}
