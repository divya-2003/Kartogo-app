import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Search, ShoppingBag, Loader2, XCircle } from "lucide-react";
import { checkServiceability } from "@/lib/serviceability.functions";
import { useLocation } from "@/lib/store";
import { toast } from "sonner";

export function LocationGate() {
  const { setLocation } = useLocation();
  const check = useServerFn(checkServiceability);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState<string | null>(null);

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Brand */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-pop">
          <ShoppingBag className="h-8 w-8" />
        </div>
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight">QuickKart</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ongole's 15-min neighbourhood store</p>
        </div>
      </div>

      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-pop md:p-8">
          <h2 className="font-display text-xl font-bold">Where should we deliver?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Type your area, locality or 6-digit pincode. We'll check if we deliver to you.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-ring">
              <MapPin className="h-4 w-4 text-primary" />
              <input
                autoFocus
                value={query}
                onChange={(e) => { setQuery(e.target.value); setDenied(null); }}
                placeholder="e.g. Magunta Layout, Ongole or 523002"
                className="w-full bg-transparent text-base outline-none"
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? "Checking..." : "Check serviceability"}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          We currently deliver only within Ongole, Andhra Pradesh.
        </p>
      </div>
    </div>
  );
}
