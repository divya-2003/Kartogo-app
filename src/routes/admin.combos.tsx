import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Layers, Plus, Pencil, Trash2, X, Power, Loader2 } from "lucide-react";
import { listAllCombosFn, upsertComboFn, deleteComboFn, type Combo, type ComboItem } from "@/lib/combos.functions";
import { useCatalog } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { ImagePicker } from "@/components/ImagePicker";

export const Route = createFileRoute("/admin/combos")({
  component: () => <CombosManager mode="admin" />,
  head: () => ({ meta: [{ title: "Combo bundles — Kartogo Admin" }] }),
});

function adminToken(): string | null {
  try { return JSON.parse(localStorage.getItem("qk_admin_token") || "null"); } catch { return null; }
}
function supplierToken(): string | null {
  try { return JSON.parse(localStorage.getItem("qk_supplier_token") || "null"); } catch { return null; }
}

export function CombosManager({ mode }: { mode: "admin" | "supplier" }) {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Combo | null>(null);
  const [creating, setCreating] = useState(false);

  const token = () => mode === "admin" ? adminToken() : supplierToken();
  const tokenArg = () => mode === "admin" ? { adminToken: token()! } : { supplierToken: token()! };

  const load = async () => {
    if (!token()) return;
    setLoading(true);
    try {
      const rows = await listAllCombosFn({ data: tokenArg() });
      setCombos(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const toggleActive = async (c: Combo) => {
    try {
      await upsertComboFn({ data: {
        ...tokenArg(), id: c.id, name: c.name, description: c.description,
        image: c.image, emoji: c.emoji, price: c.price, items: c.items,
        category: c.category, isActive: !c.isActive,
      }});
      toast.success(!c.isActive ? "Combo activated" : "Combo deactivated");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const remove = async (c: Combo) => {
    if (!confirm(`Remove combo "${c.name}"?`)) return;
    try {
      await deleteComboFn({ data: { ...tokenArg(), id: c.id } });
      toast.success("Removed");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-1">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <Layers className="h-6 w-6 text-primary" /> Combo bundles
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bundle a few items at a single combo price for customers.
          </p>
        </div>
        <button onClick={() => { setEditing(null); setCreating(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add combo
        </button>
      </header>

      {loading ? (
        <div className="grid place-items-center py-10 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : combos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No combos yet. Create your first bundle to get started.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {combos.map(c => (
            <li key={c.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary text-2xl">
                  {c.image ? <img src={c.image} alt={c.name} className="h-full w-full object-cover" /> : (c.emoji || "🎁")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-display text-base font-bold">{c.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${c.isActive ? "bg-leaf/15 text-leaf" : "bg-muted text-muted-foreground"}`}>
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-sm font-bold text-primary">{formatINR(c.price)}</div>
                  {c.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>}
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {c.items.map(it => (
                      <li key={it.productId} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold">
                        {it.name} × {it.qty}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => { setEditing(c); setCreating(false); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button onClick={() => toggleActive(c)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
                  <Power className="h-3.5 w-3.5" /> {c.isActive ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => remove(c)}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/15">
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <ComboEditor
          initial={editing}
          mode={mode}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </div>
  );
}

function ComboEditor({ initial, mode, onClose, onSaved }: {
  initial: Combo | null; mode: "admin" | "supplier"; onClose: () => void; onSaved: () => void;
}) {
  const { products } = useCatalog();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "🎁");
  const [image, setImage] = useState<string | undefined>(initial?.image ?? undefined);
  const [price, setPrice] = useState<string>(initial?.price != null ? String(initial.price) : "");
  const [items, setItems] = useState<ComboItem[]>(initial?.items ?? []);
  const [saving, setSaving] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  const matches = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const list = products;
    if (!q) return list.slice(0, 8);
    return list.filter((p) => p.name.toLowerCase().includes(q) || p.id.includes(q)).slice(0, 8);
  }, [pickerQuery, products]);

  const addItem = (id: string, itemName: string) => {
    setItems(prev => {
      const ex = prev.find(i => i.productId === id);
      return ex ? prev.map(i => i.productId === id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { productId: id, name: itemName, qty: 1 }];
    });
  };
  const setQty = (id: string, q: number) => {
    setItems(prev => q <= 0 ? prev.filter(i => i.productId !== id) : prev.map(i => i.productId === id ? { ...i, qty: q } : i));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = mode === "admin" ? adminToken() : supplierToken();
    if (!t) { toast.error("Session expired"); return; }
    if (!name.trim()) { toast.error("Name is required"); return; }
    const priceN = Number(price);
    if (!Number.isFinite(priceN) || priceN <= 0) { toast.error("Enter a valid combo price"); return; }
    if (items.length === 0) { toast.error("Add at least one item"); return; }
    setSaving(true);
    try {
      const auth = mode === "admin" ? { adminToken: t } : { supplierToken: t };
      await upsertComboFn({ data: {
        ...auth, id: initial?.id, name: name.trim(),
        description: description.trim() || null,
        image: image ?? null, emoji: emoji || null,
        price: priceN, items,
        category: null, isActive: initial?.isActive ?? true,
      }});
      toast.success(initial ? "Combo updated" : "Combo added");
      onSaved();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-t-2xl bg-card shadow-pop md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-display text-lg font-bold">{initial ? "Edit combo" : "Add combo"}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={save} className="max-h-[80vh] space-y-3 overflow-y-auto p-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Breakfast Combo"
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="grid grid-cols-[80px_1fr] gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Emoji</label>
              <input value={emoji} onChange={e => setEmoji(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-center text-lg outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Combo price (₹)</label>
              <input value={price} onChange={e => setPrice(e.target.value)} inputMode="numeric" placeholder="e.g. 199"
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Description (optional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>

          {/* Combo photo — mirrored onto the catalogue card customers see. */}
          <ImagePicker value={image} onChange={setImage} />


          <div className="rounded-xl border border-border bg-secondary/40 p-3">
            <div className="font-display text-sm font-bold">Items in this combo</div>
            {items.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">No items yet — add from the picker below.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {items.map(it => (
                  <li key={it.productId} className="flex items-center gap-2 rounded-lg bg-background px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{it.name}</span>
                    <button type="button" onClick={() => setQty(it.productId, it.qty - 1)}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-border hover:bg-secondary">−</button>
                    <span className="w-6 text-center text-sm font-bold">{it.qty}</span>
                    <button type="button" onClick={() => setQty(it.productId, it.qty + 1)}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-border hover:bg-secondary">+</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <input value={pickerQuery} onChange={e => setPickerQuery(e.target.value)}
                placeholder="Search catalog to add"
                className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none" />
              {matches.length > 0 && (
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                  {matches.map(p => (
                    <li key={p.id}>
                      <button type="button" onClick={() => addItem(p.id, p.name)}
                        className="flex w-full items-center justify-between rounded-lg bg-background px-2 py-1.5 text-left text-xs hover:bg-secondary">
                        <span className="truncate">{p.name}</span>
                        <span className="ml-2 shrink-0 text-muted-foreground">{formatINR(p.price)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary">Cancel</button>
            <button disabled={saving}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {saving ? "Saving…" : initial ? "Save changes" : "Add combo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
