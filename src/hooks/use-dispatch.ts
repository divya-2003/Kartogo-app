import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDriverDispatchFn, trackOrderFn } from "@/lib/logistics.functions";
import type { TrackingSnapshot } from "@/lib/logistics/types";

type Offer = Awaited<ReturnType<typeof getDriverDispatchFn>>["offer"];
type Partner = Awaited<ReturnType<typeof getDriverDispatchFn>>["partner"];

/**
 * Phases 3+4 — the rider's live offer feed.
 *
 * Realtime pushes the offer the instant dispatch writes it; a slow poll runs
 * alongside as a safety net (offers expire on a 20 s clock, so a missed
 * websocket frame must never cost a delivery).
 */
export function useDriverDispatch(token: string | null, enabled: boolean) {
  const [offer, setOffer] = useState<Offer>(null);
  const [partner, setPartner] = useState<Partner>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!token || inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await getDriverDispatchFn({ data: { token } });
      setOffer(res.offer);
      setPartner(res.partner);
    } catch {
      // Transient — the next tick retries.
    } finally {
      inFlight.current = false;
    }
  }, [token]);

  useEffect(() => {
    if (!token || !enabled) return;
    void refresh();
    const timer = setInterval(refresh, 8_000);
    const channel = supabase
      .channel("dispatch-offers")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_assignments" }, () => {
        void refresh();
      })
      .subscribe();
    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [token, enabled, refresh]);

  return { offer, partner, refresh };
}

/** Countdown (seconds) to an ISO deadline; clamps at zero. */
export function useCountdown(deadline: string | null | undefined) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!deadline) return setLeft(0);
    const tick = () =>
      setLeft(Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [deadline]);
  return left;
}

/** Phase 5 — customer-side live tracking of one order. */
export function useOrderTracking(token: string | null, orderId: string | null, enabled = true) {
  const [snapshot, setSnapshot] = useState<TrackingSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token || !orderId) return;
    try {
      setSnapshot(await trackOrderFn({ data: { token, orderId } }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Live tracking is unavailable right now.");
    }
  }, [token, orderId]);

  useEffect(() => {
    if (!enabled || !token || !orderId) return;
    void refresh();
    const timer = setInterval(refresh, 10_000);
    return () => clearInterval(timer);
  }, [enabled, token, orderId, refresh]);

  return { snapshot, error, refresh };
}
