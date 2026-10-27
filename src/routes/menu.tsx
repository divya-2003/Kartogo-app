import { ClipboardList as MClipboard, CreditCard as MCard, Tag as MTag, Store as MStore, Printer as MPrinter, Settings as MSettings, Shield as MShield, FileText as MFile, Pencil as MPencil } from "lucide-react";
import { BottomNav } from "@/components/marketplace/BottomNav";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getReferralFn, applyReferralFn } from "@/lib/promo.functions";

import { useAuth, useLocation, useWallet } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
  Bell,
  BellRing,
  Languages,
  HelpCircle,
  X,
} from "lucide-react";

const LANGS = [
  { code: "en", label: "English", native: "English", ready: true },
  { code: "te", label: "Telugu", native: "తెలుగు", ready: false },
  { code: "hi", label: "Hindi", native: "हिन्दी", ready: false },
  { code: "ta", label: "Tamil", native: "தமிழ்", ready: false },
];

function GuestGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card md:rounded-2xl md:shadow-pop">
      <h2 className="px-4 pb-1 pt-4 font-display text-lg font-extrabold">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function LanguageSheet({ value, onPick, onClose }: { value: string; onPick: (code: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 md:items-center" onClick={onClose}>
      <div role="dialog" aria-label="Select language" className="w-full max-w-md rounded-t-3xl bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:rounded-3xl" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold">Select Language</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-2">
          {LANGS.map(l => (
            <button key={l.code} onClick={() => onPick(l.code)} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${value === l.code ? "border-primary bg-primary/5" : "border-border"}`}>
              <span><span className="font-semibold">{l.label}</span> <span className="text-sm text-muted-foreground">{l.native}</span></span>
              {value === l.code ? <Check className="h-5 w-5 text-primary" /> : !l.ready ? <span className="text-xs font-bold text-muted-foreground">Coming soon</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/menu")({
  component: MenuPage,
  head: () => ({ meta: [
    { title: "Your account — Kartogo" },
    { name: "description", content: "Manage your Kartogo account, addresses, orders, favourites and notifications." },
    { property: "og:title", content: "Your account — Kartogo" },
    { property: "og:description", content: "Manage your Kartogo shopping account and preferences." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function MenuPage() {
  const { user, logout } = useAuth();
  const { location, savedAddresses, setLocation, removeSavedAddress } = useLocation();
  const { balance } = useWallet();
  const nav = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [amount, setAmount] = useState("");
  const [showAddr, setShowAddr] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [lang, setLang] = useState("en");
  useEffect(() => { try { setLang(localStorage.getItem("qk_language") || "en"); } catch { /* noop */ } }, []);
  const pickLang = (code: string) => {
    const l = LANGS.find(x => x.code === code);
    if (!l?.ready) { toast.info(`${l?.label ?? "This language"} is coming soon`); return; }
    setLang(code);
    try { localStorage.setItem("qk_language", code); } catch { /* noop */ }
    setShowLang(false);
  };

  // Refer & earn — both friends get Kartogo Cash after a first order of ₹200+.
  const [showRefer, setShowRefer] = useState(false);
  const [referral, setReferral] = useState<{ code: string | null; invited: number; reward: number } | null>(null);
  const [friendCode, setFriendCode] = useState("");
  useEffect(() => {
    let alive = true;
    const token = (() => { try { return JSON.parse(localStorage.getItem("qk_customer_token") || "null") ?? ""; } catch { return ""; } })();
    if (!token) return;
    getReferralFn({ data: { token } })
      .then(r => { if (alive) setReferral(r); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const claimReferral = async () => {
    const token = (() => { try { return JSON.parse(localStorage.getItem("qk_customer_token") || "null") ?? ""; } catch { return ""; } })();
    try {
      const res = await applyReferralFn({ data: { token, code: friendCode } });
      if (!res.ok) { toast.error(res.reason); return; }
      toast.success(`Referral applied — you and your friend get ₹${res.reward} after your first order of ₹200+`);
      setFriendCode("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not apply that code");
    }
  };




  if (!user) {
    return (
      <div className="min-h-screen bg-secondary/40 pb-24">
        <TopBar />
        <div className="mx-auto max-w-2xl space-y-3 md:px-6 md:py-4">
          <section className="flex items-center justify-between gap-4 bg-card px-5 py-5 md:rounded-2xl md:shadow-pop">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-extrabold">Account</h2>
              <p className="mt-1 text-sm text-muted-foreground">Log in to get exclusive offers</p>
            </div>
            <Link to="/login" search={{ redirect: "/menu" }} className="inline-flex h-11 shrink-0 items-center justify-center rounded-md bg-primary px-6 font-bold text-primary-foreground shadow-pop">
              Log In
            </Link>
          </section>

          <GuestGroup title="Account Settings">
            <Row onClick={() => setShowLang(true)} icon={<Languages className="h-5 w-5" />} label="Select Language" sub={LANGS.find(l => l.code === lang)?.label} />
            <Row to="/notifications" icon={<BellRing className="h-5 w-5" />} label="Notification Settings" />
            <Row to="/help" icon={<Headphones className="h-5 w-5" />} label="Help Center" last />
          </GuestGroup>

          <GuestGroup title="Earn with Kartogo">
            <Row to="/become-partner" icon={<MStore className="h-5 w-5" />} label="Sell on Kartogo" last />
          </GuestGroup>

          <GuestGroup title="Feedback & Information">
            <Row to="/terms" icon={<MFile className="h-5 w-5" />} label="Terms, Policies and Licenses" />
            <Row to="/support" icon={<HelpCircle className="h-5 w-5" />} label="Browse FAQs" last />
          </GuestGroup>
        </div>
        {showLang && <LanguageSheet value={lang} onPick={pickLang} onClose={() => setShowLang(false)} />}
        <BottomNav />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    toast.success("Signed out");
    // Back to the same first page a new visitor sees: Home, Shop tab.
    try { sessionStorage.setItem("qk_home_section", "shop"); sessionStorage.setItem("qk_customer_home", "1"); } catch { /* noop */ }
    nav({ to: "/", replace: true });
  };

  const soon = (label: string) => toast.info(`${label} coming soon`);

  return (
    <div className="min-h-screen bg-secondary/40 pb-24">
      <TopBar />

      <div className="mx-auto max-w-2xl px-4 md:px-6">
        {/* Profile header */}
        <div className="flex items-center gap-4 py-6">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-primary text-primary-foreground">
            <UserCircle2 className="h-12 w-12" />
          </div>
          <div className="min-w-0 flex-1">
            {user.name?.trim() && <div className="truncate font-display text-2xl font-bold">{user.name}</div>}
            <div className="text-sm text-muted-foreground">+91 {user.phone}</div>
          </div>
          <Link to="/account" aria-label="Edit profile" className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-bold shadow-pop"><MPencil className="h-4 w-4" />Edit</Link>
        </div>

        {/* Partners shopping as a customer get a one-tap way back to their portal */}
        <PortalReturnLink />

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

          {/* Saved Addresses (expandable) */}
          <div className="border-b border-border">
            <button
              onClick={() => setShowAddr(v => !v)}
              aria-expanded={showAddr}
              className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-secondary"
            >
              <div className="text-muted-foreground"><MapPin className="h-5 w-5" /></div>
              <div className="flex-1">
                <div className="font-semibold">Saved Addresses</div>
                <div className="text-xs text-muted-foreground">{savedAddresses.length} saved</div>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${showAddr ? "rotate-180" : ""}`} />
            </button>
            {showAddr && (
              <div className="space-y-2 px-4 pb-4">
                {savedAddresses.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
                    No saved addresses yet. Locations you confirm while setting your delivery area will appear here.
                  </p>
                ) : (
                  savedAddresses.map((addr) => {
                    const active = location?.query.toLowerCase() === addr.query.toLowerCase();
                    return (
                      <div
                        key={addr.query}
                        className={`flex items-center gap-3 rounded-xl border p-3 ${active ? "border-primary bg-primary/5" : "border-border bg-background"}`}
                      >
                        <button
                          onClick={() => {
                            setLocation(addr);
                            toast.success(`Delivering to ${addr.area}`);
                          }}
                          className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        >
                          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                          <span className="min-w-0 flex-1">
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
                  })
                )}
              </div>
            )}
          </div>

          <Row to="/orders" icon={<MClipboard className="h-5 w-5" />} label="Orders & Bookings" />
          <Row to="/wallet" icon={<MCard className="h-5 w-5" />} label="Payments" sub="Kartogo Cash & transactions" />
          <Row to="/" icon={<MTag className="h-5 w-5" />} label="Offers" sub="Coupons on the home page" />
          <Row to="/notifications" icon={<Bell className="h-5 w-5" />} label="Notifications" sub="Order, delivery & offer alerts" />
          <Row to="/become-partner" icon={<MStore className="h-5 w-5" />} label="Become a Partner" sub="Sell products or offer services" />
          <Row to="/print" icon={<MPrinter className="h-5 w-5" />} label="Print Store" />
          <Row to="/refunds" icon={<IndianRupee className="h-5 w-5" />} label="Your Refunds" />
          <Row to="/wishlist" icon={<Heart className="h-5 w-5" />} label="Saved Items" sub="Your grocery wishlist" />
          <Row onClick={() => soon("E-Gift Cards")} icon={<CreditCard className="h-5 w-5" />} label="E-Gift Cards" />
          <Row to="/help" icon={<Headphones className="h-5 w-5" />} label="Help & Support" />
          <Row to="/notifications" icon={<MSettings className="h-5 w-5" />} label="Settings" sub="Notification preferences" />
          <Row to="/account" icon={<UserCircle2 className="h-5 w-5" />} label="Profile" />
          {/* Refer & earn (expandable) */}
          <div>
            <button
              onClick={() => setShowRefer(v => !v)}
              aria-expanded={showRefer}
              className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-secondary"
            >
              <div className="text-muted-foreground"><Gift className="h-5 w-5" /></div>
              <div className="flex-1">
                <div className="font-semibold">Refer &amp; earn</div>
                <div className="text-xs text-muted-foreground">
                  {referral ? `${referral.invited} friend${referral.invited === 1 ? "" : "s"} joined · ₹${referral.reward} each` : "Both get Kartogo Cash when your friend’s first order is ₹200+"}
                </div>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${showRefer ? "rotate-180" : ""}`} />
            </button>
            {showRefer && (
              <div className="space-y-3 px-4 pb-4">
                <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted-foreground">Your code</span>
                    <span className="block truncate font-display text-lg font-extrabold tracking-wide text-primary">{referral?.code ?? "—"}</span>
                  </span>
                  <button
                    onClick={() => {
                      if (!referral?.code) return;
                      void navigator.clipboard?.writeText(referral.code);
                      toast.success("Referral code copied");
                    }}
                    className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                  >
                    Copy
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={friendCode}
                    onChange={e => setFriendCode(e.target.value.toUpperCase())}
                    placeholder="Have a friend's code?"
                    maxLength={24}
                    className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm uppercase outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button onClick={() => void claimReferral()} className="rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-secondary">Apply</button>
                </div>
              </div>
            )}
          </div>

        </div>


        <div className="mt-4 flex gap-2">
          <Link to="/privacy" className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-bold"><MShield className="h-4 w-4" />Privacy</Link>
          <Link to="/terms" className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-bold"><MFile className="h-4 w-4" />Terms</Link>
        </div>
        {/* Logout */}
        <button
          onClick={handleLogout}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-4 text-base font-bold text-destructive shadow-pop hover:bg-secondary"
        >
          <LogOut className="h-5 w-5" /> Logout
        </button>
      </div>
      <BottomNav />
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

function PortalReturnLink() {
  const [target, setTarget] = useState<{ to: "/supplier/sales" | "/delivery"; label: string } | null>(null);
  useEffect(() => {
    const has = (k: string) => {
      try { const v = localStorage.getItem(k); return !!v && v !== "null" && v !== '""'; } catch { return false; }
    };
    if (has("qk_supplier_token")) setTarget({ to: "/supplier/sales", label: "Back to seller portal" });
    else if (has("qk_delivery_token")) setTarget({ to: "/delivery", label: "Back to delivery portal" });
  }, []);
  if (!target) return null;
  return (
    <Link
      to={target.to}
      onClick={() => { try { sessionStorage.removeItem("qk_customer_home"); } catch { /* noop */ } }}
      className="mb-3 flex w-full items-center justify-between rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 font-bold text-primary"
    >
      <span className="flex items-center gap-2"><MStore className="h-5 w-5" /> {target.label}</span>
      <span aria-hidden>›</span>
    </Link>
  );
}
