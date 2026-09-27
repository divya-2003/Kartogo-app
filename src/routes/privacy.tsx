import { createFileRoute } from "@tanstack/react-router";
import { PageTop } from "@/components/marketplace/Cards";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Kartogo" },
      { name: "description", content: "Kartogo privacy policy for customers in Ongole." },
      { property: "og:title", content: "Privacy Policy — Kartogo" },
      { property: "og:description", content: "Kartogo privacy policy." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="min-h-screen bg-background pb-16">
      <PageTop title="Privacy Policy" back="/menu" />
      <article className="mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed text-muted-foreground">
        <p>Kartogo collects your phone number, name, addresses and order/booking details only to deliver orders, confirm bookings and support you. Location is used while the app is open to check delivery areas — never in the background. We share only what's needed with the store, professional or delivery partner serving you, and your phone number stays masked. You can ask us to delete your account anytime via Help & Support.</p>
        <p className="mt-4">Questions? Reach us from Help &amp; Support in your account.</p>
      </article>
    </div>
  ),
});
