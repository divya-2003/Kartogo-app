import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const finishTripStopFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10), tripId: z.string().uuid(), index: z.number().int().min(0).max(8) }).parse(d))
  .handler(async ({ data }) => {
    const { verifyDeliveryToken } = await import("../auth-tokens.server");
    const session = verifyDeliveryToken(data.token);
    if (!session) throw new Error("Please log in again");
    const { assertDriverActive } = await import("../driver-access.server");
    await assertDriverActive(session.driverId);
    const { finishStop } = await import("./trips.server");
    return finishStop(session.driverId, data.tripId, data.index);
  });