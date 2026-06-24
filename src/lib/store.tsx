import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { PRODUCTS, DELIVERY_BOYS, type Product } from "./data";
import { supabase } from "@/integrations/supabase/client";

// ---------------- Allow list (server/mock layer) ----------------
// In a real app this lives on the server. Roles are always derived from this
// list — never from anything the client sends.
export const ADMIN_PHONES: readonly string[] = ["9110310034"];
export const isAdminPhone = (phone: string) => ADMIN_PHONES.includes(phone);

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

// ---------------- Auth (mock OTP) ----------------
type User = { phone: string; name?: string; email?: string; address?: string; password?: string; role: "customer" | "admin" };
export type AdminAuditEntry = { phone: string; at: number };

type AuthCtx = {
  user: User | null;
  /** False until the persisted session has been restored from storage. */
  ready: boolean;
  sendOtp: (phone: string) => Promise<string>; // returns the otp for demo
  /** Verify OTP for a customer login. Rejects admin allow-listed numbers. */
  verifyOtp: (phone: string, otp: string) => Promise<User>;
  /** Verify OTP for the admin portal. Rejects any phone not on the allow list. */
  verifyAdminOtp: (phone: string, otp: string) => Promise<User>;
  setName: (name: string) => void;
  updateProfile: (patch: Partial<Pick<User, "name" | "email" | "address" | "password">>) => void;
  logout: () => void;
  adminAudit: AdminAuditEntry[];
};
const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [pendingOtp, setPendingOtp] = useState<Record<string, string>>({});
  const [adminAudit, setAdminAudit] = useState<AdminAuditEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(read<User | null>("qk_user", null));
    setAdminAudit(read<AdminAuditEntry[]>("qk_admin_audit", []));
    setReady(true);
  }, []);
  useEffect(() => { write("qk_user", user); }, [user]);
  useEffect(() => { write("qk_admin_audit", adminAudit); }, [adminAudit]);

  // Always derive role from the server-side allow list — never trust callers.
  const roleFor = (phone: string): User["role"] => (isAdminPhone(phone) ? "admin" : "customer");

  const checkOtp = (phone: string, otp: string) => {
    const expected = pendingOtp[phone];
    if (!expected) throw new Error("Please request a new OTP");
    if (otp !== expected) throw new Error("Incorrect OTP");
  };

  const value: AuthCtx = {
    user,
    ready,
    adminAudit,
    sendOtp: async (phone) => {
      const otp = "1234"; // demo OTP — replace with a real SMS provider via Lovable Cloud later
      setPendingOtp(p => ({ ...p, [phone]: otp }));
      return otp;
    },
    verifyOtp: async (phone, otp) => {
      checkOtp(phone, otp);
      const role = roleFor(phone);
      const u: User = { phone, role };
      setUser(u);
      setPendingOtp(p => { const { [phone]: _, ...rest } = p; return rest; });
      if (role === "admin") {
        setAdminAudit(prev => [{ phone, at: Date.now() }, ...prev].slice(0, 100));
      }
      return u;
    },
    verifyAdminOtp: async (phone, otp) => {
      checkOtp(phone, otp);
      if (!isAdminPhone(phone)) {
        throw new Error("This number is not authorized for admin access.");
      }
      const u: User = { phone, role: "admin" };
      setUser(u);
      setPendingOtp(p => { const { [phone]: _, ...rest } = p; return rest; });
      setAdminAudit(prev => [{ phone, at: Date.now() }, ...prev].slice(0, 100));
      return u;
    },
    setName: (name) => setUser(u => u ? { ...u, name } : u),
    updateProfile: (patch) => setUser(u => u ? { ...u, ...patch } : u),
    logout: () => {
      setUser(null);
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("qk_user");
          localStorage.removeItem("qk_cart");
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

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  useEffect(() => {
    const stored = read<Product[]>("qk_products", PRODUCTS);
    // Code (PRODUCTS) is the source of truth for catalog details (name, price,
    // mrp, image, etc.). localStorage only preserves locally-edited stock so we
    // don't clobber admin inventory changes, but still reflect code updates.
    const stockById = new Map(stored.map(p => [p.id, p.stock]));
    const merged = PRODUCTS.map(p => ({
      ...p,
      stock: stockById.get(p.id) ?? p.stock,
    }));
    setProducts(merged);
  }, []);
  useEffect(() => { write("qk_products", products); }, [products]);

  const value: CatalogCtx = {
    products,
    upsert: (p) => setProducts(prev => {
      const i = prev.findIndex(x => x.id === p.id);
      if (i === -1) return [...prev, p];
      const next = [...prev]; next[i] = p; return next;
    }),
    remove: (id) => setProducts(prev => prev.filter(p => p.id !== id)),
    setStock: (id, stock) => setProducts(prev => prev.map(p => p.id === id ? { ...p, stock } : p)),
    setPrice: (id, price) => setProducts(prev => prev.map(p => p.id === id ? { ...p, price } : p)),
  };
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
  total: number;
  paymentMethod: "cash" | "upi";
  status: OrderStatus;
  deliveryBoyId?: string;
};

type OrdersCtx = {
  orders: Order[];
  refresh: (customerPhone?: string) => Promise<void>;
  place: (o: Omit<Order, "id" | "createdAt" | "status">) => Promise<Order>;
  setStatus: (id: string, status: OrderStatus) => Promise<void>;
  assign: (id: string, deliveryBoyId: string) => Promise<void>;
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
  total: number;
  payment_method: Order["paymentMethod"];
  status: OrderStatus;
  delivery_boy_id: string | null;
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
    total: Number(r.total),
    paymentMethod: r.payment_method,
    status: r.status,
    deliveryBoyId: r.delivery_boy_id ?? undefined,
  };
}

const sortOrders = (orders: Order[]) => [...orders].sort((a, b) => b.createdAt - a.createdAt);
const ORDERS_SYNC_KEY = "qk_orders_sync";

// Postgres errors from RAISE EXCEPTION come back prefixed; strip noise so the
// admin sees just the human-readable validation message.
function cleanDbError(message?: string | null): string | undefined {
  if (!message) return undefined;
  return message.replace(/^.*?(?:ERROR:|error:)\s*/i, "").trim() || undefined;
}

function announceOrdersSync(id: string, status?: OrderStatus) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ORDERS_SYNC_KEY, JSON.stringify({ id, status, at: Date.now() }));
  } catch { /* noop */ }
}

async function fetchOrdersFromBackend(customerPhone?: string) {
  let query = supabase
    .from("app_orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (customerPhone) query = query.eq("customer_phone", customerPhone);

  const { data, error } = await query;

  if (error) {
    console.error("Failed to load orders", error);
    throw new Error("Orders could not be refreshed. Please try again.");
  }

  return ((data ?? []) as unknown as OrderRow[]).map(rowToOrder);
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);

  const refresh = useCallback(async (customerPhone?: string) => {
    const latest = await fetchOrdersFromBackend(customerPhone);
    setOrders(prev => {
      if (!customerPhone) return sortOrders(latest);
      const otherOrders = prev.filter(o => o.customerPhone !== customerPhone);
      return sortOrders([...latest, ...otherOrders]);
    });
  }, []);

  // Load all orders from the shared backend and keep them live across devices.
  useEffect(() => {
    let active = true;

    const refetch = async () => {
      try {
        const latest = await fetchOrdersFromBackend();
        if (active) setOrders(sortOrders(latest));
      } catch {
        // Keep the last good state on transient network errors.
      }
    };

    void refetch();

    const channel = supabase
      .channel("app_orders_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_orders" }, payload => {
        setOrders(prev => {
          if (payload.eventType === "DELETE") {
            return prev.filter(o => o.id !== (payload.old as unknown as OrderRow).id);
          }
          const next = rowToOrder(payload.new as unknown as OrderRow);
          const rest = prev.filter(o => o.id !== next.id);
          return [next, ...rest].sort((a, b) => b.createdAt - a.createdAt);
        });
      })
      .subscribe();

    // Background tabs throttle websockets, so a realtime event can be missed
    // while the customer/admin tab is hidden. Re-pull the latest on focus so
    // status changes made elsewhere always show up.
    const onFocus = () => { if (document.visibilityState === "visible") void refetch(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const onStorage = (event: StorageEvent) => {
      if (event.key === ORDERS_SYNC_KEY) void refetch();
    };
    window.addEventListener("storage", onStorage);

    // Realtime can arrive late on some browsers/networks. A lightweight
    // foreground poll keeps admin and customer order screens in sync within a
    // few seconds even if a websocket event is delayed or dropped.
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refetch();
    }, 1500);

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, []);


  const value: OrdersCtx = {
    orders,
    refresh,
    place: async (o) => {
      const order: Order = { ...o, id: `OK${Date.now().toString().slice(-6)}`, createdAt: Date.now(), status: "placed" };
      const { data, error } = await supabase.from("app_orders").insert({
        id: order.id,
        customer_phone: order.customerPhone,
        customer_name: order.customerName,
        address: order.address,
        items: order.items,
        subtotal: order.subtotal,
        delivery_fee: order.deliveryFee,
        total: order.total,
        payment_method: order.paymentMethod,
        status: order.status,
        delivery_boy_id: order.deliveryBoyId ?? null,
      }).select("*").single();

      if (error) {
        console.error("Failed to save order", error);
        throw new Error("Order could not be saved. Please try again.");
      }

      const saved = rowToOrder(data as unknown as OrderRow);
      // Add immediately so customer and admin pages update even before the
      // realtime event arrives. The realtime listener will de-duplicate later.
      setOrders(prev => sortOrders([saved, ...prev.filter(o => o.id !== saved.id)]));
      return saved;
    },
    setStatus: async (id, status) => {
      const previous = orders;
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
      const { data, error } = await supabase
        .from("app_orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (error || !data) {
        console.error("Failed to update order status", error);
        setOrders(previous);
        // The server-side transition trigger raises a clear message for invalid
        // jumps (e.g. moving backwards or changing a delivered order). Surface
        // it so admins understand why the change was blocked.
        throw new Error(cleanDbError(error?.message) ?? "Order status could not be updated. Please try again.");
      }


      const saved = rowToOrder(data as unknown as OrderRow);
      setOrders(prev => sortOrders([saved, ...prev.filter(o => o.id !== saved.id)]));
      announceOrdersSync(saved.id, saved.status);
    },
    assign: async (id, deliveryBoyId) => {
      const previous = orders;
      const nextDeliveryBoyId = deliveryBoyId || undefined;
      setOrders(prev => prev.map(o => o.id === id ? { ...o, deliveryBoyId: nextDeliveryBoyId } : o));
      const { data, error } = await supabase
        .from("app_orders")
        .update({ delivery_boy_id: deliveryBoyId || null, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (error || !data) {
        console.error("Failed to assign delivery partner", error);
        setOrders(previous);
        throw new Error("Delivery partner could not be assigned. Please try again.");
      }

      const saved = rowToOrder(data as unknown as OrderRow);
      setOrders(prev => sortOrders([saved, ...prev.filter(o => o.id !== saved.id)]));
      announceOrdersSync(saved.id, saved.status);
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
export type SavedLocation = { query: string; area: string };

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
  addDeliveryAddress: (addr: Omit<DeliveryAddress, "id">) => DeliveryAddress;
  removeDeliveryAddress: (id: string) => void;
  clearLocation: () => void;
};
const LocationContext = createContext<LocationCtx | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLoc] = useState<SavedLocation | null>(null);
  const [savedAddresses, setSaved] = useState<SavedLocation[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLoc(read<SavedLocation | null>("qk_location", null));
    setSaved(read<SavedLocation[]>("qk_addresses", []));
    setReady(true);
  }, []);

  const value: LocationCtx = {
    location,
    savedAddresses,
    ready,
    setLocation: (loc) => {
      setLoc(loc);
      write("qk_location", loc);
      setSaved(prev => {
        const next = [loc, ...prev.filter(a => a.query.toLowerCase() !== loc.query.toLowerCase())].slice(0, 8);
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

