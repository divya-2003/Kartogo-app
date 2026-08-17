import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useCatalog } from "@/lib/store";
import { CATEGORIES, formatINR, type Product } from "@/lib/data";
import { useSupplier } from "@/lib/supplier-context";
import { Plus, Pencil, Trash2, ClipboardCheck, PackageCheck } from "lucide-react";
import { listPurchaseOrdersFn, setPurchaseOrderStatusFn } from "@/lib/inventory.functions";
import { toast } from "sonner";
import { ItemEditor } from "@/components/ItemEditor";


export const Route = createFileRoute("/supplier/")({ component: SupplierInventory });

function SupplierInventory() {
  const { products, upsert, remove, setPrice, setStock } = useCatalog();
  const supplier = useSupplier();
  const [editing, setEditing] = useState<Product | null>(null);
  const [filter, setFilter] = useState("");

  const cats = useMemo(() => new Set(supplier?.categories ?? []), [supplier]);
  const myCategories = CATEGORIES.filter((c) => cats.has(c.slug));

  const list = products
    .filter((p) => cats.has(p.category))
    .filter((p) => !filter || p.name.toLowerCase().includes(filter.toLowerCase()));

  // Reorder (purchase) requests approved by admin, scoped to this supplier's
  // categories so each portal only sees what it has to fulfil.
  type PoLine = { product_id: string; product_name: string; quantity: number; unit_cost: number };
  type Po = { id: string; market_name: string; status: string; expected_cost: number; created_at: string; items: PoLine[] };
  const [pos, setPos] = useState<Po[]>([]);
  const [poBusy, setPoBusy] = useState<string | null>(null);

  const loadPos = async () => {
    let token: string | null = null;
    try { token = JSON.parse(localStorage.getItem("qk_supplier_token") || "null"); } catch { token = null; }
    if (!token) return;
    try {
      const res = await listPurchaseOrdersFn({ data: { supplierToken: token } });
      setPos(res.purchaseOrders as unknown as Po[]);
    } catch { /* keep last good */ }
  };
  useEffect(() => { void loadPos(); }, []);

  const catOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of products) m.set(p.id, p.category);
    return m;
  }, [products]);

  const myPos = pos.filter(po =>
    (po.status === "approved" || po.status === "pending_approval") &&
    (po.items ?? []).some(l => cats.has(catOf.get(l.product_id) ?? "")),
  );

  const markDelivered = async (id: string) => {
    let token: string | null = null;
    try { token = JSON.parse(localStorage.getItem("qk_supplier_token") || "null"); } catch { token = null; }
    if (!token) return;
    setPoBusy(id);
    try {
      await setPurchaseOrderStatusFn({ data: { supplierToken: token, id, status: "delivered" } });
      toast.success("Marked as delivered");
      await loadPos();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update"); }
    finally { setPoBusy(null); }
  };

  const defaultCat = myCategories[0]?.slug ?? "snacks";
  const EMPTY: Product = { id: "", name: "", category: defaultCat, price: 0, unit: "", stock: 0, emoji: "🛒", description: "" };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">{list.length} items in your categories · quick edit saves instantly</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search..." className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring sm:flex-none" />
          <button onClick={() => setEditing({ ...EMPTY, id: `p${Date.now()}` })} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New item
          </button>
        </div>
      </div>

      {/* Approved reorder requests from admin */}
      {myPos.length > 0 && (
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <ClipboardCheck className="h-5 w-5 text-primary" /> Reorder requests ({myPos.length})
          </h2>
          <p className="text-xs text-muted-foreground">Approved by admin — restock these and mark them delivered.</p>
          <div className="mt-3 space-y-3">
            {myPos.map(po => (
              <div key={po.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{po.market_name || "Store"}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(po.created_at).toLocaleDateString()} · {formatINR(Number(po.expected_cost) || 0)}
                    </div>
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${po.status === "approved" ? "bg-leaf/15 text-leaf" : "bg-saffron/30"}`}>
                    {po.status.replace("_", " ")}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {(po.items ?? []).filter(l => cats.has(catOf.get(l.product_id) ?? "")).map(l => (
                    <li key={l.product_id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{l.product_name}</span>
                      <span className="shrink-0 font-semibold">x{l.quantity}</span>
                    </li>
                  ))}
                </ul>
                {po.status === "approved" && (
                  <button
                    onClick={() => void markDelivered(po.id)}
                    disabled={poBusy === po.id}
                    className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    <PackageCheck className="h-3.5 w-3.5" /> {poBusy === po.id ? "Saving…" : "Mark delivered"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Desktop / laptop: table */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3">Item</th>
              <th className="p-3">Category</th>
              <th className="p-3 w-32">Price (₹)</th>
              <th className="p-3 w-28">Stock</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.map((p) => (
              <tr key={p.id} className="hover:bg-secondary/50">
                <td className="p-3"><div className="flex items-center gap-3">{p.image ? <img src={p.image} alt={p.name} loading="lazy" className="h-11 w-11 rounded-lg object-cover" /> : <span className="grid h-11 w-11 place-items-center rounded-lg bg-secondary text-xl">{p.emoji}</span>}<div><div className="font-semibold">{p.name}</div><div className="text-xs text-muted-foreground">{p.unit}</div></div></div></td>
                <td className="p-3 text-xs">{CATEGORIES.find((c) => c.slug === p.category)?.name ?? p.category}</td>
                <td className="p-3">
                  <input type="number" defaultValue={p.price} onBlur={(e) => { const v = Number(e.target.value); if (v !== p.price) { setPrice(p.id, v); toast.success(`${p.name} → ${formatINR(v)}`); } }} className="w-24 rounded-md border border-input bg-background px-2 py-1 outline-none focus:ring-2 focus:ring-ring" />
                </td>
                <td className="p-3">
                  <input type="number" defaultValue={p.stock} onBlur={(e) => { const v = Number(e.target.value); if (v !== p.stock) { setStock(p.id, v); toast.success(`${p.name} stock → ${v}`); } }} className="w-20 rounded-md border border-input bg-background px-2 py-1 outline-none focus:ring-2 focus:ring-ring" />
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => setEditing(p)} className="mr-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-secondary"><Pencil className="h-3 w-3" /> Edit</button>
                  <button onClick={() => { if (confirm(`Delete "${p.name}" from your inventory?`)) { remove(p.id); toast.success(`${p.name} is deleted from your inventory`); } }} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /> Delete</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">No items yet. Add your first item.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="space-y-3 md:hidden">
        {list.map((p) => (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              {p.image ? <img src={p.image} alt={p.name} loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-secondary text-xl">{p.emoji}</span>}
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{CATEGORIES.find((c) => c.slug === p.category)?.name ?? p.category} · {p.unit}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Price (₹)</span>
                <input type="number" defaultValue={p.price} onBlur={(e) => { const v = Number(e.target.value); if (v !== p.price) { setPrice(p.id, v); toast.success(`${p.name} → ${formatINR(v)}`); } }} className="w-full rounded-md border border-input bg-background px-2 py-1.5 outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Stock</span>
                <input type="number" defaultValue={p.stock} onBlur={(e) => { const v = Number(e.target.value); if (v !== p.stock) { setStock(p.id, v); toast.success(`${p.name} stock → ${v}`); } }} className="w-full rounded-md border border-input bg-background px-2 py-1.5 outline-none focus:ring-2 focus:ring-ring" />
              </label>
            </div>
            <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
              <button onClick={() => setEditing(p)} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"><Pencil className="h-3 w-3" /> Edit</button>
              <button onClick={() => { if (confirm(`Delete "${p.name}" from your inventory?`)) { remove(p.id); toast.success(`${p.name} is deleted from your inventory`); } }} className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /> Delete</button>
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No items yet. Add your first item.</div>
        )}
      </div>

      {editing && (
        <ItemEditor
          product={editing}
          categories={myCategories}
          onClose={() => setEditing(null)}
          onSave={(p) => { upsert(p); setEditing(null); toast.success("Item saved"); }}
        />
      )}
    </div>
  );
}
