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
