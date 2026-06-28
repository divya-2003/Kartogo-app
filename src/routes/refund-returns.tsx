import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Leaf,
  Package,
  Home,
  Ban,
  RefreshCw,
  Clock,
  Smartphone,
  HelpCircle,
  Mail,
  Phone,
  ShieldCheck,
  ChevronDown,
  MessageSquareWarning,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/refund-returns")({
  component: RefundReturnsPage,
  head: () => ({
    meta: [
      { title: "Refund & Returns Policy — Kartigo" },
      {
        name: "description",
        content:
          "Kartigo's Refund & Returns Policy. Learn about eligible returns, replacement process, refund timelines, and how to report issues with your quick commerce order.",
      },
    ],
  }),
});

const LAST_UPDATED = "June 28, 2026";

function RefundReturnsPage() {
  const nav = useNavigate();
  const [understood, setUnderstood] = useState(false);
  // Start undefined on both server and client to avoid a hydration mismatch,
  // then restore the last-opened FAQ from sessionStorage after mount.
  const [faqOpen, setFaqOpen] = useState<string | undefined>(undefined);
  useEffect(() => {
    const saved = sessionStorage.getItem("refund-faq");
    if (saved) setFaqOpen(saved);
  }, []);


  return (
    <div className="min-h-screen bg-secondary/40">
      <TopBar />

      <main className="mx-auto max-w-2xl px-4 pb-32 pt-4 md:px-6">
        {/* Hero card */}
        <div className="relative overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground shadow-pop">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
          <div className="absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-white/10" />
          <div className="relative">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
              <ShieldCheck className="h-4 w-4" /> Customer First
            </div>
            <h1 className="font-display text-3xl font-bold leading-tight">
              Refund & Returns Policy
            </h1>
            <p className="mt-2 max-w-md text-sm opacity-90">
              At Kartigo, customer satisfaction is our priority. If you receive a damaged, expired,
              missing, or incorrect product, we're here to help.
            </p>
          </div>
        </div>

        {/* Report issue CTA */}
        <Link
          to="/orders"
          search={{ report: 1 }}
          className="mt-4 flex items-center gap-3 overflow-hidden rounded-2xl bg-saffron p-4 text-saffron-foreground shadow-pop transition hover:opacity-95"
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20">
            <MessageSquareWarning className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display font-bold">Report an issue with your order</div>
            <div className="text-xs opacity-90">
              Open My Orders and request a refund or replacement.
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0" />
        </Link>

        {/* Section 1 — Fresh Products */}
        <SectionCard
          icon={<Leaf className="h-5 w-5 text-white" />}
          iconBg="bg-leaf"
          title="1. Fresh Products"
          body="Fruits, vegetables, dairy, bakery, frozen foods, and other perishable products cannot be returned after delivery unless:"
        >
          <ul className="mt-3 space-y-2">
            <Bullet
              icon={<CheckCircle2 className="h-4 w-4 text-leaf" />}
              text="Product is damaged"
            />
            <Bullet
              icon={<CheckCircle2 className="h-4 w-4 text-leaf" />}
              text="Product is expired"
            />
            <Bullet
              icon={<CheckCircle2 className="h-4 w-4 text-leaf" />}
              text="Wrong item was delivered"
            />
            <Bullet icon={<CheckCircle2 className="h-4 w-4 text-leaf" />} text="Item is missing" />
          </ul>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-saffron/10 p-3 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 text-saffron" />
            <span className="font-semibold text-foreground">
              Report issues within 2 hours of delivery.
            </span>
          </div>
        </SectionCard>

        {/* Section 2 — Packaged Grocery & FMCG */}
        <SectionCard
          icon={<Package className="h-5 w-5 text-white" />}
          iconBg="bg-saffron"
          title="2. Packaged Grocery & FMCG Products"
          body="Snacks, beverages, groceries, toiletries, and household essentials can be returned within 24 hours only if:"
        >
          <ul className="mt-3 space-y-2">
            <Bullet
              icon={<CheckCircle2 className="h-4 w-4 text-leaf" />}
              text="Product remains unopened"
            />
            <Bullet
              icon={<CheckCircle2 className="h-4 w-4 text-leaf" />}
              text="Original packaging is intact"
            />
            <Bullet
              icon={<CheckCircle2 className="h-4 w-4 text-leaf" />}
              text="Product is damaged, defective, or incorrect"
            />
          </ul>
        </SectionCard>

        {/* Section 3 — Household & Non-Food */}
        <SectionCard
          icon={<Home className="h-5 w-5 text-white" />}
          iconBg="bg-primary"
          title="3. Household & Non-Food Products"
          body="Returns are accepted within 3 days if:"
        >
          <ul className="mt-3 space-y-2">
            <Bullet
              icon={<CheckCircle2 className="h-4 w-4 text-leaf" />}
              text="Product is unused"
            />
            <Bullet
              icon={<CheckCircle2 className="h-4 w-4 text-leaf" />}
              text="Original packaging is available"
            />
            <Bullet
              icon={<CheckCircle2 className="h-4 w-4 text-leaf" />}
              text="Product is not damaged by customer"
            />
          </ul>
        </SectionCard>

        {/* Section 4 — Not Eligible */}
        <SectionCard
          icon={<Ban className="h-5 w-5 text-white" />}
          iconBg="bg-destructive"
          title="4. Items Not Eligible for Return"
          body="The following cannot be returned:"
        >
          <ul className="mt-3 space-y-2">
            <Bullet
              icon={<XCircle className="h-4 w-4 text-destructive" />}
              text="Opened food items"
            />
            <Bullet
              icon={<XCircle className="h-4 w-4 text-destructive" />}
              text="Used personal care products"
            />
            <Bullet
              icon={<XCircle className="h-4 w-4 text-destructive" />}
              text="Products damaged after delivery"
            />
            <Bullet
              icon={<XCircle className="h-4 w-4 text-destructive" />}
              text="Products without original packaging"
            />
            <Bullet
              icon={<XCircle className="h-4 w-4 text-destructive" />}
              text="Customized or special order items"
            />
          </ul>
        </SectionCard>

        {/* Section 5 — Replacement Policy */}
        <SectionCard
          icon={<RefreshCw className="h-5 w-5 text-white" />}
          iconBg="bg-leaf"
          title="5. Replacement Policy"
          body="Kartigo will provide a free replacement if:"
        >
          <ul className="mt-3 space-y-2">
            <Bullet
              icon={<CheckCircle2 className="h-4 w-4 text-leaf" />}
              text="Wrong product delivered"
            />
            <Bullet
              icon={<CheckCircle2 className="h-4 w-4 text-leaf" />}
              text="Damaged product received"
            />
            <Bullet
              icon={<CheckCircle2 className="h-4 w-4 text-leaf" />}
              text="Expired product delivered"
            />
            <Bullet
              icon={<CheckCircle2 className="h-4 w-4 text-leaf" />}
              text="Missing item in order"
            />
          </ul>
        </SectionCard>

        {/* Section 6 — Refund Timeline */}
        <SectionCard
          icon={<Clock className="h-5 w-5 text-white" />}
          iconBg="bg-primary"
          title="6. Refund Timeline"
          body="After approval, refunds are processed as follows:"
        >
          <div className="mt-4 space-y-4">
            <TimelineItem title="UPI Refund" desc="1–3 Business Days" status="fast" first />
            <TimelineItem title="Debit / Credit Card" desc="3–7 Business Days" status="standard" />
            <TimelineItem
              title="Cash on Delivery Orders"
              desc="Refund via UPI or Bank Transfer within 3–5 Business Days"
              status="standard"
              last
            />
          </div>
        </SectionCard>

        {/* Section 7 — How to Request */}
        <SectionCard
          icon={<Smartphone className="h-5 w-5 text-white" />}
          iconBg="bg-saffron"
          title="7. How to Request a Refund"
          body="Customers can request a refund in a few simple steps:"
        >
          <ol className="mt-3 space-y-3">
            <Step n={1} text="Open My Orders" />
            <Step n={2} text="Select the order" />
            <Step n={3} text="Tap 'Report an Issue'" />
            <Step n={4} text="Upload product photo (optional but recommended)" />
            <Step n={5} text="Choose refund or replacement" />
            <Step n={6} text="Submit request" />
          </ol>
        </SectionCard>

        {/* Section 8 — Need Help */}
        <SectionCard
          icon={<HelpCircle className="h-5 w-5 text-white" />}
          iconBg="bg-ink"
          title="8. Need Help?"
          body="For support, contact our team:"
        >
          <div className="mt-4 space-y-3">
            <ContactRow
              icon={<Mail className="h-5 w-5" />}
              label="Email"
              value="support@kartigo.in"
              href="mailto:support@kartigo.in"
            />
            <ContactRow
              icon={<Phone className="h-5 w-5" />}
              label="Phone"
              value="+91-9110310034"
              href="tel:+919110310034"
            />
          </div>
        </SectionCard>

        {/* FAQ accordion */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-pop">
          <h2 className="mb-4 font-display text-lg font-bold">Frequently Asked Questions</h2>
          <Accordion
            type="single"
            collapsible
            value={faqOpen}
            onValueChange={(v) => {
              setFaqOpen(v);
              if (v && typeof window !== "undefined") {
                sessionStorage.setItem("refund-faq", v);
              }
            }}
            className="w-full"
          >
            <AccordionItem value="q1">
              <AccordionTrigger>What if I miss the 2-hour reporting window?</AccordionTrigger>
              <AccordionContent>
                For fresh and perishable items, we need to verify the issue within 2 hours of
                delivery. After this window, returns may not be accepted.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2">
              <AccordionTrigger>Do I need to return the damaged product?</AccordionTrigger>
              <AccordionContent>
                In most cases, our delivery partner will collect the damaged or incorrect item
                during replacement. For some issues, a photo may be enough.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q3">
              <AccordionTrigger>Can I get a refund instead of a replacement?</AccordionTrigger>
              <AccordionContent>
                Refunds are issued when a replacement is not available or when you choose refund
                during the issue-reporting flow.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q4">
              <AccordionTrigger>How will I know my refund status?</AccordionTrigger>
              <AccordionContent>
                You will receive updates via SMS and email. You can also check the order details in
                the My Orders section.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Last updated: {LAST_UPDATED}
        </p>
      </main>

      {/* Sticky bottom action */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 md:px-6">
          <button
            onClick={() => setUnderstood((v) => !v)}
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
              understood
                ? "border-leaf bg-leaf/10 text-leaf"
                : "border-border bg-card hover:bg-secondary"
            }`}
          >
            {understood ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <div className="h-4 w-4 rounded-full border border-muted-foreground" />
            )}
            I Understand
          </button>
          <button
            onClick={() => nav({ to: "/" })}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            Back to shop
          </button>
        </div>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 md:px-6">
        <Link
          to="/"
          aria-label="Back"
          className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-secondary"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-xl font-bold">Refund & Returns</h1>
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  iconBg,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-pop">
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${iconBg}`}>
          {icon}
        </div>
        <div>
          <h2 className="font-display text-lg font-bold leading-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Bullet({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{text}</span>
    </li>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {n}
      </span>
      <span>{text}</span>
    </li>
  );
}

function TimelineItem({
  title,
  desc,
  status,
  first,
  last,
}: {
  title: string;
  desc: string;
  status: "fast" | "standard";
  first?: boolean;
  last?: boolean;
}) {
  const dotColor = status === "fast" ? "bg-leaf" : "bg-saffron";
  return (
    <div className="relative flex items-start gap-4 pl-2">
      {!first && <div className="absolute -top-4 left-[21px] h-4 w-0.5 bg-border" />}
      <div className={`relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-full ${dotColor}`} />
      {!last && <div className="absolute top-5 left-[21px] h-full w-0.5 bg-border" />}
      <div className="flex-1 rounded-xl border border-border bg-background p-3">
        <div className="font-semibold text-sm">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 hover:bg-secondary"
    >
      <div className="text-primary">{icon}</div>
      <div className="flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-semibold text-sm">{value}</div>
      </div>
      <ChevronDown className="h-4 w-4 -rotate-90 text-muted-foreground" />
    </a>
  );
}
