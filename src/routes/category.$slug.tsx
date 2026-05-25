import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { CATEGORIES } from "@/lib/data";
import { useCatalog } from "@/lib/store";

export const Route = createFileRoute("/category/$slug")({
  loader: ({ params }) => {
    const cat = CATEGORIES.find(c => c.slug === params.slug);
    if (!cat) throw notFound();
    return { cat };
  },
  component: CategoryPage,
  notFoundComponent: () => <div className="p-10 text-center">Category not found.</div>,
  errorComponent: ({ error }) => <div className="p-10 text-center text-destructive">{error.message}</div>,
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.cat.name ?? "Category"} — QuickKart Ongole` },
      { name: "description", content: `Shop ${loaderData?.cat.name} delivered in 15 minutes across Ongole.` },
    ],
  }),
});

function CategoryPage() {
  const { cat } = Route.useLoaderData();
  const { products } = useCatalog();
  const list = products.filter(p => p.category === cat.slug);
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <nav className="mb-3 text-sm text-muted-foreground"><Link to="/" className="hover:text-primary">Home</Link> / <span className="text-foreground">{cat.name}</span></nav>
        <div className="mb-6 flex items-center gap-4">
          <div className={`grid h-16 w-16 place-items-center rounded-2xl ${cat.tint} text-3xl`}>{cat.emoji}</div>
          <div>
            <h1 className="font-display text-3xl font-bold">{cat.name}</h1>
            <p className="text-sm text-muted-foreground">{list.length} item{list.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        {list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">No items in this category yet.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            {list.map(p => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
