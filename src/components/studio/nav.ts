import { BarChart3, Bell, Boxes, Building2, CalendarDays, Clock, Contact, LayoutDashboard, MessageSquare, Settings, Sparkles, Star, UsersRound, type LucideIcon } from "lucide-react";
import type { StudioPage } from "@/lib/studio";

export const STUDIO_NAV: Record<StudioPage, { to: string; label: string; icon: LucideIcon }> = {
  overview: { to: "/supplier/studio", label: "Overview", icon: LayoutDashboard },
  inventory: { to: "/supplier/studio/inventory", label: "Inventory", icon: Boxes },
  services: { to: "/supplier/studio/services", label: "My Services", icon: Sparkles },
  appointments: { to: "/supplier/studio/appointments", label: "Appointments", icon: CalendarDays },
  availability: { to: "/supplier/studio/availability", label: "Availability", icon: Clock },
  enquiries: { to: "/supplier/studio/enquiries", label: "Customer Enquiries", icon: MessageSquare },
  professionals: { to: "/supplier/studio/professionals", label: "Professionals", icon: UsersRound },
  customers: { to: "/supplier/studio/customers", label: "Customers", icon: Contact },
  notifications: { to: "/supplier/studio/notifications", label: "Notifications", icon: Bell },
  reviews: { to: "/supplier/studio/reviews", label: "Reviews", icon: Star },
  reports: { to: "/supplier/studio/reports", label: "Reports", icon: BarChart3 },
  profile: { to: "/supplier/studio/profile", label: "Business Profile", icon: Building2 },
  settings: { to: "/supplier/studio/settings", label: "Settings", icon: Settings },
};

export function pageForPath(path: string): StudioPage {
  const seg = path.replace(/\/+$/, "").split("/")[3] ?? "";
  return (seg && seg in STUDIO_NAV ? seg : "overview") as StudioPage;
}
