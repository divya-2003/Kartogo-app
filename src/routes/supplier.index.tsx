import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useCatalog } from "@/lib/store";
import { CATEGORIES, formatINR, type Product } from "@/lib/data";
import { useSupplier } from "@/lib/supplier-context";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
                  <button onClick={() => { if (confirm(`Delete ${p.name}?`)) { remove(p.id); toast.success("Item removed"); } }} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /> Delete</button>
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
              <button onClick={() => { if (confirm(`Delete ${p.name}?`)) { remove(p.id); toast.success("Item removed"); } }} className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /> Delete</button>
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

function ItemEditor({ product, categories, onSave, onClose }: { product: Product; categories: typeof CATEGORIES; onSave: (p: Product) => void; onClose: () => void }) {
  const [p, setP] = useState<Product>(product);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-pop" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{product.name ? "Edit item" : "New item"}</h2>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3">
          <div className="grid grid-cols-[64px_80px_1fr] gap-3">
            <div className="grid h-full w-16 place-items-center overflow-hidden rounded-lg border border-border bg-secondary">
              {p.image ? (
                <img src={p.image} alt={p.name || "preview"} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl">{p.emoji || "🛒"}</span>
              )}
            </div>
            <input value={p.emoji} onChange={(e) => setP({ ...p, emoji: e.target.value })} placeholder="🛒" className="rounded-lg border border-input bg-background px-3 py-2 text-center text-2xl outline-none" />
            <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="Item name" className="min-w-0 rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <select value={p.category} onChange={(e) => setP({ ...p, category: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 outline-none">
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <input value={p.unit} onChange={(e) => setP({ ...p, unit: e.target.value })} placeholder="Unit (e.g. 250g jar)" className="rounded-lg border border-input bg-background px-3 py-2 outline-none" />
          <div className="grid grid-cols-3 gap-3">
            <NumField label="Price ₹" value={p.price} onChange={(v) => setP({ ...p, price: v })} />
            <NumField label="MRP ₹" value={p.mrp ?? 0} onChange={(v) => setP({ ...p, mrp: v })} />
            <NumField label="Stock" value={p.stock} onChange={(v) => setP({ ...p, stock: v })} />
          </div>
          <ImagePicker value={p.image} onChange={(v) => setP({ ...p, image: v })} />
          <textarea value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} rows={3} placeholder="Description" className="rounded-lg border border-input bg-background px-3 py-2 outline-none" />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">Cancel</button>
          <button onClick={() => { if (!p.name || !p.unit) { toast.error("Name & unit required"); return; } onSave(p); }} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Save</button>
        </div>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold text-muted-foreground">{label}</div>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
    </label>
  );
}
