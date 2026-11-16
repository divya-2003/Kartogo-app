import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { getAvailabilityFn, saveAvailabilityFn } from "@/lib/studio.functions";
import { WEEKDAYS, type AvailabilitySettings, type DateOverride } from "@/lib/studio";
import { useStudio, useStudioQuery } from "./StudioContext";
import { Card, ErrorBox, Field, Loading, Spinner, btnOutline, btnPrimary, fmtDate, inputCls, isoToday } from "./ui";

/** Working days/hours, slots, breaks, holidays, pauses and date-specific hours. */
export function AvailabilityEditor({ showBuffer = true }: { showBuffer?: boolean }) {
  const { token, partnerId, me } = useStudio();
  const qc = useQueryClient();
  const q = useStudioQuery("availability", (a) => getAvailabilityFn({ data: a }));
  const [s, setS] = useState<AvailabilitySettings | null>(null);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [newHoliday, setNewHoliday] = useState("");
  const [ovDate, setOvDate] = useState("");
  const [ov, setOv] = useState<DateOverride>({ closed: true });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!q.data) return;
    const st = { ...q.data.settings };
    if (!q.data.saved) st.max_per_slot = 1;
    if (!q.data.saved && me?.partner.kind === "service") st.allow_customer_location = true;
    setS(st); setHolidays(q.data.holidays);
  }, [q.data, me?.partner.kind]);
  if (q.isLoading || !s) return q.error ? <ErrorBox message={(q.error as Error).message} onRetry={() => q.refetch()} /> : <Loading />;
  const upd = (patch: Partial<AvailabilitySettings>) => setS({ ...s, ...patch });
  const save = async () => {
    setBusy(true);
    const r = await saveAvailabilityFn({ data: { token, partnerId, settings: s, holidays } }).catch(() => ({ ok: false as const, error: "Network error" }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success("Availability saved");
    qc.invalidateQueries({ queryKey: ["studio-availability"] }); qc.invalidateQueries({ queryKey: ["studio-slots"] });
  };
  return (
    <div className="space-y-4">
      {!q.data?.saved && <p className="rounded-lg bg-secondary/60 p-3 text-sm">You haven't saved availability yet. Customers currently see your basic opening hours — review and save below.</p>}
      <Card title="Working days & hours">
        <div className="space-y-2">{s.working_hours.map((h, i) => (
          <div key={h.day} className="flex flex-wrap items-center gap-3">
            <label className="flex w-28 items-center gap-2 text-sm font-medium"><Switch checked={h.enabled} onCheckedChange={v => upd({ working_hours: s.working_hours.map((x, j) => j === i ? { ...x, enabled: v } : x) })} />{WEEKDAYS[h.day]}</label>
            {h.enabled ? (
              <div className="flex items-center gap-2 text-sm">
                <input aria-label={`${WEEKDAYS[h.day]} opens`} type="time" value={h.open} onChange={e => upd({ working_hours: s.working_hours.map((x, j) => j === i ? { ...x, open: e.target.value } : x) })} className={`${inputCls} w-32`} />
                <span>to</span>
                <input aria-label={`${WEEKDAYS[h.day]} closes`} type="time" value={h.close} onChange={e => upd({ working_hours: s.working_hours.map((x, j) => j === i ? { ...x, close: e.target.value } : x) })} className={`${inputCls} w-32`} />
              </div>
            ) : <span className="text-sm text-muted-foreground">Closed</span>}
          </div>
        ))}</div>
        <button className={`${btnOutline} mt-3`} onClick={() => { const f = s.working_hours.find(h => h.enabled); if (f) upd({ working_hours: s.working_hours.map(h => h.enabled ? { ...h, open: f.open, close: f.close } : h) }); }}>Copy first open day's hours to all open days</button>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Slots & capacity">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Slot duration (min)"><input type="number" min={10} max={480} step={5} value={s.slot_minutes} onChange={e => upd({ slot_minutes: Math.max(10, Number(e.target.value) || 30) })} className={inputCls} /></Field>
            {showBuffer && <Field label="Buffer between (min)"><input type="number" min={0} max={240} step={5} value={s.buffer_minutes} onChange={e => upd({ buffer_minutes: Math.max(0, Number(e.target.value) || 0) })} className={inputCls} /></Field>}
            <Field label={me?.partner.kind === "furniture" ? "Max appointments per slot" : "Max bookings per slot"}><input type="number" min={1} max={50} value={s.max_per_slot} onChange={e => upd({ max_per_slot: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })} className={inputCls} /></Field>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm">{me?.partner.kind === "furniture" ? "Showroom appointments" : "At business location"}<Switch checked={s.allow_business_location} onCheckedChange={v => upd({ allow_business_location: v })} /></label>
            <label className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm">At customer's location<Switch checked={s.allow_customer_location} onCheckedChange={v => upd({ allow_customer_location: v })} /></label>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Double bookings are blocked automatically: a slot closes once it is full, and a professional can't be in two appointments at once.</p>
        </Card>
        <Card title="Break times" action={<button className={btnOutline} onClick={() => upd({ breaks: [...s.breaks, { start: "13:00", end: "14:00" }] })}><Plus className="h-4 w-4" />Add break</button>}>
          {s.breaks.length === 0 ? <p className="text-sm text-muted-foreground">No breaks.</p> : s.breaks.map((b, i) => (
            <div key={i} className="mb-2 flex items-center gap-2 text-sm">
              <input aria-label="Break starts" type="time" value={b.start} onChange={e => upd({ breaks: s.breaks.map((x, j) => j === i ? { ...x, start: e.target.value } : x) })} className={`${inputCls} w-32`} /><span>to</span>
              <input aria-label="Break ends" type="time" value={b.end} onChange={e => upd({ breaks: s.breaks.map((x, j) => j === i ? { ...x, end: e.target.value } : x) })} className={`${inputCls} w-32`} />
              <button aria-label="Remove break" className={btnOutline} onClick={() => upd({ breaks: s.breaks.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></button>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Holidays & unavailable dates">
          <div className="flex gap-2"><input type="date" min={isoToday()} value={newHoliday} onChange={e => setNewHoliday(e.target.value)} className={inputCls} /><button className={btnOutline} onClick={() => { if (newHoliday && !holidays.includes(newHoliday)) setHolidays([...holidays, newHoliday].sort()); setNewHoliday(""); }}>Add</button></div>
          <div className="mt-2 flex flex-wrap gap-1.5">{holidays.length === 0 ? <span className="text-sm text-muted-foreground">None.</span> : holidays.map(d => (
            <span key={d} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs">{fmtDate(d)}<button aria-label={`Remove ${d}`} onClick={() => setHolidays(holidays.filter(x => x !== d))}><X className="h-3 w-3" /></button></span>
          ))}</div>
          <div className="mt-4 text-xs font-semibold text-muted-foreground">Temporary unavailability</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <input aria-label="Paused from" type="date" value={s.paused_from ?? ""} onChange={e => upd({ paused_from: e.target.value || null })} className={`${inputCls} w-40`} /><span>to</span>
            <input aria-label="Paused until" type="date" value={s.paused_until ?? ""} onChange={e => upd({ paused_until: e.target.value || null })} className={`${inputCls} w-40`} />
            {(s.paused_from || s.paused_until) && <button className={btnOutline} onClick={() => upd({ paused_from: null, paused_until: null })}>Clear</button>}
          </div>
        </Card>
        <Card title="Date-specific availability">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Date"><input type="date" min={isoToday()} value={ovDate} onChange={e => setOvDate(e.target.value)} className={`${inputCls} w-40`} /></Field>
            <label className="flex items-center gap-2 pb-2 text-sm"><Switch checked={!ov.closed} onCheckedChange={v => setOv(v ? { open: "10:00", close: "18:00" } : { closed: true })} />Open with special hours</label>
            {!ov.closed && <><input aria-label="Opens" type="time" value={ov.open ?? ""} onChange={e => setOv({ ...ov, open: e.target.value })} className={`${inputCls} w-28`} /><input aria-label="Closes" type="time" value={ov.close ?? ""} onChange={e => setOv({ ...ov, close: e.target.value })} className={`${inputCls} w-28`} /></>}
            <button className={btnOutline} onClick={() => { if (!ovDate) return void toast.error("Pick a date"); upd({ date_overrides: { ...s.date_overrides, [ovDate]: ov } }); setOvDate(""); }}>Add</button>
          </div>
          <ul className="mt-3 space-y-1 text-sm">{Object.entries(s.date_overrides).sort().map(([d, o]) => (
            <li key={d} className="flex items-center justify-between rounded-lg bg-secondary/50 px-2.5 py-1.5"><span>{fmtDate(d)} · {o.closed ? "Closed" : `${o.open}–${o.close}`}</span>
              <button aria-label={`Remove ${d}`} onClick={() => { const n = { ...s.date_overrides }; delete n[d]; upd({ date_overrides: n }); }}><X className="h-4 w-4" /></button></li>
          ))}</ul>
        </Card>
      </div>
      <div className="flex justify-end"><button disabled={busy} onClick={save} className={btnPrimary}>{busy && <Spinner />}Save availability</button></div>
    </div>
  );
}
