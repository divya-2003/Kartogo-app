import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type DriverRating = {
  id: string;
  orderId: string;
  driverId: string;
  customerPhone: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};

type Row = {
  id: string; order_id: string; driver_id: string; customer_phone: string;
  rating: number; comment: string | null; created_at: string;
};

// Submit / update a driver rating. Customer must own the order.
export const submitDriverRatingFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    customerToken: z.string().min(1),
    orderId: z.string().min(1),
    driverId: z.string().min(1),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(500).optional().nullable(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.customerToken);
    if (!session) throw new Error("Please log in again");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Confirm the order belongs to this customer and was delivered by this driver.
    const { data: order } = await supabaseAdmin
      .from("app_orders").select("id, customer_phone, delivery_boy_id, status")
      .eq("id", data.orderId).maybeSingle();
    if (!order || order.customer_phone !== session.phone) throw new Error("Order not found");
    if (order.delivery_boy_id !== data.driverId) throw new Error("Driver mismatch");

    const { error } = await supabaseAdmin
      .from("driver_ratings")
      .upsert({
        order_id: data.orderId,
        driver_id: data.driverId,
        customer_phone: session.phone,
        rating: data.rating,
        comment: data.comment?.trim() || null,
      }, { onConflict: "order_id" });
    if (error) throw new Error("Could not save rating");
    return { ok: true };
  });

// Fetch existing rating for one order (customer view — used to prefill).
export const getDriverRatingForOrderFn = createServerFn({ method: "POST" })
  .inputValidator((d: { customerToken: string; orderId: string }) => ({
    customerToken: String(d?.customerToken ?? ""),
    orderId: String(d?.orderId ?? ""),
  }))
  .handler(async ({ data }) => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.customerToken);
    if (!session) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("driver_ratings").select("*")
      .eq("order_id", data.orderId).eq("customer_phone", session.phone).maybeSingle();
    if (!row) return null;
    const rating = row as Row;
    return {
      id: rating.id,
      orderId: rating.order_id,
      driverId: rating.driver_id,
      customerPhone: rating.customer_phone,
      rating: rating.rating,
      comment: rating.comment,
      createdAt: rating.created_at,
    } satisfies DriverRating;
  });

// Aggregate for a driver — driver's own portal.
export const getDriverRatingSummaryFn = createServerFn({ method: "POST" })
  .inputValidator((d: { deliveryToken: string }) => ({ deliveryToken: String(d?.deliveryToken ?? "") }))
  .handler(async ({ data }) => {
    const { verifyDeliveryToken } = await import("./auth-tokens.server");
    const s = verifyDeliveryToken(data.deliveryToken);
    if (!s) throw new Error("Please log in again");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("driver_ratings").select("rating, comment, created_at, order_id")
      .eq("driver_id", s.driverId).order("created_at", { ascending: false });
    const list = (rows ?? []) as { rating: number; comment: string | null; created_at: string; order_id: string }[];
    const count = list.length;
    const avg = count ? list.reduce((a, r) => a + r.rating, 0) / count : 0;
    return { count, average: Math.round(avg * 10) / 10, recent: list.slice(0, 10) };
  });
