import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { MapPin, Send, Loader2, Bike, CheckCircle2, User2 } from "lucide-react";
import { toast } from "sonner";
import { LocationPicker } from "@/components/LocationPicker";
import { locateByCoords } from "@/lib/serviceability.functions";
import { createUnserviceableRequestFn } from "@/lib/unserviceable.functions";
import { useAuth, useLocation } from "@/lib/store";

const SESSION_KEY = "qk_autoloc_done";

type Denied = { address: string; pincode: string | null; reason: string; lat: number | null; lng: number | null };

/**
 * Runs once per browser session when the customer opens the app: reads the
 * device's current position, reverse-geocodes it and updates the delivery
 * location automatically. If we don't deliver there yet, a full-screen
 * "coming soon" panel takes over with a one-tap request button.
 */
export function AutoLocationGate() {
  const { setLocation, location } = useLocation();
  const { user } = useAuth();
  const locate = useServerFn(locateByCoords);
  const [denied, setDenied] = useState<Denied | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);
  // Location at the moment we blocked the app — once the customer picks a
  // different, serviceable address the gate steps aside automatically.
  const [baselineQuery, setBaselineQuery] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let settled = false;
    try { if (sessionStorage.getItem(SESSION_KEY)) return; } catch { /* ignore */ }
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const handle = async (pos: GeolocationPosition) => {
      if (settled) return;
      settled = true;
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
      const { latitude: lat, longitude: lng } = pos.coords;
      try {
        const res = await locate({ data: { lat, lng } });
        if (!alive) return;
        if (res.serviceable) {
          const area = res.area ?? res.address ?? "Current location";
          setLocation({
            query: res.address || area,
            area,
            serviceable: true,
            etaMinutes: res.etaMinutes ?? undefined,
            baseQuery: res.address || area,
          });
        } else {
          setBaselineQuery(location?.query ?? "");
          setDenied({
            address: res.address || "your current location",
            pincode: res.pincode ?? null,
            reason: res.reason,
            lat,
            lng,
          });
        }

      } catch { /* silent — the manual picker still works */ }
    };

    // Fast path: accept a recently cached, coarse fix so the app knows where the
    // customer is almost instantly. A precise fix runs in parallel and only
    // matters if the quick one fails.
    navigator.geolocation.getCurrentPosition(
      handle,
      () => { /* fall back to the precise attempt below */ },
      { enableHighAccuracy: false, timeout: 2500, maximumAge: 900000 },
    );
    navigator.geolocation.getCurrentPosition(
      handle,
      () => {
        if (settled) return;
        settled = true;
        try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
    );

    return () => { alive = false; };
  }, [locate, setLocation]);


  const sendRequest = useCallback(async () => {
    if (!denied) return;
    setRequesting(true);
    try {
      await createUnserviceableRequestFn({
        data: {
          phone: user?.phone ?? null,
          pincode: denied.pincode,
          areaText: denied.address,
          lat: denied.lat,
          lng: denied.lng,
          note: null,
        },
      });
      setRequested(true);
      toast.success("Location requested");
    } catch {
      toast.error("Couldn't send your request. Please try again.");
    } finally {
      setRequesting(false);
    }
  }, [denied, user?.phone]);

  if (!denied) return null;
  // Customer picked a different, serviceable address from the location sheet.
  if (location?.serviceable && location.query !== baselineQuery) return null;


  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      {/* Header */}
      <div className="bg-gradient-to-b from-[oklch(0.9_0.07_70)] to-background px-5 pb-6 pt-6">
        <h2 className="font-display text-3xl font-extrabold tracking-tight">Unserviceable area</h2>
        <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-semibold text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">{denied.address}</span>
        </p>
      </div>

      {/* Coming soon illustration */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="font-display text-2xl font-extrabold leading-tight text-primary/80 sm:text-3xl">
          COMING SOON
          <br />
          TO YOUR
          <br />
          NEIGHBOURHOOD
        </div>
        <div className="mt-8 grid h-32 w-32 place-items-center rounded-full bg-primary/10">
          <Bike className="h-16 w-16 text-primary" />
        </div>
        <p className="mt-6 max-w-sm text-sm text-muted-foreground">
          {denied.reason} We're expanding fast — tell us you're here and we'll ping you the moment Kartogo goes live in your area.
        </p>
        {requested && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-leaf/10 px-4 py-2 text-sm font-bold text-leaf">
            <CheckCircle2 className="h-4 w-4" /> Location requested
          </div>
        )}
      </div>

      {/* Action */}
      <div className="space-y-2 px-5 pb-8 pt-2">
        {!requested && (
          <button
            type="button"
            onClick={() => void sendRequest()}
            disabled={requesting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-display text-base font-extrabold text-primary-foreground shadow-pop transition hover:bg-primary/90 disabled:opacity-60"
          >
            {requesting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            Request Kartogo in your area
          </button>
        )}
        <div className="flex items-stretch gap-2">
          <div className="flex-1">
            <LocationPicker variant="button" buttonLabel="Change location" />
          </div>
          <Link
            to="/menu"
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 font-display text-sm font-extrabold shadow-pop transition hover:bg-secondary"
          >
            <User2 className="h-4 w-4 text-primary" /> Account details
          </Link>
        </div>
      </div>
    </div>
  );
}

