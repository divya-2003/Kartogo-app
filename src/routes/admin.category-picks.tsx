import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, useCatalog } from "@/lib/store";
import { listMpCategoriesFn, listCategoryFn } from "@/lib/marketplace.functions";
import { listCategoryRanksFn, saveCategoryRanksFn } from "@/lib/category-ranks.functions";
import { listingRef, rankLabel, MAX_RANK } from "@/lib/category-ranks";
import { sectionCategories } from "@/lib/home-sections";
import { SUPPLIERS } from "@/lib/suppliers";
import { formatINR } from "@/lib/data";
import type { MpCategory, MpListing } from "@/lib/marketplace";

export const Route = createFileRoute("/admin/category-picks")({
  component: CategoryPicksPage,
  head: () => ({
    meta: [
      { title: "Category top picks — Kartogo admin" },
      { name: "description", content: "Choose which partner seller products show 1st, 2nd and 3rd in each Shop category." },
    ],
  }),
});

type Candidate = { ref: string; name: string; seller: string; price: number };

function CategoryPicksPage() {
  const { adminToken } = useAuth();
  const { products } = useCatalog();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["mp-cats"], queryFn: () => listMpCategoriesFn(), staleTime: 5 * 60_000 });
  const ranks = useQuery({ queryKey: ["category-ranks"], queryFn: () => listCategoryRanksFn() });
  const shopCats = sectionCategories((cats.data?.categories ?? []) as MpCategory[], "shop");
  const [slug, setSlug] = useState("");
  useEffect(() => { if (!slug && shopCats[0]) setSlug(shopCats[0].slug); }, [slug, shopCats]);
  const cat = shopCats.find(c => c.slug === slug);
  const listing = useQuery({ queryKey: ["mp-category", slug], queryFn: () => listCategoryFn({ data: { slug } }), enabled: !!slug });

  const candidates = useMemo<Candidate[]>(() => {
    if (!cat) return [];
    const seen = new Set<string>();
    const fromCatalog = products.filter(p => cat.legacy_categories?.includes(p.category) && !seen.has(p.id) && seen.add(p.id)).map(p => ({
      ref: p.id, name: p.name, price: p.price,
      seller: p.sellerName ?? SUPPLIERS.find(s => s.categories.includes(p.category))?.name ?? "Kartogo",
    }));
    const fromStores = ((listing.data?.listings ?? []) as MpListing[]).map(l => ({
      ref: listingRef(l.id), name: l.name, price: Number(l.price ?? l.starting_price ?? 0), seller: l.partner?.name ?? "Local store",
    }));
    return [...fromCatalog, ...fromStores].sort((a, b) => a.seller.localeCompare(b.seller) || a.name.localeCompare(b.name));
  }, [cat, products, listing.data]);
  const bySeller = useMemo(() => {
    const m = new Map<string, Candidate[]>();
    for (const c of candidates) m.set(c.seller, [...(m.get(c.seller) ?? []), c]);
    return [...m.entries()];
  }, [candidates]);

  const saved = useMemo(() => {
    const out: string[] = Array(MAX_RANK).fill("");
    for (const r of ranks.data ?? []) if (r.category_slug === slug && r.rank <= MAX_RANK) out[r.rank - 1] = r.product_ref;
    return out;
  }, [ranks.data, slug]);
  const [picks, setPicks] = useState<string[]>(saved);
  useEffect(() => { setPicks(saved); }, [saved]);
  const [busy, setBusy] = useState(false);
  const dirty = picks.join("|") !== saved.join("|");
  const nameOf = (ref: string) => candidates.find(c => c.ref === ref);

  const save = async (next: string[]) => {
    if (!adminToken) return;
    setBusy(true);
    try {
      await saveCategoryRanksFn({ data: { adminToken, categorySlug: slug, picks: next.map(p => p || null) } });
      await qc.invalidateQueries({ queryKey: ["category-ranks"] });
      toast.success(`Top picks saved for ${cat?.name ?? "this category"}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Category top picks</h1>
        <p className="text-sm text-muted-foreground">Choose which partner seller's products customers see 1st, 2nd and 3rd inside each Shop category.</p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Shop categories">
        {shopCats.map(c => {
          const count = (ranks.data ?? []).filter(r => r.category_slug === c.slug).length;
          return (
            <button key={c.slug} role="tab" aria-selected={slug === c.slug} onClick={() => setSlug(c.slug)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${slug === c.slug ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
              <span>{c.icon}</span>{c.name}{count > 0 && <span className={`rounded-full px-1.5 text-[10px] ${slug === c.slug ? "bg-primary-foreground text-primary" : "bg-secondary"}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {cat && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold"><Trophy className="h-5 w-5 text-saffron" />{cat.name}</div>
          {listing.isLoading ? <p className="text-sm text-muted-foreground">Loading products…</p> : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No products in this category yet.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {Array.from({ length: MAX_RANK }).map((_, i) => (
                  <label key={i} className="flex flex-col gap-1">
                    <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{rankLabel(i + 1)} position</span>
                    <select value={picks[i] ?? ""} onChange={e => setPicks(p => p.map((v, j) => (j === i ? e.target.value : v === e.target.value ? "" : v)))}
                      className="h-10 rounded-md border border-input bg-background px-2 text-sm">
                      <option value="">— Not set —</option>
                      {bySeller.map(([seller, items]) => (
                        <optgroup key={seller} label={seller}>
                          {items.map(c => <option key={c.ref} value={c.ref}>{c.name} · {formatINR(c.price)}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    {picks[i] && nameOf(picks[i]) && <span className="text-xs text-muted-foreground">Seller: {nameOf(picks[i])!.seller}</span>}
                  </label>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button onClick={() => void save(picks)} disabled={busy || !dirty} className="gap-1.5"><Save className="h-4 w-4" />Save top picks</Button>
                <Button variant="outline" onClick={() => { setPicks(Array(MAX_RANK).fill("")); void save([]); }} disabled={busy || saved.every(s => !s)} className="gap-1.5"><X className="h-4 w-4" />Clear</Button>
                {dirty && <span className="text-xs font-semibold text-muted-foreground">Unsaved changes</span>}
              </div>
            </>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 font-display text-base font-extrabold">What customers see first</div>
        <ul className="divide-y divide-border text-sm">
          {shopCats.map(c => {
            const rows = (ranks.data ?? []).filter(r => r.category_slug === c.slug);
            return (
              <li key={c.slug} className="flex flex-wrap items-center gap-2 py-2">
                <span className="w-32 shrink-0 font-semibold">{c.icon} {c.name}</span>
                {rows.length ? rows.map(r => (
                  <span key={r.rank} className="rounded-full bg-secondary px-2.5 py-1 text-xs"><b>{rankLabel(r.rank)}</b> {c.slug === slug ? nameOf(r.product_ref)?.name ?? r.product_ref : (products.find(p => p.id === r.product_ref)?.name ?? (r.product_ref.startsWith("mp:") ? "Store product" : r.product_ref))}</span>
                )) : <span className="text-xs text-muted-foreground">Normal order</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
