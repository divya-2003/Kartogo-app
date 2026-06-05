import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth, useLocation } from "@/lib/store";
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
  head: () => ({ meta: [{ title: "Profile — Kartigo" }] }),
});

function MenuPage() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

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
            <div className="font-display text-2xl font-bold">{user.name || "Kartigo User"}</div>
            <div className="text-sm text-muted-foreground">+91 {user.phone}</div>
          </div>
        </div>

        {/* Quick action cards */}
        <div className="grid grid-cols-3 gap-3">
          <QuickCard to="/orders" icon={<ShoppingBag className="h-6 w-6" />} label="Your Orders" />
          <QuickCard onClick={() => soon("Help & Support")} icon={<Headphones className="h-6 w-6" />} label="Help & Support" />
          <QuickCard onClick={() => soon("Your Wishlist")} icon={<Heart className="h-6 w-6" />} label="Your Wishlist" />
        </div>

        {/* Cash & Gift card banner */}
        <button
          onClick={() => soon("Cash & Gift Card")}
          className="mt-4 w-full rounded-2xl bg-primary/10 p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <Wallet className="h-6 w-6 text-primary" />
            <span className="font-display text-lg font-bold">Kartigo Cash &amp; Gift Card</span>
            <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-primary/15 pt-3">
            <span className="text-sm text-muted-foreground">Available Balance <span className="font-bold text-foreground">₹0</span></span>
            <span className="rounded-lg bg-card px-4 py-2 text-sm font-bold shadow-pop">Add Balance</span>
          </div>
        </button>

        {/* Your Information */}
        <h2 className="mb-3 mt-8 font-display text-xl font-bold">Your Information</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-pop">
          <Row onClick={() => soon("Your Refunds")} icon={<IndianRupee className="h-5 w-5" />} label="Your Refunds" />
          <Row onClick={() => soon("Your Wishlist")} icon={<Heart className="h-5 w-5" />} label="Your Wishlist" />
          <Row onClick={() => soon("E-Gift Cards")} icon={<CreditCard className="h-5 w-5" />} label="E-Gift Cards" />
          <Row onClick={() => soon("Help & Support")} icon={<Headphones className="h-5 w-5" />} label="Help & Support" />
          <Row onClick={() => soon("Saved Addresses")} icon={<MapPin className="h-5 w-5" />} label="Saved Addresses" sub={user.address ? user.address : "Add an address"} />
          <Row to="/account" icon={<UserCircle2 className="h-5 w-5" />} label="Profile" />
          <Row onClick={() => soon("Rewards")} icon={<Gift className="h-5 w-5" />} label="Rewards" last />
        </div>

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
