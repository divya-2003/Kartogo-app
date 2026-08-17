import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Globe2, Plane, Ship, PackageCheck, ShieldCheck, Clock, BadgeIndianRupee, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { CountryCode } from "libphonenumber-js";
import { PhoneNumberInput } from "@/components/PhoneNumberInput";
import { toE164, validatePhoneNumber, getCountry, getCountryList } from "@/lib/phone";
import { createUnserviceableRequestFn } from "@/lib/unserviceable.functions";

export const Route = createFileRoute("/international")({
  component: InternationalPage,
  head: () => ({
    meta: [
      { title: "International Ordering | Kartogo" },
      { name: "description", content: "Send Ongole's pickles, snacks and daily essentials abroad. Choose your delivery country, compare air and sea shipping, and register your interest with Kartogo." },
      { property: "og:title", content: "International Ordering | Kartogo" },
      { property: "og:description", content: "Ship Indian pickles, snacks and essentials worldwide with Kartogo — air express in 5-8 days or economy sea freight." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

/** Shipping zones we quote from Ongole, with indicative pricing and transit. */
const ZONES = [
  {
    id: "gulf",
    name: "Gulf & Middle East",
    countries: ["AE", "SA", "QA", "KW", "OM", "BH"] as CountryCode[],
    air: "₹850 / kg",
    sea: "Not available",
    transit: "4–6 days",
    tone: "from-saffron/25 to-saffron/5",
  },
  {
    id: "sea",
    name: "Singapore & South-East Asia",
    countries: ["SG", "MY", "TH", "ID", "PH"] as CountryCode[],
    air: "₹1,050 / kg",
    sea: "₹340 / kg",
    transit: "5–8 days",
    tone: "from-primary/20 to-primary/5",
  },
  {
    id: "anz",
    name: "Australia & New Zealand",
    countries: ["AU", "NZ"] as CountryCode[],
    air: "₹1,420 / kg",
    sea: "₹410 / kg",
    transit: "7–10 days",
    tone: "from-emerald-500/20 to-emerald-500/5",
  },
  {
    id: "amer",
    name: "USA, Canada & UK/EU",
    countries: ["US", "CA", "GB", "DE", "FR", "IE", "NL"] as CountryCode[],
    air: "₹1,690 / kg",
    sea: "₹520 / kg",
    transit: "8–12 days",
    tone: "from-sky-500/20 to-sky-500/5",
  },
];

/** What can and cannot leave the country — customs rules, in plain language. */
const SHIPPABLE = [
  { emoji: "🥭", title: "Andhra pickles & podis", note: "Vacuum sealed, oil-safe packing" },
  { emoji: "🍪", title: "Local snacks & sweets", note: "Shelf life 60+ days only" },
  { emoji: "🌾", title: "Rice, dals & spices", note: "Up to 10 kg per shipment" },
  { emoji: "🧴", title: "Ayurveda & personal care", note: "Non-liquid preferred" },
  { emoji: "🎁", title: "Festival & pooja kits", note: "Curated combo boxes" },
];

const RESTRICTED = ["Fresh fruits, vegetables & dairy", "Prescription medicines", "Meat, fish & egg products", "Aerosols, batteries & flammables"];

function InternationalPage() {
  const [country, setCountry] = useState<CountryCode>("AE");
  const [phone, setPhone] = useState("");
  const [zoneId, setZoneId] = useState(ZONES[0]!.id);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const zone = useMemo(() => ZONES.find(z => z.id === zoneId) ?? ZONES[0]!, [zoneId]);
  const countryName = useMemo(() => getCountry(country)?.name ?? country, [country]);
  const supportedCountries = useMemo(() => {
    const isos = new Set(ZONES.flatMap(z => z.countries));
    return getCountryList().filter(c => isos.has(c.iso));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhoneNumber(phone, country)) {
      toast.error("Enter a valid mobile number for the selected country");
      return;
    }
    setBusy(true);
    try {
      await createUnserviceableRequestFn({
        data: {
          phone: toE164(phone, country) ?? phone,
          areaText: `International — ${countryName} (${zone.name})`,
          note: note.trim() || null,
        },
      });
      setDone(true);
      toast.success("Thanks! We'll message you as soon as we ship to your country.");
    } catch {
      toast.error("Could not send your request. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6">
      {/* Hero */}
      <header className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-background to-saffron/15 p-6 sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          <Globe2 className="h-3.5 w-3.5" /> Kartogo Global
        </span>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Send a taste of Ongole anywhere in the world
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Pickles, podis, snacks and daily essentials — packed by our supermarkets, customs-cleared by our
          partners, delivered to your doorstep abroad. Choose your country to see shipping options and pricing.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Highlight icon={Plane} label="Air express" value={zone.transit} />
          <Highlight icon={Ship} label="Sea economy" value={zone.sea} />
          <Highlight icon={ShieldCheck} label="Customs handled" value="End to end" />
        </div>
      </header>

      {/* Country + zone selection */}
      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold">Where should we deliver?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Pick a destination to see the live rate card for that corridor.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {ZONES.map(z => (
            <button
              key={z.id}
              onClick={() => { setZoneId(z.id); setCountry(z.countries[0]!); }}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                z.id === zone.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"
              }`}
            >
              {z.name}
            </button>
          ))}
        </div>

        <div className={`mt-4 grid gap-3 rounded-2xl bg-gradient-to-br ${zone.tone} p-4 sm:grid-cols-3`}>
          <Stat icon={Plane} label="Air freight" value={zone.air} />
          <Stat icon={Ship} label="Sea freight" value={zone.sea} />
          <Stat icon={Clock} label="Transit time" value={zone.transit} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {supportedCountries
            .filter(c => zone.countries.includes(c.iso))
            .map(c => (
              <button
                key={c.iso}
                onClick={() => setCountry(c.iso)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  c.iso === country ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"
                }`}
              >
                <span aria-hidden>{c.flag}</span> {c.name}
              </button>
            ))}
        </div>
      </section>

      {/* What ships */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <PackageCheck className="h-5 w-5 text-primary" /> What we can ship
          </h2>
          <ul className="mt-3 space-y-2">
            {SHIPPABLE.map(s => (
              <li key={s.title} className="flex items-start gap-3 rounded-xl border border-border/60 p-3">
                <span className="text-xl" aria-hidden>{s.emoji}</span>
                <div>
                  <div className="text-sm font-bold">{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.note}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-5">
            <h2 className="font-display text-xl font-bold text-destructive">Not allowed by customs</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              {RESTRICTED.map(r => <li key={r}>• {r}</li>)}
            </ul>
          </div>
          <div className="rounded-3xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <BadgeIndianRupee className="h-5 w-5 text-primary" /> How pricing works
            </h2>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><strong className="text-foreground">1.</strong> Item price is billed in ₹ at Kartogo store rates.</li>
              <li><strong className="text-foreground">2.</strong> Shipping is charged on chargeable weight (actual or volumetric).</li>
              <li><strong className="text-foreground">3.</strong> Destination duties, if any, are paid by the receiver.</li>
            </ol>
          </div>
        </div>
      </section>

      {/* Interest form */}
      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold">Register for international delivery</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We open countries in batches. Leave your number and we'll text you the moment {countryName} goes live.
        </p>

        {done ? (
          <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm font-semibold text-primary">
            You're on the list for {countryName}. We'll be in touch soon.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <PhoneNumberInput
              country={country}
              onCountryChange={setCountry}
              value={phone}
              onValueChange={setPhone}
              placeholder="Your mobile number"
            />
            <textarea
              value={note}
              onChange={e => setNote(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="What would you like to order? (optional)"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Notify me
              </button>
              <span className="text-xs text-muted-foreground">Delivering to {countryName} · {zone.transit}</span>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function Highlight({ icon: Icon, label, value }: { icon: typeof Globe2; label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
      <Icon className="h-4 w-4 text-primary" />
      <div className="leading-tight">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-bold">{value}</div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Globe2; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/70 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-1 text-lg font-extrabold">{value}</div>
    </div>
  );
}
