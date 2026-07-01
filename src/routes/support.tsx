import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Headphones, Mail, Phone, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/support")({
  component: SupportPage,
  head: () => ({ meta: [{ title: "Help & Support — Kartigo" }] }),
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
              <h1 className="font-display text-xl font-bold">Help & Support</h1>
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
              href="mailto:support@kartigo.in"
              className="flex items-center gap-4 rounded-xl border border-border p-4 hover:bg-secondary"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-muted-foreground">Email us</div>
                <div className="truncate font-semibold">support.kartigo.in</div>
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

function TopBar() {
  return (
    <div className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 md:px-6">
        <Link to="/menu" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-secondary">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-xl font-bold">Help & Support</h1>
      </div>
    </div>
  );
}
