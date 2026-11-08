import { useEffect } from "react";
import { customerEventService } from "@/lib/recommendations.tracking";
import { isPortalPath } from "@/lib/portal-mode";
import { clickLabel } from "@/lib/customer-activity";

/**
 * Records every button / link tap on customer pages so the admin "Customers"
 * section can show what each shopper clicked. Portal pages are never tracked,
 * and only the visible button text (digits masked) is stored.
 */
export function CustomerClickTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const path = window.location.pathname;
      if (isPortalPath(path)) return;
      const el = (e.target as Element | null)?.closest?.("a,button,[role=button],[role=tab],[role=checkbox],summary");
      if (!el || el.closest("[data-no-track]")) return;
      const raw = el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.getAttribute("title") || "";
      const label = clickLabel(raw);
      let target: string | undefined;
      if (el instanceof HTMLAnchorElement && el.href) {
        try { const u = new URL(el.href); if (u.origin === window.location.origin) target = u.pathname.slice(0, 120); } catch { /* ignore */ }
      }
      if (!label && !target) return;
      const productId = target?.match(/^\/product\/([^/]+)$/)?.[1];
      customerEventService.trackClick(label || "(icon)", path.slice(0, 120), target, productId ? decodeURIComponent(productId).slice(0, 64) : undefined);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
