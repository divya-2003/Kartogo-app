import { createFileRoute } from "@tanstack/react-router";
import { FoodExperience } from "@/components/marketplace/FoodExperience";

export const Route = createFileRoute("/food")({
  head: () => ({
    meta: [
      { title: "Food delivery from local kitchens — Kartogo" },
      { name: "description", content: "Biryani, tiffins, thalis and meal combos from Ongole kitchens, delivered hot." },
      { property: "og:title", content: "Kartogo Food — hot meals delivered" },
      { property: "og:description", content: "Order from partner kitchens: daily specials, tiffins and meal combos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({ q: typeof s.q === "string" ? s.q.slice(0, 40) : undefined }),
  component: FoodPage,
});

function FoodPage() {
  const search = Route.useSearch();
  return <FoodExperience initialQ={search.q} />;
}
