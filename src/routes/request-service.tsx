import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { MapPin, ArrowLeft, LocateFixed, Loader2, CheckCircle2 } from "lucide-react";
import { createUnserviceableRequestFn } from "@/lib/unserviceable.functions";
import { useAuth } from "@/lib/store";

const searchSchema = z.object({
  pincode: z.string().optional(),
  area: z.string().optional(),
});

export const Route = createFileRoute("/request-service")({
  validateSearch: (raw) => searchSchema.parse(raw ?? {}),
  component: RequestServicePage,
  head: () => ({ meta: [{ title: "Request Kartogo in your area" }] }),
});

function RequestServicePage() {
  const { pincode, area } = useSearch({ from: "/request-service" });
  const nav = useNavigate();
  const { user } = useAuth();
  const [note, setNote] = useState("");
  const [areaText, setAreaText] = useState(area ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Auto-attempt to grab location on mount for a smoother flow.
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); },
      () => { setLocating(false); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const captureLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Location isn't available on this device"); return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); toast.success("Location attached"); },
      () => { setLocating(false); toast.error("Couldn't get your location"); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createUnserviceableRequestFn({ data: {
        phone: user?.phone ?? null,
        pincode: pincode ?? null,
        areaText: areaText.trim() || null,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        note: note.trim() || null,
      }});
      setDone(true);
      toast.success("Request sent to Kartogo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-6">
        <button onClick={() => nav({ to: "/" })} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
          <div className="font-display text-lg font-bold text-destructive">
            We're not serviceable at pincode {pincode ?? "your area"} yet.
          </div>
          <p className="mt-1 text-sm text-destructive/90">
            We currently deliver only in and around Ongole — but we're expanding. Let us know you're waiting.
          </p>
        </div>

        {done ? (
          <div className="mt-6 rounded-2xl border border-leaf/30 bg-leaf/10 p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-leaf" />
            <div className="mt-2 font-display text-xl font-bold">Thanks! Request received.</div>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll let you know as soon as Kartogo goes live in your area.
            </p>
            <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
              <Link to="/" className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90">Back to home</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-pop">
            <div className="text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <MapPin className="h-6 w-6" />
              </div>
              <h1 className="mt-3 font-display text-xl font-bold">Request Kartogo to your area</h1>
              <p className="text-xs text-muted-foreground">
                We use your live location and area description to plan expansion.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Your area / locality</label>
              <input value={areaText} onChange={e => setAreaText(e.target.value)}
                placeholder="e.g. Haldenahalli, Anekal"
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Anything specific? (optional)
              </label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="e.g. Big apartment community, ~500 flats"
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <button type="button" onClick={captureLocation} disabled={locating}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-60">
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
              {coords ? "Update location" : "Attach my current location"}
            </button>
            {coords && (
              <div className="rounded-lg bg-secondary/60 px-3 py-1.5 text-center text-[11px] font-semibold text-muted-foreground">
                Location attached: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </div>
            )}

            <button disabled={submitting}
              className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {submitting ? "Sending…" : "Request Kartogo to your area"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
