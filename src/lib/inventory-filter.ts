import type { Product } from "@/lib/data";

/** Stock buckets used by the admin inventory filter. Low = 1–5 left, matching the dashboard alerts. */
export type StockFilter = "all" | "out" | "low" | "ok";

export type InventoryFilter = {
  q: string;
  stockFilter: StockFilter;
  /** Optional stock-number range, as typed (blank = no limit). */
  min: string;
  max: string;
  sort: "default" | "stock-asc" | "stock-desc";
};

const LOW_STOCK_MAX = 5;

function parseBound(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function filterInventory<T extends Pick<Product, "name" | "unit" | "category" | "stock">>(
  products: T[],
  f: InventoryFilter,
  categoryName: (slug: string) => string = s => s,
): T[] {
  const term = f.q.trim().toLowerCase();
  const min = parseBound(f.min);
  const max = parseBound(f.max);
  const list = products.filter(p => {
    if (term && !`${p.name} ${p.unit} ${categoryName(p.category)}`.toLowerCase().includes(term)) return false;
    if (f.stockFilter === "out" && p.stock > 0) return false;
    if (f.stockFilter === "low" && (p.stock <= 0 || p.stock > LOW_STOCK_MAX)) return false;
    if (f.stockFilter === "ok" && p.stock <= LOW_STOCK_MAX) return false;
    if (min !== null && p.stock < min) return false;
    if (max !== null && p.stock > max) return false;
    return true;
  });
  if (f.sort === "stock-asc") return [...list].sort((a, b) => a.stock - b.stock);
  if (f.sort === "stock-desc") return [...list].sort((a, b) => b.stock - a.stock);
  return list;
}
