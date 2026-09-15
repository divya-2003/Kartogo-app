export const ADMIN_FEATURES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "inventory", label: "Inventory" },
  { key: "warehouse", label: "Warehouse (WIMS)" },
  { key: "ai", label: "AI tools" },
  { key: "alerts", label: "Alerts" },
  { key: "notifications", label: "Push notifications" },
  { key: "orders", label: "Orders & cancellations" },
  { key: "refunds", label: "Refund requests" },
  { key: "feedback", label: "Customer feedback" },
  { key: "delivery", label: "Delivery partners" },
  { key: "logistics", label: "Live logistics" },
  { key: "print", label: "Print queue" },
  { key: "partners", label: "Partner markets" },
  { key: "combos", label: "Combo bundles" },
  { key: "promos", label: "Promo codes & surge" },
  { key: "requests", label: "Customer requests" },
  { key: "sales", label: "Sales dataset" },
  { key: "reports", label: "Business reports" },
  { key: "recommendations", label: "Recommendations" },
  { key: "sub_admins", label: "Sub-admins" },
  { key: "account", label: "Account" },
] as const;

export type AdminPermission = (typeof ADMIN_FEATURES)[number]["key"];

export function permissionForAdminPath(path: string): AdminPermission {
  if (path === "/admin") return "dashboard";
  if (path.startsWith("/admin/inventory")) return "inventory";
  if (path.startsWith("/admin/wims")) return "warehouse";
  if (path.startsWith("/admin/ai")) return "ai";
  if (path.startsWith("/admin/alerts") || path.startsWith("/admin/stock-alerts")) return "alerts";
  if (path.startsWith("/admin/notifications")) return "notifications";
  if (path.startsWith("/admin/orders") || path.startsWith("/admin/cancellations")) return "orders";
  if (path.startsWith("/admin/refund-requests")) return "refunds";
  if (path.startsWith("/admin/feedback")) return "feedback";
  if (path.startsWith("/admin/delivery")) return "delivery";
  if (path.startsWith("/admin/logistics")) return "logistics";
  if (path.startsWith("/admin/print")) return "print";
  if (path.startsWith("/admin/partners")) return "partners";
  if (path.startsWith("/admin/combos")) return "combos";
  if (path.startsWith("/admin/promos") || path.startsWith("/admin/surge")) return "promos";
  if (path.startsWith("/admin/unserviceable")) return "requests";
  if (path.startsWith("/admin/sales")) return "sales";
  if (path.startsWith("/admin/reports-")) return "reports";
  if (path.startsWith("/admin/recommendations")) return "recommendations";
  if (path.startsWith("/admin/sub-admins") || path.startsWith("/admin/portals")) return "sub_admins";
  return "account";
}