import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Clock, Star, Home as HomeIcon } from "lucide-react";
import { getPartnerFn } from "@/lib/marketplace.functions";
import { ListingCard, Rating, Thumb, FavButton, EmptyState, PageTop } from "@/components/marketplace/Cards";
import { fmtTime, isOpenNow, type MpListing, type MpPartner, type MpStaff } from "@/lib/marketplace";

export const Route = createFileRoute("/store/$id")({
  head: () => ({
    meta: [
      { title: "Store & provider profile — Kartogo" },
      { name: "description", content: "Ratings, services, products, reviews and location for a local Kartogo partner in Ongole." },
      { property: "og:title", content: "Local partner on Kartogo" },
      { property: "og:description", content: "Shop, book or check availability with a trusted local partner." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StorePage,
});

function StorePage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({ queryKey: ["mp-partner", id], queryFn: () => getPartnerFn({ data: { id } }) });
  if (isLoading) return <div className="min-h-screen bg-background"><PageTop title="Loading…" /><div className="mx-auto mt-4 h-40 max-w-2xl animate-pulse rounded-2xl bg-secondary" /></div>;
  if (!data) return <div className="min-h-screen bg-background"><PageTop title="Not found" /><div className="mx-auto max-w-2xl p-4"><EmptyState title="This partner isn't available" /></div></div>;
  const p = data.partner as MpPartner;
  const listings = data.listings as MpListing[];
  const staff = data.staff as MpStaff[];
  const open = isOpenNow(p);
  const kind = p.partner_type;
  const cta = kind === "EVENT_PROVIDER" ? "Check Availability" : kind === "RETAILER" || kind === "FURNITURE_SELLER" ? "Shop Now" : "Book Appointment";

  return (
    <div className="min-h-screen bg-background pb-28">
      <PageTop title={p.name} back="/categories" />
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-4 lg:max-w-5xl">
        <div className="relative rounded-3xl border border-border bg-card p-4 shadow-pop">
          <div className="flex gap-4">
            <Thumb images={p.photos} icon={p.icon} className="h-20 w-20 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-extrabold">{p.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Rating value={p.rating} count={p.review_count} />
                {p.distance_km != null && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{p.distance_km} km</span>}
                {open != null && <span className={`font-bold ${open ? "text-leaf" : "text-destructive"}`}>{open ? "Open now" : "Closed"}</span>}
              </div>
              {p.opens_at && <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{fmtTime(p.opens_at)} – {fmtTime(p.closes_at)}</div>}
            </div>
          </div>
          <FavButton type="partner" id={p.id} className="absolute right-3 top-3" />
          {p.description && <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {p.address && <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1"><MapPin className="h-3 w-3" />{p.address}</span>}
            {p.service_area && <span className="rounded-full bg-secondary px-2.5 py-1">Serves: {p.service_area}</span>}
            {p.service_modes?.includes("HOME_SERVICE") && <span className="inline-flex items-center gap-1 rounded-full bg-saffron/20 px-2.5 py-1 font-bold"><HomeIcon className="h-3 w-3" />Home service</span>}
          </div>
          {listings[0] && (
            <a href="#offerings" className="mt-4 flex h-11 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">{cta}</a>
          )}
        </div>

        <section id="offerings">
          <h3 className="mb-2 font-display text-lg font-bold">{kind === "EVENT_PROVIDER" ? "Packages & portfolio" : kind === "RETAILER" || kind === "FURNITURE_SELLER" ? "Products" : "Services"}</h3>
          {listings.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{listings.map(l => <ListingCard key={l.id} l={l} />)}</div> : <EmptyState title="No listings yet" />}
        </section>

        {staff.length > 0 && (
          <section>
            <h3 className="mb-2 font-display text-lg font-bold">Professionals</h3>
            <div className="flex gap-3 overflow-x-auto [scrollbar-width:none]">
              {staff.map(s => (
                <div key={s.id} className="w-32 shrink-0 rounded-2xl border border-border bg-card p-3 text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 font-display text-lg font-bold text-primary">{s.name[0]}</div>
                  <div className="mt-1 truncate text-sm font-bold">{s.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{s.title}</div>
                  <div className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-bold"><Star className="h-3 w-3 fill-saffron text-saffron" />{s.rating}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3 className="mb-2 font-display text-lg font-bold">Reviews</h3>
          <div className="space-y-2">
            {(data.reviews as { id: string; customer_name: string; rating: number; comment: string | null }[]).map(r => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between text-sm font-bold">{r.customer_name}<Rating value={r.rating} /></div>
                {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
              </div>
            ))}
          </div>
        </section>
        <Link to="/categories" className="block text-center text-sm font-bold text-primary">Browse more categories</Link>
      </div>
    </div>
  );
}
