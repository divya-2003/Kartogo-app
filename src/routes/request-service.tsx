import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { Loader2, CheckCircle2, MapPin, Bike, Send, User2, PackageCheck } from "lucide-react";
import { createUnserviceableRequestFn } from "@/lib/unserviceable.functions";
import { LocationPicker } from "@/components/LocationPicker";
import { useAuth, useLocation } from "@/lib/store";

const searchSchema = z.object({
  pincode: z.string().optional(),
  area: z.string().optional(),
});

export const Route = createFileRoute("/request-service")({
  validateSearch: (raw) => searchSchema.parse(raw ?? {}),
  component: RequestServicePage,
  head: () => ({
    meta: [
      { title: "Request Kartogo in your area" },
      { name: "description", content: "Tell Kartogo where you live and we'll notify you the moment 15-minute delivery goes live in your area." },
      { property: "og:title", content: "Request Kartogo in your area" },
      { property: "og:description", content: "We're expanding beyond Ongole — register your area and we'll ping you when we arrive." },
    ],
  }),
});

// Full-screen "coming soon" panel shown when Quick service isn't available for
// the customer's location. Requests are filed automatically on arrival.
function RequestServicePage() {
  const { pincode, area } = useSearch({ from: "/request-service" });
  const nav = useNavigate();
  const { user } = useAuth();
  const { location } = useLocation();
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  const areaLabel = area?.trim() || location?.query || location?.area || "your current location";
  const requestKey = `qk_area_requested:${(pincode || areaLabel).trim().toLowerCase()}`;

  // One request per location — remember what this device already asked for.
  useEffect(() => {
    try { if (localStorage.getItem(requestKey)) setState("done"); else setState("idle"); }
    catch { /* ignore */ }
  }, [requestKey]);

  // Picking a serviceable location from here takes the customer straight to
  // the quick page; an unserviceable pick keeps them on this screen.
  useEffect(() => {
    if (location?.serviceable) {
      try { localStorage.setItem("qk_service_tier", "quick"); } catch { /* ignore */ }
      nav({ to: "/", replace: true });
    }
  }, [location?.serviceable, location?.query, nav]);

  const submit = useCallback(() => {
    setState("sending");
    const send = async (coords: { lat: number; lng: number } | null) => {
      try {
        await createUnserviceableRequestFn({ data: {
          phone: user?.phone ?? null,
          pincode: pincode ?? null,
          areaText: area?.trim() || location?.query || null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          note: null,
        } });
        try { localStorage.setItem(requestKey, new Date().toISOString()); } catch { /* ignore */ }
        setState("done");
      } catch {
        setState("error");
      }
    };
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => void send({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => void send(null),
        { enableHighAccuracy: true, timeout: 6000 },
      );
    } else {
      void send(null);
    }
  }, [pincode, area, user?.phone, location?.query, requestKey]);

  const goStandard = () => {
    try { localStorage.setItem("qk_service_tier", "standard"); } catch { /* ignore */ }
    nav({ to: "/", replace: true });
  };


  return (
    <div className="min-h-screen bg-gradient-to-b from-[oklch(0.9_0.07_70)] to-background">
      <div className="mx-auto max-w-lg px-4 py-6">
        {/* header — title left, account details top right */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight">Unserviceable area</h1>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 truncate">{areaLabel}</span>
            </div>
          </div>
          <Link
            to="/menu"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold shadow-pop"
          >
            <User2 className="h-4 w-4 text-primary" /> Profile
          </Link>
        </div>

        {/* Change the delivery location right here — a serviceable pick jumps
            straight to the quick page, an unserviceable one stays on this page. */}
        <div className="mt-3">
          <LocationPicker variant="button" buttonLabel="Change location" />
        </div>


        <div className="mt-10 text-center">
          <div className="font-display text-3xl font-extrabold uppercase leading-tight tracking-tight text-primary">
            Coming soon<br />to your<br />neighbourhood
          </div>
          <div className="mx-auto mt-8 grid h-40 w-40 place-items-center rounded-full bg-primary/10">
            <Bike className="h-20 w-20 text-primary" />
          </div>

          <p className="mx-auto mt-8 max-w-sm text-sm text-muted-foreground">
            We're not serviceable at {pincode ? `pincode ${pincode}` : "your area"} yet. We currently deliver only in Ongole.
            We're expanding fast — tell us you're here and we'll ping you the moment Kartogo goes live in your area.
          </p>

          <div className="mt-6 min-h-[24px] text-sm font-semibold">
            {state === "sending" && (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Sending your request…
              </span>
            )}
            {state === "done" && (
              <span className="inline-flex items-center gap-2 text-leaf">
                <CheckCircle2 className="h-4 w-4" /> Request received
              </span>
            )}
            {state === "error" && (
              <button
                onClick={submit}
                className="inline-flex items-center gap-2 text-destructive underline"
              >
                Couldn't send — try again
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 space-y-3 pb-10">
          <button
            type="button"
            onClick={submit}
            disabled={state === "sending" || state === "done"}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 disabled:opacity-60 font-display text-base font-extrabold text-primary-foreground hover:bg-primary/90"
          >
            <Send className="h-5 w-5" /> Request Kartogo quick in your area
          </button>

          <div className="grid grid-cols-2 gap-3">
            <LocationPicker variant="button" buttonLabel="Change location" />
            <button
              type="button"
              onClick={goStandard}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 font-display text-sm font-extrabold"
            >
              <PackageCheck className="h-4 w-4 text-primary" /> Go to standard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
