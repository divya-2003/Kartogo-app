import { useCallback, useEffect, useRef, useState } from "react";
import { GPS_INTERVAL_MS, GPS_MIN_MOVE_METERS, type DriverStatus, type GeoPoint } from "@/lib/logistics/types";
import { haversineMeters } from "@/lib/logistics/geo";
import { pingDriverLocationFn } from "@/lib/logistics.functions";

type Options = {
  token: string | null;
  /** Tracking only runs while the rider is online. */
  enabled: boolean;
};

export type DriverLocationState = {
  point: GeoPoint | null;
  error: string | null;
  permission: "unknown" | "granted" | "denied" | "unsupported";
  lastSentAt: number | null;
};

/**
 * Phase 2 — the rider's GPS heartbeat.
 *
 * Watches the device position, samples it every 10 s and only calls the server
 * when the rider actually moved 10 m or more. All failures are surfaced as
 * state rather than thrown, so a denied permission never breaks the portal.
 */
export function useDriverLocation({ token, enabled }: Options): DriverLocationState {
  const [state, setState] = useState<DriverLocationState>({
    point: null,
    error: null,
    permission: "unknown",
    lastSentAt: null,
  });
  const latest = useRef<GeolocationPosition | null>(null);
  const lastSent = useRef<GeoPoint | null>(null);

  useEffect(() => {
    if (!enabled || !token) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((s) => ({ ...s, permission: "unsupported" }));
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        latest.current = pos;
        setState((s) => ({
          ...s,
          permission: "granted",
          error: null,
          point: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        }));
      },
      (err) => {
        setState((s) => ({
          ...s,
          permission: err.code === err.PERMISSION_DENIED ? "denied" : s.permission,
          // Phase 9: we keep the last known point and keep going.
          error: err.code === err.PERMISSION_DENIED
            ? "Location permission is off — customers can't see you live."
            : "GPS signal is weak. Using your last known location.",
        }));
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );

    const timer = setInterval(async () => {
      const pos = latest.current;
      if (!pos) return;
      const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (lastSent.current && haversineMeters(lastSent.current, point) < GPS_MIN_MOVE_METERS) return;
      try {
        const res = await pingDriverLocationFn({
          data: {
            token,
            lat: point.lat,
            lng: point.lng,
            accuracy: pos.coords.accuracy ?? undefined,
            speed: pos.coords.speed ?? undefined,
            heading: pos.coords.heading ?? undefined,
          },
        });
        if (res?.accepted) {
          lastSent.current = point;
          setState((s) => ({ ...s, lastSentAt: Date.now() }));
        }
      } catch {
        // Offline / flaky network — the next tick retries.
      }
    }, GPS_INTERVAL_MS);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(timer);
    };
  }, [enabled, token]);

  return state;
}

/** Small helper so screens can ask for a one-shot fix (e.g. before going online). */
export function useOneShotLocation() {
  return useCallback(
    () =>
      new Promise<GeoPoint | null>((resolve) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 10_000 },
        );
      }),
    [],
  );
}

export const isBusyStatus = (s: DriverStatus) =>
  s === "ASSIGNED" || s === "PICKING_ORDER" || s === "EN_ROUTE";
