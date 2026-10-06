import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LocateFixed, MapPin, Navigation, Clock, Loader2 } from "lucide-react";
import { PageTop } from "@/components/marketplace/Cards";
import { useAuth } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { VEHICLES, distanceKm, quote, type Vehicle } from "@/lib/rides";
import { createRideFn, cancelServiceOrderFn, myServiceOrdersFn } from "@/lib/service-orders.functions";

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

// Stores don't have saved map pins yet, so store drops use Ongole town centre for the fare.
const TOWN_CENTRE = { lat: 15.5057, lng: 80.0499 };

type Place = { label: string; lat: number; lng: number };

// Popular Ongole spots for quick selection.
const PLACES: Place[] = [
  { label: "Ongole Railway Station", lat: 15.5057, lng: 80.0499 },
  { label: "RTC Bus Stand, Ongole", lat: 15.5036, lng: 80.0446 },
  { label: "Church Centre", lat: 15.5009, lng: 80.0485 },
  { label: "Kurnool Road", lat: 15.5108, lng: 80.0324 },
  { label: "Govt. General Hospital (RIMS)", lat: 15.4945, lng: 80.0579 },
  { label: "Kotha Patnam Beach", lat: 15.4426, lng: 80.1515 },
  { label: "Trunk Road", lat: 15.5148, lng: 80.0472 },
];

function PlacePicker({ label, value, onChange, allowCurrent }: { label: string; value: Place | null; onChange: (p: Place) => void; allowCurrent?: boolean }) {
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const locate = () => {
    if (!navigator.geolocation) return void toast.error("Location isn't available on this device");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      p => { setLocating(false); setOpen(false); onChange({ label: "Current location", lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => { setLocating(false); toast.error("Couldn't get your location. Pick a place instead."); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-background p-3 text-left">
        {allowCurrent ? <span className="h-3 w-3 rounded-full bg-leaf" /> : <span className="h-3 w-3 rounded-sm bg-destructive" />}
        <div className="min-w-0"><div className="text-[11px] font-bold uppercase text-muted-foreground">{label}</div><div className={`truncate text-sm font-semibold ${value ? "" : "text-muted-foreground"}`}>{value?.label ?? "Choose a place"}</div></div>
      </button>
      {open && (
        <div className="mt-2 space-y-1 rounded-xl border border-border bg-card p-2">
          {allowCurrent && <button onClick={locate} className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm font-bold text-primary hover:bg-secondary">{locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}Use current location</button>}
          {PLACES.map(p => <button key={p.label} onClick={() => { onChange(p); setOpen(false); }} className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-secondary"><MapPin className="h-4 w-4 text-muted-foreground" />{p.label}</button>)}
        </div>
      )}
    </div>
  );
}

function RidesPage() {
  const { customerToken } = useAuth();
  const nav = useNavigate();
  const search = Route.useSearch();
  const [pickup, setPickup] = useState<Place | null>(null);
  const [drop, setDrop] = useState<Place | null>(() =>
    search.drop ? { label: search.drop, ...TOWN_CENTRE }
    : search.type === "station" ? PLACES[0] : null);
  const [vehicle, setVehicle] = useState<Vehicle>(search.type === "cab" ? "car" : search.type === "bike" ? "bike" : "auto");
  const [busy, setBusy] = useState(false);
  const [ride, setRide] = useState<{ id: string; code: string; stage: "searching" | "found"; status?: string; driver?: string; driverPhone?: string } | null>(null);
  const [nearby, setNearby] = useState<Record<Vehicle, number>>({ bike: 0, auto: 0, car: 0 });

  // Auto-fill pickup from current location on first load.
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(p => setPickup(cur => cur ?? { label: "Current location", lat: p.coords.latitude, lng: p.coords.longitude }), () => {}, { timeout: 8000 });
    setNearby({ bike: 3 + Math.floor(Math.random() * 5), auto: 2 + Math.floor(Math.random() * 4), car: 1 + Math.floor(Math.random() * 3) });
  }, []);

  // Follow the real ride status as the driver updates it.
  useEffect(() => {
    if (!ride || !customerToken) return;
    const poll = async () => {
      const rows = await myServiceOrdersFn({ data: { token: customerToken } }).catch(() => []);
      const r = rows.find(x => x.id === ride.id) as any;
      if (r) setRide(cur => cur && { ...cur, status: r.status, stage: r.status === "SEARCHING" ? "searching" : "found", driver: r.driver_name ?? undefined, driverPhone: r.driver_phone ?? undefined });
    };
    const t = setInterval(poll, 8000);
    return () => clearInterval(t);
  }, [ride?.id, customerToken]);

  const km = useMemo(() => pickup && drop ? distanceKm(pickup, drop) : null, [pickup, drop]);

  const book = async () => {
    if (!customerToken) { toast("Please login to book a ride"); nav({ to: "/login", search: { redirect: "/rides" } }); return; }
    if (!pickup || !drop) return void toast.error("Choose pickup and drop");
    if (pickup.label === drop.label && km! < 0.6) return void toast.error("Pickup and drop are the same");
    setBusy(true);
    const r = await createRideFn({ data: { token: customerToken, pickup, drop, vehicle } }).catch(() => null);
    setBusy(false);
    if (!r) return void toast.error("Network error, please try again");
    if (!r.ok) return void toast.error(r.error);
    setRide({ id: r.id, code: r.code, stage: "searching" });
  };
  const cancel = async () => {
    if (!ride || !customerToken) return;
    const r = await cancelServiceOrderFn({ data: { token: customerToken, id: ride.id } }).catch(() => null);
    if (r?.ok) { toast("Ride cancelled"); setRide(null); } else toast.error(r?.error ?? "Couldn't cancel");
  };

  if (ride) {
    const v = VEHICLES.find(x => x.id === vehicle)!;
    return (
      <div className="min-h-screen bg-background">
        <PageTop title="Your ride" />
        <div className="mx-auto max-w-md space-y-4 px-4 py-8 text-center">
          {ride.stage === "searching" ? (
            <>
              <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                <span className="absolute inset-6 animate-ping rounded-full bg-primary/30 [animation-delay:300ms]" />
                <span className="relative text-6xl">{v.icon}</span>
              </div>
              <h2 className="font-display text-xl font-extrabold">Finding a nearby {v.label.toLowerCase()} driver…</h2>
              <p className="text-sm text-muted-foreground">Booking #{ride.code}</p>
            </>
          ) : (
            <>
              <div className="text-6xl">{v.icon}</div>
              <h2 className="font-display text-xl font-extrabold">{ride.status === "ARRIVED" ? "Your driver has arrived" : ride.status === "IN_TRIP" ? "On the way to drop" : ride.status === "COMPLETED" ? "Ride completed" : ride.status === "CANCELLED" ? "Ride cancelled" : "Driver is on the way"}</h2>
              {ride.driver && <p className="text-sm font-semibold">{ride.driver}{ride.driverPhone ? ` · ${ride.driverPhone}` : ""}</p>}
              <p className="text-sm text-muted-foreground">Booking #{ride.code}</p>
            </>
          )}
          <div className="rounded-2xl border border-border bg-card p-4 text-left text-sm">
            <div className="flex gap-2"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-leaf" />{pickup?.label}</div>
            <div className="mt-2 flex gap-2"><span className="mt-1 h-2.5 w-2.5 rounded-sm bg-destructive" />{drop?.label}</div>
            <div className="mt-3 flex justify-between border-t border-border pt-2 font-bold"><span>Fare</span><span>{formatINR(quote(vehicle, km ?? 1).fare)}</span></div>
          </div>
          <div className="flex gap-2">
            <button onClick={cancel} className="h-12 flex-1 rounded-xl border border-destructive font-bold text-destructive">Cancel ride</button>
            <button onClick={() => nav({ to: "/orders", search: { tab: "bookings" } })} className="h-12 flex-1 rounded-xl bg-primary font-bold text-primary-foreground">My Orders</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <PageTop title="Kartogo Rides" />
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
          <PlacePicker label="Pickup" value={pickup} onChange={setPickup} allowCurrent />
          <PlacePicker label="Drop" value={drop} onChange={setDrop} />
        </div>
        {km != null && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Navigation className="h-4 w-4" />About {km.toFixed(1)} km</div>}
        <div className="space-y-2">
          {VEHICLES.map(v => {
            const q = quote(v.id, km ?? 0);
            return (
              <button key={v.id} onClick={() => setVehicle(v.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${vehicle === v.id ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                <span className="text-3xl">{v.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{v.label} <span className="text-xs font-normal text-muted-foreground">· {v.seats} seat{v.seats > 1 ? "s" : ""}</span></div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-leaf">{nearby[v.id]} nearby</span>
                    {km != null && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{q.minutes} min trip</span>}
                  </div>
                </div>
                <span className="font-display text-lg font-extrabold">{km != null ? formatINR(q.fare) : `${formatINR(v.perKm)}/km`}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">Upfront fare — what you see is what you pay. Pay the driver by cash or UPI.</p>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur">
        <button disabled={busy || !pickup || !drop} onClick={book} className="mx-auto flex h-12 w-full max-w-2xl items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50">
          {busy ? "Booking…" : `Book ${VEHICLES.find(x => x.id === vehicle)!.label}${km != null ? ` · ${formatINR(quote(vehicle, km).fare)}` : ""}`}
        </button>
      </div>
    </div>
  );
}
