import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Store, Plus, Pencil, Trash2, LocateFixed, MapPin, X, ExternalLink, Loader2, Power } from "lucide-react";
import {
  listPartnerMarketsFn,
  upsertPartnerMarketFn,
  deletePartnerMarketFn,
  type PartnerMarket,
} from "@/lib/partners.functions";

export const Route = createFileRoute("/admin/partners")({
  component: AdminPartnersPage,
  head: () => ({ meta: [{ title: "Partner markets — Kartogo Admin" }] }),
});

function adminToken(): string | null {
  try { return JSON.parse(localStorage.getItem("qk_admin_token") || "null"); } catch { return null; }
}

// Parse an assortment of Google-Maps-style URLs to (lat, lng).
function parseGoogleMapsUrl(raw: string): { lat: number; lng: number } | null {
  const s = raw.trim();
  if (!s) return null;
  // 1) @lat,lng
  const at = s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]) };
  // 2) ?q=lat,lng or &q=lat,lng or !3dlat!4dlng
  const q = s.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (q) return { lat: Number(q[1]), lng: Number(q[2]) };
  const q2 = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (q2) return { lat: Number(q2[1]), lng: Number(q2[2]) };
  // 3) Plain "lat,lng"
  const plain = s.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (plain) return { lat: Number(plain[1]), lng: Number(plain[2]) };
  return null;
}

function AdminPartnersPage() {
  const [markets, setMarkets] = useState<PartnerMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PartnerMarket | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const token = adminToken();
    if (!token) return;
    setLoading(true);
    try {
      const rows = await listPartnerMarketsFn({ data: { adminToken: token } });
      setMarkets(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (m: PartnerMarket) => {
    const token = adminToken(); if (!token) return;
    try {
      await upsertPartnerMarketFn({ data: {
        adminToken: token, id: m.id, name: m.name, address: m.address, phone: m.phone,
        lat: m.lat, lng: m.lng, notes: m.notes, isActive: !m.isActive,
      }});
      toast.success(!m.isActive ? "Market activated" : "Market deactivated");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const remove = async (m: PartnerMarket) => {
    if (!confirm(`Remove ${m.name}?`)) return;
    const token = adminToken(); if (!token) return;
    try {
      await deletePartnerMarketFn({ data: { adminToken: token, id: m.id } });
      toast.success("Removed");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-1">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <Store className="h-6 w-6 text-primary" /> Partner markets
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Supermarkets and partner stores supplying Kartogo. Location pinned on Google Maps.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setCreating(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add market
        </button>
      </header>

      {loading ? (
        <div className="grid place-items-center py-10 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : markets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No partner markets yet. Add your first supermarket to get started.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {markets.map(m => (
            <li key={m.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base font-bold truncate">{m.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${m.isActive ? "bg-leaf/15 text-leaf" : "bg-muted text-muted-foreground"}`}>
                      {m.isActive ? "Active" : "Inactive"}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${m.acceptingOrders ? "bg-primary/10 text-primary" : "bg-destructive/15 text-destructive"}`}>
                      {m.acceptingOrders ? "Taking orders" : "Paused"}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">~{m.prepMinutes} min prep</span>
                  </div>
                  <div className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-2">{m.address}</span>
                  </div>
                  {m.phone && (
                    <a href={`tel:${m.phone}`} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      📞 {m.phone}
                    </a>
                  )}
                  {m.notes && <p className="mt-2 text-xs italic text-muted-foreground">{m.notes}</p>}
                </div>
              </div>

              {m.lat != null && m.lng != null && (
                <div className="mt-3 overflow-hidden rounded-xl border border-border">
                  <iframe
                    title={`Map for ${m.name}`}
                    src={`https://maps.google.com/maps?q=${m.lat},${m.lng}&z=15&output=embed`}
                    className="h-40 w-full"
                    loading="lazy"
                  />
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {m.lat != null && m.lng != null && (
                  <a
                    href={`https://www.google.com/maps?q=${m.lat},${m.lng}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open in Maps
                  </a>
                )}
                <button
                  onClick={() => { setEditing(m); setCreating(false); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => toggleActive(m)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                >
                  <Power className="h-3.5 w-3.5" /> {m.isActive ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => remove(m)}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/15"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <MarketEditor
          initial={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </div>
  );
}

function MarketEditor({ initial, onClose, onSaved }: {
  initial: PartnerMarket | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lat, setLat] = useState<string>(initial?.lat != null ? String(initial.lat) : "");
  const [lng, setLng] = useState<string>(initial?.lng != null ? String(initial.lng) : "");
  const [urlInput, setUrlInput] = useState("");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const applyMapsUrl = () => {
    const parsed = parseGoogleMapsUrl(urlInput);
    if (!parsed) { toast.error("Couldn't read a location from that link. Paste a Google Maps URL or 'lat,lng'."); return; }
    setLat(String(parsed.lat));
    setLng(String(parsed.lng));
    toast.success("Location pinned from link");
  };

  const useCurrent = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Geolocation isn't available on this device"); return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        // Best-effort reverse geocode to prefill the address if empty.
        if (!address.trim()) {
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=17&addressdetails=1`, {
              headers: { "Accept-Language": "en" },
            });
            if (res.ok) {
              const j = await res.json() as { display_name?: string };
              if (j.display_name) setAddress(j.display_name);
            }
          } catch { /* noop */ }
        }
        setLocating(false);
        toast.success("Current location pinned");
      },
      () => { setLocating(false); toast.error("Couldn't get your location"); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = adminToken();
    if (!token) { toast.error("Admin session expired"); return; }
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!address.trim()) { toast.error("Address is required"); return; }
    const latN = lat === "" ? null : Number(lat);
    const lngN = lng === "" ? null : Number(lng);
    if ((latN != null && !Number.isFinite(latN)) || (lngN != null && !Number.isFinite(lngN))) {
      toast.error("Latitude and longitude must be numbers"); return;
    }
    setSaving(true);
    try {
      await upsertPartnerMarketFn({ data: {
        adminToken: token,
        id: initial?.id,
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim() || null,
        lat: latN, lng: lngN,
        notes: notes.trim() || null,
        isActive: initial?.isActive ?? true,
      }});
      toast.success(initial ? "Market updated" : "Market added");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  };

  const hasPin = lat !== "" && lng !== "" && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-t-2xl bg-card shadow-pop md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-display text-lg font-bold">{initial ? "Edit market" : "Add partner market"}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={save} className="max-h-[80vh] space-y-3 overflow-y-auto p-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Reliance Fresh, Kurnool Rd"
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Address</label>
            <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2}
              placeholder="Full address / landmark"
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Mobile number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" placeholder="e.g. 9876543210"
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="rounded-xl border border-border bg-secondary/40 p-3">
            <div className="font-display text-sm font-bold">Google Maps location</div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Pin the exact location by using GPS, or paste a Google Maps share link.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={useCurrent} disabled={locating}
                className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15 disabled:opacity-60">
                {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
                Use my current location
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
                placeholder="Paste Google Maps link or lat,lng"
                className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none" />
              <button type="button" onClick={applyMapsUrl}
                className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-background hover:bg-ink/90">
                Pin
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input value={lat} onChange={e => setLat(e.target.value)} placeholder="Latitude"
                className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none" />
              <input value={lng} onChange={e => setLng(e.target.value)} placeholder="Longitude"
                className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none" />
            </div>
            {hasPin && (
              <div className="mt-3 overflow-hidden rounded-lg border border-border">
                <iframe title="Preview" src={`https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`} className="h-36 w-full" loading="lazy" />
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Manager Ravi — 9876543210"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary">
              Cancel
            </button>
            <button disabled={saving}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {saving ? "Saving…" : initial ? "Save changes" : "Add market"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
