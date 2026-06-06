import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { evaluateServiceability } from "./serviceability";

const inputSchema = z.object({
  location: z.string().min(1).max(200),
});

/**
 * Backend serviceability check. The user types their location freely; the
 * server decides whether it falls inside the dark store's delivery zone.
 */
export const checkServiceability = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    return evaluateServiceability(data.location);
  });

const coordsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Reverse-geocodes the user's GPS coordinates into a readable address using
 * OpenStreetMap's Nominatim service, then runs the same serviceability rules.
 */
export const locateByCoords = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => coordsSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${data.lat}&lon=${data.lng}&zoom=16&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Kartigo/1.0 (delivery serviceability check)",
          "Accept-Language": "en",
        },
      });
      if (!res.ok) {
        return { address: null, ...evaluateServiceability("") };
      }
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
      const address = parts.join(", ") || json.display_name || "";
      return { address, ...evaluateServiceability(address) };
    } catch {
      return { address: null, ...evaluateServiceability("") };
    }
  });
