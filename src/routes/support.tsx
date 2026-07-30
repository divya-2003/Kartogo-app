import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft, Headphones, Mail, Phone, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/support")({
  component: SupportPage,
  head: () => ({
    meta: [
      { title: "Help & Support — Kartogo" },
      { name: "description", content: "Reach the Kartogo team in Ongole for order help, refunds, delivery questions and feedback — call, email or message us 24/7." },
      { property: "og:title", content: "Help & Support — Kartogo" },
      { property: "og:description", content: "Get help with your Kartogo order — call, email or message our Ongole support team, 24/7." },
      { property: "og:url", content: "/support" },
    ],
    links: [{ rel: "canonical", href: "/support" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          { "@type": "Question", name: "How do I contact Kartogo customer service?", acceptedAnswer: { "@type": "Answer", text: "Call +91 91103 10034 or email support@kartogo.in — our team responds 24/7." } },
          { "@type": "Question", name: "How fast is Kartogo delivery?", acceptedAnswer: { "@type": "Answer", text: "Kartogo delivers snacks, pickles, spices, tiffin batter and daily essentials within about 15 minutes across Ongole." } },
          { "@type": "Question", name: "Can I return or refund an order?", acceptedAnswer: { "@type": "Answer", text: "Yes — reach us within 24 hours of delivery via call or email and we'll arrange a refund or replacement per our returns policy." } },
        ],
      }),
    }],
  }),
});

function SupportPage() {
  return (
    <div className="min-h-screen bg-secondary/40 pb-8">
      <TopBar />

      <div className="mx-auto max-w-2xl px-4 py-6 md:px-6">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-pop sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
              <Headphones className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Help & Support</h2>
              <p className="text-sm text-muted-foreground">We're here to help you 24/7</p>
            </div>
          </div>

          <div className="space-y-3">
            <a
              href="tel:9110310034"
              className="flex items-center gap-4 rounded-xl border border-border p-4 hover:bg-secondary"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Phone className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-muted-foreground">Customer service</div>
                <div className="font-semibold">+91 91103 10034</div>
              </div>
              <ChevronLeft className="h-5 w-5 rotate-180 text-muted-foreground" />
            </a>

            <a
              href="mailto:support@kartogo.in"
              className="flex items-center gap-4 rounded-xl border border-border p-4 hover:bg-secondary"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-muted-foreground">Email us</div>
                <div className="truncate font-semibold">support.kartogo.in</div>
              </div>
              <ChevronLeft className="h-5 w-5 rotate-180 text-muted-foreground" />
            </a>

            <div className="flex items-center gap-4 rounded-xl border border-border p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-muted-foreground">Response time</div>
                <div className="font-semibold">Within 24 hours</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-pop">
          <h2 className="font-display text-lg font-bold">Frequently asked questions</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>For order issues, please share your order ID when you call or email.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>Refunds and returns are processed within 5–7 business days.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>Our team is available every day from 8 AM to 10 PM.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Goes back to wherever the customer came from (Print Store, orders, profile…)
// instead of always dumping them on the profile page.
function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => { if (router.history.canGoBack()) router.history.back(); else void router.navigate({ to: "/menu" }); }}
      className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-secondary"
    >
      <ChevronLeft className="h-5 w-5" />
    </button>
  );
}

function TopBar() {
  return (
    <div className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 md:px-6">
        <BackButton />
        <h1 className="font-display text-xl font-bold">Help & Support</h1>
      </div>
    </div>
  );
}
