import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Crosshair, MapPin, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { useAuth } from "@/lib/store";
import { Switch } from "@/components/ui/switch";
import { listDeliveryZonesFn, saveDeliveryZoneFn, deleteDeliveryZoneFn } from "@/lib/delivery-zones.functions";
import type { DeliveryZone } from "@/lib/delivery-zones";

export const Route = createFileRoute("/admin/delivery-zones")({
  component: DeliveryZonesAdmin,
  head: () => ({ meta: [{ title: "Quick areas & delivery times — Kartogo Admin" }] }),
});

type Draft = {
  id?: string;
  name: string;
  keyword: string;
  pincode: string;
  lat: string;
  lng: string;
  radiusKm: string;
  etaMinutes: string;
  quickEnabled: boolean;
  isActive: boolean;
};

const EMPTY: Draft = { name: "", keyword: "", pincode: "", lat: "", lng: "", radiusKm: "1", etaMinutes: "15", quickEnabled: true, isActive: true };

const input = "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function toDraft(z: DeliveryZone): Draft {
  return {
    id: z.id, name: z.name, keyword: z.keyword ?? "", pincode: z.pincode ?? "",
    lat: z.lat != null ? String(z.lat) : "", lng: z.lng != null ? String(z.lng) : "",
    radiusKm: String(z.radius_km ?? 1), etaMinutes: String(z.eta_minutes), quickEnabled: z.quick_enabled, isActive: z.is_active,
  };
}

function DeliveryZonesAdmin() {
  const { adminToken } = useAuth();
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    if (!adminToken) return;
    try { setZones(await listDeliveryZonesFn({ data: { adminToken } })); }
    catch (e) { toast.error((e as Error).message); }
  }, [adminToken]);
  useEffect(() => { void load(); }, [load]);

  const save = async (d: Draft) => {
    if (!adminToken) return;
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    const lat = num(d.lat), lng = num(d.lng);
    if ((lat != null && Number.isNaN(lat)) || (lng != null && Number.isNaN(lng))) { toast.error("Coordinates must be numbers"); return false; }
    setBusy(true);
    try {
      await saveDeliveryZoneFn({
        data: {
          adminToken, id: d.id, name: d.name, keyword: d.keyword.trim() || null, pincode: d.pincode.trim() || null,
          lat, lng, radiusKm: Number(d.radiusKm) || 1, etaMinutes: Math.round(Number(d.etaMinutes) || 15),
          quickEnabled: d.quickEnabled, isActive: d.isActive,
        },
      });
      await load();
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally { setBusy(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.name.trim().length < 2) { toast.error("Give the area a name"); return; }
    if (await save(draft)) { toast.success(draft.id ? "Area updated" : "Area added"); setDraft(EMPTY); }
  };

  const useMyPosition = () => {
    if (!navigator.geolocation) { toast.error("This device can't share its location"); return; }
    navigator.geolocation.getCurrentPosition(
      p => setDraft(d => ({ ...d, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) })),
      () => toast.error("Couldn't read your location"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const remove = async (z: DeliveryZone) => {
    if (!adminToken || !confirm(`Remove ${z.name}?`)) return;
    try { await deleteDeliveryZoneFn({ data: { adminToken, id: z.id } }); toast.success("Area removed"); await load(); }
    catch (e) { toast.error((e as Error).message); }
  };

  const shown = zones.filter(z => !filter.trim() || `${z.name} ${z.keyword ?? ""} ${z.pincode ?? ""}`.toLowerCase().includes(filter.trim().toLowerCase()));
  const quickCount = zones.filter(z => z.is_active && z.quick_enabled).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Quick areas & delivery times</h1>
        <p className="text-sm text-muted-foreground">
          Switch Quick delivery on or off and set the delivery time for each area. Add a map point to cover exact coordinates with a radius — customers detected inside it get these settings first.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold">{draft.id ? `Edit ${draft.name}` : "Add an area"}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label><span className="mb-1 block text-xs font-semibold text-muted-foreground">Area name</span>
            <input className={input} value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Ramnagar 2nd line" /></label>
          <label><span className="mb-1 block text-xs font-semibold text-muted-foreground">Match words in address</span>
            <input className={input} value={draft.keyword} onChange={e => setDraft(d => ({ ...d, keyword: e.target.value }))} placeholder="ramnagar" /></label>
          <label><span className="mb-1 block text-xs font-semibold text-muted-foreground">Pincode</span>
            <input className={input} inputMode="numeric" maxLength={6} value={draft.pincode} onChange={e => setDraft(d => ({ ...d, pincode: e.target.value.replace(/\D/g, "") }))} placeholder="523001" /></label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[8rem] flex-1"><span className="mb-1 block text-xs font-semibold text-muted-foreground">Latitude</span>
            <input className={input} inputMode="decimal" value={draft.lat} onChange={e => setDraft(d => ({ ...d, lat: e.target.value }))} placeholder="15.5057" /></label>
          <label className="min-w-[8rem] flex-1"><span className="mb-1 block text-xs font-semibold text-muted-foreground">Longitude</span>
            <input className={input} inputMode="decimal" value={draft.lng} onChange={e => setDraft(d => ({ ...d, lng: e.target.value }))} placeholder="80.0499" /></label>
          <label className="w-28"><span className="mb-1 block text-xs font-semibold text-muted-foreground">Radius (km)</span>
            <input className={input} inputMode="decimal" value={draft.radiusKm} onChange={e => setDraft(d => ({ ...d, radiusKm: e.target.value }))} /></label>
          <button type="button" onClick={useMyPosition} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-secondary">
            <Crosshair className="h-4 w-4" /> Use my location
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="w-36"><span className="mb-1 block text-xs font-semibold text-muted-foreground">Delivery time (min)</span>
            <input className={input} inputMode="numeric" value={draft.etaMinutes} onChange={e => setDraft(d => ({ ...d, etaMinutes: e.target.value.replace(/\D/g, "") }))} /></label>
          <label className="flex items-center gap-2 pb-2 text-sm font-semibold">
            <Switch checked={draft.quickEnabled} onCheckedChange={v => setDraft(d => ({ ...d, quickEnabled: v }))} /> Quick delivery
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm font-semibold">
            <Switch checked={draft.isActive} onCheckedChange={v => setDraft(d => ({ ...d, isActive: v }))} /> Active
          </label>
          <div className="ml-auto flex gap-2">
            {draft.id && <button type="button" onClick={() => setDraft(EMPTY)} className="rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-secondary">Cancel</button>}
            <button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              <Plus className="h-4 w-4" /> {draft.id ? "Save changes" : "Add area"}
            </button>
          </div>
        </div>
      </form>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Areas <span className="text-sm font-semibold text-muted-foreground">({zones.length} · {quickCount} with Quick)</span></h2>
          <input className={`${input} max-w-xs`} value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search areas" />
        </div>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No areas yet — add one above.</p>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map(z => (
              <li key={z.id} className={`flex flex-wrap items-center gap-3 py-3 ${z.is_active ? "" : "opacity-60"}`}>
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${z.quick_enabled ? "bg-leaf/15 text-leaf" : "bg-muted text-muted-foreground"}`}>
                  {z.quick_enabled ? <Zap className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                </span>
                <div className="min-w-[10rem] flex-1">
                  <div className="font-semibold">{z.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[z.keyword && `“${z.keyword}”`, z.pincode, z.lat != null && z.lng != null && `${z.lat.toFixed(4)}, ${z.lng.toFixed(4)} · ${z.radius_km} km`].filter(Boolean).join(" · ") || "No match rule"}
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <input
                    key={`${z.id}-${z.eta_minutes}`}
                    defaultValue={z.eta_minutes}
                    inputMode="numeric"
                    aria-label={`Delivery time for ${z.name}`}
                    onBlur={e => { const v = Number(e.target.value); if (v && v !== z.eta_minutes) void save({ ...toDraft(z), etaMinutes: String(v) }); }}
                    className="w-16 rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                  /> min
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <Switch checked={z.quick_enabled} onCheckedChange={v => void save({ ...toDraft(z), quickEnabled: v })} aria-label={`Quick delivery for ${z.name}`} />
                  {z.quick_enabled ? "Quick on" : "Quick off"}
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <Switch checked={z.is_active} onCheckedChange={v => void save({ ...toDraft(z), isActive: v })} aria-label={`${z.name} active`} />
                  {z.is_active ? "Active" : "Paused"}
                </label>
                <div className="flex gap-2">
                  <button onClick={() => { setDraft(toDraft(z)); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label={`Edit ${z.name}`} className="rounded-lg border border-border p-2 hover:bg-secondary"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => void remove(z)} aria-label={`Remove ${z.name}`} className="rounded-lg border border-border p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
