import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/store";
import { createStockAlertFn } from "@/lib/stock-alerts.functions";

export const RESTOCK_THANKS = "Thank you. We will notify you once the product is available";

/**
 * "Notify me" for a sold-out product on its own page: raises the restock
 * request and opens a dark confirmation bar just above the button.
 */
export function useRestockNotify(product: { id: string; name: string; category?: string; returnTo: string }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const show = () => {
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 4000);
  };

  const notify = async () => {
    if (!user) {
      toast.info("Login to receive a back-in-stock alert");
      nav({ to: "/login", search: { redirect: product.returnTo } });
      return;
    }
    if (done) { show(); return; }
    setBusy(true);
    try {
      await createStockAlertFn({ data: {
        productId: product.id,
        productName: product.name,
        category: product.category ?? "",
        customerPhone: user.phone ?? null,
        customerName: user.name ?? null,
      } });
      setDone(true);
      show();
    } catch {
      toast.error("Couldn't register your request. Please try again.");
    } finally { setBusy(false); }
  };

  return { notify, busy, done, open };
}

/** Dark confirmation bar shown after tapping "Notify me". */
export function RestockSnackbar({ open, className = "" }: { open: boolean; className?: string }) {
  if (!open) return null;
  return (
    <div role="status" aria-live="polite" className={`z-50 rounded-lg bg-foreground px-4 py-3.5 text-[15px] font-medium leading-snug text-background shadow-pop animate-in fade-in slide-in-from-bottom-2 ${className}`}>
      {RESTOCK_THANKS}
    </div>
  );
}
