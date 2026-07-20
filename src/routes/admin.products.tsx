import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useCatalog } from "@/lib/store";
import { CATEGORIES, formatINR, type Product } from "@/lib/data";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ImagePicker } from "@/components/ImagePicker";

export const Route = createFileRoute("/admin/products")({ component: ProductsAdmin });

const EMPTY: Product = { id: "", name: "", category: "snacks", price: 0, unit: "", stock: 0, emoji: "🛒", description: "" };

function ProductsAdmin() {
  const { products, upsert, remove } = useCatalog();
  const [editing, setEditing] = useState<Product | null>(null);
  const [filter, setFilter] = useState("");

  const list = products.filter(p =>
    !filter || p.name.toLowerCase().includes(filter.toLowerCase()) || p.category.includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">{products.length} items in catalogue</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search..." className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring sm:flex-none" />
          <button onClick={() => setEditing({ ...EMPTY, id: `p${Date.now()}` })} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New product
          </button>
        </div>
      </div>

      {/* Desktop / laptop: table */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Category</th>
              <th className="p-3">Price</th>
              <th className="p-3">Stock</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.map(p => (
              <tr key={p.id} className="hover:bg-secondary/50">
                <td className="p-3"><div className="flex items-center gap-3">{p.image ? <img src={p.image} alt={p.name} loading="lazy" className="h-12 w-12 rounded-lg object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-lg bg-secondary text-xl">{p.emoji}</span>}<div><div className="font-semibold">{p.name}</div><div className="text-xs text-muted-foreground">{p.unit}</div></div></div></td>
                <td className="p-3">{CATEGORIES.find(c => c.slug === p.category)?.name ?? p.category}</td>
                <td className="p-3 font-display font-bold">{formatINR(p.price)}</td>
                <td className="p-3"><span className={`rounded-md px-2 py-0.5 text-xs font-bold ${p.stock === 0 ? "bg-destructive/15 text-destructive" : p.stock <= 5 ? "bg-saffron/30" : "bg-primary/10 text-primary"}`}>{p.stock}</span></td>
                <td className="p-3 text-right">
                  <button onClick={() => setEditing(p)} className="mr-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-secondary"><Pencil className="h-3 w-3" /> Edit</button>
                  <button onClick={() => { if (confirm(`Delete ${p.name}?`)) { remove(p.id); toast.success("Product removed"); } }} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /> Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="space-y-3 md:hidden">
        {list.map(p => (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              {p.image ? <img src={p.image} alt={p.name} loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-secondary text-xl">{p.emoji}</span>}
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{CATEGORIES.find(c => c.slug === p.category)?.name ?? p.category} · {p.unit}</div>
              </div>
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${p.stock === 0 ? "bg-destructive/15 text-destructive" : p.stock <= 5 ? "bg-saffron/30" : "bg-primary/10 text-primary"}`}>{p.stock}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
              <div className="font-display font-bold">{formatINR(p.price)}</div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(p)} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"><Pencil className="h-3 w-3" /> Edit</button>
                <button onClick={() => { if (confirm(`Delete ${p.name}?`)) { remove(p.id); toast.success("Product removed"); } }} className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /> Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <ProductEditor
          product={editing}
          onClose={() => setEditing(null)}
          onSave={(p) => { upsert(p); setEditing(null); toast.success("Product saved"); }}
        />
      )}
    </div>
  );
}

function ProductEditor({ product, onSave, onClose }: { product: Product; onSave: (p: Product) => void; onClose: () => void }) {
  const [p, setP] = useState<Product>(product);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-pop" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{product.name ? "Edit product" : "New product"}</h2>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <input value={p.emoji} onChange={e => setP({ ...p, emoji: e.target.value })} placeholder="🛒" className="rounded-lg border border-input bg-background px-3 py-2 text-center text-2xl outline-none" />
            <input value={p.name} onChange={e => setP({ ...p, name: e.target.value })} placeholder="Product name" className="rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <select value={p.category} onChange={e => setP({ ...p, category: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 outline-none">
            {CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <input value={p.unit} onChange={e => setP({ ...p, unit: e.target.value })} placeholder="Unit (e.g. 250g jar)" className="rounded-lg border border-input bg-background px-3 py-2 outline-none" />
          <div className="grid grid-cols-3 gap-3">
            <NumField label="Price ₹" value={p.price} onChange={v => setP({ ...p, price: v })} />
            <NumField label="MRP ₹" value={p.mrp ?? 0} onChange={v => setP({ ...p, mrp: v })} />
            <NumField label="Stock" value={p.stock} onChange={v => setP({ ...p, stock: v })} />
          </div>
          <textarea value={p.description} onChange={e => setP({ ...p, description: e.target.value })} rows={3} placeholder="Description" className="rounded-lg border border-input bg-background px-3 py-2 outline-none" />
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
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
    </label>
  );
}
