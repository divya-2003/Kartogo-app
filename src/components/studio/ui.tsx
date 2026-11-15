import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { STATUS_LABEL, ENQUIRY_LABEL, type AppointmentStatus, type EnquiryStatus, type StockState } from "@/lib/studio";

export function PageHeader({ title, crumb, children, sub }: { title: string; crumb?: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Link to="/supplier/studio" className="hover:text-foreground">Partner Studio</Link>
          {crumb && <><ChevronRight className="h-3 w-3" /><span className="text-foreground">{crumb}</span></>}
        </nav>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-4 ${className}`}>
      {(title || action) && <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{title}</h2>{action}</div>}
      {children}
    </section>
  );
}

export function Kpi({ label, value, tone = "default", icon }: { label: string; value: ReactNode; tone?: "default" | "warn" | "bad" | "good"; icon?: ReactNode }) {
  const t = tone === "bad" ? "text-destructive" : tone === "warn" ? "text-saffron-foreground" : tone === "good" ? "text-leaf" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">{label}{icon}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${t}`}>{value}</div>
    </div>
  );
}

const TONE: Record<string, string> = {
  PENDING: "bg-saffron/20 text-saffron-foreground", CONFIRMED: "bg-primary/10 text-primary", RESCHEDULED: "bg-brand-navy/10 text-brand-navy",
  COMPLETED: "bg-leaf/15 text-leaf", CANCELLED: "bg-muted text-muted-foreground", REJECTED: "bg-destructive/10 text-destructive", NO_SHOW: "bg-destructive/10 text-destructive",
  NEW: "bg-saffron/20 text-saffron-foreground", RESPONDED: "bg-primary/10 text-primary", IN_PROGRESS: "bg-brand-navy/10 text-brand-navy", CONVERTED: "bg-leaf/15 text-leaf", CLOSED: "bg-muted text-muted-foreground",
  in: "bg-leaf/15 text-leaf", low: "bg-saffron/20 text-saffron-foreground", out: "bg-destructive/10 text-destructive", untracked: "bg-muted text-muted-foreground",
  active: "bg-leaf/15 text-leaf", inactive: "bg-muted text-muted-foreground",
};
export function Badge({ k, children }: { k: string; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[k] ?? "bg-secondary"}`}>{children}</span>;
}
export const StatusBadge = ({ s }: { s: AppointmentStatus }) => <Badge k={s}>{STATUS_LABEL[s] ?? s}</Badge>;
export const EnquiryBadge = ({ s }: { s: EnquiryStatus }) => <Badge k={s}>{ENQUIRY_LABEL[s] ?? s}</Badge>;
const STOCK_LABEL: Record<StockState, string> = { in: "In stock", low: "Low stock", out: "Out of stock", untracked: "Stock not set" };
export const StockBadge = ({ s }: { s: StockState }) => <Badge k={s}>{STOCK_LABEL[s]}</Badge>;
export const ActiveBadge = ({ on }: { on: boolean }) => <Badge k={on ? "active" : "inactive"}>{on ? "Active" : "Inactive"}</Badge>;

export function Empty({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" />
      <div className="mt-2 font-semibold">{title}</div>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {children && <div className="mt-3 flex gap-2">{children}</div>}
    </div>
  );
}
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <AlertTriangle className="h-5 w-5 text-destructive" /><span className="flex-1">{message}</span>
      {onRetry && <button onClick={onRetry} className="rounded-lg border border-border bg-card px-3 py-1.5 font-semibold">Retry</button>}
    </div>
  );
}
export function Loading({ rows = 4 }: { rows?: number }) {
  return <div className="space-y-2" aria-busy="true">{Array.from({ length: rows }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-secondary" />)}</div>;
}
export const Spinner = () => <Loader2 className="h-4 w-4 animate-spin" />;

/** Button that asks for confirmation before running a destructive action. */
export function ConfirmButton({ title, body, confirmLabel = "Confirm", onConfirm, className, children, disabled }: { title: string; body?: string; confirmLabel?: string; onConfirm: () => void | Promise<void>; className?: string; children: ReactNode; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} className={className}>{children}</button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle>{body && <AlertDialogDescription>{body}</AlertDialogDescription>}</AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2">
            <AlertDialogCancel className="mt-0">Keep</AlertDialogCancel>
            <AlertDialogAction onClick={() => { void onConfirm(); }}>{confirmLabel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-sm">
      <button aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
      <span className="tabular-nums">Page {page} of {pages}</span>
      <button aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
    </div>
  );
}

export const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
export const btn = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50";
export const btnPrimary = `${btn} bg-brand-navy text-brand-on-navy hover:opacity-90`;
export const btnOutline = `${btn} border border-border bg-card hover:bg-secondary`;
export const btnDanger = `${btn} border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15`;

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const fmtDate = (d?: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const fmtTime = (t?: string | null) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
export const fmtWhen = (ts?: string | null) => (ts ? new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");
export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const isoToday = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
