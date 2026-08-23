import { useMemo } from "react";
import { ProductCard } from "@/components/ProductCard";
import { useCatalog } from "@/lib/store";
import { useRecommendationImpressions, type Recommendation } from "@/hooks/use-recommendations";

/**
 * Shared renderer for every recommendation section. It only renders when there
 * are real, currently available products to show — empty sections never appear.
 */
export function RecommendationRow({
  title,
  subtitle,
  items,
  limit = 8,
  compact,
}: {
  title: string;
  subtitle?: string;
  items: Recommendation[];
  limit?: number;
  compact?: boolean;
}) {
  const { products } = useCatalog();

  const resolved = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return items
      .map((rec) => ({ rec, product: byId.get(rec.productId) }))
      .filter((entry): entry is { rec: Recommendation; product: NonNullable<typeof entry.product> } =>
        Boolean(entry.product && entry.product.stock > 0))
      .slice(0, limit);
  }, [items, products, limit]);

  const onClick = useRecommendationImpressions(resolved.map((r) => r.rec));

  if (resolved.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="font-display text-xl font-extrabold">{title}</h2>
      {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      <div className={`mt-3 grid gap-3 ${compact ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"}`}>
        {resolved.map(({ rec, product }) => (
          <div key={`${rec.type}-${rec.productId}`} onClickCapture={() => onClick(rec)}>
            <ProductCard p={product} />
            <p className="mt-1 px-1 text-[11px] font-semibold text-muted-foreground">{rec.reason}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
