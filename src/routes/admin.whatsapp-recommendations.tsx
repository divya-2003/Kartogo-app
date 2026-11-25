import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, ExternalLink, MessageCircle, RefreshCw, Search, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/store";
import { listPendingPromosFn, updatePromoStatusFn, openPromoLinkFn } from "@/lib/whatsapp-promo.functions";
import { WHATSAPP_DAILY_LIMIT, whatsappMessage, type PromoProduct } from "@/lib/whatsapp-link";

export const Route = createFileRoute("/admin/whatsapp-recommendations")({
  component: WhatsappRecommendations,
  head: () => ({ meta: [
    { title: "WhatsApp Recommendations — Kartogo Admin" },
    { name: "description", content: "Registered but Not Ordered: consent-based, manually confirmed WhatsApp product recommendations." },
    { property: "og:title", content: "WhatsApp Recommendations — Kartogo Admin" },
    { property: "og:description", content: "Manage consent-based customer recommendations and the daily manual message allowance." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

type Customer = Awaited<ReturnType<typeof listPendingPromosFn>>["customers"][number];
type Confirmation = { id: string; name: string; action: "sent" | "skip"; productId?: string };

function WhatsappRecommendations() {
  const { adminToken } = useAuth();
  const fetchPending = useServerFn(listPendingPromosFn);
  const update = useServerFn(updatePromoStatusFn);
  const openLink = useServerFn(openPromoLinkFn);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  useEffect(() => { const t = window.setTimeout(() => { setTerm(search.trim()); setPage(1); }, 300); return () => window.clearTimeout(t); }, [search]);
  const query = useQuery({
    queryKey: ["whatsapp-promos", adminToken, page, term],
    enabled: Boolean(adminToken),
    queryFn: () => {
      if (!adminToken) throw new Error("Admin authorization required");
      return fetchPending({ data: { adminToken, page, search: term } });
    },
    refetchInterval: 60_000,
    retry: false,
  });
  const data = query.data;
  const productFor = (customer: Customer) => data?.products.find(p => p.id === (selected[customer.id] ?? customer.productId));
  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: ["whatsapp-promos"] }), [queryClient]);
  const limitReached = (data?.sent ?? 0) >= WHATSAPP_DAILY_LIMIT;

  async function launch(customer: Customer, product: PromoProduct | undefined) {
    if (!product) { toast.error("Select an available product first."); return; }
    if (!adminToken || limitReached) { toast.error("Daily limit of 25 messages reached."); return; }
    // Reserve the browser tab synchronously to avoid mobile popup blocking.
    const tab = window.open("about:blank", "_blank");
    if (!tab) { toast.error("Allow pop-ups for Kartogo to open WhatsApp."); return; }
    tab.opener = null;
    setOpening(customer.id);
    try {
      const r = await openLink({ data: { adminToken, userId: customer.id, productId: product.id } });
      tab.location.href = r.url;
    } catch (e) {
      tab.close();
      toast.error(e instanceof Error ? e.message : "Could not open WhatsApp.");
      void refresh();
    } finally { setOpening(null); }
  }

  async function commit() {
    if (!confirm || !adminToken) return;
    setBusy(true);
    try {
      await update({ data: { adminToken, userId: confirm.id, action: confirm.action, ...(confirm.productId ? { productId: confirm.productId } : {}) } });
      // Never hide a row before a database-confirmed success.
      toast.success(confirm.action === "sent" ? "Message marked as sent" : "Customer skipped");
      setConfirm(null);
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save. Please try again."); }
    finally { setBusy(false); }
  }

  function row(customer: Customer) {
    const product = productFor(customer);
    return <tr key={customer.id} data-search-item className="block border-b border-border p-4 last:border-0 lg:table-row lg:p-0">
      <td className="block pb-2 font-semibold lg:table-cell lg:px-3 lg:py-4">{customer.name || "Customer"}</td>
      <td className="block pb-2 text-sm lg:table-cell lg:px-3 lg:py-4">{customer.phone}</td>
      <td className="block pb-3 text-xs text-muted-foreground lg:table-cell lg:px-3 lg:py-4">{new Date(customer.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })}</td>
      <td className="block pb-3 lg:table-cell lg:max-w-64 lg:px-3 lg:py-4">
        <Select value={selected[customer.id] ?? customer.productId ?? ""} onValueChange={id => setSelected(prev => ({ ...prev, [customer.id]: id }))}>
          <SelectTrigger aria-label={`Recommended product for ${customer.name}`}><SelectValue placeholder="Select an available product" /></SelectTrigger>
          <SelectContent>{data?.products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} · ₹{p.price}</SelectItem>)}</SelectContent>
        </Select>
        {product && <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Message preview</summary><p className="mt-2 whitespace-pre-wrap break-words">{whatsappMessage(customer.name, product.name, product.id)}</p></details>}
      </td>
      <td className="block lg:table-cell lg:px-3 lg:py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={!product || limitReached || opening !== null || busy} onClick={() => void launch(customer, product)}><ExternalLink className="mr-1.5 h-4 w-4" />{opening === customer.id ? "Opening…" : "Open in WhatsApp"}</Button>
          <Button size="sm" disabled={!product || limitReached || busy} onClick={() => setConfirm({ id: customer.id, name: customer.name, action: "sent", ...(product ? { productId: product.id } : {}) })}><Check className="mr-1 h-4 w-4" />Mark as Sent</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm({ id: customer.id, name: customer.name, action: "skip" })}><SkipForward className="mr-1 h-4 w-4" />Skip</Button>
        </div>
      </td>
    </tr>;
  }

  return <div className="min-w-0">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm text-muted-foreground">Customer Growth</p><h1 className="font-display text-2xl font-bold">WhatsApp Recommendations</h1><p className="mt-1 text-sm text-muted-foreground">Registered but Not Ordered</p></div>
      <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void refresh()}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</Button>
    </div>
    {data && <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[{ label: "Messages Sent Today", value: `${data.sent} / 25` }, { label: "Daily Limit", value: "25" }, { label: "Pending Recommendations", value: data.pending }, { label: "Skipped Customers", value: data.skipped }].map(stat => <div key={stat.label} className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{stat.label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{stat.value}</p></div>)}
    </div>}
    <p className="mb-4 text-sm text-muted-foreground">Select a product, open WhatsApp and send the message manually. Return here and confirm Mark as Sent. Opening a chat does not mark it sent. The daily allowance resets at midnight in India.</p>
    {limitReached && <p role="alert" className="mb-4 rounded-lg border border-border bg-secondary p-3 text-sm font-semibold">Daily limit reached — Messages Sent Today: {data?.sent} / 25. Skip remains available.</p>}
    <div className="mb-4 flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><Input aria-label="Search pending customers" placeholder="Search customer name or phone" value={search} onChange={e => setSearch(e.target.value)} /></div>
    {!adminToken && <p role="alert">Sign in as an authorized admin.</p>}
    {query.isPending && adminToken && <p role="status" className="py-8 text-center text-muted-foreground">Loading recommendations…</p>}
    {query.isError && <div role="alert" className="flex flex-wrap items-center gap-3 py-6"><p className="text-destructive">{query.error.message}</p><Button variant="outline" onClick={() => void refresh()}>Try again</Button></div>}
    {data && !query.isError && <>
      {!data.products.length && <p role="alert" className="mb-3 text-sm text-destructive">No active, in-stock products are available. Sending is disabled.</p>}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {data.customers.length ? <table className="block w-full text-left lg:table"><thead className="hidden border-b border-border bg-secondary text-xs text-muted-foreground lg:table-header-group"><tr>{["Customer Name", "Phone Number", "Signup Date", "Recommended Product", "Actions"].map(h => <th className="px-3 py-3 font-semibold" key={h}>{h}</th>)}</tr></thead><tbody className="block lg:table-row-group">{data.customers.map(row)}</tbody></table> : <div className="py-12 text-center"><MessageCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-semibold">No pending recommendations</p><p className="mt-1 text-sm text-muted-foreground">{term ? "No customers match your search." : "Customers appear after opting in, waiting 24 hours and having no submitted orders."}</p></div>}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{data.total} customer{data.total === 1 ? "" : "s"} · Page {data.page} of {data.pages}</span><div className="flex gap-2"><Button size="icon" variant="outline" aria-label="Previous page" disabled={data.page <= 1 || query.isFetching} onClick={() => setPage(data.page - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button size="icon" variant="outline" aria-label="Next page" disabled={data.page >= data.pages || query.isFetching} onClick={() => setPage(data.page + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div>
      {data.invalidCount > 0 && <section className="mt-6 border-t border-border pt-4"><h2 className="font-semibold">Invalid phone numbers ({data.invalidCount})</h2><p className="mb-3 text-sm text-muted-foreground">These customers cannot be contacted. No WhatsApp link can be generated.</p>{data.invalid.map(c => <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3"><span className="text-sm">{c.name || "Customer"} · {c.phone || "Missing phone"}</span><Button size="sm" variant="outline" onClick={() => setConfirm({ id: c.id, name: c.name, action: "skip" })}>Skip</Button></div>)}</section>}
    </>}
    <AlertDialog open={Boolean(confirm)} onOpenChange={open => { if (!open && !busy) setConfirm(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirm?.action === "sent" ? "Confirm manually sent message" : "Skip this customer?"}</AlertDialogTitle><AlertDialogDescription>{confirm?.action === "sent" ? `Confirm that you actually sent the WhatsApp message to ${confirm.name}. This records it against today’s allowance.` : `${confirm?.name || "This customer"} will be removed from this campaign. This does not use your daily allowance.`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><Button disabled={busy} onClick={() => void commit()}>{busy ? "Saving…" : confirm?.action === "sent" ? "Confirm Mark as Sent" : "Confirm Skip"}</Button></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>;
}