import { Link, useNavigate } from "@tanstack/react-router";
import { Star, MapPin, Clock, Heart, Home as HomeIcon, Package, Truck, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatINR } from "@/lib/data";
import { useAuth } from "@/lib/store";
import { toggleFavoriteFn, myFavoritesFn } from "@/lib/marketplace.functions";
import { type MpListing, type MpPartner, listingPrice, listingRoute, isOpenNow, fmtTime } from "@/lib/marketplace";

export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-leaf/15 px-1.5 py-0.5 text-[11px] font-bold text-leaf">
      <Star className="h-3 w-3 fill-current" /> {Number(value).toFixed(1)}
      {count != null && <span className="font-semibold text-muted-foreground">({count})</span>}
    </span>
  );
}

export function Thumb({ images, icon, className = "" }: { images?: string[]; icon: string; className?: string }) {
  if (images?.[0]) return <img src={images[0]} alt="" loading="lazy" className={`object-cover ${className}`} />;
  return <div className={`grid place-items-center bg-secondary text-4xl ${className}`}>{icon}</div>;
}

// Shared favourites cache so every heart on screen stays in sync.
let favKeys: Set<string> | null = null;
const listeners = new Set<() => void>();
export function useFavorite(type: "listing" | "partner", id: string) {
  const { customerToken } = useAuth();
  const nav = useNavigate();
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force(x => x + 1);
    listeners.add(l);
    if (!favKeys && customerToken) {
      favKeys = new Set();
      myFavoritesFn({ data: { token: customerToken } }).then(r => { favKeys = new Set(r.keys); listeners.forEach(f => f()); }).catch(() => {});
    }
    return () => { listeners.delete(l); };
  }, [customerToken]);
  const key = `${type}:${id}`;
  const saved = !!customerToken && !!favKeys?.has(key);
  const toggle = async () => {
    if (!customerToken) { toast("Login to save favourites"); nav({ to: "/login", search: { redirect: "/favorites" } as never }); return; }
    favKeys ??= new Set();
    saved ? favKeys.delete(key) : favKeys.add(key);
    listeners.forEach(f => f());
    const r = await toggleFavoriteFn({ data: { token: customerToken, type, id } }).catch(() => null);
    if (!r?.ok) toast.error("Couldn't update favourites");
  };
  return { saved, toggle };
}

export function FavButton({ type, id, className = "" }: { type: "listing" | "partner"; id: string; className?: string }) {
  const { saved, toggle } = useFavorite(type, id);
  return (
    <button type="button" aria-label={saved ? "Remove from favourites" : "Save to favourites"} aria-pressed={saved}
      onClick={e => { e.preventDefault(); e.stopPropagation(); void toggle(); }}
      className={`grid h-8 w-8 place-items-center rounded-full bg-card/90 shadow-pop ${className}`}>
      <Heart className={`h-4 w-4 ${saved ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
    </button>
  );
}

function ctaFor(l: MpListing) {
  switch (l.transaction_type) {
    case "SERVICE_BOOKING": return "Book Now";
    case "HOME_SERVICE_BOOKING": return "Book Service";
    case "EVENT_BOOKING": return "Check Availability";
    case "QUOTE_REQUEST": return "Request Quote";
    default: return "Buy Now";
  }
}

/** Adapts to the listing type: service, home service, event package, quote or scheduled product. */
export function ListingCard({ l, compact = false }: { l: MpListing; compact?: boolean }) {
  const price = listingPrice(l);
  const route = listingRoute(l);
  const home = l.transaction_type === "HOME_SERVICE_BOOKING" || l.service_modes?.includes("HOME_SERVICE");
  return (
    <Link to={route} params={{ id: l.id }} className={`group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-pop transition hover:-translate-y-0.5 ${compact ? "w-44 shrink-0" : ""}`}>
      <div className="relative">
        <Thumb images={l.images} icon={l.icon} className="aspect-[4/3] w-full" />
        <FavButton type="listing" id={l.id} className="absolute right-2 top-2" />
        {l.listing_type === "PACKAGE" && <span className="absolute left-2 top-2 rounded-md bg-primary px-2 py-0.5 text-[10px] font-extrabold text-primary-foreground">Package</span>}
        {l.transaction_type === "HOME_SERVICE_BOOKING" && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-saffron px-2 py-0.5 text-[10px] font-extrabold text-foreground"><HomeIcon className="h-3 w-3" />Home Service</span>}
        {l.transaction_type === "QUOTE_REQUEST" && <span className="absolute left-2 top-2 rounded-md bg-foreground px-2 py-0.5 text-[10px] font-extrabold text-background">Quote</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="line-clamp-2 text-sm font-bold leading-snug">{l.name}</div>
        {l.partner && <div className="truncate text-xs text-muted-foreground">{l.partner.name}</div>}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <Rating value={l.rating} count={compact ? undefined : l.review_count} />
          {l.duration_min && <span className="inline-flex items-center gap-0.5"><Clock className="h-3 w-3" />{l.duration_min} min</span>}
          {!compact && l.service_area && home && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{l.service_area}</span>}
          {!compact && l.attributes?.installation && <span className="inline-flex items-center gap-0.5"><Wrench className="h-3 w-3" />Installation</span>}
        </div>
        {!compact && l.attributes?.delivery && <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-leaf"><Truck className="h-3 w-3" />{l.attributes.delivery}</div>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div>
            {price.amount != null ? (
              <>
                {price.from && <div className="text-[10px] font-semibold text-muted-foreground">Starting</div>}
                <span className="font-display text-lg font-extrabold">{formatINR(price.amount)}</span>
                {l.mrp && <span className="ml-1 text-xs text-muted-foreground line-through">{formatINR(Number(l.mrp))}</span>}
              </>
            ) : <span className="text-sm font-bold text-muted-foreground">Price on quote</span>}
          </div>
          {!compact && <span className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground">{ctaFor(l)}</span>}
        </div>
      </div>
    </Link>
  );
}

export function PartnerCard({ p, compact = false }: { p: MpPartner; compact?: boolean }) {
  const open = isOpenNow(p);
  return (
    <Link to="/store/$id" params={{ id: p.slug }} className={`relative flex gap-3 rounded-2xl border border-border bg-card p-3 shadow-pop transition hover:-translate-y-0.5 ${compact ? "w-64 shrink-0" : ""}`}>
      <Thumb images={p.photos} icon={p.icon} className="h-16 w-16 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="truncate pr-8 font-bold">{p.name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <Rating value={p.rating} count={p.review_count} />
          {p.distance_km != null && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{p.distance_km} km</span>}
          {open != null && <span className={`font-bold ${open ? "text-leaf" : "text-destructive"}`}>{open ? "Open" : "Closed"}</span>}
        </div>
        {p.opens_at && <div className="mt-0.5 text-[11px] text-muted-foreground">{fmtTime(p.opens_at)} – {fmtTime(p.closes_at)}</div>}
        {!compact && p.service_modes?.includes("HOME_SERVICE") && <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary"><Package className="h-3 w-3" />Home service available</div>}
      </div>
      <FavButton type="partner" id={p.id} className="absolute right-2 top-2" />
    </Link>
  );
}

export function SkeletonGrid({ n = 6 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-secondary" />)}
    </div>
  );
}

export function EmptyState({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <div className="font-display text-lg font-bold">{title}</div>
      {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function PageTop({ title, back = "/" }: { title: string; back?: string }) {
  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 lg:max-w-5xl">
        <button type="button" onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = back))} aria-label="Back"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border hover:bg-secondary">
          <span aria-hidden className="text-lg leading-none">‹</span>
        </button>
        <h1 className="truncate font-display text-lg font-bold">{title}</h1>
      </div>
    </div>
  );
}
