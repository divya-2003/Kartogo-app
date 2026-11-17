import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, LocateFixed } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ImagePicker, MultiImagePicker } from "@/components/ImagePicker";
import { saveBusinessProfileFn } from "@/lib/studio.functions";
import { WEEKDAYS } from "@/lib/studio";
import { useStudio } from "@/components/studio/StudioContext";
import { Badge, Card, Field, PageHeader, Spinner, btnOutline, btnPrimary, fmtTime, inputCls } from "@/components/studio/ui";

export const Route = createFileRoute("/supplier/studio/profile")({
  component: Profile,
  head: () => ({ meta: [{ title: "Business Profile — Partner Studio" }, { name: "description", content: "Your business details customers see on Kartogo." }] }),
});

function Profile() {
  const { me, token, partnerId, refresh } = useStudio();
  const p = me!.partner;
  const [f, setF] = useState({ name: p.name, description: p.description ?? "", address: p.address ?? "", serviceArea: p.service_area ?? "", phone: p.business_phone ?? "", logo: p.logo_url ?? undefined as string | undefined, photos: p.photos ?? [], lat: p.lat != null ? String(p.lat) : "", lng: p.lng != null ? String(p.lng) : "", active: p.is_active });
  const [busy, setBusy] = useState(false);
  const locate = () => navigator.geolocation?.getCurrentPosition(pos => setF(s => ({ ...s, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) })), () => toast.error("Couldn't get your location"), { enableHighAccuracy: true, timeout: 10000 });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = f.lat === "" ? null : Number(f.lat), lng = f.lng === "" ? null : Number(f.lng);
    if ((lat != null && !Number.isFinite(lat)) || (lng != null && !Number.isFinite(lng))) return void toast.error("Location must be numbers.");
    setBusy(true);
    const r = await saveBusinessProfileFn({ data: { token, partnerId, name: f.name, description: f.description, address: f.address, serviceArea: f.serviceArea, businessPhone: f.phone.replace(/\s/g, ""), logoUrl: f.logo ?? null, photos: f.photos, lat, lng, isActive: f.active } }).catch(() => ({ ok: false as const, error: "Please check the details and try again." }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success("Business profile saved"); refresh();
  };
  return (
    <div>
      <PageHeader title="Business Profile" crumb="Business Profile" sub="Shown to customers on your Kartogo store page." />
      <form onSubmit={save} className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Business details">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Business name *"><input required minLength={2} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={inputCls} /></Field>
              <Field label="Contact number *"><input required inputMode="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} className={inputCls} /></Field>
            </div>
            <div className="mt-3"><Field label="Description"><textarea rows={3} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} className={inputCls} /></Field></div>
          </Card>
          <Card title="Location">
            <Field label="Address *"><textarea required rows={2} value={f.address} onChange={e => setF({ ...f, address: e.target.value })} className={inputCls} /></Field>
            <div className="mt-3"><Field label="Service area"><input value={f.serviceArea} onChange={e => setF({ ...f, serviceArea: e.target.value })} placeholder="e.g. Ongole and 15 km around" className={inputCls} /></Field></div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Field label="Latitude"><input value={f.lat} onChange={e => setF({ ...f, lat: e.target.value })} className={`${inputCls} w-36`} /></Field>
              <Field label="Longitude"><input value={f.lng} onChange={e => setF({ ...f, lng: e.target.value })} className={`${inputCls} w-36`} /></Field>
              <button type="button" onClick={locate} className={btnOutline}><LocateFixed className="h-4 w-4" />Use my location</button>
            </div>
            {f.lat && f.lng && <iframe title="Business location" src={`https://maps.google.com/maps?q=${f.lat},${f.lng}&z=15&output=embed`} className="mt-3 h-44 w-full rounded-lg border border-border" loading="lazy" />}
          </Card>
          <Card title="Logo & photos">
            <Field label="Logo"><ImagePicker value={f.logo} onChange={v => setF({ ...f, logo: v })} /></Field>
            <div className="mt-3"><Field label="Business photos (up to 8)"><MultiImagePicker value={f.photos} onChange={v => setF({ ...f, photos: v.slice(0, 8) })} /></Field></div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Verification">
            <div className="flex items-center gap-2"><BadgeCheck className={`h-5 w-5 ${p.verification_status === "VERIFIED" ? "text-leaf" : "text-muted-foreground"}`} /><Badge k={p.verification_status === "VERIFIED" ? "COMPLETED" : p.verification_status === "REJECTED" ? "REJECTED" : "PENDING"}>{p.verification_status === "VERIFIED" ? "Verified by Kartogo" : p.verification_status === "REJECTED" ? "Not verified" : "Verification pending"}</Badge></div>
            <p className="mt-2 text-xs text-muted-foreground">Category and verification are managed by Kartogo.</p>
            <div className="mt-3 text-sm"><b>Category:</b> {p.categories.map(c => c.name).join(", ") || "—"}</div>
          </Card>
          <Card title="Working hours">
            <p className="text-sm">{fmtTime(p.opens_at ?? "10:00")} – {fmtTime(p.closes_at ?? "20:00")}</p>
            <p className="text-xs text-muted-foreground">Closed: {p.weekly_off.length ? p.weekly_off.map(d => WEEKDAYS[d]).join(", ") : "never"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Change detailed hours in {p.kind === "service" ? "Availability" : "Settings"}.</p>
          </Card>
          <Card title="Visibility">
            <label className="flex items-center justify-between gap-2 text-sm">Show my business to customers<Switch checked={f.active} onCheckedChange={v => setF({ ...f, active: v })} disabled={p.account_status === "SUSPENDED"} /></label>
          </Card>
          <button disabled={busy} className={`${btnPrimary} w-full`}>{busy && <Spinner />}Save profile</button>
        </div>
      </form>
    </div>
  );
}
