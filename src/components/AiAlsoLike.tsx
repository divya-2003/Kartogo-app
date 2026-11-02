import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { RecommendationRow } from "@/components/RecommendationRow";
import { aiRelatedProductsFn } from "@/lib/ai-recommendations.functions";

/** "You may also like" — related products chosen by Lovable AI from the catalog. */
export function AiAlsoLike({ productId, className = "" }: { productId: string; className?: string }) {
  const q = useQuery({
    queryKey: ["ai-also-like", productId],
    queryFn: () => aiRelatedProductsFn({ data: { productId } }),
    staleTime: 60 * 60_000,
    retry: false,
  });
  const items = (q.data?.ids ?? []).map((id, i) => ({ productId: id, type: "AI_SIMILAR", reason: "You may also like", score: 1 - i / 100, sourceProductId: productId }));
  if (q.isLoading) {
    return (
      <section className={className} aria-busy="true">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold"><Sparkles className="h-4 w-4 text-primary" /> You may also like</h2>
        <div className="flex gap-3 overflow-hidden">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 w-36 shrink-0 animate-pulse rounded-2xl bg-secondary" />)}</div>
      </section>
    );
  }
  if (items.length === 0) return null;
  return (
    <section className={className}>
      <h2 className="flex items-center gap-2 font-display text-lg font-extrabold"><Sparkles className="h-4 w-4 text-primary" /> You may also like</h2>
      <p className="text-sm text-muted-foreground">Picked for you by Kartogo AI from our store.</p>
      <RecommendationRow title="" items={items} limit={8} compact />
    </section>
  );
}
