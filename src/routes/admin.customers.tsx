import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MousePointerClick, ShoppingCart, UsersRound, AlertTriangle, RefreshCw, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth, useCatalog } from "@/lib/store";
import { customerActivityFn, deleteCustomerEventsFn } from "@/lib/customer-activity.functions";
import { EVENT_LABELS, INCOMPLETE_LABELS, type ActivityEvent, type CustomerActivity } from "@/lib/customer-activity";

export const Route = createFileRoute("/admin/customers")({
  component: AdminCustomersPage,
  head: () => ({
    meta: [
      { title: "Customers — Kartogo admin" },
      { name: "description", content: "Every customer action on Kartogo: clicks, product views, cart adds, checkouts and unfinished actions, with delete controls." },
    ],
  }),
});

type Data = Awaited<ReturnType<typeof customerActivityFn>>;
type Filter = "all" | "incomplete" | "signed_in" | "guests";

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function Confirm({ title, body, label, onConfirm, size = "sm", variant = "outline" }: { title: string; body: string; label: React.ReactNode; onConfirm: () => void; size?: "sm" | "default" | "icon"; variant?: "outline" | "destructive" | "ghost" }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size={size} variant={variant} className="gap-1.5">{label}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AdminCustomersPage() {
  const { adminToken } = useAuth();
  const { products } = useCatalog();
  const [days, setDays] = useState(30);
  const [filter, setFilter] = useState<Filter>("all");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    try { setData(await customerActivityFn({ data: { adminToken, days } })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not load customer activity"); }
    finally { setLoading(false); }
  }, [adminToken, days]);
  useEffect(() => { void load(); }, [load]);

  const productName = useCallback((id: string | null) => {
    if (!id) return "";
    return data?.productNames[id] ?? products.find(p => p.id === id)?.name ?? id;
  }, [data, products]);

  type DeletePayload =
    | { mode: "events"; adminToken: string; ids: string[] }
    | { mode: "customer"; adminToken: string; phone: string | null; sessionIds: string[] }
    | { mode: "all"; adminToken: string };
  const remove = async (payload: DeletePayload) => {
    try {
      const r = await deleteCustomerEventsFn({ data: payload });
      toast.success(`Deleted ${r.deleted} action${r.deleted === 1 ? "" : "s"}`);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete"); }
  };

  const customers = useMemo(() => (data?.customers ?? []).filter(c =>
    filter === "incomplete" ? c.incomplete.length > 0 : filter === "signed_in" ? !!c.phone : filter === "guests" ? !c.phone : true), [data, filter]);
  const totals = useMemo(() => {
    const all = data?.customers ?? [];
    const sum = (k: string[]) => all.reduce((n, c) => n + k.reduce((m, t) => m + (c.counts[t] ?? 0), 0), 0);
    return { people: all.length, clicks: sum(["ELEMENT_CLICKED", "RECOMMENDATION_CLICKED"]), carts: sum(["PRODUCT_ADDED_TO_CART", "RECOMMENDATION_ADDED_TO_CART"]), incomplete: all.filter(c => c.incomplete.length).length };
  }, [data]);

  const detail = (e: ActivityEvent) => {
    const m = e.metadata ?? {};
    if (e.event_type === "ELEMENT_CLICKED") return [m.label ? `"${m.label}"` : "", m.path ? `on ${m.path}` : ""].filter(Boolean).join(" ");
    if (e.event_type === "PRODUCT_SEARCHED") return e.search_query ? `"${e.search_query}"` : "";
    if (e.event_type === "CATEGORY_VIEWED") return e.category ?? "";
    if (e.order_id) return `Order ${e.order_id}`;
    return productName(e.product_id);
  };

  if (!adminToken) return <p className="text-sm text-muted-foreground">Sign in as admin to see customers.</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Customers</h1>
          <p className="text-sm text-muted-foreground">Every click, view, cart add and checkout by each shopper, including actions they left unfinished.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Time range" value={days} onChange={e => setDays(Number(e.target.value))} className="h-9 rounded-md border border-input bg-card px-2 text-sm font-semibold">
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading} className="gap-1.5"><RefreshCw className="h-4 w-4" />Refresh</Button>
          <Confirm variant="destructive" label={<><Trash2 className="h-4 w-4" />Delete all</>} title="Delete all customer activity?"
            body="This permanently removes every recorded customer action from the admin page and the database. Personal suggestions will start learning again from scratch."
            onConfirm={() => void remove({ mode: "all", adminToken })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { icon: UsersRound, label: "Customers", value: totals.people },
          { icon: MousePointerClick, label: "Clicks", value: totals.clicks },
          { icon: ShoppingCart, label: "Added to cart", value: totals.carts },
          { icon: AlertTriangle, label: "With unfinished actions", value: totals.incomplete },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground"><s.icon className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-wide">{s.label}</span></div>
            <div className="mt-2 font-display text-2xl font-extrabold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {([["all", "All"], ["incomplete", "Unfinished actions"], ["signed_in", "Signed in"], ["guests", "Guests"]] as [Filter, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${filter === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{label}</button>
        ))}
      </div>
      {data?.truncated && <p className="text-xs text-muted-foreground">Showing the latest {data.totalEvents.toLocaleString("en-IN")} actions. Pick a shorter time range to see older ones in full.</p>}

      {loading && !data ? <p className="text-sm text-muted-foreground">Loading customer activity…</p> : customers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">No customer activity in this period.</div>
      ) : (
        <ul className="space-y-3">
          {customers.map(c => <CustomerRow key={c.key} c={c} open={open === c.key} onToggle={() => setOpen(open === c.key ? null : c.key)} detail={detail} productName={productName}
            onDeleteCustomer={() => void remove({ mode: "customer", adminToken, phone: c.phone, sessionIds: c.sessionIds })}
            onDeleteEvent={id => void remove({ mode: "events", adminToken, ids: [id] })} />)}
        </ul>
      )}
    </div>
  );
}

function CustomerRow({ c, open, onToggle, detail, productName, onDeleteCustomer, onDeleteEvent }: {
  c: CustomerActivity; open: boolean; onToggle: () => void; detail: (e: ActivityEvent) => string; productName: (id: string | null) => string;
  onDeleteCustomer: () => void; onDeleteEvent: (id: string) => void;
}) {
  const n = (types: string[]) => types.reduce((s, t) => s + (c.counts[t] ?? 0), 0);
  const stats = [
    ["Clicks", n(["ELEMENT_CLICKED", "RECOMMENDATION_CLICKED"])],
    ["Product views", n(["PRODUCT_VIEWED"])],
    ["Searches", n(["PRODUCT_SEARCHED"])],
    ["Added to cart", n(["PRODUCT_ADDED_TO_CART", "RECOMMENDATION_ADDED_TO_CART"])],
    ["Checkouts", n(["CHECKOUT_STARTED"])],
    ["Orders", n(["ORDER_PLACED"])],
  ] as const;
  return (
    <li className="rounded-2xl border border-border bg-card p-4" data-search-item>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-base font-extrabold">{c.name ?? (c.phone ? "Customer" : "Guest shopper")}</div>
          <div className="text-xs text-muted-foreground">{c.phone ? `+91 ${c.phone}` : `Not signed in · ${c.sessionIds.length} device session${c.sessionIds.length === 1 ? "" : "s"}`} · Last active {fmt(c.lastSeen)}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onToggle} className="gap-1.5">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{open ? "Hide actions" : "View actions"}</Button>
          <Confirm label={<><Trash2 className="h-4 w-4" />Delete</>} title="Delete this customer's activity?"
            body="Every recorded action for this shopper is removed from the admin page and the database." onConfirm={onDeleteCustomer} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {stats.map(([label, value]) => <span key={label} className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{label}: <b>{value}</b></span>)}
      </div>
      {c.incomplete.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {c.incomplete.map(a => (
            <span key={a.kind} className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />{INCOMPLETE_LABELS[a.kind]}{a.productIds.length ? `: ${a.productIds.slice(0, 3).map(productName).join(", ")}${a.productIds.length > 3 ? ` +${a.productIds.length - 3}` : ""}` : ""} · {fmt(a.at)}
            </span>
          ))}
        </div>
      )}
      {open && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="py-2 pr-3">When</th><th className="py-2 pr-3">Action</th><th className="py-2 pr-3">Details</th><th className="py-2" /></tr></thead>
            <tbody>
              {c.events.map(e => (
                <tr key={e.id} className="border-b border-border/60 last:border-0">
                  <td className="whitespace-nowrap py-1.5 pr-3 text-xs text-muted-foreground">{fmt(e.created_at)}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 font-semibold">{EVENT_LABELS[e.event_type] ?? e.event_type}</td>
                  <td className="py-1.5 pr-3 text-xs">{detail(e)}</td>
                  <td className="py-1.5 text-right">
                    <Button size="icon" variant="ghost" aria-label="Delete this action" onClick={() => onDeleteEvent(e.id)} className="h-7 w-7"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.events.length >= 300 && <p className="mt-2 text-xs text-muted-foreground">Showing the latest 300 actions for this customer.</p>}
        </div>
      )}
    </li>
  );
}
