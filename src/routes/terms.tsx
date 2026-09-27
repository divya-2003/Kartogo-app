import { createFileRoute } from "@tanstack/react-router";
import { PageTop } from "@/components/marketplace/Cards";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — Kartogo" },
      { name: "description", content: "Kartogo terms of use for customers in Ongole." },
      { property: "og:title", content: "Terms of Use — Kartogo" },
      { property: "og:description", content: "Kartogo terms of use." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="min-h-screen bg-background pb-16">
      <PageTop title="Terms of Use" back="/menu" />
      <article className="mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed text-muted-foreground">
        <p>By using Kartogo you agree to provide accurate details, pay for orders and services you confirm, and follow each partner's cancellation rules shown at booking. Prices, availability and delivery or service times are set by local partners and may change. Services are performed by independent partners; Kartogo helps resolve issues through Help & Support. Misuse, fake bookings or abuse of partners may lead to account suspension.</p>
        <p className="mt-4">Questions? Reach us from Help &amp; Support in your account.</p>
      </article>
    </div>
  ),
});
