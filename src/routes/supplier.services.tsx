import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { myPartnersFn, saveListingFn, saveStaffFn, updatePartnerAvailabilityFn } from "@/lib/partner-manage.functions";

export const Route = createFileRoute("/supplier/services")({
  component: ServicesPage,
  head: () => ({ meta: [{ title: "My services — Kartogo Partner" }] }),
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const getToken = () => { try { return JSON.parse(localStorage.getItem("qk_supplier_token") || "null") as string | null; } catch { return null; } };
const hm = (t?: string | null) => (t ?? "09:00").slice(0, 5);

function DayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {DAYS.map((d, i) => {
        const on = value.includes(i);
        return (
          <button key={d} type="button" onClick={() => onChange(on ? value.filter(x => x !== i) : [...value, i])}
            className={`rounded-md border px-2 py-1 text-xs font-semibold ${on ? "border-destructive bg-destructive/10 text-destructive" : "border-border"}`}>{d}</button>
        );
      })}
    </div>
  );
}

function ServicesPage() {
  const [partners, setPartners] = useState<any[] | null>(null);
  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { setPartners([]); return; }
    setPartners(await myPartnersFn({ data: { token } }));
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!partners) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!partners.length) return (
    <div className="rounded-2xl border border-border bg-card p-6 text-sm">
      <h1 className="font-display text-xl font-bold">My services</h1>
      <p className="mt-2 text-muted-foreground">No service business is linked to your number yet. Ask the Kartogo team to link your salon, home-service or event business.</p>
    </div>
  );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">My services</h1>
        <p className="text-sm text-muted-foreground">Manage your listings, staff and opening hours. Bookings are handled by the Kartogo team.</p>
      </div>
      {partners.map(p => <PartnerCard key={p.id} p={p} reload={load} />)}
    </div>
  );
}

function PartnerCard({ p, reload }: { p: any; reload: () => void }) {
  const [opens, setOpens] = useState(hm(p.opens_at));
  const [closes, setCloses] = useState(hm(p.closes_at));
  const [weeklyOff, setWeeklyOff] = useState<number[]>(p.weekly_off ?? []);
  const [closed, setClosed] = useState<string[]>(p.closed_dates ?? []);
  const [newDate, setNewDate] = useState("");
  const [active, setActive] = useState<boolean>(p.is_active);

  const saveAvail = async () => {
    const r = await updatePartnerAvailabilityFn({ data: { token: getToken()!, partnerId: p.id, opensAt: opens, closesAt: closes, weeklyOff, closedDates: closed, isActive: active } });
    r.ok ? toast.success("Availability saved") : toast.error(r.error ?? "Failed");
    reload();
  };

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{p.icon}</span>
        <div className="min-w-0 flex-1"><div className="truncate font-bold">{p.name}</div><div className="text-xs text-muted-foreground">{p.partner_type}</div></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Open for bookings</label>
      </div>

      <div className="space-y-3 rounded-xl border border-border p-4">
        <h3 className="font-semibold">Availability</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Hours</span>
          <Input type="time" value={opens} onChange={e => setOpens(e.target.value)} className="w-32" />
          <span>to</span>
          <Input type="time" value={closes} onChange={e => setCloses(e.target.value)} className="w-32" />
        </div>
        <div className="text-sm"><div className="mb-1">Weekly off</div><DayPicker value={weeklyOff} onChange={setWeeklyOff} /></div>
        <div className="text-sm">
          <div className="mb-1">Closed dates</div>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-44" />
            <Button size="sm" variant="outline" onClick={() => { if (newDate && !closed.includes(newDate)) setClosed([...closed, newDate].sort()); setNewDate(""); }}>Add</Button>
            {closed.map(d => (
              <button key={d} onClick={() => setClosed(closed.filter(x => x !== d))} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{d} ✕</button>
            ))}
          </div>
        </div>
        <Button size="sm" onClick={saveAvail}>Save availability</Button>
      </div>

      <ListingsBlock p={p} reload={reload} />
      <StaffBlock p={p} reload={reload} />
    </section>
  );
}

function ListingsBlock({ p, reload }: { p: any; reload: () => void }) {
  const [edit, setEdit] = useState<any | null>(null);
  const save = async () => {
    const r = await saveListingFn({ data: { token: getToken()!, partnerId: p.id, id: edit.id, listing: {
      name: edit.name ?? "", description: edit.description ?? "", price: Number(edit.price ?? edit.starting_price ?? 0),
      duration_min: edit.duration_min ? Number(edit.duration_min) : null, is_active: edit.is_active ?? true,
    } } });
    if (r.ok) { toast.success("Listing saved"); setEdit(null); reload(); } else toast.error(r.error ?? "Failed");
  };
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between"><h3 className="font-semibold">Listings</h3><Button size="sm" variant="outline" onClick={() => setEdit({ is_active: true })}>Add listing</Button></div>
      {p.listings.map((l: any) => (
        <div key={l.id} className="flex items-center gap-3 border-t border-border pt-2 text-sm">
          <div className="min-w-0 flex-1"><div className="truncate font-semibold">{l.name}</div><div className="text-xs text-muted-foreground">₹{l.price ?? l.starting_price ?? 0}{l.duration_min ? ` · ${l.duration_min} min` : ""}{l.is_active ? "" : " · Hidden"}</div></div>
          <Button size="sm" variant="ghost" onClick={() => setEdit({ ...l })}>Edit</Button>
        </div>
      ))}
      {edit && (
        <div className="grid gap-2 rounded-lg bg-secondary/50 p-3 sm:grid-cols-2">
          <Input placeholder="Name" value={edit.name ?? ""} onChange={e => setEdit({ ...edit, name: e.target.value })} />
          <Input placeholder="Price ₹" type="number" value={edit.price ?? edit.starting_price ?? ""} onChange={e => setEdit({ ...edit, price: e.target.value })} />
          <Input placeholder="Duration (min)" type="number" value={edit.duration_min ?? ""} onChange={e => setEdit({ ...edit, duration_min: e.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.is_active ?? true} onChange={e => setEdit({ ...edit, is_active: e.target.checked })} /> Visible to customers</label>
          <Input className="sm:col-span-2" placeholder="Description" value={edit.description ?? ""} onChange={e => setEdit({ ...edit, description: e.target.value })} />
          <div className="flex gap-2 sm:col-span-2"><Button size="sm" onClick={save}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button></div>
        </div>
      )}
    </div>
  );
}

function StaffBlock({ p, reload }: { p: any; reload: () => void }) {
  const [edit, setEdit] = useState<any | null>(null);
  const [leave, setLeave] = useState("");
  const save = async () => {
    const r = await saveStaffFn({ data: { token: getToken()!, partnerId: p.id, id: edit.id, staff: {
      name: edit.name ?? "", title: edit.title ?? "", is_active: edit.is_active ?? true,
      off_weekdays: edit.off_weekdays ?? [], off_dates: edit.off_dates ?? [],
    } } });
    if (r.ok) { toast.success("Staff saved"); setEdit(null); reload(); } else toast.error(r.error ?? "Failed");
  };
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between"><h3 className="font-semibold">Staff</h3><Button size="sm" variant="outline" onClick={() => setEdit({ is_active: true, off_weekdays: [], off_dates: [] })}>Add staff</Button></div>
      {p.staff.map((st: any) => (
        <div key={st.id} className="flex items-center gap-3 border-t border-border pt-2 text-sm">
          <div className="min-w-0 flex-1"><div className="truncate font-semibold">{st.name}</div><div className="text-xs text-muted-foreground">{st.title}{st.is_active ? "" : " · Inactive"}{st.off_weekdays?.length ? ` · Off ${st.off_weekdays.map((d: number) => DAYS[d]).join(", ")}` : ""}</div></div>
          <Button size="sm" variant="ghost" onClick={() => setEdit({ ...st, off_weekdays: st.off_weekdays ?? [], off_dates: st.off_dates ?? [] })}>Edit</Button>
        </div>
      ))}
      {edit && (
        <div className="space-y-2 rounded-lg bg-secondary/50 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Name" value={edit.name ?? ""} onChange={e => setEdit({ ...edit, name: e.target.value })} />
            <Input placeholder="Role (e.g. Senior stylist)" value={edit.title ?? ""} onChange={e => setEdit({ ...edit, title: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.is_active} onChange={e => setEdit({ ...edit, is_active: e.target.checked })} /> Available for bookings</label>
          <div className="text-sm"><div className="mb-1">Weekly off</div><DayPicker value={edit.off_weekdays} onChange={v => setEdit({ ...edit, off_weekdays: v })} /></div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Input type="date" value={leave} onChange={e => setLeave(e.target.value)} className="w-44" />
            <Button size="sm" variant="outline" onClick={() => { if (leave && !edit.off_dates.includes(leave)) setEdit({ ...edit, off_dates: [...edit.off_dates, leave].sort() }); setLeave(""); }}>Add leave</Button>
            {edit.off_dates.map((d: string) => <button key={d} onClick={() => setEdit({ ...edit, off_dates: edit.off_dates.filter((x: string) => x !== d) })} className="rounded-full bg-background px-2 py-0.5 text-xs">{d} ✕</button>)}
          </div>
          <div className="flex gap-2"><Button size="sm" onClick={save}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button></div>
        </div>
      )}
    </div>
  );
}
