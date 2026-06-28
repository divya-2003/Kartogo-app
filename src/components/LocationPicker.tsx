import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Search, X, ChevronDown, Loader2, XCircle, Clock, Check, Trash2, LocateFixed, Zap, Pencil } from "lucide-react";
import { toast } from "sonner";
import { checkServiceability, locateByCoords } from "@/lib/serviceability.functions";
import { searchServiceableAreas, deliveryWindow, DARK_STORE, type ServiceableArea } from "@/lib/serviceability";
import { useLocation, buildLocationQuery, type SavedLocation } from "@/lib/store";

export function LocationPicker() {
  const { location, savedAddresses, setLocation, removeSavedAddress, updateSavedAddress } = useLocation();
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
      updateSavedAddress={updateSavedAddress}
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

  // Second step: capture the exact address (door no, apartment, landmark) for a
  // confirmed serviceable area before we save the location.
  const [pending, setPending] = useState<
    { query: string; area: string; etaMinutes?: number } | null
  >(null);
  const [doorNumber, setDoorNumber] = useState("");
  const [apartment, setApartment] = useState("");
  const [landmark, setLandmark] = useState("");

  useEffect(() => {
    if (open) {
      setQuery("");
      setDenied(null);
      setPending(null);
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

  // Move to the "exact location" step for a confirmed serviceable area.
  const startDetails = (p: { query: string; area: string; etaMinutes?: number }) => {
    setPending(p);
    setDoorNumber("");
    setApartment("");
    setLandmark("");
  };

  const selectArea = (area: ServiceableArea) => {
    startDetails({
      query: `${area.name}, ${DARK_STORE.city} ${area.pincode}`,
      area: area.name,
      etaMinutes: area.etaMinutes,
    });
  };

  const saveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending) return;
    if (!doorNumber.trim()) {
      toast.error("Please add your door / flat number");
      return;
    }
    const parts = [
      doorNumber.trim(),
      apartment.trim(),
      pending.query,
      landmark.trim() ? `Near ${landmark.trim()}` : "",
    ].filter(Boolean);
    setLocation({
      query: parts.join(", "),
      area: pending.area,
      serviceable: true,
      etaMinutes: pending.etaMinutes,
      doorNumber: doorNumber.trim(),
      apartment: apartment.trim() || undefined,
      landmark: landmark.trim() || undefined,
      baseQuery: pending.query,
    });
    toast.success(`Delivering to ${pending.area} in ${deliveryWindow(pending.etaMinutes)}`);
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
        startDetails({
          query: query.trim(),
          area: result.area ?? query.trim(),
          etaMinutes: result.etaMinutes ?? undefined,
        });
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
            startDetails({
              query: result.address ?? label,
              area: label,
              etaMinutes: result.etaMinutes ?? undefined,
            });
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
              <h2 className="font-display text-lg font-bold">
                {pending ? "Add your exact location" : "Select your location"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {pending
                  ? `${pending.area} · delivery in ${deliveryWindow(pending.etaMinutes)}`
                  : "We'll check if we deliver to your area."}
              </p>
            </div>
            <button
              onClick={() => (pending ? setPending(null) : setOpen(false))}
              aria-label="Close"
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {pending ? (
            /* Step 2: exact address details */
            <div className="mx-auto w-full max-w-lg flex-1 overflow-y-auto px-4 py-5">
              <div className="flex items-start gap-2 rounded-xl border border-leaf/30 bg-leaf/10 p-3 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-leaf" />
                <span>
                  <span className="block font-semibold">{pending.area}</span>
                  <span className="block text-xs text-muted-foreground">{pending.query}</span>
                </span>
              </div>

              <form onSubmit={saveDetails} className="mt-5 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Door / Flat number
                  </label>
                  <input
                    autoFocus
                    value={doorNumber}
                    onChange={(e) => setDoorNumber(e.target.value)}
                    placeholder="e.g. 12-3-45, Flat 201"
                    className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Apartment / Building name <span className="font-normal normal-case">(optional)</span>
                  </label>
                  <input
                    value={apartment}
                    onChange={(e) => setApartment(e.target.value)}
                    placeholder="e.g. Sai Residency"
                    className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Landmark <span className="font-normal normal-case">(optional)</span>
                  </label>
                  <input
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="e.g. Opposite SBI ATM"
                    className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90">
                  <Check className="h-4 w-4" /> Save & deliver here
                </button>
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  className="w-full rounded-xl py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  Change area
                </button>
              </form>
            </div>
          ) : (
          /* Body */
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

            {/* Autocomplete suggestions */}
            <div className="mt-6">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> {query.trim() ? "Matching areas" : "Popular areas we deliver to"}
              </h3>
              {suggestions.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No serviceable area matches “{query.trim()}”. We currently deliver only in Ongole.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {suggestions.map((area) => (
                    <li key={area.keyword}>
                      <button
                        type="button"
                        onClick={() => selectArea(area)}
                        className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left hover:border-primary hover:bg-primary/5"
                      >
                        <MapPin className="h-4 w-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{area.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">Ongole · {area.pincode}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-leaf/10 px-2 py-1 text-[11px] font-bold text-leaf">
                          <Zap className="h-3 w-3" /> {deliveryWindow(area.etaMinutes)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>




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
          )}
        </div>,
        document.body
      )}
    </>
  );
}
