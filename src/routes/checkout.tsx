import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { useAuth, useCart, useCatalog, useOrders } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { toast } from "sonner";
import { Banknote, Smartphone } from "lucide-react";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({ meta: [{ title: "Checkout — QuickKart" }] }),
});

function CheckoutPage() {
  const { user } = useAuth();
  const { items, subtotal, clear } = useCart();
  const { products } = useCatalog();
  const { place } = useOrders();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState<"cash" | "upi">("cash");

  useEffect(() => { if (user?.name) setName(user.name); }, [user]);

  const fee = subtotal === 0 ? 0 : subtotal >= 199 ? 0 : 25;
  const total = subtotal + fee;

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

  const handlePlace = () => {
    if (!name.trim() || !address.trim()) { toast.error("Please fill name & address"); return; }
    const order = place({
      customerPhone: user.phone,
      customerName: name,
      address,
      items: items.map(i => {
        const p = products.find(p => p.id === i.productId)!;
        return { productId: p.id, name: p.name, qty: i.qty, price: p.price };
      }),
      subtotal, deliveryFee: fee, total, paymentMethod: payment,
    });
    clear();
    toast.success(`Order ${order.id} placed!`);
    nav({ to: "/orders" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <h1 className="mb-6 font-display text-3xl font-bold">Checkout</h1>
        <div className="grid gap-6 md:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 font-display text-lg font-bold">Delivery details</h2>
              <div className="grid gap-3">
                <Field label="Full name"><input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></Field>
                <Field label="Mobile"><input value={user.phone} disabled className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-muted-foreground" /></Field>
                <Field label="Delivery address"><textarea value={address} onChange={e => setAddress(e.target.value)} rows={3} placeholder="House no., street, landmark, Ongole" className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></Field>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 font-display text-lg font-bold">Payment</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <PaymentOption icon={<Banknote className="h-5 w-5" />} title="Cash on delivery" desc="Pay rider in cash" selected={payment === "cash"} onClick={() => setPayment("cash")} />
                <PaymentOption icon={<Smartphone className="h-5 w-5" />} title="UPI on delivery" desc="GPay / PhonePe / Paytm" selected={payment === "upi"} onClick={() => setPayment("upi")} />
              </div>
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
            <div className="space-y-1 border-t border-border pt-3 text-sm">
              <Row label="Subtotal" value={formatINR(subtotal)} />
              <Row label="Delivery" value={fee === 0 ? "FREE" : formatINR(fee)} />
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold"><span>Total</span><span>{formatINR(total)}</span></div>
            </div>
            <button onClick={handlePlace} className="mt-5 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90">Place order</button>
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
function PaymentOption({ icon, title, desc, selected, onClick }: { icon: React.ReactNode; title: string; desc: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
      <div className={`grid h-9 w-9 place-items-center rounded-lg ${selected ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{icon}</div>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </button>
  );
}
