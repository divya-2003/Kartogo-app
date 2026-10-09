import { createFileRoute } from "@tanstack/react-router";
import { RidesExperience } from "@/components/marketplace/RidesExperience";

export const Route = createFileRoute("/rides")({
  head: () => ({
    meta: [
      { title: "Book a bike, auto or car ride — Kartogo Rides" },
      { name: "description", content: "Pick up and drop anywhere in Ongole with upfront fares for bike, auto and car rides." },
      { property: "og:title", content: "Kartogo Rides — upfront fares, nearby drivers" },
      { property: "og:description", content: "Book a bike, auto or car in seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { drop?: string; type?: string } => ({
    drop: typeof s.drop === "string" ? s.drop.slice(0, 200) : undefined,
    type: typeof s.type === "string" ? s.type : undefined,
  }),
  component: RidesPage,
});

function RidesPage() {
  const search = Route.useSearch();
  return <RidesExperience search={search} />;
}
