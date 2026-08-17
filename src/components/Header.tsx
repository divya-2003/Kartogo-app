import { Link, useRouterState, useRouter } from "@tanstack/react-router";
import { ShoppingBag, Search, User2, LayoutDashboard, ShieldCheck, ChevronLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useCart, useAuth } from "@/lib/store";
import { LocationPicker } from "@/components/LocationPicker";
import { SearchOverlay } from "@/components/SearchOverlay";
import kartogoLogo from "@/assets/kartogo-mark.png";

const SEARCH_TERMS = ["avakaya", "maggi", "agarbatti", "milk", "bread", "paneer"];

function useTypewriterPlaceholder(terms: string[]) {
  const [text, setText] = useState("");

  useEffect(() => {
    let termIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timeout: ReturnType<typeof setTimeout>;

    const tick = () => {
      const current = terms[termIndex];
      if (!deleting) {
        charIndex++;
        setText(current.slice(0, charIndex));
        if (charIndex === current.length) {
          deleting = true;
          timeout = setTimeout(tick, 1400);
          return;
        }
        timeout = setTimeout(tick, 110);
      } else {
        charIndex--;
        setText(current.slice(0, charIndex));
        if (charIndex === 0) {
          deleting = false;
          termIndex = (termIndex + 1) % terms.length;
          timeout = setTimeout(tick, 300);
          return;
        }
        timeout = setTimeout(tick, 50);
      }
    };

    timeout = setTimeout(tick, 400);
    return () => clearTimeout(timeout);
  }, [terms]);

  return text;
}

export function Header() {
  const placeholder = useTypewriterPlaceholder(SEARCH_TERMS);
  const { count } = useCart();
  const { user } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useRouterState({ select: s => s.location.pathname });
  const isAdminArea = location.startsWith("/admin");
  const isSupplierArea = location.startsWith("/supplier");
  const isCheckout = location.startsWith("/checkout") || location.startsWith("/cart");
  const isOrders = location.startsWith("/orders");
  const hideUserActions = isCheckout || isOrders || isSupplierArea;
  const hideBrowse = isAdminArea || isSupplierArea || isCheckout || isOrders;
  const isAdmin = user?.role === "admin";
  const router = useRouter();
  const isHome = location === "/";
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
    else void router.navigate({ to: isAdmin ? "/admin" : "/" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 md:px-6">
        {/* Inside the app the logo tile becomes a back button; only the landing
            screen keeps the brand mark. */}
        {isHome ? (
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-[#0d1b4a]">
              <img
                src={kartogoLogo}
                alt="Kartogo - Neighborhood Store"
                className="h-full w-full scale-110 object-cover object-center"
              />
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg font-bold tracking-tight">Kartogo</div>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goBack}
              aria-label="Go back"
              className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card hover:bg-secondary"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="font-display text-lg font-bold tracking-tight">
              Kartogo{isAdminArea && <span className="ml-1 text-xs font-semibold text-primary">· Admin</span>}
            </div>
          </div>
        )}

        {!hideBrowse && !isAdmin && (
          <div className="hidden md:block">
            <LocationPicker />
          </div>
        )}

        {!hideBrowse && (
          <Link
            to="/search"
            search={{ q: "" }}
            className="ml-2 hidden flex-1 md:block"
          >
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left shadow-pop">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="w-full truncate text-sm text-muted-foreground">
                {placeholder ? `Search "${placeholder}"` : "Search"}
              </span>
            </div>
          </Link>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Admin shortcut visible only to admins */}
          {isAdmin && !isAdminArea && (
            <Link to="/admin" className="hidden items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary md:inline-flex">
              <LayoutDashboard className="h-4 w-4" /> Admin
            </Link>
          )}

          {/* Customer-only links */}
          {!isAdminArea && !isAdmin && !user && !hideUserActions && (
            <Link to="/login" className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-secondary">
              <User2 className="h-4 w-4" />
              <span className="hidden sm:inline">Login</span>
            </Link>
          )}

          {!isAdminArea && !isAdmin && user && !hideUserActions && (
            <Link
              to="/menu"
              aria-label="Account menu"
              className="inline-flex items-center justify-center rounded-full border border-border bg-card p-2 hover:bg-secondary"
            >
              <User2 className="h-4 w-4" />
            </Link>
          )}



          {/* Admin badge when in admin area */}
          {isAdminArea && isAdmin && (
            <span className="hidden items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary sm:inline-flex">
              <ShieldCheck className="h-4 w-4" /> {user?.phone}
            </span>
          )}

          {/* Cart — customers only */}
          {!isAdminArea && !isAdmin && !hideUserActions && (
            <Link to="/cart" className="relative inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Cart</span>
              {count > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-saffron px-1 text-[11px] font-bold text-saffron-foreground">
                  {count}
                </span>
              )}
            </Link>
          )}

          {/* Admin account */}
          {user && isAdmin && (
            <Link to="/admin/account" aria-label="Admin account" title="Account" className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-2 hover:bg-secondary">
              <User2 className="h-4 w-4" />
            </Link>
          )}

        </div>
      </div>

      {!hideBrowse && (
        <div className="px-4 pb-3 md:hidden">
          {!isAdmin && (
            <div className="mb-2">
              <LocationPicker />
            </div>
          )}
          <Link to="/search" search={{ q: "" }} className="block w-full">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="w-full truncate text-sm text-muted-foreground">{placeholder ? `Search "${placeholder}"` : "Search"}</span>
            </div>
          </Link>
        </div>
      )}

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}


