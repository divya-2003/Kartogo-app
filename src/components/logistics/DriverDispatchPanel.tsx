import { useState } from "react";
import { toast } from "sonner";
import { Bike, Clock, MapPin, Wifi, WifiOff, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDriverLocation } from "@/hooks/use-driver-location";
import { useCountdown, useDriverDispatch } from "@/hooks/use-dispatch";
import { setDriverStatusFn, respondToOfferFn } from "@/lib/logistics.functions";
import { ACCEPT_WINDOW_SECONDS, DRIVER_STATUS_LABEL, type DriverStatus } from "@/lib/logistics/types";
import { formatDistance } from "@/lib/logistics/geo";

type Props = {
  token: string;
  /** Called after the rider accepts so the portal can refresh its order lists. */
  onAssigned?: () => void;
};

/**
 * Rider-side logistics bar: duty toggle, live GPS state and the 20-second
 * acceptance card. Drops into the delivery portal as a single component.
 */
export function DriverDispatchPanel({ token, onAssigned }: Props) {
  const [busy, setBusy] = useState(false);
  const { offer, partner, refresh } = useDriverDispatch(token, true);
  const status: DriverStatus = partner?.status ?? "OFFLINE";
  const online = status !== "OFFLINE";
  const gps = useDriverLocation({ token, enabled: online });
  const secondsLeft = useCountdown(offer?.expiresAt);

  async function changeStatus(next: DriverStatus) {
    setBusy(true);
    try {
      await setDriverStatusFn({ data: { token, status: next } });
      await refresh();
      toast.success(`You're now ${DRIVER_STATUS_LABEL[next].toLowerCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update your duty status");
    } finally {
      setBusy(false);
    }
  }

  async function respond(accept: boolean) {
    if (!offer) return;
    setBusy(true);
    try {
      await respondToOfferFn({ data: { token, orderId: offer.orderId, accept } });
      toast.success(accept ? "Delivery accepted" : "Passed to the next partner");
      await refresh();
      if (accept) onAssigned?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send your response");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          {online ? <Wifi className="h-4 w-4 text-primary" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
          {DRIVER_STATUS_LABEL[status]}
        </span>
        <Badge variant="secondary" className="gap-1">
          <MapPin className="h-3 w-3" />
          {gps.point ? "GPS live" : gps.permission === "denied" ? "GPS off" : "Locating…"}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          {online ? (
            <>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => changeStatus("BREAK")}>
                <Coffee className="mr-1 h-4 w-4" /> Break
              </Button>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => changeStatus("OFFLINE")}>
                Go offline
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={busy} onClick={() => changeStatus("AVAILABLE")}>
              <Bike className="mr-1 h-4 w-4" /> Go online
            </Button>
          )}
        </div>
      </div>

      {gps.error && online && (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{gps.error}</p>
      )}

      {offer && secondsLeft > 0 && (
        <div className="rounded-xl border-2 border-primary bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">New delivery request</p>
            <span className="flex items-center gap-1 text-sm font-bold text-primary">
              <Clock className="h-4 w-4" />
              {secondsLeft}s
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(secondsLeft / ACCEPT_WINDOW_SECONDS) * 100}%` }}
            />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Order</dt>
              <dd className="font-medium">#{offer.orderId.slice(-6)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Items</dt>
              <dd className="font-medium">{offer.itemCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">To pickup</dt>
              <dd className="font-medium">{formatDistance(offer.distanceMeters)}</dd>
            </div>
          </dl>
          {offer.area && <p className="mt-2 text-xs text-muted-foreground">Drop area: {offer.area}</p>}
          <div className="mt-3 flex items-center gap-2">
            <Button className="flex-1" disabled={busy} onClick={() => void respond(true)}>
              Accept
            </Button>
            <Button className="flex-1" variant="outline" disabled={busy} onClick={() => void respond(false)}>
              Pass
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
