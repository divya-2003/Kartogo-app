import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BadgePercent, Plus, Save, Trash2, Search, Eye, Loader2 } from "lucide-react";
import { useAuth, useCatalog } from "@/lib/store";
import { CATEGORIES } from "@/lib/data";
import {
  listAllOffersFn, saveOfferFn, deleteOfferFn,
  OFFER_TONES, type ProductOffer, type OfferTone,
} from "@/lib/offers.functions";

export const Route = createFileRoute("/admin/offers")({ component: OffersAdmin });

// Tone → the exact classes the customer product page renders, so the admin
// preview below is pixel-identical to what shoppers will see.
export const TONE_CLASS: Record<OfferTone, { wrap: string; badge: string; title: string }> = {
  primary: { wrap: "border-primary/30 bg-primary/5", badge: "bg-primary text-primary-foreground", title: "text-primary" },
  leaf: { wrap: "border-leaf/30 bg-leaf/10", badge: "bg-leaf text-background", title: "text-leaf" },
  saffron: { wrap: "border-saffron/40 bg-saffron/15", badge: "bg-saffron text-saffron-foreground", title: "text-saffron-foreground" },
  destructive: { wrap: "border-destructive/30 bg-destructive/10", badge: "bg-destructive text-destructive-foreground", title: "text-destructive" },
  ink: { wrap: "border-border bg-secondary", badge: "bg-foreground text-background", title: "text-foreground" },
};

const TONE_LABEL: Record<OfferTone, string> = {
  primary: "Brand", leaf: "Green", saffron: "Saffron", destructive: "Red", ink: "Ink",
};

type Draft = Omit<ProductOffer, "id"> & { id: string | null };

const EMPTY: Draft = {
  id: null, title: "", description: "", badge: "", tone: "primary",
  appliesToAll: false, productIds: [], isActive: true, sortOrder: 0,
};

export function OfferCard({ offer }: { offer: Pick<ProductOffer, "title" | "description" | "badge" | "tone"> }) {
  const t = TONE_CLASS[offer.tone] ?? TONE_CLASS.primary;
  return (
    <div className={`rounded-2xl border p-4 ${t.wrap}`}>
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-background/70">
          <BadgePercent className={`h-5 w-5 ${t.title}`} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`font-display text-sm font-extrabold ${t.title}`}>{offer.title || "Offer title"}</span>
            {offer.badge && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${t.badge}`}>{offer.badge}</span>
            )}
          </div>
          {offer.description && <p className="mt-1 text-xs text-muted-foreground">{offer.description}</p>}
        </div>
      </div>
    </div>
  );
}

function OffersAdmin() {
  const { adminToken } = useAuth();
  const { products } = useCatalog();
  const [offers, setOffers] = useState<ProductOffer[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  const load = async () => {
    if (!adminToken) return;
    setLoading(true);
    try { setOffers(await listAllOffersFn({ data: { adminToken } })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not load offers"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [adminToken]);

  const filtered = useMemo(
    () => products
      .filter(p => cat === "all" || p.category === cat)
      .filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 200),
    [products, q, cat],
  );

  const selected = new Set(draft.productIds);
  const toggleProduct = (id: string) =>
    setDraft(d => ({
      ...d,
      productIds: d.productIds.includes(id) ? d.productIds.filter(x => x !== id) : [...d.productIds, id],
    }));

  const save = async () => {
    if (!adminToken) return;
    if (draft.title.trim().length < 2) { toast.error("Give this offer a title"); return; }
    if (!draft.appliesToAll && draft.productIds.length === 0) {
      toast.error("Pick at least one product, or switch on 'All products'"); return;
    }
    setSaving(true);
    try {
      await saveOfferFn({ data: { adminToken, offer: { ...draft, id: draft.id ?? undefined } } });
      toast.success("Saved — every customer page is updated");
      setDraft(EMPTY);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!adminToken) return;
    try {
      await deleteOfferFn({ data: { adminToken, id } });
      toast.success("Offer removed");
      if (draft.id === id) setDraft(EMPTY);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete"); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">Additional offers</h1>
        <p className="text-sm text-muted-foreground">
          Design an offer, choose the products it applies to and save — it appears instantly on every customer's product page.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Editor */}
        <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Offer title
              <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                placeholder="Buy 2 get 1 free"
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:ring-2 focus:ring-ring" />
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Badge (optional)
              <input value={draft.badge} onChange={e => setDraft(d => ({ ...d, badge: e.target.value }))}
                placeholder="SAVE 20%"
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:ring-2 focus:ring-ring" />
            </label>
          </div>

          <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Description
            <textarea rows={2} value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
              placeholder="Applies automatically at checkout on selected packs."
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:ring-2 focus:ring-ring" />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Colour</span>
            {OFFER_TONES.map(t => (
              <button key={t} type="button" onClick={() => setDraft(d => ({ ...d, tone: t }))}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold ${TONE_CLASS[t].badge} ${draft.tone === t ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : "opacity-70"}`}>
                {TONE_LABEL[t]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={draft.appliesToAll}
                onChange={e => setDraft(d => ({ ...d, appliesToAll: e.target.checked }))} />
              All products
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={draft.isActive}
                onChange={e => setDraft(d => ({ ...d, isActive: e.target.checked }))} />
              Live for customers
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              Order
              <input type="number" min={0} max={999} value={draft.sortOrder}
                onChange={e => setDraft(d => ({ ...d, sortOrder: Number(e.target.value) || 0 }))}
                className="w-16 rounded-lg border border-input bg-background px-2 py-1 text-sm" />
            </label>
          </div>

          {/* Product picker */}
          {!draft.appliesToAll && (
            <div className="rounded-2xl border border-border">
              <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-background px-2 py-1.5">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products"
                    className="w-full bg-transparent text-sm outline-none" />
                </div>
                <select value={cat} onChange={e => setCat(e.target.value)}
                  className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm">
                  <option value="all">All categories</option>
                  {CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                  {draft.productIds.length} selected
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto p-2">
                {filtered.map(p => (
                  <label key={p.id} className={`flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-secondary ${selected.has(p.id) ? "bg-primary/5" : ""}`}>
                    <input type="checkbox" className="h-4 w-4 accent-primary" checked={selected.has(p.id)} onChange={() => toggleProduct(p.id)} />
                    <span className="text-lg">{p.emoji}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                    <span className="text-xs text-muted-foreground">₹{p.price}</span>
                  </label>
                ))}
                {filtered.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">No products match.</div>}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => void save()} disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
            </button>
            {draft.id && (
              <button onClick={() => setDraft(EMPTY)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:bg-secondary">
                Cancel edit
              </button>
            )}
            <button onClick={() => setDraft(EMPTY)} className="inline-flex items-center gap-1 rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:bg-secondary">
              <Plus className="h-4 w-4" /> New offer
            </button>
          </div>
        </section>

        {/* Live preview */}
        <aside className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <Eye className="h-4 w-4" /> Live preview
          </div>
          <div className="rounded-2xl border border-dashed border-border bg-card p-3">
            <div className="mb-2 font-display text-sm font-extrabold">Additional offers</div>
            <OfferCard offer={draft} />
          </div>
          <p className="text-xs text-muted-foreground">
            {draft.appliesToAll
              ? "Shows on every product page."
              : `Shows on ${draft.productIds.length} selected product page${draft.productIds.length === 1 ? "" : "s"}.`}
          </p>
        </aside>
      </div>

      {/* Existing offers */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">All offers ({offers.length})</h2>
        {loading ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : offers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No offers yet.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {offers.map(o => (
              <div key={o.id} className="space-y-2 rounded-2xl border border-border bg-card p-3">
                <OfferCard offer={o} />
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-bold ${o.isActive ? "bg-leaf/15 text-leaf" : "bg-muted text-muted-foreground"}`}>
                    {o.isActive ? "Live" : "Paused"}
                  </span>
                  <span className="text-muted-foreground">
                    {o.appliesToAll ? "All products" : `${o.productIds.length} product${o.productIds.length === 1 ? "" : "s"}`}
                  </span>
                  <button onClick={() => setDraft({ ...o })} className="ml-auto rounded-lg border border-border px-3 py-1 font-bold hover:bg-secondary">Edit</button>
                  <button onClick={() => void remove(o.id)} className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-3 py-1 font-bold text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
