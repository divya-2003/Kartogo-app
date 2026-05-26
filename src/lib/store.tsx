import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { PRODUCTS, DELIVERY_BOYS, type Product } from "./data";

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
type User = { phone: string; name?: string; role: "customer" | "admin" };
export type AdminAuditEntry = { phone: string; at: number };

type AuthCtx = {
  user: User | null;
  sendOtp: (phone: string) => Promise<string>; // returns the otp for demo
  /** Verify OTP for a customer login. Rejects admin allow-listed numbers. */
  verifyOtp: (phone: string, otp: string) => Promise<User>;
  /** Verify OTP for the admin portal. Rejects any phone not on the allow list. */
  verifyAdminOtp: (phone: string, otp: string) => Promise<User>;
  setName: (name: string) => void;
  logout: () => void;
  adminAudit: AdminAuditEntry[];
};
const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [pendingOtp, setPendingOtp] = useState<Record<string, string>>({});
  const [adminAudit, setAdminAudit] = useState<AdminAuditEntry[]>([]);

  useEffect(() => {
    setUser(read<User | null>("qk_user", null));
    setAdminAudit(read<AdminAuditEntry[]>("qk_admin_audit", []));
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
    adminAudit,
    sendOtp: async (phone) => {
      const otp = "1234"; // demo OTP — replace with a real SMS provider via Lovable Cloud later
      setPendingOtp(p => ({ ...p, [phone]: otp }));
      return otp;
    },
    verifyOtp: async (phone, otp) => {
      checkOtp(phone, otp);
      if (isAdminPhone(phone)) {
        // Admin numbers must use the dedicated admin login portal.
        throw new Error("This number is reserved for admin login. Please use the admin portal.");
      }
      const u: User = { phone, role: roleFor(phone) };
      setUser(u);
      setPendingOtp(p => { const { [phone]: _, ...rest } = p; return rest; });
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
      // Audit log — record every successful admin authentication.
      setAdminAudit(prev => [{ phone, at: Date.now() }, ...prev].slice(0, 100));
      return u;
    },
    setName: (name) => setUser(u => u ? { ...u, name } : u),
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
  useEffect(() => { setProducts(read<Product[]>("qk_products", PRODUCTS)); }, []);
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
  place: (o: Omit<Order, "id" | "createdAt" | "status">) => Order;
  setStatus: (id: string, status: OrderStatus) => void;
  assign: (id: string, deliveryBoyId: string) => void;
};
const OrdersContext = createContext<OrdersCtx | null>(null);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => { setOrders(read<Order[]>("qk_orders", [])); }, []);
  useEffect(() => { write("qk_orders", orders); }, [orders]);

  const value: OrdersCtx = {
    orders,
    place: (o) => {
      const order: Order = { ...o, id: `OK${Date.now().toString().slice(-6)}`, createdAt: Date.now(), status: "placed" };
      setOrders(prev => [order, ...prev]);
      return order;
    },
    setStatus: (id, status) => setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o)),
    assign: (id, deliveryBoyId) => setOrders(prev => prev.map(o => o.id === id ? { ...o, deliveryBoyId } : o)),
  };
  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}
export const useOrders = () => {
  const c = useContext(OrdersContext);
  if (!c) throw new Error("OrdersProvider missing");
  return c;
};

export { DELIVERY_BOYS };
