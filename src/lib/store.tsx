import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PRODUCTS, DELIVERY_BOYS, type Product } from "./data";
import { requestOtpFn, verifyOtpFn, adminLoginFn } from "./auth.functions";
import { getWalletFn, addMoneyFn, getTopupsFn, recordFailedTopupFn, type WalletTxnRow, type TopupRow } from "./wallet.functions";
import {
  listOrdersFn,
  placeOrderFn,
  setOrderStatusFn,
  assignOrderFn,
  markRefundedFn,
  cancelOrderFn,
  requestRefundFn,
  resolveRefundRequestFn,
} from "./orders.functions";
import { addWishlistFn, removeWishlistFn, mergeWishlistFn } from "./wishlist.functions";
import { getCustomerProfileFn, saveCustomerProfileFn, saveCustomerAddressesFn } from "./customer.functions";
import {
  listCatalogItemsFn,
  upsertCatalogItemFn,
  deleteCatalogItemFn,
  setCatalogPriceFn,
  setCatalogStockFn,
  type CatalogItemRow,
} from "./catalog.functions";



// ---------------- Cart ----------------
export type CartItem = { productId: string; qty: number };

type CartCtx = {
  items: CartItem[];
  add: (id: string, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const CartContext = createContext<CartCtx | null>(null);

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
}
function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => { setItems(read<CartItem[]>("qk_cart", [])); }, []);
  useEffect(() => { write("qk_cart", items); }, [items]);

  const products = useProductsValue();

  const value = useMemo<CartCtx>(() => {
    const add: CartCtx["add"] = (id, qty = 1) =>
      setItems(prev => {
        const ex = prev.find(i => i.productId === id);
        return ex ? prev.map(i => i.productId === id ? { ...i, qty: i.qty + qty } : i) : [...prev, { productId: id, qty }];
      });
    const remove: CartCtx["remove"] = (id) => setItems(prev => prev.filter(i => i.productId !== id));
    const setQty: CartCtx["setQty"] = (id, qty) =>
      setItems(prev => qty <= 0 ? prev.filter(i => i.productId !== id) : prev.map(i => i.productId === id ? { ...i, qty } : i));
    const clear = () => setItems([]);
    const count = items.reduce((s, i) => s + i.qty, 0);
    const subtotal = items.reduce((s, i) => {
      const p = products.find(p => p.id === i.productId);
      return s + (p ? p.price * i.qty : 0);
    }, 0);
    return { items, add, remove, setQty, clear, count, subtotal };
  }, [items, products]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export const useCart = () => {
  const c = useContext(CartContext);
  if (!c) throw new Error("CartProvider missing");
  return c;
};

// ---------------- Wishlist (server-synced across devices) ----------------
// Saved products persist in the database keyed by the customer's phone, so the
// wishlist follows them across logins/devices. localStorage is only an offline
// cache and a holding area for items saved while browsing as a guest — those
// are merged into the account on the next login.
type WishlistCtx = {
  ids: string[];
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  count: number;
};
const WishlistContext = createContext<WishlistCtx | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { customerToken } = useAuth();
  const [ids, setIds] = useState<string[]>([]);

  const tokenRef = useRef(customerToken);
  useEffect(() => { tokenRef.current = customerToken; }, [customerToken]);

  // Load the offline cache once on mount.
  useEffect(() => { setIds(read<string[]>("qk_wishlist", [])); }, []);
  // Keep the cache in sync so guest picks survive a reload and offline reads work.
  useEffect(() => { write("qk_wishlist", ids); }, [ids]);

  // React to identity changes:
  //  - login  → fold any guest items into the account, then adopt the server list.
  //  - logout → clear the wishlist so the next person on this device starts fresh.
  const prevTokenRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const prev = prevTokenRef.current;
    prevTokenRef.current = customerToken;
    let active = true;
    if (customerToken) {
      (async () => {
        try {
          const guestIds = read<string[]>("qk_wishlist", []);
          const res = await mergeWishlistFn({ data: { token: customerToken, ids: guestIds } });
          if (active) setIds(res.ids);
        } catch {
          // Keep the local cache on transient errors.
        }
      })();
    } else if (prev) {
      // Genuine logout (had a token, now null) — don't wipe on first mount.
      setIds([]);
    }
    return () => { active = false; };
  }, [customerToken]);


  const value = useMemo<WishlistCtx>(() => {
    const optimistic = (next: string[]) => setIds(next);

    const add = (id: string) => {
      setIds(prev => prev.includes(id) ? prev : [id, ...prev]);
      const token = tokenRef.current;
      if (token) {
        void addWishlistFn({ data: { token, productId: id } })
          .then(res => optimistic(res.ids))
          .catch(() => { /* cache already updated */ });
      }
    };
    const remove = (id: string) => {
      setIds(prev => prev.filter(x => x !== id));
      const token = tokenRef.current;
      if (token) {
        void removeWishlistFn({ data: { token, productId: id } })
          .then(res => optimistic(res.ids))
          .catch(() => { /* cache already updated */ });
      }
    };

    return {
      ids,
      has: (id) => ids.includes(id),
      toggle: (id) => { if (ids.includes(id)) remove(id); else add(id); },
      remove,
      clear: () => setIds([]),
      count: ids.length,
    };
  }, [ids]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}
export const useWishlist = () => {
  const c = useContext(WishlistContext);
  if (!c) throw new Error("WishlistProvider missing");
  return c;
};

// ---------------- Auth (server-verified OTP + signed tokens) ----------------
// OTPs are generated, hashed and verified entirely on the server, then delivered
// by SMS. The browser only ever holds short signed tokens that prove identity —
// it can no longer fabricate a role or a verified phone number.
type User = { phone: string; name?: string; email?: string; address?: string; role: "customer" | "admin" };
export type DeliverySession = { token: string; driver: { id: string; name: string; phone: string } };
export type SupplierSession = { token: string; supplier: { id: string; name: string; phone: string } };
export type AdminAuditEntry = { phone: string; at: number };

type AuthCtx = {
  user: User | null;
  /** False until the persisted session has been restored from storage. */
  ready: boolean;
  /** Signed customer token (proves phone ownership) used for server calls. */
  customerToken: string | null;
  /** Signed admin token issued after passcode verification. */
  adminToken: string | null;
  /** Request an SMS OTP. Returns demo-mode info when SMS is bypassed. */
  sendOtp: (phone: string) => Promise<{ demo: boolean; demoCode?: string }>;
  /** Verify the SMS OTP. Returns admin-eligibility, delivery and supplier sessions. */
  verifyOtp: (phone: string, otp: string) => Promise<{ user: User; isAdminPhone: boolean; delivery: DeliverySession | null; supplier: SupplierSession | null }>;
  /** Exchange the secret admin passcode for a signed admin token. */
  adminLogin: (passcode: string) => Promise<User>;
  setName: (name: string) => void;
  updateProfile: (patch: Partial<Pick<User, "name" | "email" | "address">>) => void;
  logout: () => void;
  adminAudit: AdminAuditEntry[];
};
const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [customerToken, setCustomerToken] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminAudit, setAdminAudit] = useState<AdminAuditEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(read<User | null>("qk_user", null));
    setCustomerToken(read<string | null>("qk_customer_token", null));
    setAdminToken(read<string | null>("qk_admin_token", null));
    setAdminAudit(read<AdminAuditEntry[]>("qk_admin_audit", []));
    setReady(true);
  }, []);
  useEffect(() => { write("qk_user", user); }, [user]);
  useEffect(() => { write("qk_customer_token", customerToken); }, [customerToken]);
  useEffect(() => { write("qk_admin_token", adminToken); }, [adminToken]);
  useEffect(() => { write("qk_admin_audit", adminAudit); }, [adminAudit]);

  // Pull the server-stored profile (name / email / address) whenever a customer
  // session is present — this is what makes the details a user entered on one
  // device show up when the SAME phone number logs in on another device.
  useEffect(() => {
    if (!customerToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getCustomerProfileFn({ data: { token: customerToken } });
        const p = res.profile;
        if (!p || cancelled) return;
        setUser(u => {
          if (!u) return u;
          // Server profile is the source of truth for name/email/address so a
          // name entered anywhere (checkout address, account page, other device)
          // shows up everywhere. Fall back to local values only if the server
          // has none yet.
          return {
            ...u,
            name: p.name || u.name || undefined,
            email: p.email || u.email || undefined,
            address: p.address || u.address || undefined,
          };
        });
      } catch { /* offline / not logged in — keep local values */ }
    })();
    return () => { cancelled = true; };
  }, [customerToken]);

  const value: AuthCtx = {
    user,
    ready,
    customerToken,
    adminToken,
    adminAudit,
    sendOtp: async (phone) => {
      const res = await requestOtpFn({ data: { phone } });
      return { demo: Boolean(res.demo), demoCode: "demoCode" in res ? res.demoCode : undefined };
    },
    verifyOtp: async (phone, otp) => {
      const res = await verifyOtpFn({ data: { phone, code: otp } });
      const u: User = { phone, role: "customer" };
      setUser(u);
      setCustomerToken(res.token);
      // A new login is not yet an admin session until the passcode is provided.
      setAdminToken(null);
      return { user: u, isAdminPhone: res.isAdminPhone, delivery: res.delivery ?? null, supplier: res.supplier ?? null };
    },
    adminLogin: async (passcode) => {
      const res = await adminLoginFn({ data: { passcode } });
      if (!res.ok) throw new Error(res.error ?? "Incorrect admin passcode");
      // Persist synchronously BEFORE returning so the admin route's beforeLoad
      // (which reads localStorage directly) sees the token on the very first
      // navigation. The state-driven useEffect write runs only after re-render,
      // which is too late for the immediate nav({ to: "/admin" }) call.
      write("qk_admin_token", res.token);
      setAdminToken(res.token);
      const u: User = { ...(user ?? { phone: "" }), role: "admin" } as User;
      setUser(u);
      if (u.phone) setAdminAudit(prev => [{ phone: u.phone, at: Date.now() }, ...prev].slice(0, 100));
      return u;
    },

    setName: (name) => {
      setUser(u => {
        const next = u ? { ...u, name } : u;
        // Persist name (and preserve existing email/address so this doesn't
        // wipe them). The customer profile is what feeds the account page,
        // order records and the header greeting.
        if (next && customerToken) {
          void saveCustomerProfileFn({
            data: {
              token: customerToken,
              name,
              email: next.email ?? "",
              address: next.address ?? "",
            },
          }).catch(() => {});
        }
        return next;
      });
    },
    updateProfile: (patch) => {
      setUser(u => {
        const next = u ? { ...u, ...patch } : u;
        // Persist to the backend so these details follow the phone number across devices.
        if (next && customerToken) {
          void saveCustomerProfileFn({
            data: {
              token: customerToken,
              name: next.name ?? "",
              email: next.email ?? "",
              address: next.address ?? "",
            },
          }).catch(() => {});
        }
        return next;
      });
    },
    logout: () => {
      setUser(null);
      setCustomerToken(null);
      setAdminToken(null);
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("qk_user");
          localStorage.removeItem("qk_customer_token");
          localStorage.removeItem("qk_admin_token");
          localStorage.removeItem("qk_delivery_token");
          localStorage.removeItem("qk_delivery_driver");
          localStorage.removeItem("qk_supplier_token");
          localStorage.removeItem("qk_supplier");
          localStorage.removeItem("qk_cart");
          localStorage.removeItem("qk_wishlist");
          // Clear the local address cache so the next person to log in on this
          // device starts from their own server-synced addresses, not these.
          localStorage.removeItem("qk_addresses");
          localStorage.removeItem("qk_delivery_addresses");
        } catch { /* noop */ }
      }
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => {
  const c = useContext(AuthContext);
  if (!c) throw new Error("AuthProvider missing");
  return c;

};

// ---------------- Wallet (Kartogo Cash) ----------------
// The wallet is now SERVER-AUTHORITATIVE. Balance and transactions live in the
// database and are only read/changed through token-scoped server functions, so a
// client can no longer fabricate a balance via localStorage to pay for free.
// Order spends and refunds are applied entirely on the server (in placeOrderFn /
// cancelOrderFn / markRefundedFn); the client just refreshes after those calls.
export type WalletTxn = { id: string; type: "credit" | "debit"; amount: number; note: string; at: number };
export type WalletTopup = { id: string; amount: number; status: "success" | "failed"; at: number };
type WalletCtx = {
  balance: number;
  txns: WalletTxn[];
  /** Past top-up attempts (successful and failed), newest first. */
  topups: WalletTopup[];
  /** Top up money (server-side credit). Resolves once the new balance is loaded. */
  addMoney: (amount: number) => Promise<void>;
  /** Record a cancelled / failed top-up attempt so it appears in history. */
  recordFailedTopup: (amount: number) => Promise<void>;
  /** Re-read the authoritative balance + history from the server. */
  refresh: () => Promise<void>;
};
const WalletContext = createContext<WalletCtx | null>(null);

function rowToWalletTxn(r: WalletTxnRow): WalletTxn {
  return {
    id: r.id,
    type: r.type,
    amount: Number(r.amount),
    note: r.note,
    at: new Date(r.created_at).getTime(),
  };
}

function rowToTopup(r: TopupRow): WalletTopup {
  return {
    id: r.id,
    amount: Number(r.amount),
    status: r.status,
    at: new Date(r.created_at).getTime(),
  };
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { customerToken } = useAuth();
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [topups, setTopups] = useState<WalletTopup[]>([]);

  const tokenRef = useRef(customerToken);
  useEffect(() => { tokenRef.current = customerToken; }, [customerToken]);

  const refresh = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) { setBalance(0); setTxns([]); setTopups([]); return; }
    try {
      const [wallet, topupRes] = await Promise.all([
        getWalletFn({ data: { token } }),
        getTopupsFn({ data: { token } }),
      ]);
      setBalance(Number(wallet.balance));
      setTxns((wallet.txns as WalletTxnRow[]).map(rowToWalletTxn));
      setTopups((topupRes.topups as TopupRow[]).map(rowToTopup));
    } catch {
      // Keep last good state on transient errors.
    }
  }, []);

  // Load the wallet whenever the signed-in customer changes.
  useEffect(() => { void refresh(); }, [refresh, customerToken]);

  const value = useMemo<WalletCtx>(() => ({
    balance,
    txns,
    topups,
    addMoney: async (amount) => {
      const token = tokenRef.current;
      if (!token || !amount || amount <= 0) return;
      const res = await addMoneyFn({ data: { token, amount: Math.round(amount) } });
      setBalance(Number(res.balance));
      setTxns((res.txns as WalletTxnRow[]).map(rowToWalletTxn));
      if (res.topups) setTopups((res.topups as TopupRow[]).map(rowToTopup));
    },
    recordFailedTopup: async (amount) => {
      const token = tokenRef.current;
      if (!token || !amount || amount <= 0) return;
      const res = await recordFailedTopupFn({ data: { token, amount: Math.round(amount) } });
      setTopups((res.topups as TopupRow[]).map(rowToTopup));
    },
    refresh,
  }), [balance, txns, topups, refresh]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
export const useWallet = () => {
  const c = useContext(WalletContext);
  if (!c) throw new Error("WalletProvider missing");
  return c;
};

// ---------------- Catalog (products + inventory editable) ----------------
type CatalogCtx = {
  products: Product[];
  upsert: (p: Product) => void;
  remove: (id: string) => void;
  setStock: (id: string, stock: number) => void;
  setPrice: (id: string, price: number) => void;
};
const CatalogContext = createContext<CatalogCtx | null>(null);

function useProductsValue(): Product[] {
  const c = useContext(CatalogContext);
  return c?.products ?? PRODUCTS;
}

function rowToProduct(r: CatalogItemRow): Product {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    price: Number(r.price),
    mrp: r.mrp == null ? undefined : Number(r.mrp),
    unit: r.unit,
    stock: Number(r.stock),
    emoji: r.emoji,
    image: r.image ?? undefined,
    description: r.description,
  };
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const { customerToken, adminToken } = useAuth();
  const [supplierProducts, setSupplierProducts] = useState<Product[]>([]);
  // Local overrides for seed PRODUCTS (stock/price tweaks). Supplier-added items
  // now come from the server so every browser sees them.
  const [seedOverrides, setSeedOverrides] = useState<Record<string, Partial<Product>>>({});

  // Read the shared server catalog. This is what makes an item added on the
  // supplier page appear in the customer + admin apps too.
  const refreshCatalog = useCallback(async () => {
    try {
      const res = await listCatalogItemsFn();
      setSupplierProducts(res.items.map(rowToProduct));
    } catch { /* keep last good */ }
  }, []);

  useEffect(() => {
    setSeedOverrides(read<Record<string, Partial<Product>>>("qk_products_overrides", {}));
    void refreshCatalog();
  }, [refreshCatalog]);
  useEffect(() => { write("qk_products_overrides", seedOverrides); }, [seedOverrides]);

  // Light polling + focus refresh so a change from another browser (or the
  // supplier page in a separate tab) shows up quickly.
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === "visible") void refreshCatalog(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshCatalog();
    }, 5000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.clearInterval(poll);
    };
  }, [refreshCatalog]);

  const products = useMemo<Product[]>(() => {
    const seed = PRODUCTS.map(p => ({ ...p, ...(seedOverrides[p.id] ?? {}) }));
    // Supplier/admin items come after seed catalog. De-dupe by id in case of clashes.
    const seen = new Set(seed.map(p => p.id));
    return [...seed, ...supplierProducts.filter(p => !seen.has(p.id))];
  }, [supplierProducts, seedOverrides]);

  const tokens = () => ({
    supplierToken: read<string | null>("qk_supplier_token", null) ?? "",
    adminToken: adminToken ?? "",
  });

  const isSeed = (id: string) => PRODUCTS.some(p => p.id === id);

  const value: CatalogCtx = {
    products,
    upsert: (p) => {
      // Optimistic update
      setSupplierProducts(prev => {
        if (isSeed(p.id)) return prev;
        const i = prev.findIndex(x => x.id === p.id);
        if (i === -1) return [...prev, p];
        const next = [...prev]; next[i] = p; return next;
      });
      if (isSeed(p.id)) {
        setSeedOverrides(prev => ({ ...prev, [p.id]: { ...prev[p.id], ...p } }));
      }
      const { supplierToken, adminToken } = tokens();
      void upsertCatalogItemFn({ data: {
        supplierToken, adminToken,
        id: p.id, name: p.name, category: p.category, price: p.price,
        mrp: p.mrp, unit: p.unit, stock: p.stock, emoji: p.emoji,
        image: p.image, description: p.description,
      } }).then(refreshCatalog).catch(() => { /* keep optimistic */ });
    },
    remove: (id) => {
      setSupplierProducts(prev => prev.filter(p => p.id !== id));
      const { supplierToken, adminToken } = tokens();
      void deleteCatalogItemFn({ data: { supplierToken, adminToken, id } })
        .then(refreshCatalog).catch(() => {});
    },
    setStock: (id, stock) => {
      setSupplierProducts(prev => prev.map(p => p.id === id ? { ...p, stock } : p));
      if (isSeed(id)) setSeedOverrides(prev => ({ ...prev, [id]: { ...prev[id], stock } }));
      const { supplierToken, adminToken } = tokens();
      if (!isSeed(id)) {
        void setCatalogStockFn({ data: { supplierToken, adminToken, id, stock } })
          .then(refreshCatalog).catch(() => {});
      }
    },
    setPrice: (id, price) => {
      setSupplierProducts(prev => prev.map(p => p.id === id ? { ...p, price } : p));
      if (isSeed(id)) setSeedOverrides(prev => ({ ...prev, [id]: { ...prev[id], price } }));
      const { supplierToken, adminToken } = tokens();
      if (!isSeed(id)) {
        void setCatalogPriceFn({ data: { supplierToken, adminToken, id, price } })
          .then(refreshCatalog).catch(() => {});
      }
    },
  };
  // customerToken is unused here but kept in deps for future auth-aware pricing.
  void customerToken;
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}
export const useCatalog = () => {
  const c = useContext(CatalogContext);
  if (!c) throw new Error("CatalogProvider missing");
  return c;
};

// ---------------- Orders ----------------
export type OrderStatus = "placed" | "packed" | "out_for_delivery" | "delivered" | "cancelled";
export type Order = {
  id: string;
  createdAt: number;
  updatedAt?: number;
  customerPhone: string;
  customerName: string;
  address: string;
  items: { productId: string; name: string; qty: number; price: number }[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  promoCode?: string;
  total: number;
  paymentMethod: "cash" | "upi" | "wallet";
  status: OrderStatus;
  deliveryBoyId?: string;
  cancelReason?: string;
  refunded?: boolean;
  refundedAt?: number;
};

type OrdersCtx = {
  orders: Order[];
  refresh: (customerPhone?: string) => Promise<void>;
  place: (o: PlaceOrderInput) => Promise<Order>;
  setStatus: (id: string, status: OrderStatus, cancelReason?: string) => Promise<void>;
  assign: (id: string, deliveryBoyId: string) => Promise<void>;
  markRefunded: (id: string, refunded: boolean) => Promise<void>;
  /** Customer-scoped cancellation (only the order owner, only while "placed"). */
  cancel: (id: string, reason: string) => Promise<Order>;
};

/** What checkout passes in — raw items only; the server computes all money. */
export type PlaceOrderInput = {
  items: { productId: string; qty: number }[];
  customerName: string;
  address: string;
  paymentMethod: Order["paymentMethod"];
  promoCode?: string;
};
const OrdersContext = createContext<OrdersCtx | null>(null);


// Maps a database row (snake_case) to the in-app Order shape.
type OrderRow = {
  id: string;
  created_at: string;
  updated_at?: string | null;
  customer_phone: string;
  customer_name: string;
  address: string;
  items: Order["items"];
  subtotal: number;
  delivery_fee: number;
  discount?: number | null;
  promo_code?: string | null;
  total: number;
  payment_method: Order["paymentMethod"];
  status: OrderStatus;
  delivery_boy_id: string | null;
  cancel_reason?: string | null;
  refunded?: boolean | null;
  refunded_at?: string | null;
};
function rowToOrder(r: OrderRow): Order {
  return {
    id: r.id,
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : undefined,
    customerPhone: r.customer_phone,
    customerName: r.customer_name,
    address: r.address,
    items: r.items ?? [],
    subtotal: Number(r.subtotal),
    deliveryFee: Number(r.delivery_fee),
    discount: Number(r.discount ?? 0),
    promoCode: r.promo_code ?? undefined,
    total: Number(r.total),
    paymentMethod: r.payment_method,
    status: r.status,
    deliveryBoyId: r.delivery_boy_id ?? undefined,
    cancelReason: r.cancel_reason ?? undefined,
    refunded: r.refunded ?? false,
    refundedAt: r.refunded_at ? new Date(r.refunded_at).getTime() : undefined,
  };
}

const sortOrders = (orders: Order[]) => [...orders].sort((a, b) => b.createdAt - a.createdAt);
const ORDERS_SYNC_KEY = "qk_orders_sync";

function announceOrdersSync(id: string, status?: OrderStatus) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ORDERS_SYNC_KEY, JSON.stringify({ id, status, at: Date.now() }));
  } catch { /* noop */ }
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { customerToken, adminToken } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  // Keep the freshest tokens available to the polling loop without re-creating it.
  const tokensRef = useRef({ customerToken, adminToken });
  useEffect(() => { tokensRef.current = { customerToken, adminToken }; }, [customerToken, adminToken]);

  // All order reads go through the server function, which scopes the result to
  // the caller's identity (admin => all, customer => own). The browser no longer
  // talks to the orders table directly.
  const fetchOrders = useCallback(async (): Promise<Order[]> => {
    const { customerToken: ct, adminToken: at } = tokensRef.current;
    if (!ct && !at) return [];
    const rows = await listOrdersFn({
      data: { customerToken: ct ?? undefined, adminToken: at ?? undefined },
    });
    return sortOrders((rows as unknown as OrderRow[]).map(rowToOrder));
  }, []);

  // `customerPhone` is accepted for call-site compatibility but ignored — the
  // server decides scope from the signed token, not from anything the client says.
  const refresh = useCallback(async (_customerPhone?: string) => {
    try {
      const latest = await fetchOrders();
      setOrders(latest);
    } catch {
      // Keep the last good state on transient errors.
    }
  }, [fetchOrders]);

  // Keep order screens in sync via a lightweight foreground poll plus refetch on
  // focus/online/cross-tab sync. (Realtime broadcast of order PII is disabled.)
  useEffect(() => {
    let active = true;
    const refetch = async () => {
      try {
        const latest = await fetchOrders();
        if (active) setOrders(latest);
      } catch { /* keep last good */ }
    };

    void refetch();

    const onFocus = () => { if (document.visibilityState === "visible") void refetch(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const onStorage = (event: StorageEvent) => {
      if (event.key === ORDERS_SYNC_KEY) void refetch();
    };
    window.addEventListener("storage", onStorage);

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refetch();
    }, 2000);

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(poll);
    };
  }, [fetchOrders, customerToken, adminToken]);

  const upsertLocal = (saved: Order) =>
    setOrders(prev => sortOrders([saved, ...prev.filter(o => o.id !== saved.id)]));

  const value: OrdersCtx = {
    orders,
    refresh,
    place: async (o) => {
      const ct = tokensRef.current.customerToken;
      if (!ct) throw new Error("Please log in to place an order");
      const row = await placeOrderFn({
        data: {
          token: ct,
          items: o.items,
          name: o.customerName,
          address: o.address,
          paymentMethod: o.paymentMethod,
          promoCode: o.promoCode,
        },
      });
      const saved = rowToOrder(row as unknown as OrderRow);
      upsertLocal(saved);
      announceOrdersSync(saved.id, saved.status);
      return saved;
    },
    setStatus: async (id, status, cancelReason) => {
      const at = tokensRef.current.adminToken;
      if (!at) throw new Error("Admin authorization required");
      const previous = orders;
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status, cancelReason: cancelReason ?? o.cancelReason } : o));
      try {
        const row = await setOrderStatusFn({ data: { adminToken: at, id, status, cancelReason } });
        const saved = rowToOrder(row as unknown as OrderRow);
        upsertLocal(saved);
        announceOrdersSync(saved.id, saved.status);
      } catch (e) {
        setOrders(previous);
        throw e;
      }
    },
    assign: async (id, deliveryBoyId) => {
      const at = tokensRef.current.adminToken;
      if (!at) throw new Error("Admin authorization required");
      const previous = orders;
      setOrders(prev => prev.map(o => o.id === id ? { ...o, deliveryBoyId: deliveryBoyId || undefined } : o));
      try {
        const row = await assignOrderFn({ data: { adminToken: at, id, deliveryBoyId } });
        const saved = rowToOrder(row as unknown as OrderRow);
        upsertLocal(saved);
        announceOrdersSync(saved.id, saved.status);
      } catch (e) {
        setOrders(previous);
        throw e;
      }
    },
    markRefunded: async (id, refunded) => {
      const at = tokensRef.current.adminToken;
      if (!at) throw new Error("Admin authorization required");
      const previous = orders;
      setOrders(prev => prev.map(o => o.id === id ? { ...o, refunded, refundedAt: refunded ? Date.now() : undefined } : o));
      try {
        const row = await markRefundedFn({ data: { adminToken: at, id, refunded } });
        const saved = rowToOrder(row as unknown as OrderRow);
        upsertLocal(saved);
        announceOrdersSync(saved.id, saved.status);
      } catch (e) {
        setOrders(previous);
        throw e;
      }
    },
    cancel: async (id, reason) => {
      const ct = tokensRef.current.customerToken;
      if (!ct) throw new Error("Please log in to cancel an order");
      const row = await cancelOrderFn({ data: { token: ct, id, reason } });
      const saved = rowToOrder(row as unknown as OrderRow);
      upsertLocal(saved);
      announceOrdersSync(saved.id, saved.status);
      return saved;
    },
  };
  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}
export const useOrders = () => {
  const c = useContext(OrdersContext);
  if (!c) throw new Error("OrdersProvider missing");
  return c;
};

// ---------------- Delivery location ----------------
export type SavedLocation = {
  query: string;
  area: string;
  /** Whether the dark store delivers to this location. */
  serviceable?: boolean;
  /** Expected door delivery time in minutes. */
  etaMinutes?: number;
  /** Exact address details captured after the area is confirmed. */
  doorNumber?: string;
  apartment?: string;
  landmark?: string;
  /** The area/city/pincode part of the address, kept separate so we can edit the exact details without touching the selected area. */
  baseQuery?: string;
};

function regexEscape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Reconstruct the area/city base string from a legacy saved query that didn't store baseQuery separately. */
function inferBaseQuery(loc: SavedLocation): string {
  let base = loc.query;
  if (loc.doorNumber) base = base.replace(new RegExp(`^${regexEscape(loc.doorNumber)}\\s*,?\\s*`), "");
  if (loc.apartment) base = base.replace(new RegExp(`${regexEscape(loc.apartment)}\\s*,?\\s*`), "");
  if (loc.landmark) base = base.replace(new RegExp(`,?\\s*Near\\s+${regexEscape(loc.landmark)}$`), "");
  return base.replace(/^,\\s*|\\s*,$/g, "").trim();
}

/** Build the full display query from the area base plus exact address details. */
export function buildLocationQuery(loc: SavedLocation): string {
  const base = loc.baseQuery ?? inferBaseQuery(loc);
  const parts = [
    loc.doorNumber,
    loc.apartment,
    base,
    loc.landmark ? `Near ${loc.landmark}` : "",
  ].filter(Boolean);
  return parts.join(", ");
}

/** A full delivery address the customer can reuse at checkout. */
export type DeliveryAddress = {
  id: string;
  label: string;
  name: string;
  address: string;
};

type LocationCtx = {
  location: SavedLocation | null;
  /** Previously confirmed serviceable addresses the user can reselect. */
  savedAddresses: SavedLocation[];
  /** Full delivery addresses the user can pick from at checkout. */
  deliveryAddresses: DeliveryAddress[];
  /** True once we've restored any persisted location from storage. */
  ready: boolean;
  setLocation: (loc: SavedLocation) => void;
  removeSavedAddress: (query: string) => void;
  /** Update only the exact address details (door / apartment / landmark) of a saved area without changing its city/area. */
  updateSavedAddress: (query: string, patch: Partial<Pick<SavedLocation, "doorNumber" | "apartment" | "landmark" | "baseQuery">>) => void;
  addDeliveryAddress: (addr: Omit<DeliveryAddress, "id">) => DeliveryAddress;
  removeDeliveryAddress: (id: string) => void;
  clearLocation: () => void;
};
const LocationContext = createContext<LocationCtx | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const { customerToken } = useAuth();
  const [location, setLoc] = useState<SavedLocation | null>(null);
  const [savedAddresses, setSaved] = useState<SavedLocation[]>([]);
  const [deliveryAddresses, setDelivery] = useState<DeliveryAddress[]>([]);
  const [ready, setReady] = useState(false);
  // Becomes true once we've reconciled with the server for the current session,
  // so we don't push an empty local list up before the server copy has loaded.
  const syncedRef = useRef(false);

  useEffect(() => {
    setLoc(read<SavedLocation | null>("qk_location", null));
    setSaved(read<SavedLocation[]>("qk_addresses", []));
    setDelivery(read<DeliveryAddress[]>("qk_delivery_addresses", []));
    setReady(true);
  }, []);

  // On login, pull the server-stored addresses and merge them with anything saved
  // locally so the SAME phone number sees its addresses on every device. The
  // merged result is written back so both sides stay in sync.
  useEffect(() => {
    if (!customerToken) { syncedRef.current = false; return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await getCustomerProfileFn({ data: { token: customerToken } });
        if (cancelled) return;
        const serverSaved = (res.profile?.savedAddresses ?? []) as unknown as SavedLocation[];
        const serverDelivery = (res.profile?.deliveryAddresses ?? []) as unknown as DeliveryAddress[];

        const localSaved = read<SavedLocation[]>("qk_addresses", []);
        const localDelivery = read<DeliveryAddress[]>("qk_delivery_addresses", []);

        // Union saved locations by their display query (server wins on ties so
        // cross-device edits are respected), capped at 8.
        const mergedSaved: SavedLocation[] = [...serverSaved];
        for (const a of localSaved) {
          if (!mergedSaved.some(s => s.query.toLowerCase() === a.query.toLowerCase())) mergedSaved.push(a);
        }
        const nextSaved = mergedSaved.slice(0, 8);

        // Union delivery addresses by id, capped at 12.
        const mergedDelivery: DeliveryAddress[] = [...serverDelivery];
        for (const a of localDelivery) {
          if (!mergedDelivery.some(d => d.id === a.id)) mergedDelivery.push(a);
        }
        const nextDelivery = mergedDelivery.slice(0, 12);

        setSaved(nextSaved);
        setDelivery(nextDelivery);
        write("qk_addresses", nextSaved);
        write("qk_delivery_addresses", nextDelivery);
        syncedRef.current = true;
        // Push the merged set back up so the server has the union too.
        void saveCustomerAddressesFn({
          data: { token: customerToken, savedAddresses: nextSaved as unknown as [], deliveryAddresses: nextDelivery as unknown as [] },
        }).catch(() => {});
      } catch { /* offline — keep local copy */ }
    })();
    return () => { cancelled = true; };
  }, [customerToken]);

  // Persist any later address changes to the server (once the initial sync is done).
  useEffect(() => {
    if (!customerToken || !syncedRef.current) return;
    void saveCustomerAddressesFn({
      data: { token: customerToken, savedAddresses: savedAddresses as unknown as [], deliveryAddresses: deliveryAddresses as unknown as [] },
    }).catch(() => {});
  }, [customerToken, savedAddresses, deliveryAddresses]);

  const value: LocationCtx = {
    location,
    savedAddresses,
    deliveryAddresses,
    ready,
    setLocation: (loc) => {
      const baseQuery = loc.baseQuery ?? inferBaseQuery(loc);
      // Once a customer has added a door number / apartment / landmark for an
      // area, never wipe them when the same area is re-selected. Carry over any
      // previously saved details the incoming selection doesn't provide.
      const prior = savedAddresses.find(
        a => (a.baseQuery ?? inferBaseQuery(a)).toLowerCase() === baseQuery.toLowerCase(),
      );
      const merged: SavedLocation = {
        ...loc,
        baseQuery,
        doorNumber: (loc.doorNumber?.trim() || prior?.doorNumber) || undefined,
        apartment: (loc.apartment?.trim() || prior?.apartment) || undefined,
        landmark: (loc.landmark?.trim() || prior?.landmark) || undefined,
      };
      const stored: SavedLocation = {
        ...merged,
        query:
          merged.doorNumber || merged.apartment || merged.landmark
            ? buildLocationQuery(merged)
            : merged.query,
      };
      setLoc(stored);
      write("qk_location", stored);
      setSaved(prev => {
        const next = [
          stored,
          ...prev.filter(
            a =>
              a.query.toLowerCase() !== stored.query.toLowerCase() &&
              (a.baseQuery ?? inferBaseQuery(a)).toLowerCase() !== baseQuery.toLowerCase(),
          ),
        ].slice(0, 8);
        write("qk_addresses", next);
        return next;
      });
    },
    removeSavedAddress: (query) => {
      setSaved(prev => {
        const next = prev.filter(a => a.query.toLowerCase() !== query.toLowerCase());
        write("qk_addresses", next);
        return next;
      });
    },
    updateSavedAddress: (query, patch) => {
      const idx = savedAddresses.findIndex(a => a.query.toLowerCase() === query.toLowerCase());
      if (idx === -1) return;
      const existing = savedAddresses[idx];
      const baseQuery = patch.baseQuery ?? existing.baseQuery ?? inferBaseQuery(existing);
      // Preserve door number / apartment once set — a blank patch value must not
      // erase what the customer already entered.
      const detail = {
        doorNumber: (patch.doorNumber?.trim() || existing.doorNumber) || undefined,
        apartment: (patch.apartment?.trim() || existing.apartment) || undefined,
        landmark: (patch.landmark?.trim() || existing.landmark) || undefined,
      };
      const updated: SavedLocation = {
        ...existing,
        ...patch,
        ...detail,
        baseQuery,
        query: buildLocationQuery({ ...existing, ...patch, ...detail, baseQuery }),
      };
      const next = [updated, ...savedAddresses.filter((_, i) => i !== idx)].slice(0, 8);
      setSaved(next);
      write("qk_addresses", next);
      if (location?.query.toLowerCase() === query.toLowerCase()) {
        setLoc(updated);
        write("qk_location", updated);
      }
    },
    addDeliveryAddress: (addr) => {
      const created: DeliveryAddress = {
        ...addr,
        id: (typeof crypto !== "undefined" && crypto.randomUUID)
          ? crypto.randomUUID()
          : `addr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      };
      setDelivery(prev => {
        const next = [created, ...prev].slice(0, 12);
        write("qk_delivery_addresses", next);
        return next;
      });
      return created;
    },
    removeDeliveryAddress: (id) => {
      setDelivery(prev => {
        const next = prev.filter(a => a.id !== id);
        write("qk_delivery_addresses", next);
        return next;
      });
    },
    clearLocation: () => {
      setLoc(null);
      if (typeof window !== "undefined") {
        try { localStorage.removeItem("qk_location"); } catch { /* noop */ }
      }
    },
  };
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}
export const useLocation = () => {
  const c = useContext(LocationContext);
  if (!c) throw new Error("LocationProvider missing");
  return c;
};

export { DELIVERY_BOYS };

// ---------------- Drivers (availability toggles) ----------------
// Admin-managed availability for delivery partners. The roster is static
// (src/lib/data.ts); availability overrides persist in localStorage and sync
// across tabs so the Orders "Assign" dropdown only offers available riders.
export type Driver = { id: string; name: string; phone: string; active: boolean };

type DriversCtx = {
  drivers: Driver[];
  available: Driver[];
  setAvailable: (id: string, active: boolean) => void;
};
const DriversContext = createContext<DriversCtx | null>(null);
const DRIVERS_KEY = "qk_driver_availability";

export function DriversProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  useEffect(() => { setOverrides(read<Record<string, boolean>>(DRIVERS_KEY, {})); }, []);
  useEffect(() => { write(DRIVERS_KEY, overrides); }, [overrides]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DRIVERS_KEY) setOverrides(read<Record<string, boolean>>(DRIVERS_KEY, {}));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<DriversCtx>(() => {
    const drivers: Driver[] = DELIVERY_BOYS.map(d => ({ ...d, active: overrides[d.id] ?? d.active }));
    return {
      drivers,
      available: drivers.filter(d => d.active),
      setAvailable: (id, active) => setOverrides(prev => ({ ...prev, [id]: active })),
    };
  }, [overrides]);

  return <DriversContext.Provider value={value}>{children}</DriversContext.Provider>;
}
export const useDrivers = () => {
  const c = useContext(DriversContext);
  if (!c) throw new Error("DriversProvider missing");
  return c;
};


