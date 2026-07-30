import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Loader2, CheckCircle2, MapPin } from "lucide-react";
import { createUnserviceableRequestFn } from "@/lib/unserviceable.functions";
import { useAuth } from "@/lib/store";

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

// No questions asked: the moment the customer lands here from the "Request
// Kartogo" button we capture their location (best effort) and file the request
// with the admin automatically.
function RequestServicePage() {
  const { pincode, area } = useSearch({ from: "/request-service" });
  const nav = useNavigate();
  const { user } = useAuth();
  const [state, setState] = useState<"sending" | "done" | "error">("sending");
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    const send = async (coords: { lat: number; lng: number } | null) => {
      try {
        await createUnserviceableRequestFn({ data: {
          phone: user?.phone ?? null,
          pincode: pincode ?? null,
          areaText: area?.trim() || null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          note: null,
        } });
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
  }, [pincode, area, user?.phone]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-6">
        <button onClick={() => nav({ to: "/" })} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
          <div className="font-display text-lg font-bold text-destructive">
            We're not serviceable at {pincode ? `pincode ${pincode}` : "your area"} yet.
          </div>
          <p className="mt-1 text-sm text-destructive/90">
            We currently deliver only in and around Ongole — but we're expanding fast.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-center shadow-pop">
          {state === "sending" && (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <div className="mt-2 font-display text-xl font-bold">Sending your request…</div>
              <p className="mt-1 text-sm text-muted-foreground">Attaching your location for our expansion map.</p>
            </>
          )}
          {state === "done" && (
            <>
              <CheckCircle2 className="mx-auto h-10 w-10 text-leaf" />
              <div className="mt-2 font-display text-xl font-bold">Thanks! Request received.</div>
              <p className="mt-1 text-sm text-muted-foreground">
                We'll let you know as soon as Kartogo goes live in your area.
              </p>
            </>
          )}
          {state === "error" && (
            <>
              <MapPin className="mx-auto h-10 w-10 text-destructive" />
              <div className="mt-2 font-display text-xl font-bold">Couldn't send your request</div>
              <p className="mt-1 text-sm text-muted-foreground">Please check your connection and try again.</p>
              <button
                onClick={() => { sent.current = false; setState("sending"); location.reload(); }}
                className="mt-4 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-secondary"
              >
                Try again
              </button>
            </>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link to="/" className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90">Back to home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
