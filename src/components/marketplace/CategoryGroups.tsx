import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listMpCategoriesFn } from "@/lib/marketplace.functions";
import { GROUP_LABELS, type CategoryGroup, type MpCategory } from "@/lib/marketplace";

const TINTS: Record<CategoryGroup, string> = { shop: "bg-leaf/10", beauty: "bg-saffron/15", home_services: "bg-primary/10", events: "bg-secondary" };

/** Data-driven category groups (Shop, Beauty & Wellness, Home Services, Events). */
export function MarketplaceCategoryGroups({ term = "" }: { term?: string }) {
  const { data, isLoading, isError } = useQuery({ queryKey: ["mp-cats"], queryFn: () => listMpCategoriesFn(), staleTime: 5 * 60_000 });
  const cats = ((data?.categories ?? []) as MpCategory[]).filter(c => !term || c.name.toLowerCase().includes(term));
  if (isLoading) return <div className="mb-6 grid grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-secondary" />)}</div>;
  if (isError) return <p className="mb-6 text-sm text-muted-foreground">Couldn't load categories. Pull to refresh.</p>;
  return (
    <div className="mb-8 space-y-6">
      {(Object.keys(GROUP_LABELS) as CategoryGroup[]).map(g => {
        const list = cats.filter(c => c.group_key === g);
        if (!list.length) return null;
        return (
          <section key={g}>
            <h2 className="mb-2 font-display text-lg font-extrabold">{GROUP_LABELS[g]}</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {list.map(c => (
                <Link key={c.slug} to="/explore/$slug" params={{ slug: c.slug }} className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-border p-3 text-center shadow-pop transition hover:-translate-y-0.5 ${TINTS[g]}`}>
                  {c.image_url ? <img src={c.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="text-3xl">{c.icon}</span>}
                  <span className="text-xs font-bold leading-tight">{c.name}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
