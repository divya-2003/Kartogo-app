import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, ExternalLink, Loader2, MessageCircle, RefreshCw, Search, SkipForward } from "lucide-react";
import { useAuth } from "@/lib/store";
import { pendingWhatsAppFn, prepareWhatsAppFn, updateWhatsAppFn } from "@/lib/whatsapp-promo.functions";
import { indiaDay, type PromoCustomer, WHATSAPP_DAILY_LIMIT } from "@/lib/whatsapp-promo.shared";
import { whatsappMessage } from "@/lib/whatsapp-link";
import { WhatsAppProductPicker } from "@/components/admin/WhatsAppProductPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/whatsapp-recommendations")({
  component: WhatsAppRecommendations,
  head: () => ({ meta: [
    { title: "WhatsApp Recommendations — Kartogo Admin" },
    { name: "description", content: "Manage Kartogo's consent-based, manually sent first-order WhatsApp recommendations." },
    { property: "og:title", content: "WhatsApp Recommendations — Kartogo Admin" },
    { property: "og:description", content: "Authorized manual recommendations with customer consent and a daily message limit." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
});

function WhatsAppRecommendations() {
  const { adminToken } = useAuth();
  const fetch = useServerFn(pendingWhatsAppFn);
  const prepare = useServerFn(prepareWhatsAppFn);
  const update = useServerFn(updateWhatsAppFn);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [confirmation, setConfirmation] = useState<{ customer: PromoCustomer; action: "sent" | "skip"; productId: string } | null>(null);
  const query = useQuery({ queryKey: ["whatsapp-promos", adminToken, debounced, page], queryFn: () => fetch({ data: { token: adminToken ?? "", search: debounced, page } }), enabled: Boolean(adminToken), retry: false, refetchOnWindowFocus: true, refetchInterval: 60_000 });
  useEffect(() => { const timer = window.setTimeout(() => { setDebounced(search); setPage(1); }, 300); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => { if (query.data && query.data.page !== page) setPage(query.data.page); }, [query.data, page]);
  const data = query.data;
  const capped = (data?.summary.sent ?? 0) >= WHATSAPP_DAILY_LIMIT;
  const productFor = (c: PromoCustomer) => selected[c.id] ?? c.productId ?? "";
  const openWhatsApp = async (customer: PromoCustomer) => {
    if (!adminToken || busyRef.current) return;
    const productId = productFor(customer);
    if (!productId) { toast.error("Select a product first."); return; }
    // Reserve a tab during the click, before awaiting server checks, to avoid popup blocking.
    const tab = window.open("about:blank", "_blank");
    if (!tab) { toast.error("Allow popups for Kartogo, then try again."); return; }
    tab.opener = null;
    busyRef.current = true; setBusy(customer.id);
    try { const result = await prepare({ data: { token: adminToken, userId: customer.id, productId } }); tab.location.replace(result.url); }
    catch (error) { tab.close(); toast.error(error instanceof Error ? error.message : "Could not open WhatsApp."); void query.refetch(); }
    finally { busyRef.current = false; setBusy(null); }
  };
  const confirm = async () => {
    if (!adminToken || !confirmation || busyRef.current) return;
    const { customer, action, productId } = confirmation;
    busyRef.current = true; setBusy(customer.id);
    try {
      await update({ data: { token: adminToken, userId: customer.id, action, ...(productId ? { productId } : {}) } });
      // A row is removed only after its database transaction succeeds.
      query.client;
      setConfirmation(null);
      toast.success(action === "sent" ? "Message marked as sent" : "Customer skipped");
      await query.refetch();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save. Please try again."); }
    finally { busyRef.current = false; setBusy(null); }
  };
  if (!adminToken) return <p>Sign in as an authorized admin to view WhatsApp recommendations.</p>;
  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase text-muted-foreground">Customer Growth</p><h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-bold"><MessageCircle className="h-6 w-6 shrink-0" />WhatsApp Recommendations</h1><p className="mt-1 text-sm text-muted-foreground">Registered but Not Ordered</p></div>
      <Button variant="outline" disabled={query.isFetching || Boolean(busy)} onClick={() => void query.refetch()}><RefreshCw />Refresh</Button>
    </header>
    <section aria-label="Campaign summary" className="grid grid-cols-2 gap-4 border-y border-border py-5 lg:grid-cols-4">
      <div><p className="text-sm text-muted-foreground">Messages Sent Today</p><p className="mt-1 text-2xl font-bold">{data ? data.summary.sent : "—"} / 25</p><p className="text-xs text-muted-foreground">Asia/Kolkata · {data?.summary.day ?? indiaDay()}</p></div>
      <div><p className="text-sm text-muted-foreground">Daily Limit</p><p className="mt-1 text-2xl font-bold">25</p></div>
      <div><p className="text-sm text-muted-foreground">Pending Recommendations</p><p className="mt-1 text-2xl font-bold">{data?.summary.pending ?? "—"}</p></div>
      <div><p className="text-sm text-muted-foreground">Skipped Customers</p><p className="mt-1 text-2xl font-bold">{data?.summary.skipped ?? "—"}</p></div>
    </section>
    <p className="text-sm text-muted-foreground">Open WhatsApp, send the message manually, then return and select Mark as Sent. Opening a chat does not mark it as sent.</p>
    {capped && <p role="status" className="rounded-md border border-border bg-secondary p-3 text-sm font-semibold">Daily limit reached. More messages can be confirmed after midnight in India. Skip is still available.</p>}
    {Boolean(data?.summary.invalid) && <p className="text-sm text-destructive">{data?.summary.invalid} record(s) excluded because their phone number is invalid.</p>}
    {data && !data.products.length && <p role="status" className="text-sm text-destructive">No active products are available. Sending is disabled.</p>}
    <div className="relative max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Search customers" placeholder="Search customer name or phone" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div>
    {query.isLoading && <p role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading recommendations…</p>}
    {query.isError && <div role="alert" className="flex flex-wrap items-center gap-3"><p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Could not load recommendations."}</p><Button variant="outline" onClick={() => void query.refetch()}>Retry</Button></div>}
    {data && !query.isError && <>
      {!data.customers.length ? <div className="border-y border-border py-12 text-center"><MessageCircle className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">No pending recommendations</h2><p className="mt-1 text-sm text-muted-foreground">{search ? "No customers match your search." : "Opted-in customers with no submitted orders appear after 24 hours."}</p></div> : <>
        <div className="hidden grid-cols-[1fr_1fr_1fr_1.3fr_2fr] gap-4 border-b border-border pb-2 text-xs font-semibold uppercase text-muted-foreground xl:grid"><span>Customer Name</span><span>Phone Number</span><span>Signup Date</span><span>Recommended Product</span><span>Actions</span></div>
        <div className="grid gap-3 md:grid-cols-2 xl:block">
          {data.customers.map(customer => {
            const productId = productFor(customer); const product = data.products.find(p => p.id === productId);
            return <article key={customer.id} data-search-item className="min-w-0 rounded-md border border-border p-4 xl:grid xl:grid-cols-[1fr_1fr_1fr_1.3fr_2fr] xl:items-center xl:gap-4 xl:rounded-none xl:border-x-0 xl:border-t-0 xl:px-0">
              <div className="break-words font-semibold">{customer.name || "Customer"}</div>
              <div className="mt-1 text-sm xl:mt-0">{customer.phone}</div>
              <div className="mt-1 text-xs text-muted-foreground xl:mt-0">{new Date(customer.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })}</div>
              <div className="mt-3 min-w-0 xl:mt-0"><WhatsAppProductPicker label={`Recommended product for ${customer.name || customer.phone}`} products={data.products} value={productId} disabled={Boolean(busy) || !data.products.length} onChange={id => setSelected(prev => ({ ...prev, [customer.id]: id }))} /></div>
              <div className="mt-3 flex flex-wrap items-center gap-2 xl:mt-0">
                <Button size="sm" variant="outline" disabled={Boolean(busy) || capped || !product} onClick={() => void openWhatsApp(customer)}><ExternalLink />Open in WhatsApp</Button>
                <Button size="sm" disabled={Boolean(busy) || capped || !product} onClick={() => setConfirmation({ customer, action: "sent", productId })}><Check />Mark as Sent</Button>
                <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => setConfirmation({ customer, action: "skip", productId })}><SkipForward />Skip</Button>
                {busy === customer.id && <Loader2 aria-label="Working" className="h-4 w-4 animate-spin" />}
              </div>
            </article>;
          })}
        </div>
      </>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"><p className="text-sm text-muted-foreground">{data.total} customer(s) · Page {data.page} of {Math.max(1, Math.ceil(data.total / 25))}</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={data.page <= 1 || query.isFetching || Boolean(busy)} onClick={() => setPage(p => p - 1)}><ChevronLeft />Previous</Button><Button size="sm" variant="outline" disabled={data.page * 25 >= data.total || query.isFetching || Boolean(busy)} onClick={() => setPage(p => p + 1)}>Next<ChevronRight /></Button></div></div>
    </>}
    <AlertDialog open={Boolean(confirmation)} onOpenChange={open => { if (!open && !busy) setConfirmation(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{confirmation?.action === "sent" ? "Confirm manually sent message" : "Skip this customer?"}</AlertDialogTitle><AlertDialogDescription>{confirmation?.action === "sent" ? `Confirm you sent the WhatsApp message to ${confirmation.customer.name || confirmation.customer.phone}. Opening WhatsApp alone does not count.` : "This customer will leave the campaign. Skipping does not count toward the daily message limit."}</AlertDialogDescription></AlertDialogHeader>
        {confirmation?.action === "sent" && <p className="max-h-56 overflow-y-auto whitespace-pre-line rounded-md bg-secondary p-3 text-sm">{whatsappMessage(confirmation.customer.name, data?.products.find(p => p.id === confirmation.productId)?.name ?? "", confirmation.productId)}</p>}
        <AlertDialogFooter className="flex-row justify-end gap-2"><Button variant="outline" disabled={Boolean(busy)} onClick={() => setConfirmation(null)}>Cancel</Button><Button disabled={Boolean(busy)} onClick={() => void confirm()}>{busy && <Loader2 className="animate-spin" />}{confirmation?.action === "sent" ? "Confirm Mark as Sent" : "Confirm Skip"}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}