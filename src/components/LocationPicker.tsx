import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search, X, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { SERVICE_AREAS, findServiceArea, type ServiceArea } from "@/lib/data";

const STORAGE_KEY = "qk_location";

function readSaved(): ServiceArea | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? (JSON.parse(v) as ServiceArea) : null;
  } catch {
    return null;
  }
}

export function LocationPicker({ compact = false }: { compact?: boolean }) {
  const [saved, setSaved] = useState<ServiceArea | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSaved(readSaved());
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SERVICE_AREAS;
    return SERVICE_AREAS.filter(
      a => a.name.toLowerCase().includes(q) || a.pincode.includes(q),
    );
  }, [query]);

  const noMatch = query.trim().length > 0 && matches.length === 0;

  const choose = (area: ServiceArea) => {
    setSaved(area);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(area));
    } catch {
      /* noop */
    }
    setOpen(false);
    setQuery("");
    toast.success(`Delivering to ${area.name}`);
  };

  const handleCheck = () => {
    const found = findServiceArea(query);
    if (found) choose(found);
    else
      toast.error("Sorry, we don't deliver to that area yet — we currently serve Ongole.");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          compact
            ? "flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            : "flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
        }
      >
        <MapPin className="h-3.5 w-3.5 text-primary" />
        <span className="max-w-[120px] truncate">
          {saved ? `${saved.name} · 15 min` : "Set your location"}
        </span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/40 p-4 backdrop-blur-sm sm:items-center">
          <div className="mt-16 w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-pop sm:mt-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold">Choose your location</h2>
                <p className="text-xs text-muted-foreground">
                  We deliver in 15 min across Ongole.
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

            <form
              onSubmit={e => {
                e.preventDefault();
                handleCheck();
              }}
              className="mt-4 flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring"
            >
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Type your area or pincode"
                className="w-full bg-transparent text-sm outline-none"
              />
            </form>

            {noMatch ? (
              <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                Sorry, we don't deliver to “{query}” yet. We currently serve Ongole only.
              </div>
            ) : (
              <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                {matches.map(area => {
                  const active = saved?.name === area.name;
                  return (
                    <li key={`${area.name}-${area.pincode}`}>
                      <button
                        onClick={() => choose(area)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm hover:bg-secondary"
                      >
                        <span className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          <span>
                            <span className="font-medium">{area.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {area.pincode}
                            </span>
                          </span>
                        </span>
                        {active && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
