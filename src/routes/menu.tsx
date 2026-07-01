import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth, useLocation, useWallet } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Headphones,
  Heart,
  Wallet,
  IndianRupee,
  CreditCard,
  MapPin,
  UserCircle2,
  Gift,
  LogOut,
  Check,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/menu")({
  component: MenuPage,
  head: () => ({ meta: [{ title: "Profile — Kartogo" }] }),
});

function MenuPage() {
  const { user, logout } = useAuth();
  const { location, savedAddresses, setLocation, removeSavedAddress } = useLocation();
  const { balance } = useWallet();
  const nav = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [amount, setAmount] = useState("");


  if (!user) {
    return (
      <div className="min-h-screen bg-secondary/40">
        <TopBar />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold">Please login</h1>
          <Link to="/login" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">Login with OTP</Link>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    toast.success("Signed out");
    nav({ to: "/login" });
  };

  const soon = (label: string) => toast.info(`${label} coming soon`);

  return (
    <div className="min-h-screen bg-secondary/40 pb-12">
      <TopBar />

      <div className="mx-auto max-w-2xl px-4 md:px-6">
        {/* Profile header */}
        <div className="flex items-center gap-4 py-6">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-primary text-primary-foreground">
            <UserCircle2 className="h-12 w-12" />
          </div>
          <div>
            <div className="font-display text-2xl font-bold">{user.name || "Kartogo User"}</div>
            <div className="text-sm text-muted-foreground">+91 {user.phone}</div>
          </div>
        </div>

        {/* Quick action cards */}
        <div className="grid grid-cols-3 gap-3">
          <QuickCard to="/orders" icon={<ShoppingBag className="h-6 w-6" />} label="Your Orders" />
          <QuickCard to="/support" icon={<Headphones className="h-6 w-6" />} label="Help & Support" />
          <QuickCard to="/wishlist" icon={<Heart className="h-6 w-6" />} label="Your Wishlist" />
        </div>

        {/* Cash & Gift card banner */}
        <div className="mt-4 w-full rounded-2xl bg-primary/10 p-4 text-left">
          <div className="flex items-center gap-3">
            <Wallet className="h-6 w-6 text-primary" />
            <span className="font-display text-lg font-bold">Kartogo Cash &amp; Gift Card</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-primary/15 pt-3">
            <span className="text-sm text-muted-foreground">Available Balance <span className="font-bold text-foreground">{formatINR(balance)}</span></span>
            <button onClick={() => { setAmount(""); setShowAdd(true); }} className="rounded-lg bg-card px-4 py-2 text-sm font-bold shadow-pop">Add Balance</button>
          </div>
          <Link to="/wallet" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            View transaction history <ChevronRight className="h-4 w-4" />
          </Link>
        </div>


        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setShowAdd(false)}>
            <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-pop" onClick={e => e.stopPropagation()}>
              <h3 className="font-display text-lg font-bold">Add money to wallet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Current balance: {formatINR(balance)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[100, 200, 500, 1000].map(v => (
                  <button key={v} onClick={() => setAmount(String(v))} className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${amount === String(v) ? "border-primary bg-primary/10 text-primary" : "border-input"}`}>+{formatINR(v)}</button>
                ))}
              </div>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="mt-4 flex gap-2">
                <button onClick={() => setShowAdd(false)} className="flex-1 rounded-xl border border-border py-2.5 font-bold hover:bg-secondary">Cancel</button>
                <button
                  onClick={() => {
                    const amt = Math.round(Number(amount));
                    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
                    setShowAdd(false);
                    nav({ to: "/topup", search: { amount: amt } });
                  }}
                  className="flex-1 rounded-xl bg-primary py-2.5 font-bold text-primary-foreground hover:bg-primary/90"
                >
                  Proceed to pay
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Your Information */}
        <h2 className="mb-3 mt-8 font-display text-xl font-bold">Your Information</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-pop">
          <Row to="/wallet" icon={<Wallet className="h-5 w-5" />} label="Kartogo Cash" sub={formatINR(balance)} />
          <Row to="/refunds" icon={<IndianRupee className="h-5 w-5" />} label="Your Refunds" />
          <Row to="/wishlist" icon={<Heart className="h-5 w-5" />} label="Your Wishlist" />
          <Row onClick={() => soon("E-Gift Cards")} icon={<CreditCard className="h-5 w-5" />} label="E-Gift Cards" />
          <Row to="/support" icon={<Headphones className="h-5 w-5" />} label="Help & Support" />
          <Row to="/account" icon={<UserCircle2 className="h-5 w-5" />} label="Profile" />
          <Row onClick={() => soon("Rewards")} icon={<Gift className="h-5 w-5" />} label="Rewards" last />
        </div>

        {/* Saved Addresses */}
        <h2 className="mb-3 mt-8 font-display text-xl font-bold">Saved Addresses</h2>
        {savedAddresses.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground shadow-pop">
            No saved addresses yet. Locations you confirm while setting your delivery area will appear here.
          </p>
        ) : (
          <div className="space-y-2">
            {savedAddresses.map((addr) => {
              const active = location?.query.toLowerCase() === addr.query.toLowerCase();
              return (
                <div
                  key={addr.query}
                  className={`flex items-center gap-3 rounded-2xl border p-4 shadow-pop ${active ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                >
                  <button
                    onClick={() => {
                      setLocation(addr);
                      toast.success(`Delivering to ${addr.area}`);
                    }}
                    className="flex flex-1 items-start gap-3 text-left"
                  >
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{addr.area}</span>
                      <span className="block truncate text-xs text-muted-foreground">{addr.query}</span>
                    </span>
                  </button>
                  {active ? (
                    <Check className="h-5 w-5 shrink-0 text-primary" />
                  ) : (
                    <button
                      onClick={() => removeSavedAddress(addr.query)}
                      aria-label="Remove address"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-destructive"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-4 text-base font-bold text-destructive shadow-pop hover:bg-secondary"
        >
          <LogOut className="h-5 w-5" /> Logout
        </button>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 md:px-6">
        <Link to="/" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-secondary">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-xl font-bold">Profile</h1>
      </div>
    </div>
  );
}

function QuickCard({ to, onClick, icon, label }: { to?: string; onClick?: () => void; icon: React.ReactNode; label: string }) {
  const inner = (
    <>
      <div className="text-foreground">{icon}</div>
      <span className="text-center text-sm font-semibold leading-tight">{label}</span>
    </>
  );
  const cls = "flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-pop hover:bg-secondary";
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  return <button onClick={onClick} className={cls}>{inner}</button>;
}

function Row({ to, onClick, icon, label, sub, last }: { to?: string; onClick?: () => void; icon: React.ReactNode; label: string; sub?: string; last?: boolean }) {
  const inner = (
    <>
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1">
        <div className="font-semibold">{label}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </>
  );
  const cls = `flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-secondary ${last ? "" : "border-b border-border"}`;
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  return <button onClick={onClick} className={cls}>{inner}</button>;
}
