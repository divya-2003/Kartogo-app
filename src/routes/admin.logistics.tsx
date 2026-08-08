import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bike, MapPin, RefreshCw, Timer, Truck, UserCheck, UserX, PackageSearch } from "lucide-react";
import { useAuth } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLogisticsDashboardFn } from "@/lib/logistics.functions";
import { DRIVER_STATUS_LABEL, VEHICLE_LABEL, type LogisticsDashboard } from "@/lib/logistics/types";
import { mapLink } from "@/lib/logistics/geo";

export const Route = createFileRoute("/admin/logistics")({
  component: LogisticsControlTower,
  head: () => ({
    meta: [
      { title: "Live delivery control tower | Kartogo admin" },
      {
        name: "description",
        content:
          "Track online riders, live GPS positions, orders waiting for a delivery partner and today's delivery performance across Kartogo.",
      },
      { property: "og:title", content: "Live delivery control tower | Kartogo admin" },
      {
        property: "og:description",
        content: "Real-time rider status, dispatch queue and delivery performance for Kartogo operations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Bike }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function LogisticsControlTower() {
  const { adminToken } = useAuth();
  const [data, setData] = useState<LogisticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!adminToken) return;
    try {
      setData(await getLogisticsDashboardFn({ data: { adminToken } }));
      setSyncedAt(Date.now());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load the control tower");
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10_000);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Live delivery control tower</h1>
          <p className="text-sm text-muted-foreground">
            {syncedAt ? `Updated ${new Date(syncedAt).toLocaleTimeString()}` : "Connecting…"}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-1 h-4 w-4" /> Refresh
        </Button>
      </header>

      {loading && !data ? (
        <p className="text-sm text-muted-foreground">Loading live operations…</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">No logistics data yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Online riders" value={data.onlineDrivers} icon={UserCheck} />
            <Stat label="Busy riders" value={data.busyDrivers} icon={Truck} />
            <Stat label="Offline riders" value={data.offlineDrivers} icon={UserX} />
            <Stat label="Waiting for driver" value={data.ordersWaitingForDriver} icon={PackageSearch} />
            <Stat label="In delivery" value={data.ordersInDelivery} icon={Bike} />
            <Stat label="Delivered today" value={data.deliveredToday} icon={UserCheck} />
            <Stat
              label="Avg delivery time"
              value={data.averageDeliveryMinutes != null ? `${data.averageDeliveryMinutes} min` : "—"}
              icon={Timer}
            />
          </div>

          <section className="rounded-xl border border-border bg-card">
            <h2 className="border-b border-border px-3 py-2 text-sm font-semibold">Rider positions</h2>
            {data.partners.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                No riders have come online yet. Partners appear here the moment they go on duty.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {data.partners.map((p) => (
                  <li key={p.driverId} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {VEHICLE_LABEL[p.vehicleType] ?? p.vehicleType} · {p.completedOrders} deliveries
                        {p.activeOrderId ? ` · on #${p.activeOrderId.slice(-6)}` : ""}
                      </p>
                    </div>
                    <Badge variant={p.online ? "secondary" : "outline"}>{DRIVER_STATUS_LABEL[p.status]}</Badge>
                    {p.location ? (
                      <a
                        href={mapLink(p.location)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium"
                      >
                        <MapPin className="h-3.5 w-3.5" /> Map
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">No GPS</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
