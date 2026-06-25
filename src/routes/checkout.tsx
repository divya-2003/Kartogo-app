import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
import { useAuth, useCart, useCatalog, useOrders, useLocation, useWallet } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { toast } from "sonner";
import { Banknote, Smartphone, Wallet, MapPin, Plus, Check, Trash2, X, Tag } from "lucide-react";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({ meta: [{ title: "Checkout — Kartigo" }] }),
});

// Available promo codes. `type` "flat" = rupees off, "pct" = percentage off (capped).
type Coupon = { type: "flat" | "pct"; value: number; minSubtotal: number; maxOff?: number; desc: string };
const COUPONS: Record<string, Coupon> = {
  SAVE50: { type: "flat", value: 50, minSubtotal: 299, desc: "₹50 off on orders above ₹299" },
  KART10: { type: "pct", value: 10, minSubtotal: 199, maxOff: 100, desc: "10% off (up to ₹100) above ₹199" },
  BIG100: { type: "flat", value: 100, minSubtotal: 599, desc: "₹100 off on orders above ₹599" },
};

function computeDiscount(code: string | null, subtotal: number): number {
  if (!code) return 0;
  const c = COUPONS[code];
  if (!c || subtotal < c.minSubtotal) return 0;
  const raw = c.type === "flat" ? c.value : Math.floor((subtotal * c.value) / 100);
  const capped = c.maxOff ? Math.min(raw, c.maxOff) : raw;
  return Math.min(capped, subtotal);
}

function CheckoutPage() {
  const { user } = useAuth();
  const { items, subtotal, clear } = useCart();
  const { products } = useCatalog();
  const { place } = useOrders();
  const { savedAddresses, deliveryAddresses, addDeliveryAddress, removeDeliveryAddress, removeSavedAddress } = useLocation();
  const { balance: walletBalance, refresh: refreshWallet } = useWallet();
  const nav = useNavigate();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [payment, setPayment] = useState<"cash" | "upi" | "wallet">("cash");
  const [placing, setPlacing] = useState(false);

  // Promo code state.
  const [promoInput, setPromoInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);

  // New-address form state.
  const [label, setLabel] = useState("Home");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const userName = user?.name?.trim() || "Kartigo User";
  const addressOptions = useMemo(() => {
    const normalizedDelivery = deliveryAddresses.map(addr => ({
      id: `delivery:${addr.id}`,
      kind: "delivery" as const,
      label: addr.label,
      name: addr.name,
      address: addr.address,
      removableId: addr.id,
    }));

    const seen = new Set(normalizedDelivery.map(addr => addr.address.trim().toLowerCase()));
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

    return [...normalizedDelivery, ...savedLocationOptions];
  }, [deliveryAddresses, savedAddresses, userName]);

  useEffect(() => { if (user?.name && !name) setName(user.name); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const fee = subtotal === 0 ? 0 : subtotal >= 199 ? 0 : 25;
  const discount = useMemo(() => computeDiscount(appliedCode, subtotal), [appliedCode, subtotal]);
  const total = Math.max(0, subtotal + fee - discount);

  // If wallet was chosen but no longer covers the total, fall back to cash.
  useEffect(() => {
    if (payment === "wallet" && walletBalance < total) setPayment("cash");
  }, [payment, walletBalance, total]);


  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) { toast.error("Enter a promo code"); return; }
    const coupon = COUPONS[code];
    if (!coupon) { toast.error("Invalid promo code"); return; }
    if (subtotal < coupon.minSubtotal) {
      toast.error(`Add ${formatINR(coupon.minSubtotal - subtotal)} more to use ${code}`);
      return;
    }
    setAppliedCode(code);
    setPromoInput("");
    toast.success(`${code} applied — you saved ${formatINR(computeDiscount(code, subtotal))}!`);
  };

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
    if (!name.trim() || !address.trim()) { toast.error("Please fill name & address"); return; }
    const created = addDeliveryAddress({ label: label.trim() || "Home", name: name.trim(), address: address.trim() });
    setSelectedId(`delivery:${created.id}`);
    setShowForm(false);
    setShowPicker(false);
    setLabel("Home");
    setAddress("");
    toast.success("Address saved");
  };

  const handlePlace = async () => {
    const selected = addressOptions.find(a => a.id === selectedId);
    if (!selected) { toast.error("Please select a delivery address"); return; }
    if (payment === "wallet" && walletBalance < total) {
      toast.error(`Not enough wallet balance. Add ${formatINR(total - walletBalance)} more.`);
      return;
    }
    setPlacing(true);
    try {
      // Only raw items + address are sent. The server recomputes subtotal,
      // delivery fee, promo discount and total from its own catalog so prices
      // can never be tampered with from the browser. When paying with Kartigo
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

            {/* Address picker modal */}
            {showPicker && (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={() => setShowPicker(false)}>
                <div
                  className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold">{showForm ? "Add a new address" : "Select delivery address"}</h3>
                    <button onClick={() => setShowPicker(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {!showForm && (
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
                            {["Home", "Work", "Other"].map(l => (
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
                        <Field label="Delivery address"><textarea value={address} onChange={e => setAddress(e.target.value)} rows={3} placeholder="House no., street, landmark, Ongole" className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></Field>
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
                <PaymentOption icon={<Banknote className="h-5 w-5" />} title="Cash on delivery" desc="Pay rider in cash" selected={payment === "cash"} onClick={() => setPayment("cash")} />
                <PaymentOption icon={<Smartphone className="h-5 w-5" />} title="UPI on delivery" desc="GPay / PhonePe / Paytm" selected={payment === "upi"} onClick={() => setPayment("upi")} />
                <PaymentOption
                  icon={<Wallet className="h-5 w-5" />}
                  title="Kartigo Cash"
                  desc={walletBalance >= total ? `Balance ${formatINR(walletBalance)}` : `Low balance ${formatINR(walletBalance)}`}
                  selected={payment === "wallet"}
                  disabled={walletBalance < total}
                  onClick={() => { if (walletBalance >= total) setPayment("wallet"); }}
                />
              </div>
              {walletBalance < total && (
                <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
                  <X className="h-3.5 w-3.5" /> Insufficient Kartigo Cash — you need {formatINR(total - walletBalance)} more. Add money from your profile to pay with the wallet.
                </p>
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
                  <p className="mt-2 text-xs text-muted-foreground">Try <span className="font-semibold text-primary">SAVE50</span>, <span className="font-semibold text-primary">KART10</span> or <span className="font-semibold text-primary">BIG100</span></p>
                </>
              )}
            </div>

            <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
              <Row label="Subtotal" value={formatINR(subtotal)} />
              <Row label="Delivery" value={fee === 0 ? "FREE" : formatINR(fee)} />
              {discount > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Discount ({appliedCode})</span><span className="font-semibold text-primary">−{formatINR(discount)}</span></div>
              )}
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold"><span>Total</span><span>{formatINR(total)}</span></div>

              {/* Payment split */}
              {payment === "wallet" ? (
                <div className="mt-3 space-y-1 rounded-xl bg-primary/5 p-3">
                  <div className="flex justify-between"><span className="text-muted-foreground">Paid via Kartigo Cash</span><span className="font-semibold text-primary">−{formatINR(total)}</span></div>
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

            <button disabled={placing || !selectedId} onClick={handlePlace} className="mt-5 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {placing ? "Placing order..." : "Place order"}
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
