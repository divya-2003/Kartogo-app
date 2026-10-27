import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { CATEGORIES } from "@/lib/data";
import type { Product } from "@/lib/data";
import { MultiImagePicker } from "@/components/ImagePicker";

/**
 * Shared "new / edit item" dialog used by both the supplier inventory and the
 * admin inventory. Whatever is saved here goes straight to the shared server
 * catalog, so a new item (with its picture) shows up for admins and customers
 * as well.
 */
export function ItemEditor({
  product,
  categories,
  onSave,
  onClose,
  requireDetails = false,
}: {
  product: Product;
  categories: typeof CATEGORIES;
  onSave: (p: Product) => void;
  onClose: () => void;
  /** Sellers must give a description, at least one photo and an expiry date (or mark it as non-expiring). */
  requireDetails?: boolean;
}) {
  const [p, setP] = useState<Product>(product);
  const [noExpiry, setNoExpiry] = useState(!!product.id && !!product.name && !product.expiryDate);
  const today = new Date().toISOString().slice(0, 10);
  const save = () => {
    if (!p.name.trim() || !p.unit.trim()) { toast.error("Name & unit required"); return; }
    if (requireDetails) {
      if (p.description.trim().length < 10) { toast.error("Add a product description (at least 10 characters)"); return; }
      if (!(p.images?.length || p.image)) { toast.error("Add at least one product photo"); return; }
      if (!noExpiry && !p.expiryDate) { toast.error("Add the expiry date, or tick \"Doesn't expire\""); return; }
    }
    if (p.expiryDate && !noExpiry && p.expiryDate < today) { toast.error("Expiry date is already past"); return; }
    onSave({ ...p, expiryDate: noExpiry ? undefined : p.expiryDate });
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-pop" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{product.name ? "Edit item" : "New item"}</h2>
          <button onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
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
          <label className="block">
            <div className="mb-1 text-xs font-semibold text-muted-foreground">Max per customer / order (0 = no limit)</div>
            <input
              type="number"
              min={0}
              value={p.maxPerOrder ?? 0}
              onChange={(e) => { const v = Math.max(0, Math.floor(Number(e.target.value) || 0)); setP({ ...p, maxPerOrder: v || undefined }); }}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <MultiImagePicker
            value={p.images ?? (p.image ? [p.image] : [])}
            onChange={(imgs) => setP({ ...p, images: imgs, image: imgs[0] })}
          />
          <label className="block">
            <div className="mb-1 text-xs font-semibold text-muted-foreground">Description{requireDetails ? " *" : ""}</div>
            <textarea value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} rows={3} maxLength={2000} placeholder="What it is, ingredients or material, how to use, pack contents…" className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <div>
            <div className="mb-1 text-xs font-semibold text-muted-foreground">Expiry / best before{requireDetails ? " *" : ""}</div>
            <div className="flex items-center gap-3">
              <input type="date" min={today} disabled={noExpiry} value={noExpiry ? "" : p.expiryDate ?? ""} onChange={(e) => setP({ ...p, expiryDate: e.target.value || undefined })} aria-label="Expiry date" className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
              <label className="flex shrink-0 items-center gap-2 text-sm"><input type="checkbox" checked={noExpiry} onChange={(e) => setNoExpiry(e.target.checked)} /> Doesn't expire</label>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">Cancel</button>
          <button onClick={save} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Save</button>
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
