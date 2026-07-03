import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  Home,
  LayoutGrid,
  TrendingUp,
  Printer,
  ShieldCheck,
  Upload,
  FileText,
  IdCard,
  Image as ImageIcon,
  HelpCircle,
  ChevronRight,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/print")({
  component: PrintStorePage,
  head: () => ({
    meta: [
      { title: "Print Store — Kartogo Ongole" },
      { name: "description", content: "Print documents, passport photos and glossy photo prints with Kartogo — securely deleted after printing and delivered in minutes across Ongole." },
    ],
  }),
});

type PrintService = {
  key: string;
  title: string;
  Icon: typeof FileText;
  tint: string;
  lines: string[];
  cta: string;
};

const SERVICES: PrintService[] = [
  {
    key: "documents",
    title: "Documents",
    Icon: FileText,
    tint: "bg-primary/10 text-primary",
    lines: ["A4 prints — Black & White or Colour", "Single side prints starting at ₹2/page"],
    cta: "Upload new files",
  },
  {
    key: "passport",
    title: "Passport Photos",
    Icon: IdCard,
    tint: "bg-leaf/10 text-leaf",
    lines: ["Kodak Glossy Paper", "Sets of 8, 16, 32"],
    cta: "Order passport photos",
  },
  {
    key: "photos",
    title: "Photos",
    Icon: ImageIcon,
    tint: "bg-saffron/15 text-saffron",
    lines: ["Kodak Glossy Paper", "4 size options"],
    cta: "Order photo prints",
  },
];

function PrintStorePage() {
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 lg:max-w-7xl lg:px-8">
          <Link to="/" aria-label="Back" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border hover:bg-secondary">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-xl font-bold">Print Store</h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5 lg:max-w-7xl lg:px-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-[oklch(0.9_0.07_70)] to-card p-6 text-center shadow-pop">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink text-background">
            <Printer className="h-7 w-7" />
          </div>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-none tracking-tight">
            Kartogo <span className="text-primary">Prints</span>
          </h2>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Fast, affordable printing — delivered to your door
          </p>
        </div>

        {/* Security note */}
        <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-bold shadow-pop">
          <ShieldCheck className="h-5 w-5 shrink-0 text-leaf" />
          <span>Your documents are securely deleted after printing</span>
        </div>

        {/* Services */}
        <div className="mt-4 space-y-3">
          {SERVICES.map(s => (
            <div key={s.key} className="rounded-3xl border border-border bg-card p-5 shadow-pop">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-extrabold">{s.title}</h3>
                  <ul className="mt-2 space-y-1">
                    {s.lines.map(line => (
                      <li key={line} className="flex gap-2 text-sm text-muted-foreground">
                        <span className="text-primary">•</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${s.tint}`}>
                  <s.Icon className="h-7 w-7" />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-pop transition hover:bg-primary/90"
                >
                  <Upload className="h-4 w-4" /> {s.cta}
                </button>
                <span className="inline-flex items-center gap-1 rounded-full bg-leaf/10 px-3 py-1 text-[11px] font-bold text-leaf">
                  <Zap className="h-3 w-3" /> Available now
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-pop">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg font-extrabold">Have questions?</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Please read the FAQs before printing or get in touch with our support team for more details.
          </p>
          <Link
            to="/support"
            className="mt-3 inline-flex items-center gap-1 rounded-2xl border border-primary px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/10"
          >
            Browse our FAQs <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2 lg:max-w-7xl">
          <Link to="/" className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-muted-foreground">
            <Home className="h-5 w-5" /> Home
          </Link>
          <Link to="/categories" className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-muted-foreground">
            <LayoutGrid className="h-5 w-5" /> Categories
          </Link>
          <Link to="/search" search={{ q: "" }} className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-muted-foreground">
            <TrendingUp className="h-5 w-5" /> Trending
          </Link>
          <Link to="/print" className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-primary">
            <Printer className="h-5 w-5" /> Print Store
          </Link>
        </div>
      </nav>
    </div>
  );
}
