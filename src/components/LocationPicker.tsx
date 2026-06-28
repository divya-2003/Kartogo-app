import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Search, X, ChevronDown, Loader2, XCircle, Clock, Check, Trash2, LocateFixed, Zap } from "lucide-react";
import { toast } from "sonner";
import { checkServiceability, locateByCoords } from "@/lib/serviceability.functions";
import { searchServiceableAreas, deliveryWindow, DARK_STORE, type ServiceableArea } from "@/lib/serviceability";
import { useLocation, type SavedLocation } from "@/lib/store";

export function LocationPicker() {
  const { location, savedAddresses, setLocation, removeSavedAddress } = useLocation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // useServerFn needs the client-side router context. Rendering the interactive
  // picker only after mount prevents SSR from crashing and switching the whole
  // app to client rendering.
  if (!mounted) {
    return (
      <button className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold">
        <MapPin className="h-3.5 w-3.5 text-primary" />
        <span className="max-w-[140px] truncate">
          {location ? location.area : "Set your location"}
        </span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
    );
  }

  return (
    <LocationPickerClient
      location={location}
      savedAddresses={savedAddresses}
      setLocation={setLocation}
      removeSavedAddress={removeSavedAddress}
    />
  );
}

function LocationPickerClient({
  location,
  savedAddresses,
  setLocation,
  removeSavedAddress,
}: {
  location: SavedLocation | null;
  savedAddresses: SavedLocation[];
  setLocation: (loc: SavedLocation) => void;
  removeSavedAddress: (query: string) => void;
}) {
  const check = useServerFn(checkServiceability);
  const locate = useServerFn(locateByCoords);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setDenied(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Lock background scroll while the full-screen sheet is open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const suggestions = useMemo<ServiceableArea[]>(
    () => searchServiceableAreas(query, 6),
    [query],
  );

  const selectArea = (area: ServiceableArea) => {
    setLocation({
      query: `${area.name}, ${DARK_STORE_CITY} ${area.pincode}`,
      area: area.name,
      serviceable: true,
      etaMinutes: area.etaMinutes,
    });
    toast.success(`Delivering to ${area.name} in ${deliveryWindow(area.etaMinutes)}`);
    setOpen(false);
  };

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
        setLocation({
          query: query.trim(),
          area: result.area ?? query.trim(),
          serviceable: true,
          etaMinutes: result.etaMinutes ?? undefined,
        });
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

  const useCurrentLocation = () => {
    setDenied(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Geolocation isn't supported on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const result = await locate({
            data: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          });
          if (result.serviceable) {
            const label = result.area ?? result.address ?? "Current location";
            setLocation({ query: result.address ?? label, area: label });
            toast.success(result.reason);
            setOpen(false);
          } else {
            if (result.address) setQuery(result.address);
            setDenied(result.reason);
          }
        } catch {
          toast.error("Couldn't detect your location. Please try again.");
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Please type your area instead."
            : "Couldn't get your location. Please type your area instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const selectSaved = (addr: SavedLocation) => {
    setLocation(addr);
    toast.success(`Delivering to ${addr.area}`);
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
      >
        <MapPin className="h-3.5 w-3.5 text-primary" />
        <span className="max-w-[140px] truncate">
          {location ? location.area : "Set your location"}
        </span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-4">
            <div>
              <h2 className="font-display text-lg font-bold">Select your location</h2>
              <p className="text-xs text-muted-foreground">
                We'll check if we deliver to your area.
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="mx-auto w-full max-w-lg flex-1 overflow-y-auto px-4 py-5">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-3 focus-within:ring-2 focus-within:ring-ring">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => { setQuery(e.target.value); setDenied(null); }}
                  placeholder="Type your area, locality or pincode"
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
                {loading ? "Checking..." : "Check & deliver here"}
              </button>
            </form>

            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 py-3 font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
            >
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
              {locating ? "Detecting your location..." : "Use my current location"}
            </button>


            {/* Saved addresses */}
            <div className="mt-8">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Saved addresses
              </h3>

              {savedAddresses.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No saved addresses yet. Locations you confirm will appear here.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {savedAddresses.map((addr) => {
                    const active = location?.query.toLowerCase() === addr.query.toLowerCase();
                    return (
                      <li
                        key={addr.query}
                        className={`flex items-center gap-3 rounded-xl border p-3 ${active ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                      >
                        <button
                          onClick={() => selectSaved(addr)}
                          className="flex flex-1 items-start gap-3 text-left"
                        >
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{addr.area}</span>
                            <span className="block truncate text-xs text-muted-foreground">{addr.query}</span>
                          </span>
                        </button>
                        {active ? (
                          <Check className="h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <button
                            onClick={() => removeSavedAddress(addr.query)}
                            aria-label="Remove address"
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
