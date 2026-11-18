import { useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { appointmentActionFn, studioSlotsFn, createSellerAppointmentFn } from "@/lib/studio.functions";
import { allowedActions, toMin, type AppointmentAction } from "@/lib/studio";
import { useStudio, unwrap } from "./StudioContext";
import { Field, Spinner, btnDanger, btnOutline, btnPrimary, fmtTime, inputCls, isoToday } from "./ui";

const LABEL: Record<AppointmentAction, string> = { ACCEPT: "Accept", REJECT: "Reject", CONFIRM: "Confirm", RESCHEDULE: "Reschedule", CANCEL: "Cancel", COMPLETE: "Mark completed", NO_SHOW: "Mark no-show" };
const NEEDS_DIALOG: AppointmentAction[] = ["REJECT", "RESCHEDULE", "CANCEL", "NO_SHOW"];

export function SlotPicker({ date, onDate, value, onPick, durationMin, staffId, ignoreBookingId }: { date: string; onDate: (d: string) => void; value: string; onPick: (t: string) => void; durationMin?: number | null; staffId?: string | null; ignoreBookingId?: string }) {
  const { token, partnerId } = useStudio();
  const q = useQuery({
    queryKey: ["studio-slots", partnerId, date, durationMin, staffId, ignoreBookingId],
    queryFn: () => unwrap(studioSlotsFn({ data: { token, partnerId, date, durationMin: durationMin ?? undefined, staffId: staffId ?? null, ignoreBookingId } })),
    enabled: !!date,
  });
  return (
    <div className="space-y-2">
      <Field label="Date"><input type="date" min={isoToday()} value={date} onChange={e => { onDate(e.target.value); onPick(""); }} className={inputCls} /></Field>
      <div className="text-xs font-semibold text-muted-foreground">Free times</div>
      {q.isLoading ? <Spinner /> : q.error ? <p className="text-sm text-destructive">{(q.error as Error).message}</p> : !q.data?.length ? <p className="text-sm text-muted-foreground">No free times on this date. Check your availability or pick another day.</p> : (
        <div className="flex flex-wrap gap-1.5">{q.data.map(s => (
          <button key={s.time} type="button" onClick={() => onPick(s.time)} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${value === s.time ? "border-brand-navy bg-brand-navy text-brand-on-navy" : "border-border bg-card"}`}>{fmtTime(s.time)}{s.remaining > 1 && s.remaining < 50 ? ` · ${s.remaining} left` : ""}</button>
        ))}</div>
      )}
    </div>
  );
}

/** Row of status actions for one appointment, with dialogs where a note or new time is needed. */
export function AppointmentActions({ b, onDone, staff }: { b: any; onDone: () => void; staff?: { id: string; name: string; is_active: boolean }[] }) {
  const { token, partnerId } = useStudio();
  const [dialog, setDialog] = useState<AppointmentAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(b.booking_date ?? isoToday());
  const [time, setTime] = useState("");
  const actions = allowedActions(b.appointment_status);
  const dur = b.start_time && b.end_time ? toMin(b.end_time) - toMin(b.start_time) : b.listing?.duration_min ?? null;

  const act = async (action: AppointmentAction | "ASSIGN" | "PAYMENT", extra: Record<string, unknown> = {}) => {
    setBusy(true);
    const r = await appointmentActionFn({ data: { token, partnerId, id: b.id, action, ...extra } as never }).catch(() => ({ ok: false as const, error: "Network error" }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success(action === "ASSIGN" ? "Professional updated" : action === "PAYMENT" ? "Payment status updated" : ({ ACCEPT: "Appointment accepted", REJECT: "Appointment rejected", CONFIRM: "Appointment confirmed", RESCHEDULE: "Appointment rescheduled", CANCEL: "Appointment cancelled", COMPLETE: "Marked as completed", NO_SHOW: "Marked as no-show" } as Record<string, string>)[action] ?? "Updated");
    setDialog(null); setNote(""); onDone();
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {actions.map(a => (
        <button key={a} disabled={busy} onClick={() => NEEDS_DIALOG.includes(a) ? setDialog(a) : act(a)}
          className={a === "REJECT" || a === "CANCEL" || a === "NO_SHOW" ? btnDanger : a === "ACCEPT" || a === "CONFIRM" || a === "COMPLETE" ? btnPrimary : btnOutline}>{LABEL[a]}</button>
      ))}
      {staff && staff.length > 0 && actions.length > 0 && (
        <select aria-label="Assign professional" disabled={busy} value={b.staff_id ?? ""} onChange={e => act("ASSIGN", { staffId: e.target.value || null })} className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm">
          <option value="">Unassigned</option>{staff.filter(s => s.is_active || s.id === b.staff_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      {b.amount > 0 && (
        <select aria-label="Payment status" disabled={busy} value={b.payment_status ?? "UNPAID"} onChange={e => act("PAYMENT", { paymentStatus: e.target.value })} className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm">
          <option value="UNPAID">Unpaid</option><option value="PAID">Paid</option><option value="REFUNDED">Refunded</option><option value="NOT_APPLICABLE">Not applicable</option>
        </select>
      )}
      <Dialog open={!!dialog} onOpenChange={o => !o && setDialog(null)}>
        <DialogContent className="font-studio max-w-md">
          <DialogHeader><DialogTitle>{dialog ? LABEL[dialog] : ""} · {b.customer_name || "Customer"}</DialogTitle></DialogHeader>
          {dialog === "RESCHEDULE" && <SlotPicker date={date} onDate={setDate} value={time} onPick={setTime} durationMin={dur} staffId={b.staff_id} ignoreBookingId={b.id} />}
          <Field label={dialog === "RESCHEDULE" ? "Message to customer (optional)" : "Reason (shared with the customer)"}><textarea rows={3} value={note} onChange={e => setNote(e.target.value)} className={inputCls} /></Field>
          <div className="flex justify-end gap-2">
            <button className={btnOutline} onClick={() => setDialog(null)}>Back</button>
            <button disabled={busy || (dialog === "RESCHEDULE" && !time)} className={dialog === "RESCHEDULE" ? btnPrimary : btnDanger}
              onClick={() => dialog && act(dialog, dialog === "RESCHEDULE" ? { date, time, note: note || undefined } : { note: note || undefined })}>{busy && <Spinner />}{dialog ? LABEL[dialog] : ""}</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Seller-created appointment form (also used to convert an enquiry). */
export function NewAppointmentDialog({ onClose, onDone, listings, staff, enquiry }: { onClose: () => void; onDone: () => void; listings: { id: string; name: string; duration_min?: number | null }[]; staff?: { id: string; name: string; is_active: boolean }[]; enquiry?: { id: string; customer_name: string | null; listing_id: string | null } }) {
  const { token, partnerId, me } = useStudio();
  const [name, setName] = useState(enquiry?.customer_name ?? "");
  const [phone, setPhone] = useState("");
  const [listingId, setListingId] = useState(enquiry?.listing_id ?? "");
  const [type, setType] = useState(me?.appointmentTypes[0] ?? "Showroom Visit");
  const [location, setLocation] = useState<"BUSINESS" | "CUSTOMER">("BUSINESS");
  const [address, setAddress] = useState("");
  const [staffId, setStaffId] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(isoToday());
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const dur = listings.find(l => l.id === listingId)?.duration_min ?? null;
  const save = async () => {
    if (!name.trim()) return void toast.error("Add the customer's name.");
    if (!enquiry && !/^\+?\d{10,15}$/.test(phone.trim())) return void toast.error("Enter the customer's 10-digit mobile number.");
    if (!time) return void toast.error("Pick a free time.");
    setBusy(true);
    const r = await createSellerAppointmentFn({ data: { token, partnerId, enquiryId: enquiry?.id ?? null, listingId: listingId || null, customerName: name.trim(), customerPhone: enquiry ? undefined : phone.trim(), appointmentType: type, date, time, staffId: staffId || null, locationType: location, address: address || undefined, notes: notes || undefined } }).catch(() => ({ ok: false as const, error: "Network error" }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success(`Appointment ${r.data.code} created`);
    onDone();
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="font-studio max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{enquiry ? "Convert enquiry to appointment" : "New appointment"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Customer name"><input value={name} onChange={e => setName(e.target.value)} className={inputCls} /></Field>
          {!enquiry && <Field label="Mobile number"><input inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} /></Field>}
          <Field label="Appointment type"><select value={type} onChange={e => setType(e.target.value)} className={inputCls}>{(me?.appointmentTypes ?? []).map(t => <option key={t}>{t}</option>)}</select></Field>
          <Field label={me?.partner.kind === "furniture" ? "Product (optional)" : "Service"}><select value={listingId} onChange={e => setListingId(e.target.value)} className={inputCls}><option value="">{me?.partner.kind === "furniture" ? "General visit" : "Choose a service"}</option>{listings.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
          <Field label="Location"><select value={location} onChange={e => setLocation(e.target.value as never)} className={inputCls}><option value="BUSINESS">{me?.partner.kind === "furniture" ? "At showroom" : "At business location"}</option><option value="CUSTOMER">At customer's place</option></select></Field>
          {staff && staff.length > 0 && <Field label="Professional"><select value={staffId} onChange={e => { setStaffId(e.target.value); setTime(""); }} className={inputCls}><option value="">Any / unassigned</option>{staff.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>}
        </div>
        {location === "CUSTOMER" && <Field label="Customer address"><input value={address} onChange={e => setAddress(e.target.value)} className={inputCls} /></Field>}
        <SlotPicker date={date} onDate={setDate} value={time} onPick={setTime} durationMin={dur} staffId={staffId || null} />
        <Field label="Notes"><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} /></Field>
        <div className="flex justify-end gap-2"><button className={btnOutline} onClick={onClose}>Cancel</button><button disabled={busy} onClick={save} className={btnPrimary}>{busy && <Spinner />}Create appointment</button></div>
      </DialogContent>
    </Dialog>
  );
}
