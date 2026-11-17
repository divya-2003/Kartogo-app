import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Ban, CalendarCheck, Settings2, Store } from "lucide-react";
import { adminStudioOverviewFn, adminUpdateStudioPartnerFn, adminUpdateCategoryConfigFn } from "@/lib/studio-admin.functions";
import { BOOKING_MODE_LABEL, type BookingMode } from "@/lib/studio";

export const Route = createFileRoute("/admin/studio")({
  component: AdminStudio,
  head: () => ({ meta: [{ title: "Partner Studio sellers — Kartogo Admin" }] }),
});

const tok = () => { try { return JSON.parse(localStorage.getItem("qk_admin_token") || "null") ?? ""; } catch { return ""; } };
const MODES: BookingMode[] = ["INSTANT", "SELLER_APPROVAL", "BOOKING_REQUEST"];
const pill = "rounded-full px-2 py-0.5 text-[10px] font-bold";

function AdminStudio() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-studio"], queryFn: () => adminStudioOverviewFn({ data: { token: tok() } }) });
  const [kind, setKind] = useState<"" | "furniture" | "service">("");
  const [cfg, setCfg] = useState<string | null>(null);
  const reload = () => qc.invalidateQueries({ queryKey: ["admin-studio"] });
  const update = async (id: string, patch: Record<string, unknown>, msg: string) => {
    const r = await adminUpdateStudioPartnerFn({ data: { token: tok(), id, ...patch } as never }).catch(() => ({ ok: false as const, error: "Network error" }));
    if (!r.ok) return void toast.error((r as any).error);
    toast.success(msg); reload();
  };
  const rows = (q.data?.partners ?? []).filter((p: any) => !kind || p.kind === kind);
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-1">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><Store className="h-6 w-6 text-primary" />Partner Studio sellers</h1>
        <p className="mt-1 text-sm text-muted-foreground">Furniture sellers and service providers, their verification, account status, booking mode and appointment activity (last 30 days). Every change is recorded in the audit log.</p>
      </header>
      <div className="flex gap-2">{([["", "All"], ["furniture", "Furniture sellers"], ["service", "Service providers"]] as const).map(([k, l]) => <button key={k} onClick={() => setKind(k)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${kind === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{l}</button>)}</div>
      {q.isLoading ? <div className="h-40 animate-pulse rounded-2xl bg-secondary" /> : q.error ? <p className="text-sm text-destructive">{(q.error as Error).message}</p> : (
        <ul className="grid gap-3 md:grid-cols-2">{rows.map((p: any) => (
          <li key={p.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5"><span className="truncate font-display text-base font-bold">{p.icon} {p.name}</span>
                  <span className={`${pill} bg-secondary`}>{p.kind === "furniture" ? "Furniture" : "Services"}</span>
                  <span className={`${pill} ${p.verification_status === "VERIFIED" ? "bg-leaf/15 text-leaf" : p.verification_status === "REJECTED" ? "bg-destructive/15 text-destructive" : "bg-saffron/20"}`}>{p.verification_status === "VERIFIED" ? "Verified" : p.verification_status === "REJECTED" ? "Rejected" : "Pending verification"}</span>
                  <span className={`${pill} ${p.account_status === "ACTIVE" ? "bg-primary/10 text-primary" : "bg-destructive/15 text-destructive"}`}>{p.account_status === "ACTIVE" ? "Active" : "Suspended"}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Categories: {(p.category_slugs ?? []).join(", ")}</div>
                <div className="text-xs text-muted-foreground">Login number: {p.supplier_phone ?? "not linked"}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-1 text-center text-xs">
              {[["Bookings", p.stats.total], ["Pending", p.stats.pending], ["Done", p.stats.completed], ["Cancelled", p.stats.cancelled], ["Enquiries", p.stats.enquiries]].map(([l, v]) => <div key={l as string} className="rounded-lg bg-secondary/60 p-1.5"><div className="text-base font-bold">{v}</div>{l}</div>)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {p.verification_status !== "VERIFIED" && <button onClick={() => update(p.id, { verification: "VERIFIED" }, "Business verified")} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"><BadgeCheck className="h-3.5 w-3.5" />Verify</button>}
              {p.verification_status !== "REJECTED" && <button onClick={() => confirm(`Reject verification for ${p.name}?`) && update(p.id, { verification: "REJECTED" }, "Verification rejected")} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">Reject</button>}
              <button onClick={() => confirm(p.account_status === "ACTIVE" ? `Suspend ${p.name}? Their store is hidden and Studio changes are blocked.` : `Reactivate ${p.name}?`) && update(p.id, { account: p.account_status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }, p.account_status === "ACTIVE" ? "Account suspended" : "Account reactivated")} className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive"><Ban className="h-3.5 w-3.5" />{p.account_status === "ACTIVE" ? "Suspend" : "Reactivate"}</button>
              <label className="flex items-center gap-1 text-xs"><CalendarCheck className="h-3.5 w-3.5" />
                <select aria-label="Booking mode" value={p.booking_mode ?? ""} onChange={e => update(p.id, { bookingMode: e.target.value || null }, "Booking mode updated")} className="rounded-lg border border-border bg-background px-2 py-1">
                  <option value="">Category default</option>{MODES.map(m => <option key={m} value={m}>{BOOKING_MODE_LABEL[m]}</option>)}
                </select></label>
              <button onClick={() => { const v = prompt(`Seller login number for ${p.name} (10 digits)`); if (v && /^\d{10}$/.test(v.trim())) update(p.id, { phone: v.trim() }, "Login number updated"); else if (v) toast.error("Enter a 10-digit number"); }} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">{p.linked ? "Change login number" : "Link login number"}</button>
            </div>
          </li>
        ))}</ul>
      )}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Settings2 className="h-5 w-5" />Category configuration</h2>
        <p className="text-xs text-muted-foreground">Booking mode and appointment types used by every business in a category (a business-level booking mode above overrides it).</p>
        <ul className="mt-3 divide-y divide-border">{(q.data?.categories ?? []).map((c: any) => <CategoryRow key={c.slug} c={c} open={cfg === c.slug} onToggle={() => setCfg(cfg === c.slug ? null : c.slug)} onSaved={reload} />)}</ul>
      </section>
    </div>
  );
}

function CategoryRow({ c, open, onToggle, onSaved }: { c: any; open: boolean; onToggle: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<BookingMode>(c.booking_mode);
  const [types, setTypes] = useState<string>((c.appointment_types ?? []).join(", "));
  const save = async () => {
    const r = await adminUpdateCategoryConfigFn({ data: { token: tok(), slug: c.slug, bookingMode: mode, appointmentTypes: types.split(",").map((t: string) => t.trim()).filter(Boolean) } }).catch(() => ({ ok: false as const, error: "Network error" }));
    if (!r.ok) return void toast.error((r as any).error);
    toast.success(`${c.name} updated`); onSaved(); onToggle();
  };
  return (
    <li className="py-2">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-2 text-left text-sm"><span className="font-semibold">{c.name}</span><span className="text-xs text-muted-foreground">{BOOKING_MODE_LABEL[c.booking_mode as BookingMode]} · {(c.appointment_types ?? []).length} appointment types</span></button>
      {open && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <select aria-label="Booking mode" value={mode} onChange={e => setMode(e.target.value as BookingMode)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm">{MODES.map(m => <option key={m} value={m}>{BOOKING_MODE_LABEL[m]}</option>)}</select>
          <input aria-label="Appointment types" value={types} onChange={e => setTypes(e.target.value)} placeholder="Comma-separated appointment types" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
          <button onClick={save} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground">Save</button>
        </div>
      )}
    </li>
  );
}
