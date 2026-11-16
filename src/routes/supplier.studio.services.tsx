import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, Home, Pencil, Plus, Power, Store, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { MultiImagePicker } from "@/components/ImagePicker";
import { listServicesFn, saveServiceFn, deleteServiceFn, setListingActiveFn } from "@/lib/studio.functions";
import { WEEKDAYS } from "@/lib/studio";
import { useStudio, useStudioQuery } from "@/components/studio/StudioContext";
import { ActiveBadge, ConfirmButton, Empty, ErrorBox, Field, Loading, PageHeader, Spinner, btnDanger, btnOutline, btnPrimary, inputCls, inr } from "@/components/studio/ui";

export const Route = createFileRoute("/supplier/studio/services")({
  component: Services,
  head: () => ({ meta: [{ title: "My Services — Partner Studio" }, { name: "description", content: "Add and manage the services customers can book." }] }),
});

function Services() {
  const { token, partnerId } = useStudio();
  const qc = useQueryClient();
  const q = useStudioQuery("services", (a) => listServicesFn({ data: a }));
  const [term, setTerm] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("");
  const [editing, setEditing] = useState<any | null | undefined>(undefined);
  const reload = () => qc.invalidateQueries({ queryKey: ["studio-services"] });
  const rows = useMemo(() => (q.data?.services ?? []).filter((s: any) => {
    const t = term.trim().toLowerCase();
    return (!t || `${s.name} ${s.description ?? ""}`.toLowerCase().includes(t)) && (!cat || s.category_slug === cat) &&
      (!status || (status === "active") === s.is_active) && (!mode || (s.service_modes ?? []).includes(mode));
  }), [q.data, term, cat, status, mode]);
  const run = async (p: Promise<{ ok: boolean; error?: string }>, msg: string) => {
    const r = await p.catch(() => ({ ok: false, error: "Network error" }));
    if (!r.ok) return void toast.error((r as any).error);
    toast.success(msg); reload();
  };
  return (
    <div>
      <PageHeader title="My Services" crumb="My Services" sub="Services, prices and durations customers can book.">
        <button className={btnPrimary} onClick={() => setEditing(null)}><Plus className="h-4 w-4" />Add service</button>
      </PageHeader>
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input aria-label="Search services" placeholder="Search services" value={term} onChange={e => setTerm(e.target.value)} className={inputCls} />
        <select aria-label="Category" value={cat} onChange={e => setCat(e.target.value)} className={inputCls}><option value="">All categories</option>{q.data?.categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
        <select aria-label="Location" value={mode} onChange={e => setMode(e.target.value)} className={inputCls}><option value="">Any location</option><option value="AT_SALON">At business location</option><option value="HOME_SERVICE">Home visit</option></select>
        <select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)} className={inputCls}><option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      </div>
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox message={(q.error as Error).message} onRetry={() => q.refetch()} /> : rows.length === 0 ? (
        <Empty title={q.data?.services.length ? "No services match" : "No services yet"} body="Add a service with its price and duration so customers can book it.">
          {!q.data?.services.length && <button className={btnPrimary} onClick={() => setEditing(null)}><Plus className="h-4 w-4" />Add service</button>}
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((s: any) => (
            <article key={s.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
              {s.images?.[0] ? <img src={s.images[0]} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" /> : <span className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-secondary text-2xl">{s.icon}</span>}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2"><h3 className="truncate font-semibold">{s.name}</h3><ActiveBadge on={s.is_active} /></div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{inr(Number(s.price ?? s.starting_price ?? 0))}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{s.duration_min ?? 60} min</span>
                  {(s.service_modes ?? []).includes("AT_SALON") && <span className="flex items-center gap-1"><Store className="h-3 w-3" />At business</span>}
                  {(s.service_modes ?? []).includes("HOME_SERVICE") && <span className="flex items-center gap-1"><Home className="h-3 w-3" />Home visit</span>}
                </div>
                <div className="mt-2 flex gap-1">
                  <button aria-label={`Edit ${s.name}`} className={btnOutline} onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></button>
                  <button aria-label={s.is_active ? "Deactivate" : "Activate"} className={btnOutline} onClick={() => run(setListingActiveFn({ data: { token, partnerId, ids: [s.id], active: !s.is_active } }), s.is_active ? "Deactivated" : "Activated")}><Power className="h-4 w-4" /></button>
                  <ConfirmButton title={`Delete ${s.name}?`} body="Customers will no longer see this service. Services with past bookings can only be deactivated." confirmLabel="Delete" className={btnDanger} onConfirm={() => run(deleteServiceFn({ data: { token, partnerId, id: s.id } }), "Service deleted")}><Trash2 className="h-4 w-4" /></ConfirmButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing !== undefined && <ServiceDialog service={editing} categories={q.data?.categories ?? []} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); reload(); }} />}
    </div>
  );
}

function ServiceDialog({ service, categories, onClose, onSaved }: { service: any | null; categories: { slug: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const { token, partnerId } = useStudio();
  const [f, setF] = useState({
    name: service?.name ?? "", category: service?.category_slug ?? categories[0]?.slug ?? "", description: service?.description ?? "",
    images: (service?.images ?? []) as string[], price: service?.price != null ? String(service.price) : "", duration: String(service?.duration_min ?? 60),
    atBusiness: service ? (service.service_modes ?? []).includes("AT_SALON") : true, home: service ? (service.service_modes ?? []).includes("HOME_SERVICE") : false,
    homeFee: String(service?.home_service_fee ?? 0), days: (service?.attributes?.available_days ?? [0, 1, 2, 3, 4, 5, 6]) as number[], active: service?.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const modes = [...(f.atBusiness ? ["AT_SALON"] : []), ...(f.home ? ["HOME_SERVICE"] : [])] as ("AT_SALON" | "HOME_SERVICE")[];
    if (!modes.length) return void toast.error("Choose at least one location.");
    if (!f.images.length) return void toast.error("Add at least one photo.");
    if (f.description.trim().length < 10) return void toast.error("Add a description of at least 10 characters.");
    setBusy(true);
    const r = await saveServiceFn({ data: { token, partnerId, id: service?.id ?? null, name: f.name, category: f.category, description: f.description, images: f.images, price: Number(f.price) || 0, durationMin: Math.round(Number(f.duration)) || 60, modes, homeFee: Number(f.homeFee) || 0, availableDays: f.days, isActive: f.active } }).catch(() => ({ ok: false as const, error: "Please check the form and try again." }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success(service ? "Service updated" : "Service added"); onSaved();
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="font-studio max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>{service ? "Edit service" : "Add service"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Service name *"><input required minLength={2} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={inputCls} /></Field>
            <Field label="Category *"><select value={f.category} onChange={e => setF({ ...f, category: e.target.value })} className={inputCls}>{categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></Field>
          </div>
          <Field label="Description *"><textarea rows={3} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} className={inputCls} /></Field>
          <Field label="Photos * (up to 8)"><MultiImagePicker value={f.images} onChange={imgs => setF({ ...f, images: imgs.slice(0, 8) })} /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Price (₹) *"><input required type="number" min={0} value={f.price} onChange={e => setF({ ...f, price: e.target.value })} className={inputCls} /></Field>
            <Field label="Duration (minutes) *"><input required type="number" min={10} max={600} value={f.duration} onChange={e => setF({ ...f, duration: e.target.value })} className={inputCls} /></Field>
            {f.home && <Field label="Home visit fee (₹)"><input type="number" min={0} value={f.homeFee} onChange={e => setF({ ...f, homeFee: e.target.value })} className={inputCls} /></Field>}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm">At business location<Switch checked={f.atBusiness} onCheckedChange={v => setF({ ...f, atBusiness: v })} /></label>
            <label className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm">Home visit<Switch checked={f.home} onCheckedChange={v => setF({ ...f, home: v })} /></label>
            <label className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm">Active<Switch checked={f.active} onCheckedChange={v => setF({ ...f, active: v })} /></label>
          </div>
          <Field label="Available on">
            <div className="flex flex-wrap gap-1.5">{WEEKDAYS.map((d, i) => (
              <button key={d} type="button" aria-pressed={f.days.includes(i)} onClick={() => setF({ ...f, days: f.days.includes(i) ? f.days.filter(x => x !== i) : [...f.days, i].sort() })} className={`rounded-full border px-3 py-1 text-xs font-semibold ${f.days.includes(i) ? "border-brand-navy bg-brand-navy text-brand-on-navy" : "border-border"}`}>{d}</button>
            ))}</div>
          </Field>
          <div className="flex justify-end gap-2 border-t border-border pt-3"><button type="button" className={btnOutline} onClick={onClose}>Cancel</button><button disabled={busy} className={btnPrimary}>{busy && <Spinner />}{service ? "Save changes" : "Add service"}</button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
