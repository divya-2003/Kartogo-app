import { useEffect, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { enterCustomerMode as markCustomerMode, leaveCustomerMode } from "@/lib/portal-mode";

/** Marks this app run as "shopping as a customer" so Home doesn't bounce back to the portal. */
export function enterCustomerMode() {
  markCustomerMode();
  try { sessionStorage.setItem("qk_home_section", "shop"); } catch { /* unavailable */ }
}

/** Clears customer mode when a partner returns to their own portal. */
export function useLeaveCustomerMode() {
  useEffect(() => { leaveCustomerMode(); }, []);
}

/**
 * Three-line menu button for partner portals (seller, delivery). The side menu
 * holds only the portal's own pages.
 */
export function PartnerMenu({ title, children, closeKey }: { title: string; children: (close: () => void) => ReactNode; closeKey?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [closeKey]);
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-card hover:bg-secondary"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="truncate text-left font-display text-base font-bold">{title}</SheetTitle>
        </SheetHeader>
        <div className="max-h-[calc(100dvh-5rem)] space-y-5 overflow-y-auto p-3">
          <div>{children(close)}</div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
