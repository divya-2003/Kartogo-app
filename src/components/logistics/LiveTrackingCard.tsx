import { Bike, MapPin, Navigation, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useOrderTracking } from "@/hooks/use-dispatch";
import { CUSTOMER_TRACK_LABEL, CUSTOMER_TRACK_STAGES, VEHICLE_LABEL } from "@/lib/logistics/types";
import { formatDistance, formatEta, mapLink } from "@/lib/logistics/geo";

type Props = { token: string | null; orderId: string; compact?: boolean };

/**
 * Phase 5 — what the customer sees while their order is on the move:
 * partner name, vehicle, live map link, ETA and the delivery stage.
 */
export function LiveTrackingCard({ token, orderId, compact }: Props) {
  const { snapshot, error } = useOrderTracking(token, orderId);
  if (!token || error || !snapshot) return null;
  if (snapshot.stage === "delivered") return null;

  const stageIndex = CUSTOMER_TRACK_STAGES.indexOf(snapshot.stage);
  const live = snapshot.driver?.location;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{CUSTOMER_TRACK_LABEL[snapshot.stage]}</p>
        {snapshot.etaMinutes != null && (
          <Badge variant="secondary">Arriving in {formatEta(snapshot.etaMinutes)}</Badge>
        )}
      </div>

      <div className="mt-2 flex gap-1" aria-hidden="true">
        {CUSTOMER_TRACK_STAGES.map((s, i) => (
          <span
            key={s}
            className={`h-1.5 flex-1 rounded-full ${i <= stageIndex ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>

      {snapshot.driver && (
        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <Bike className="h-4 w-4 text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{snapshot.driver.name}</p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              {VEHICLE_LABEL[snapshot.driver.vehicleType] ?? snapshot.driver.vehicleType}
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-current" />
                {snapshot.driver.rating.toFixed(1)}
              </span>
            </p>
          </div>
          {live && (
            <a
              href={mapLink(live)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium"
            >
              <Navigation className="h-3.5 w-3.5" /> Live map
            </a>
          )}
        </div>
      )}

      {!compact && snapshot.route && (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {formatDistance(snapshot.route.distanceMeters)} away
          {snapshot.route.source === "estimate" ? " (estimated)" : ""}
        </p>
      )}
    </div>
  );
}
