import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Search, X, ChevronDown, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { checkServiceability } from "@/lib/serviceability.functions";
import { useLocation } from "@/lib/store";

export function LocationPicker() {
  const { location, setLocation } = useLocation();
  const check = useServerFn(checkServiceability);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery(location?.query ?? "");
      setDenied(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      toast.error("Please type your location");
      return;
    }
    setLoading(true);
    setDenied(null);
    try {
      const result = await check({ data: { location: query } });
      if (result.serviceable) {
        setLocation({ query: query.trim(), area: result.area ?? query.trim() });
        toast.success(result.reason);
        setOpen(false);
      } else {
        setDenied(result.reason);
      }
    } catch {
      toast.error("Couldn't check your location. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
      >
        <MapPin className="h-3.5 w-3.5 text-primary" />
        <span className="max-w-[140px] truncate">
          {location ? `${location.area} · 15 min` : "Set your location"}
        </span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/40 p-4 backdrop-blur-sm sm:items-center">
          <div className="mt-16 w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-pop sm:mt-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold">Change your location</h2>
                <p className="text-xs text-muted-foreground">
                  We'll check if we deliver to your area.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-ring">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => { setQuery(e.target.value); setDenied(null); }}
                  placeholder="Type your area or pincode"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>

              {denied && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{denied}</span>
                </div>
              )}

              <button
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? "Checking..." : "Check & save"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
