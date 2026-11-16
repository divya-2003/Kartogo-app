import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Phone, Plus, Trash2, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ImagePicker } from "@/components/ImagePicker";
import { listProfessionalsFn, saveProfessionalFn, deleteProfessionalFn } from "@/lib/studio.functions";
import { WEEKDAYS } from "@/lib/studio";
import { useStudio, useStudioQuery } from "@/components/studio/StudioContext";
import { ActiveBadge, ConfirmButton, Empty, ErrorBox, Field, Loading, PageHeader, Spinner, btnDanger, btnOutline, btnPrimary, fmtDate, fmtTime, inputCls } from "@/components/studio/ui";

export const Route = createFileRoute("/supplier/studio/professionals")({
  component: Professionals,
  head: () => ({ meta: [{ title: "Professionals — Partner Studio" }, { name: "description", content: "Your team, their services, working hours and schedules." }] }),
});

function Professionals() {
  const { token, partnerId, me } = useStudio();
  const qc = useQueryClient();
  const q = useStudioQuery("professionals", (a) => listProfessionalsFn({ data: a }));
  const [editing, setEditing] = useState<any | null | undefined>(undefined);
  const reload = () => qc.invalidateQueries({ queryKey: ["studio-professionals"] });
  const services = q.data?.services ?? [];
  const solo = (q.data?.staff.length ?? 0) <= 1;
  return (
    <div>
      <PageHeader title="Professionals" crumb="Professionals" sub={me?.partner.kind === "furniture" ? "Optional: add consultants or installers who handle appointments." : "Your team members, the services they do and when they work."}>
        <button className={btnPrimary} onClick={() => setEditing(null)}><Plus className="h-4 w-4" />Add professional</button>
      </PageHeader>
      {solo && <p className="mb-3 rounded-lg bg-secondary/60 p-3 text-sm">Working alone? You can skip this — appointments work without a team. Add people only when more than one person takes bookings.</p>}
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox message={(q.error as Error).message} onRetry={() => q.refetch()} /> : !q.data?.staff.length ? <Empty title="No professionals yet" /> : (
        <div className="grid gap-3 md:grid-cols-2">{q.data.staff.map((s: any) => (
          <article key={s.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              {s.photo_url ? <img src={s.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-full bg-secondary"><UserRound className="h-5 w-5" /></span>}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><h3 className="truncate font-semibold">{s.name}</h3><ActiveBadge on={s.is_active} /></div>
                <div className="text-xs text-muted-foreground">{s.title || "Professional"}{s.phone ? <> · <Phone className="inline h-3 w-3" /> {s.phone}</> : null}</div>
                <div className="mt-1 text-xs">{s.work_start && s.work_end ? `${fmtTime(s.work_start)} – ${fmtTime(s.work_end)}` : "Business hours"} · Off: {(s.off_weekdays ?? []).length ? s.off_weekdays.map((d: number) => WEEKDAYS[d]).join(", ") : "none"}</div>
                <div className="mt-1 text-xs text-muted-foreground">Services: {(s.service_ids ?? []).length ? services.filter((x: any) => s.service_ids.includes(x.id)).map((x: any) => x.name).join(", ") : "All services"}</div>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-secondary/40 p-2 text-xs">
              <div className="mb-1 font-semibold">Upcoming schedule</div>
              {s.schedule.length === 0 ? <span className="text-muted-foreground">No upcoming appointments.</span> : s.schedule.map((a: any) => <div key={a.id}>{fmtDate(a.booking_date)} {fmtTime(a.start_time)} · {a.customer_name ?? "Customer"} · {a.listing?.name ?? ""}</div>)}
            </div>
            <div className="mt-3 flex gap-2">
              <button className={btnOutline} onClick={() => setEditing(s)}><Pencil className="h-4 w-4" />Edit</button>
              <ConfirmButton title={`Remove ${s.name}?`} body="People with past appointments are deactivated instead of deleted." confirmLabel="Remove" className={btnDanger} onConfirm={async () => {
                const r = await deleteProfessionalFn({ data: { token, partnerId, id: s.id } }).catch(() => ({ ok: false as const, error: "Network error" }));
                if (!r.ok) return void toast.error(r.error);
                toast.success(r.data.deactivated ? "Deactivated (has past appointments)" : "Removed"); reload();
              }}><Trash2 className="h-4 w-4" />Remove</ConfirmButton>
            </div>
          </article>
        ))}</div>
      )}
      {editing !== undefined && <ProDialog pro={editing} services={services} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); reload(); }} />}
    </div>
  );
}

function ProDialog({ pro, services, onClose, onSaved }: { pro: any | null; services: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const { token, partnerId } = useStudio();
  const [f, setF] = useState({ name: pro?.name ?? "", title: pro?.title ?? "", phone: pro?.phone ?? "", photo: pro?.photo_url ?? undefined as string | undefined, services: (pro?.service_ids ?? []) as string[], off: (pro?.off_weekdays ?? []) as number[], offDates: ((pro?.off_dates ?? []) as string[]).join(", "), start: pro?.work_start?.slice(0, 5) ?? "", end: pro?.work_end?.slice(0, 5) ?? "", active: pro?.is_active ?? true });
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const offDates = f.offDates.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
    if (offDates.some(d => !/^\d{4}-\d{2}-\d{2}$/.test(d))) return void toast.error("Write leave dates as YYYY-MM-DD, separated by commas.");
    if ((f.start && !f.end) || (!f.start && f.end)) return void toast.error("Set both start and end of working hours, or neither.");
    setBusy(true);
    const r = await saveProfessionalFn({ data: { token, partnerId, id: pro?.id ?? null, name: f.name, title: f.title, phone: f.phone, photoUrl: f.photo ?? null, serviceIds: f.services, offWeekdays: f.off, offDates, workStart: f.start || null, workEnd: f.end || null, isActive: f.active } }).catch(() => ({ ok: false as const, error: "Please check the form." }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success(pro ? "Saved" : "Professional added"); onSaved();
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="font-studio max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{pro ? "Edit professional" : "Add professional"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name *"><input required minLength={2} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={inputCls} /></Field>
            <Field label="Designation"><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="e.g. Senior stylist" className={inputCls} /></Field>
            <Field label="Contact number"><input inputMode="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} className={inputCls} /></Field>
            <Field label="Working hours (optional)"><div className="flex items-center gap-1"><input type="time" aria-label="Starts" value={f.start} onChange={e => setF({ ...f, start: e.target.value })} className={inputCls} /><input type="time" aria-label="Ends" value={f.end} onChange={e => setF({ ...f, end: e.target.value })} className={inputCls} /></div></Field>
          </div>
          <Field label="Profile photo"><ImagePicker value={f.photo} onChange={v => setF({ ...f, photo: v })} /></Field>
          <Field label="Weekly days off"><div className="flex flex-wrap gap-1.5">{WEEKDAYS.map((d, i) => <button key={d} type="button" aria-pressed={f.off.includes(i)} onClick={() => setF({ ...f, off: f.off.includes(i) ? f.off.filter(x => x !== i) : [...f.off, i] })} className={`rounded-full border px-3 py-1 text-xs font-semibold ${f.off.includes(i) ? "border-destructive bg-destructive/10 text-destructive" : "border-border"}`}>{d}</button>)}</div></Field>
          <Field label="Leave dates" hint="YYYY-MM-DD, separated by commas"><input value={f.offDates} onChange={e => setF({ ...f, offDates: e.target.value })} className={inputCls} /></Field>
          {services.length > 0 && <Field label="Assigned services (none = all)"><div className="flex flex-wrap gap-1.5">{services.map(s => <button key={s.id} type="button" aria-pressed={f.services.includes(s.id)} onClick={() => setF({ ...f, services: f.services.includes(s.id) ? f.services.filter(x => x !== s.id) : [...f.services, s.id] })} className={`rounded-full border px-3 py-1 text-xs font-semibold ${f.services.includes(s.id) ? "border-brand-navy bg-brand-navy text-brand-on-navy" : "border-border"}`}>{s.name}</button>)}</div></Field>}
          <label className="flex items-center justify-between rounded-lg border border-border p-2.5 text-sm">Active (takes bookings)<Switch checked={f.active} onCheckedChange={v => setF({ ...f, active: v })} /></label>
          <div className="flex justify-end gap-2"><button type="button" className={btnOutline} onClick={onClose}>Cancel</button><button disabled={busy} className={btnPrimary}>{busy && <Spinner />}Save</button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
