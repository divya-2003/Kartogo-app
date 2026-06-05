import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { useCatalog } from "@/lib/store";
import { z } from "zod";

const SearchSchema = z.object({ q: z.string().optional().default("") });

export const Route = createFileRoute("/search")({
  validateSearch: SearchSchema,
  component: SearchPage,
  head: () => ({ meta: [{ title: "Search — Kartigo" }] }),
});

function SearchPage() {
  const { q } = Route.useSearch();
  const { products } = useCatalog();
  const query = q.trim().toLowerCase();
  const results = query ? products.filter(p =>
    p.name.toLowerCase().includes(query) ||
    p.category.toLowerCase().includes(query) ||
    p.description.toLowerCase().includes(query)
  ) : [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <h1 className="font-display text-2xl font-bold">
          {query ? <>Results for "<span className="text-primary">{q}</span>"</> : "Search products"}
        </h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">{query ? `${results.length} item${results.length === 1 ? "" : "s"} found` : "Try ‘avakaya’, ‘maggi’, ‘batter’"}</p>
        {query && results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">Nothing matched. Try a different word.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            {results.map(p => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
