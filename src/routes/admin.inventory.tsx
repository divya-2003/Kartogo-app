import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, X, Plus, Pencil } from "lucide-react";
import { useCatalog } from "@/lib/store";
import { CATEGORIES, formatINR, type Product } from "@/lib/data";
import { ItemEditor } from "@/components/ItemEditor";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/inventory")({ component: InventoryAdmin });

const EMPTY: Product = { id: "", name: "", category: CATEGORIES[0]?.slug ?? "snacks", price: 0, unit: "", stock: 0, emoji: "🛒", description: "" };

function InventoryAdmin() {
  const { products: allProducts, setPrice, setStock, upsert } = useCatalog();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);

  // Search across name, unit and category so the admin can jump straight to an
  // item instead of scrolling the whole catalogue.
  const products = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return allProducts;
    return allProducts.filter(p => {
      const cat = CATEGORIES.find(c => c.slug === p.category)?.name ?? p.category;
      return `${p.name} ${p.unit} ${cat}`.toLowerCase().includes(term);
    });
  }, [allProducts, q]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Inventory & prices</h1>
          <p className="text-sm text-muted-foreground">Quick edit — changes save instantly.</p>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY, id: `p${Date.now()}` })}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New item
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-xl border border-input bg-background px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search products, units or categories…"
            aria-label="Search inventory"
            className="w-full bg-transparent text-sm outline-none"
          />
          {q && (
            <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="grid h-6 w-6 place-items-center rounded-full hover:bg-secondary">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <span className="text-xs font-semibold text-muted-foreground">{products.length} of {allProducts.length} items</span>
      </div>

      {editing && (
        <ItemEditor
          product={editing}
          categories={CATEGORIES}
          onClose={() => setEditing(null)}
          onSave={(p) => { upsert(p); setEditing(null); toast.success("Item saved"); }}
        />
      )}


      {products.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
          No products match "{q}".
        </div>
      )}
      {/* Desktop / laptop: table */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="p-3">Product</th><th className="p-3">Category</th><th className="p-3 w-32">Price (₹)</th><th className="p-3 w-32">Stock</th><th className="p-3">Status</th><th className="p-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-secondary/50">
                <td className="p-3"><div className="flex items-center gap-2">{p.image ? <img src={p.image} alt={p.name} loading="lazy" className="h-10 w-10 rounded-lg object-cover" /> : <span className="text-xl">{p.emoji}</span>}<div><div className="font-semibold">{p.name}</div><div className="text-xs text-muted-foreground">{p.unit}</div></div></div></td>
                <td className="p-3 text-xs">{CATEGORIES.find(c => c.slug === p.category)?.name ?? p.category}</td>
                <td className="p-3">
                  <input type="number" defaultValue={p.price} onBlur={(e) => { const v = Number(e.target.value); if (v !== p.price) { setPrice(p.id, v); toast.success(`${p.name} → ${formatINR(v)}`); } }} className="w-24 rounded-md border border-input bg-background px-2 py-1 outline-none focus:ring-2 focus:ring-ring" />
                </td>
                <td className="p-3">
                  <input type="number" defaultValue={p.stock} onBlur={(e) => { const v = Number(e.target.value); if (v !== p.stock) { setStock(p.id, v); toast.success(`${p.name} stock → ${v}`); } }} className="w-24 rounded-md border border-input bg-background px-2 py-1 outline-none focus:ring-2 focus:ring-ring" />
                </td>
                <td className="p-3"><span className={`rounded-md px-2 py-0.5 text-xs font-bold ${p.stock === 0 ? "bg-destructive/15 text-destructive" : p.stock <= 5 ? "bg-saffron/30" : "bg-primary/10 text-primary"}`}>{p.stock === 0 ? "Out" : p.stock <= 5 ? "Low" : "OK"}</span></td>
                <td className="p-3 text-right"><button onClick={() => setEditing(p)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-secondary"><Pencil className="h-3 w-3" /> Edit</button></td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="space-y-3 md:hidden">
        {products.map(p => (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {p.image ? <img src={p.image} alt={p.name} loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <span className="shrink-0 text-xl">{p.emoji}</span>}
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{CATEGORIES.find(c => c.slug === p.category)?.name ?? p.category} · {p.unit}</div>
                </div>
              </div>
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${p.stock === 0 ? "bg-destructive/15 text-destructive" : p.stock <= 5 ? "bg-saffron/30" : "bg-primary/10 text-primary"}`}>{p.stock === 0 ? "Out" : p.stock <= 5 ? "Low" : "OK"}</span>
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
            <button onClick={() => setEditing(p)} className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-border py-2 text-xs font-bold hover:bg-secondary"><Pencil className="h-3 w-3" /> Edit details & picture</button>

          </div>
        ))}
      </div>
    </div>
  );
}
