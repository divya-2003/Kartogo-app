import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { evaluateServiceability } from "./serviceability";
import { applyDeliveryZones } from "./delivery-zones";

const inputSchema = z.object({
  location: z.string().min(1).max(200),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

/**
 * Backend serviceability check. The user types their location freely; the
 * server decides whether it falls inside the delivery zone, then applies the
 * admin's per-area Quick switch and delivery time.
 */
export const checkServiceability = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { loadDeliveryZones } = await import("./delivery-zones.server");
    const zones = await loadDeliveryZones();
    const coords = data.lat != null && data.lng != null ? { lat: data.lat, lng: data.lng } : null;
    return applyDeliveryZones(evaluateServiceability(data.location), zones, data.location, coords);
  });

const coordsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Reverse-geocodes the user's GPS coordinates into a readable address using
 * OpenStreetMap's Nominatim service, then runs the same serviceability rules
 * plus the admin's map-point delivery areas.
 */
export const locateByCoords = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => coordsSchema.parse(data))
  .handler(async ({ data }) => {
    const { loadDeliveryZones } = await import("./delivery-zones.server");
    const zones = await loadDeliveryZones();
    const coords = { lat: data.lat, lng: data.lng };
    let address = "";
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${data.lat}&lon=${data.lng}&zoom=16&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Kartogo/1.0 (delivery serviceability check)",
          "Accept-Language": "en",
        },
      });
      if (res.ok) {
        const json = (await res.json()) as {
          display_name?: string;
          address?: Record<string, string>;
        };
        const a = json.address ?? {};
        const parts = [
          a.suburb,
          a.neighbourhood,
          a.village,
          a.town,
          a.city,
          a.county,
          a.state,
          a.postcode,
        ].filter(Boolean);
        address = parts.join(", ") || json.display_name || "";
      }
    } catch {
      address = "";
    }
    const result = applyDeliveryZones(evaluateServiceability(address), zones, address, coords);
    return { address: address || null, ...result, lat: data.lat, lng: data.lng };
  });
