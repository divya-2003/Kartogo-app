// Server-only: booking push notifications shared by customer, partner and admin booking flows.

/**
 * Booking push notifications (best-effort, never blocks the booking flow).
 * Customers hear about placed / confirmed / cancelled bookings; the partner
 * hears about new bookings and customer cancellations.
 */
export async function pushBookingEvent(
  bookingId: string,
  event: "placed" | "confirmed" | "cancelled" | "cancelled_by_customer",
  known?: { phone: string; partnerId: string; listingName: string; code: string },
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = supabaseAdmin as unknown as { from: (t: string) => any };
    let info = known;
    if (!info) {
      const { data: b } = await s.from("mp_bookings").select("customer_phone,partner_id,booking_code,listing:mp_listings(name)").eq("id", bookingId).maybeSingle();
      if (!b) return;
      info = { phone: String(b.customer_phone ?? ""), partnerId: String(b.partner_id ?? ""), listingName: String(b.listing?.name ?? "your booking"), code: String(b.booking_code ?? "") };
    }
    const { safePush } = await import("./push.server");
    const ref = info.code ? ` (${info.code})` : "";
    if (info.phone) {
      if (event === "placed") await safePush({ phone: info.phone, type: "BOOKING_PLACED", orderId: bookingId, body: `${info.listingName}${ref} is booked. We'll let you know once it's confirmed.` });
      if (event === "confirmed") await safePush({ phone: info.phone, type: "BOOKING_CONFIRMED", orderId: bookingId, body: `${info.listingName}${ref} is confirmed.` });
      if (event === "cancelled" || event === "cancelled_by_customer") await safePush({ phone: info.phone, type: "BOOKING_CANCELLED", orderId: bookingId, body: `${info.listingName}${ref} has been cancelled.` });
    }
    if (event === "placed" || event === "cancelled_by_customer") {
      const { data: partner } = await s.from("mp_partners").select("supplier_phone").eq("id", info.partnerId).maybeSingle();
      const partnerPhone = partner?.supplier_phone ? String(partner.supplier_phone) : "";
      if (partnerPhone && partnerPhone !== info.phone) {
        await safePush({
          phone: partnerPhone,
          type: event === "placed" ? "PARTNER_NEW_BOOKING" : "PARTNER_BOOKING_CANCELLED",
          orderId: bookingId,
          body: event === "placed" ? `New booking for ${info.listingName}${ref}. Open your bookings to confirm it.` : `The customer cancelled ${info.listingName}${ref}.`,
        });
      }
    }
  } catch (e) {
    console.error("booking push failed", e);
  }
}
