import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
import { useAuth, useCart, useCatalog, useOrders, useLocation, useWallet, buildLocationQuery, type SavedLocation } from "@/lib/store";
import { ingestOrderFn } from "@/lib/recommendations.functions";
import { clearRecommendationCartProductIds, customerEventService, getRecommendationCartProductIds } from "@/lib/recommendations.tracking";
import { formatINR } from "@/lib/data";
import { toast } from "sonner";
import { Banknote, Smartphone, Wallet, MapPin, Plus, Check, Trash2, X, Tag, Pencil, Flame } from "lucide-react";
import { getSurgeConfigFn, SURGE_REASON_LABELS, type SurgeConfig } from "@/lib/surge.functions";
import { computeDiscount, type PromoRule } from "@/lib/promo";
import { listPromoRulesFn, validatePromoFn } from "@/lib/promo.functions";
import { listDeliverySlotsFn, type DeliverySlot } from "@/lib/slots.functions";

// ---- Scheduled delivery helpers -------------------------------------------
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** "18:00:00" -> "6:00 PM" */
function prettyTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hour = ((h ?? 0) % 12) || 12;
  return `${hour}:${pad(m ?? 0)} ${(h ?? 0) < 12 ? "AM" : "PM"}`;
}
const slotWindow = (s: DeliverySlot) => `${prettyTime(s.start_time)} – ${prettyTime(s.end_time)}`;
/** A slot is bookable today only while there's still time to reach its start. */
function slotAvailableToday(s: DeliverySlot, now = new Date()): boolean {
  const [h, m] = s.start_time.split(":").map(Number);
  const start = new Date(now);
  start.setHours(h ?? 0, m ?? 0, 0, 0);
  return start.getTime() - now.getTime() > 60 * 60 * 1000; // 1-hour cut-off
}



export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({ meta: [{ title: "Checkout — Kartogo" }] }),
});

// Promo rules live in one shared module so the storefront cards, this checkout
// preview and the server-side order validation always agree on the same codes.

function CheckoutPage() {
  const { user, setName: setProfileName, customerToken } = useAuth();
  const { items, subtotal, clear } = useCart();
  const { products } = useCatalog();
  const { place } = useOrders();
  const { location, savedAddresses, deliveryAddresses, addDeliveryAddress, removeDeliveryAddress, removeSavedAddress, updateSavedAddress } = useLocation();
  const { balance: walletBalance, refresh: refreshWallet } = useWallet();
  const nav = useNavigate();

  useEffect(() => { customerEventService.trackCheckoutStarted(); }, []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [payment, setPayment] = useState<"cash" | "upi" | "wallet">("cash");
  const [placing, setPlacing] = useState(false);

  // Edit a saved location's exact address without changing its area.
  const [editLocationId, setEditLocationId] = useState<string | null>(null);
  const [editDoorNumber, setEditDoorNumber] = useState("");
  const [editApartment, setEditApartment] = useState("");
  const [editLandmark, setEditLandmark] = useState("");

  // Promo code state.
  const [promoInput, setPromoInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);

  // New-address form state.
  const [label, setLabel] = useState("Home");
  const [name, setName] = useState("");
  const [newDoor, setNewDoor] = useState("");
  const [newApartment, setNewApartment] = useState("");
  const [newLandmark, setNewLandmark] = useState("");

  // Scheduled delivery (Standard orders only).
  const isQuick = (location?.etaMinutes ?? 99) <= 13;
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [slotDate, setSlotDate] = useState<string | null>(null);
  useEffect(() => {
    if (isQuick) return;
    let alive = true;
    void listDeliverySlotsFn({ data: {} })
      .then(rows => { if (alive) setSlots(rows); })
      .catch(() => {});
    return () => { alive = false; };
  }, [isQuick]);


  const userName = user?.name?.trim() || "Kartogo User";
  // The address the customer picked in "Select your location" is always the
  // default delivery address here — never an older saved one.
  const currentLocationId = location ? `location:${location.query}` : null;
  const addressOptions = useMemo(() => {
    const seen = new Set<string>();
    const currentOption = location
      ? [{
          id: `location:${location.query}`,
          kind: "location" as const,
          label: location.area,
          name: userName,
          address: location.query || location.area,
          removableId: location.query,
        }]
      : [];
    currentOption.forEach(o => seen.add(o.address.trim().toLowerCase()));

    const normalizedDelivery = deliveryAddresses
      .filter(addr => {
        const key = addr.address.trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(addr => ({
        id: `delivery:${addr.id}`,
        kind: "delivery" as const,
        label: addr.label,
        // Always show the current profile name so a name change reflects on every
        // saved address, not the possibly-stale name captured when it was added.
        name: userName,
        address: addr.address,
        removableId: addr.id,
      }));

    const savedLocationOptions = savedAddresses
      .filter(addr => {
        const key = (addr.query || addr.area).trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(addr => ({
        id: `location:${addr.query}`,
        kind: "location" as const,
        label: addr.area,
        name: userName,
        address: addr.query || addr.area,
        removableId: addr.query,
      }));

    return [...currentOption, ...normalizedDelivery, ...savedLocationOptions];
  }, [location, deliveryAddresses, savedAddresses, userName]);

  useEffect(() => { if (user?.name && !name) setName(user.name); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the location sheet: switching location switches the delivery address.
  useEffect(() => {
    if (currentLocationId) setSelectedId(currentLocationId);
  }, [currentLocationId]);

  // Keep a valid selection: default to saved addresses and only show the form when requested.
  useEffect(() => {
    if (addressOptions.length === 0) {
      setSelectedId(null);
      setShowForm(false);
    } else if (!selectedId || !addressOptions.some(a => a.id === selectedId)) {
      setSelectedId(addressOptions[0].id);
      setShowForm(false);
    }
  }, [addressOptions, selectedId]);


  const baseFee = subtotal === 0 ? 0 : subtotal >= 199 ? 0 : 25;
  const [surge, setSurge] = useState<SurgeConfig | null>(null);
  // Live estimate: surge/delivery rules are admin-controlled, so re-read them
  // periodically while the customer is on checkout instead of once on mount.
  useEffect(() => {
    let alive = true;
    const pull = () => { getSurgeConfigFn().then(s => { if (alive) setSurge(s); }).catch(() => {}); };
    pull();
    const t = setInterval(pull, 20000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const surgeAmount = surge?.enabled && subtotal > 0 ? Math.round(surge.amount) : 0;
  const fee = baseFee + surgeAmount;

  // Promo codes are admin-managed in the backend; the checkout previews them
  // and the server re-validates before the order is written.
  const [promoRules, setPromoRules] = useState<PromoRule[]>([]);
  useEffect(() => {
    let alive = true;
    listPromoRulesFn()
      .then(r => { if (alive) setPromoRules(r); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Basket lines, so product-targeted promo codes only discount the items
  // the admin selected for that offer.
  const basketLines = useMemo(
    () => items.map(i => {
      const p = products.find(pr => pr.id === i.productId);
      return { productId: i.productId, price: p?.price ?? 0, qty: i.qty };
    }),
    [items, products],
  );

  const discount = useMemo(
    () => computeDiscount(appliedCode, subtotal, promoRules, basketLines),
    [appliedCode, subtotal, promoRules, basketLines],
  );
  const total = Math.max(0, subtotal + fee - discount);
  // GST is inclusive in listed prices (5% slab) — show it as a breakdown line
  // so the estimate stays transparent without changing what's payable.
  const GST_RATE = 0.05;
  const taxableValue = Math.max(0, subtotal - discount);
  const gst = Math.round((taxableValue - taxableValue / (1 + GST_RATE)) * 100) / 100;
  const freeDeliveryGap = subtotal > 0 && subtotal < 199 ? 199 - subtotal : 0;


  // Show wallet warning only when the wallet method is actively selected.



  const tryPromo = async (raw: string) => {
    const code = raw.trim().toUpperCase();
    if (!code) { toast.error("Enter a promo code"); return; }
    try {
      const token = JSON.parse(localStorage.getItem("qk_customer_token") || "null");
      const verdict = await validatePromoFn({ data: { token: token ?? "", code, subtotal, items: basketLines } });
      if (!verdict.ok) { toast.error(verdict.reason); return; }
      setAppliedCode(verdict.code);
      setPromoInput("");
      toast.success(`${verdict.code} applied — you saved ${formatINR(verdict.discount)}!`);
    } catch {
      toast.error("Could not check that promo code");
    }
  };

  const applyPromo = () => { void tryPromo(promoInput); };

  // A coupon tapped on the home page is remembered and pre-filled here.
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("qk_promo_code"); } catch { /* ignore */ }
    if (saved) {
      setPromoInput(saved);
      try { localStorage.removeItem("qk_promo_code"); } catch { /* ignore */ }
    }
  }, []);




  const removePromo = () => {
    setAppliedCode(null);
    toast.success("Promo code removed");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold">Please login to checkout</h1>
          <p className="mt-2 text-muted-foreground">We need your number to send order updates.</p>
          <Link to="/login" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">Login with OTP</Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold">Your cart is empty</h1>
          <Link to="/" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">Start shopping</Link>
        </div>
      </div>
    );
  }

  const saveNewAddress = () => {
    if (!name.trim()) { toast.error("Please enter your name"); return; }
    if (!newDoor.trim() || !newApartment.trim() || !newLandmark.trim()) {
      toast.error("Please add your door number, apartment name and landmark");
      return;
    }
    const trimmedName = name.trim();
    // The name entered on the address is the customer's name — sync it to their
    // profile so it updates everywhere in the app (account, orders, header).
    if (trimmedName && trimmedName !== (user?.name ?? "").trim()) {
      setProfileName(trimmedName);
    }
    const composed = `${newDoor.trim()}, ${newApartment.trim()}, Ongole (Near ${newLandmark.trim()})`;
    const created = addDeliveryAddress({ label: label.trim() || "Home", name: trimmedName, address: composed });
    setSelectedId(`delivery:${created.id}`);
    setShowForm(false);
    setShowPicker(false);
    setLabel("Home");
    setNewDoor("");
    setNewApartment("");
    setNewLandmark("");
    toast.success("Address saved");
  };

  const startEditLocation = (query: string) => {
    const addr = savedAddresses.find(a => a.query.toLowerCase() === query.toLowerCase());
    if (!addr) return;
    setEditLocationId(query);
    setEditDoorNumber(addr.doorNumber ?? "");
    setEditApartment(addr.apartment ?? "");
    setEditLandmark(addr.landmark ?? "");
  };

  const saveLocationEdit = () => {
    if (!editLocationId) return;
    if (!editDoorNumber.trim() || !editApartment.trim() || !editLandmark.trim()) {
      toast.error("Please add your door number, apartment name and landmark");
      return;
    }
    const existing = savedAddresses.find(a => a.query.toLowerCase() === editLocationId.toLowerCase());
    if (!existing) return;
    const updated: SavedLocation = {
      ...existing,
      doorNumber: editDoorNumber.trim(),
      apartment: editApartment.trim(),
      landmark: editLandmark.trim(),
    };
    const newQuery = buildLocationQuery(updated);
    updateSavedAddress(editLocationId, {
      doorNumber: editDoorNumber.trim(),
      apartment: editApartment.trim(),
      landmark: editLandmark.trim(),
    });
    setSelectedId(`location:${newQuery}`);
    setEditLocationId(null);
    toast.success("Address updated");
  };

  const handlePlace = async () => {
    const selected = addressOptions.find(a => a.id === selectedId);
    if (!selected) { toast.error("Please select a delivery address"); return; }
    // Require complete exact-address details (door no., apartment, landmark)
    // before placing. Saved-area addresses may be missing them — prompt to edit.
    if (selected.kind === "location") {
      const saved = savedAddresses.find(a => a.query.toLowerCase() === selected.removableId.toLowerCase());
      if (!saved?.doorNumber?.trim() || !saved?.apartment?.trim() || !saved?.landmark?.trim()) {
        toast.error("Please add your door number, apartment name and landmark");
        setShowPicker(true);
        startEditLocation(selected.removableId);
        return;
      }
    }
    if (payment === "wallet" && walletBalance < total) {
      toast.error(`Not enough wallet balance. Add ${formatINR(total - walletBalance)} more.`);
      return;
    }
    customerEventService.trackPaymentStarted();
    setPlacing(true);
    try {
      // Only raw items + address are sent. The server recomputes subtotal,
      // delivery fee, promo discount and total from its own catalog so prices
      // can never be tampered with from the browser. When paying with Kartogo
      // Cash, the server also validates and deducts the authoritative wallet
      // balance — the client never charges the wallet itself.
      const order = await place({
        customerName: selected.name,
        address: selected.address,
        items: items.map(i => ({ productId: i.productId, qty: i.qty })),
        promoCode: appliedCode ?? undefined,
        paymentMethod: payment,
      });
      clear();
      // Feed the recommendation engine: purchase events, refreshed preferences,
      // replenishment predictions and co-purchase associations. Idempotent, and
      // never allowed to block the confirmation.
      const recommendationProductIds = getRecommendationCartProductIds();
      void ingestOrderFn({ data: { token: customerToken ?? "", orderId: order.id, recommendationProductIds } })
        .then((result) => { if (result.ok) clearRecommendationCartProductIds(); })
        .catch(() => {});
      customerEventService.trackOrderPlaced(order.id);
      if (payment === "wallet") void refreshWallet();
      toast.success(`Order ${order.id} placed!`);
      nav({ to: "/orders", search: { open: order.id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPlacing(false);
    }
  };


  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <h1 className="mb-6 font-display text-3xl font-bold">Checkout</h1>
        <div className="grid gap-6 md:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-5">
              {(() => {
                const selectedAddress = addressOptions.find(a => a.id === selectedId);
                return (
                  <>
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="font-display text-lg font-bold">Delivery address</h2>
                      {addressOptions.length > 0 && (
                        <button
                          onClick={() => { setShowForm(false); setShowPicker(true); }}
                          className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
                        >
                          Change
                        </button>
                      )}
                    </div>

                    {/* Collapsed: selected address only */}
                    {selectedAddress && (
                      <div className="flex items-start gap-3 rounded-xl border border-primary bg-primary/5 p-3">
                        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{selectedAddress.label}</span>
                            <span className="text-xs text-muted-foreground">{selectedAddress.name}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">{selectedAddress.address}</div>
                        </div>
                      </div>
                    )}

                    {/* Empty state */}
                    {addressOptions.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border bg-background p-4 text-center">
                        <MapPin className="mx-auto h-6 w-6 text-primary" />
                        <p className="mt-2 text-sm font-semibold">No saved address found</p>
                        <p className="mt-1 text-xs text-muted-foreground">Add one address once, then select it for future orders.</p>
                        <button
                          onClick={() => { setName(user.name ?? ""); setShowForm(true); setShowPicker(true); }}
                          className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                        >
                          <Plus className="h-4 w-4" /> Add new address
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </section>

            {/* Scheduled delivery — Standard orders can pick a time window */}
            {!isQuick && slots.length > 0 && (
              <section className="rounded-2xl border border-border bg-card p-5">
                <h2 className="font-display text-lg font-bold">Delivery time</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose a window that suits you, or let us deliver as soon as we can.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={() => { setSlotId(null); setSlotDate(null); }}
                    className={`rounded-xl border p-3 text-left transition ${!slotId ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                  >
                    <div className="text-sm font-bold">As soon as possible</div>
                    <div className="text-xs text-muted-foreground">Standard delivery today</div>
                  </button>
                  {slots.map(s => {
                    const today = slotAvailableToday(s);
                    const date = today ? ymd(new Date()) : ymd(new Date(Date.now() + 86400000));
                    const chosen = slotId === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => { setSlotId(s.id); setSlotDate(date); }}
                        className={`rounded-xl border p-3 text-left transition ${chosen ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                      >
                        <div className="text-sm font-bold">{s.label}</div>
                        <div className="text-xs text-muted-foreground">{slotWindow(s)}</div>
                        <div className="mt-0.5 text-[11px] font-semibold text-primary">
                          {today ? "Today" : "Tomorrow"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}


            {/* Address picker modal */}
            {showPicker && (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={() => setShowPicker(false)}>
                <div
                  className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold">
                      {editLocationId ? "Edit exact address" : showForm ? "Add a new address" : "Select delivery address"}
                    </h3>
                    <button onClick={() => setShowPicker(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {editLocationId ? (
                    <div className="rounded-xl border border-border bg-background p-4">
                      {(() => {
                        const addr = savedAddresses.find(a => a.query.toLowerCase() === editLocationId.toLowerCase());
                        return addr ? (
                          <div className="mb-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <div>
                              <div className="text-sm font-bold">{addr.area}</div>
                              <div className="text-xs text-muted-foreground">{addr.baseQuery ?? addr.query}</div>
                            </div>
                          </div>
                        ) : null;
                      })()}
                      <div className="grid gap-3">
                        <Field label="Door / Flat number">
                          <input value={editDoorNumber} onChange={e => setEditDoorNumber(e.target.value)} placeholder="e.g. 12-3-45, Flat 201" className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
                        </Field>
                        <Field label="Apartment / Building name">
                          <input value={editApartment} onChange={e => setEditApartment(e.target.value)} placeholder="e.g. Sai Residency" className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
                        </Field>
                        <Field label="Landmark">
                          <input value={editLandmark} onChange={e => setEditLandmark(e.target.value)} placeholder="e.g. Opposite SBI ATM" className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
                        </Field>
                        <div className="flex gap-2">
                          <button onClick={() => setEditLocationId(null)} className="flex-1 rounded-xl border border-border py-2.5 font-bold hover:bg-secondary">Cancel</button>
                          <button onClick={saveLocationEdit} className="flex-1 rounded-xl bg-primary py-2.5 font-bold text-primary-foreground hover:bg-primary/90">Save changes</button>
                        </div>

                        {/* Saved addresses — pick one instead of editing this one. */}
                        {addressOptions.length > 0 && (
                          <div className="border-t border-border pt-3">
                            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                              Or deliver to a saved address
                            </div>
                            <ul className="grid gap-2">
                              {addressOptions.map(opt => (
                                <li key={opt.id}>
                                  <button
                                    onClick={() => { setSelectedId(opt.id); setEditLocationId(null); setShowPicker(false); }}
                                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${opt.id === selectedId ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                                  >
                                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                    <span className="min-w-0">
                                      <span className="block text-sm font-bold">{opt.label}</span>
                                      <span className="block text-xs text-muted-foreground">{opt.address}</span>
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : !showForm && (
                    <>
                      {addressOptions.length > 0 && (
                        <ul className="grid gap-2">
                          {addressOptions.map((addr) => {
                            const active = addr.id === selectedId;
                            return (
                              <li
                                key={addr.id}
                                className={`flex items-start gap-3 rounded-xl border p-3 transition ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                              >
                                <button onClick={() => { setSelectedId(addr.id); setShowPicker(false); }} className="flex flex-1 items-start gap-3 text-left">
                                  <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                                    {active ? <Check className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold">{addr.label}</span>
                                      <span className="text-xs text-muted-foreground">{addr.name}</span>
                                    </div>
                                    <div className="text-sm text-muted-foreground">{addr.address}</div>
                                  </div>
                                </button>
                                {addr.kind === "location" && (
                                  <button
                                    onClick={() => startEditLocation(addr.removableId)}
                                    aria-label="Edit exact address"
                                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-primary"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => addr.kind === "delivery" ? removeDeliveryAddress(addr.removableId) : removeSavedAddress(addr.removableId)}
                                  aria-label="Remove address"
                                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      <button
                        onClick={() => { setName(user.name ?? ""); setShowForm(true); }}
                        className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-primary/40 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
                      >
                        <Plus className="h-4 w-4" /> Add new address
                      </button>
                    </>
                  )}

                  {/* New address form */}
                  {showForm && (
                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="grid gap-3">
                        <Field label="Label">
                          <div className="flex flex-wrap gap-2">
                            {["Home", "Work", "Friends", "Other"].map(l => (
                              <button
                                key={l}
                                type="button"
                                onClick={() => setLabel(l)}
                                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${label === l ? "border-primary bg-primary/10 text-primary" : "border-input"}`}
                              >
                                {l}
                              </button>
                            ))}
                          </div>
                        </Field>
                        <Field label="Full name"><input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></Field>
                        <Field label="Mobile"><input value={user.phone} disabled className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-muted-foreground" /></Field>
                        <Field label="Door / Flat number"><input value={newDoor} onChange={e => setNewDoor(e.target.value)} placeholder="e.g. 12-3-45, Flat 201" className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></Field>
                        <Field label="Apartment / Building name"><input value={newApartment} onChange={e => setNewApartment(e.target.value)} placeholder="e.g. Sai Residency" className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></Field>
                        <Field label="Landmark"><input value={newLandmark} onChange={e => setNewLandmark(e.target.value)} placeholder="e.g. Opposite SBI ATM" className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></Field>
                        <div className="flex gap-2">
                          {addressOptions.length > 0 && (
                            <button onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-border py-2.5 font-bold hover:bg-secondary">Back</button>
                          )}
                          <button onClick={saveNewAddress} className="flex-1 rounded-xl bg-primary py-2.5 font-bold text-primary-foreground hover:bg-primary/90">Save address</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 font-display text-lg font-bold">Payment</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <PaymentOption
                  icon={<Banknote className="h-5 w-5" />}
                  title="Cash on delivery"
                  desc={total > 499 ? "Unavailable for orders over ₹499" : "Pay rider in cash"}
                  selected={payment === "cash"}
                  onClick={() => { if (total <= 499) setPayment("cash"); }}
                  disabled={total > 499}
                />
                <PaymentOption icon={<Smartphone className="h-5 w-5" />} title="UPI on delivery" desc="GPay / PhonePe / Paytm" selected={payment === "upi"} onClick={() => setPayment("upi")} />
                <PaymentOption
                  icon={<Wallet className="h-5 w-5" />}
                  title="Kartogo Cash"
                  desc={walletBalance >= total ? `Balance ${formatINR(walletBalance)}` : `Low balance ${formatINR(walletBalance)}`}
                  selected={payment === "wallet"}
                  onClick={() => setPayment("wallet")}
                />
              </div>
              {total > 499 && payment === "cash" && (
                <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700">
                  Cash on delivery is available only for orders up to ₹499. Please choose UPI or Kartogo Cash.
                </p>
              )}
              {payment === "wallet" && walletBalance < total && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
                  <span className="flex items-center gap-1.5">
                    <X className="h-3.5 w-3.5" /> Insufficient Kartogo Cash — you need {formatINR(total - walletBalance)} more.
                  </span>
                  <Link
                    to="/topup"
                    search={{ amount: Math.ceil(total - walletBalance) }}

                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add now
                  </Link>
                </div>
              )}


            </section>
          </div>

          <aside className="h-fit rounded-2xl border border-border bg-card p-5">
            <div className="font-display text-lg font-bold">Your order</div>
            <ul className="my-4 space-y-2 text-sm">
              {items.map(i => {
                const p = products.find(p => p.id === i.productId)!;
                return <li key={i.productId} className="flex justify-between"><span>{p.emoji} {p.name} × {i.qty}</span><span className="font-semibold">{formatINR(p.price * i.qty)}</span></li>;
              })}
            </ul>
            {/* Promo code */}
            <div className="border-t border-border pt-3">
              {appliedCode ? (
                <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/5 px-3 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Tag className="h-4 w-4 text-primary" />
                    <span className="font-bold text-primary">{appliedCode}</span>
                    <span className="text-muted-foreground">applied</span>
                  </div>
                  <button onClick={removePromo} className="text-xs font-semibold text-muted-foreground hover:text-destructive">Remove</button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={promoInput}
                        onChange={e => setPromoInput(e.target.value.toUpperCase())}
                        onKeyDown={e => { if (e.key === "Enter") applyPromo(); }}
                        placeholder="Promo code"
                        maxLength={20}
                        className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm uppercase outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <button onClick={applyPromo} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90">Apply</button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {promoRules.map(rule => {
                      const eligible = subtotal >= rule.minSubtotal;
                      return (
                        <button
                          key={rule.code}
                          type="button"
                          onClick={() => { void tryPromo(rule.code); }}
                          className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] ${eligible ? "border-primary/40 bg-primary/5" : "border-border opacity-70"}`}
                        >
                          <span className="font-bold text-primary">{rule.code}</span>
                          <span className="ml-1 text-muted-foreground">{rule.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live estimate</span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-leaf" /> updates live
                </span>
              </div>
              <Row label="Subtotal" value={formatINR(subtotal)} />
              <Row label="Delivery" value={baseFee === 0 ? "FREE" : formatINR(baseFee)} />
              {freeDeliveryGap > 0 && (
                <div className="text-xs text-primary">Add {formatINR(freeDeliveryGap)} more for free delivery</div>
              )}
              {surgeAmount > 0 && surge && (
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Flame className="h-3.5 w-3.5 text-primary" />
                    Surge · {SURGE_REASON_LABELS[surge.reason]}
                  </span>
                  <span className="font-semibold text-primary">+{formatINR(surgeAmount)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Discount ({appliedCode})</span><span className="font-semibold text-primary">−{formatINR(discount)}</span></div>
              )}
              {gst > 0 && (
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Incl. GST @ 5%</span><span className="text-muted-foreground">{formatINR(gst)}</span></div>
              )}
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold"><span>Total</span><span>{formatINR(total)}</span></div>


              {/* Payment split */}
              {payment === "wallet" ? (
                <div className="mt-3 space-y-1 rounded-xl bg-primary/5 p-3">
                  <div className="flex justify-between"><span className="text-muted-foreground">Paid via Kartogo Cash</span><span className="font-semibold text-primary">−{formatINR(total)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Wallet balance after</span><span className="font-semibold">{formatINR(walletBalance - total)}</span></div>
                  <div className="mt-1 flex justify-between border-t border-primary/15 pt-1.5 font-bold"><span>Payable now</span><span className="text-leaf">{formatINR(0)}</span></div>
                </div>
              ) : (
                <div className="mt-3 space-y-1 rounded-xl bg-secondary/40 p-3">
                  <div className="flex justify-between"><span className="text-muted-foreground">Pay on delivery ({payment === "upi" ? "UPI" : "Cash"})</span><span className="font-semibold">{formatINR(total)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Wallet used</span><span className="font-semibold">{formatINR(0)}</span></div>
                </div>
              )}
            </div>

            {/* Kartogo Cash orders are blocked outright when the balance can't
                cover the total — the server would reject them anyway. */}
            <button
              disabled={placing || !selectedId || (payment === "wallet" && walletBalance < total)}
              onClick={handlePlace}
              className="mt-5 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {placing
                ? "Placing order..."
                : payment === "wallet" && walletBalance < total
                  ? `Insufficient Kartogo Cash — add ${formatINR(total - walletBalance)}`
                  : "Place order"}
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="mb-1 text-xs font-semibold text-muted-foreground">{label}</div>{children}</label>;
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{value}</span></div>;
}
function PaymentOption({ icon, title, desc, selected, onClick, disabled }: { icon: React.ReactNode; title: string; desc: string; selected: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`flex items-start gap-3 rounded-xl border p-3 text-left transition disabled:opacity-50 ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
      <div className={`grid h-9 w-9 place-items-center rounded-lg ${selected ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{icon}</div>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </button>
  );
}
