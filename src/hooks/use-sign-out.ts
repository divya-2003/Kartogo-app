import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/store";
import { enterCustomerMode } from "@/lib/portal-mode";

/**
 * One sign-out for every page and portal: clears every session on this
 * device (customer, admin, seller, delivery, printer, kitchen), empties the
 * cart and wishlist shown here (the account's own cart stays saved), and opens
 * the signed-out Home page a new visitor sees.
 */
export function useSignOut() {
  const { logout } = useAuth();
  const nav = useNavigate();
  return useCallback(() => {
    logout();
    try { sessionStorage.setItem("qk_home_section", "shop"); } catch { /* unavailable */ }
    enterCustomerMode();
    toast.success("Signed out");
    void nav({ to: "/", replace: true });
  }, [logout, nav]);
}
