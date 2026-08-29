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
          setLocation({
            query: res.address || "Current location",
            area: res.address || "Current location",
            serviceable: false,
          });
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

  // The blocking "request Kartogo" screen no longer takes over the app on
  // open — customers browse freely and reach the request page from the Quick
  // service option instead. Detection above still runs silently.
  return null;
}
