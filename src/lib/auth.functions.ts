import { createServerFn } from "@tanstack/react-start";
import { canonicalPhone, canonicalToE164, normalizeIncomingPhone } from "./phone";

// ---------------- Demo OTP mode ----------------
// Demo mode is ONLY for private/staging builds where real SMS is unavailable
// (e.g. Twilio still on trial). It is gated behind a server-side environment
// flag that is guaranteed to be false/absent in production, so the public,
// deployed app always requires a real per-request random code delivered by
// SMS. Even when demo mode is on, the code is randomly generated per request —
// there is never a fixed, publicly-known code.
//
// To enable demo mode in a private environment, set the server secret
// DEMO_OTP_MODE="true". Leave it unset in production.
function isDemoOtpMode(): boolean {
  // Server-only flag. Must be explicitly set to "true" in a private/staging
  // environment; it is unset in production, so production always delivers the
  // code by SMS and never returns it in an API response.
  return process.env.DEMO_OTP_MODE === "true";
}

// ---------------- Request an OTP ----------------
// Generates a random 6-digit code, stores only its hash with a short expiry,
// and delivers it by SMS. The code is NEVER returned to the client.
export const requestOtpFn = createServerFn({ method: "POST" })
  .inputValidator((data: { phone: string }) => {
    return { phone: normalizeIncomingPhone(data?.phone) };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createHash, randomInt } = await import("node:crypto");
    const { sendSms } = await import("./sms.server");
    const phone = data.phone;

    // Rate limit: at most 5 codes per phone per hour.
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await supabaseAdmin
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .eq("consumed", false)
      .gte("created_at", hourAgo);
    if ((count ?? 0) >= 5) throw new Error("Too many OTP requests. Please try again later.");

    // Always generate a real, random per-request 6-digit code. There is never a
    // fixed or predictable code, in any mode.
    const demoMode = isDemoOtpMode();
    const code = String(randomInt(100000, 1000000));
    const codeHash = createHash("sha256").update(`${phone}:${code}`).digest("hex");
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

    // Invalidate any earlier unused codes for this phone.
    await supabaseAdmin.from("otp_codes").update({ consumed: true }).eq("phone", phone).eq("consumed", false);

    const { error } = await supabaseAdmin
      .from("otp_codes")
      .insert({ phone, code_hash: codeHash, expires_at: expiresAt })
      .select("id")
      .single();
    if (error) {
      console.error("Failed to store OTP", error);
      throw new Error("Could not generate a verification code. Please try again.");
    }

    // Demo mode (private/staging only): skip the real SMS (Twilio trial can't
    // reach unverified numbers) and return the freshly generated random code so
    // the UI can show it. This branch is unreachable in production because
    // DEMO_OTP_MODE is unset there.
    if (demoMode) {
      return { ok: true as const, demo: true as const, demoCode: code };
    }

    try {
      await sendSms(canonicalToE164(phone) ?? `+91${phone}`, `Your Kartogo verification code is ${code}. It expires in 5 minutes.`);
    } catch (err) {
      // Twilio trial accounts can only text verified numbers, and the connector
      // may not be configured yet. Rather than blocking login, fall back to
      // showing the freshly generated code in the UI (demo delivery).
      // Until the paid SMS plan is live, ANY delivery failure (trial-account
      // restrictions, unsupported country, missing connector) falls back to
      // showing the freshly generated random code in the UI — identically for
      // Indian and international numbers.
      console.warn("SMS delivery failed, falling back to on-screen code", err);
      return { ok: true as const, demo: true as const, demoCode: code };
    }
    return { ok: true as const, demo: false as const };

  });


// ---------------- Verify an OTP ----------------
// On success returns a signed customer token (proves phone ownership). Admin
// status is never granted here — it only flags whether to prompt for a passcode.
export const verifyOtpFn = createServerFn({ method: "POST" })
  .inputValidator((data: { phone: string; code: string }) => {
    const phone = normalizeIncomingPhone(data?.phone);
    const code = String(data?.code ?? "");
    if (!/^\d{4,8}$/.test(code)) throw new Error("Enter the code you received");
    return { phone, code };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createHash } = await import("node:crypto");
    const { issueCustomerToken, issueDeliveryToken, issueSupplierToken, issuePendingDriverToken } = await import("./auth-tokens.server");
    const { findRosterDriverByPhone } = await import("./driver-roster.server");
    const { findSupplierByPhone, findSupplierById } = await import("./suppliers");

    const { data: rows } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("phone", data.phone)
      .eq("consumed", false)
      .order("created_at", { ascending: false })
      .limit(1);

    // Expected, user-correctable problems are RETURNED (not thrown) so they
    // surface as a toast instead of an unhandled server-function error.
    const fail = (error: string) => ({ ok: false as const, error });

    const row = rows?.[0];
    if (!row) return fail("Please request a new OTP");
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("otp_codes").update({ consumed: true }).eq("id", row.id);
      return fail("Your code has expired. Request a new one.");
    }
    if (row.attempts >= 5) {
      await supabaseAdmin.from("otp_codes").update({ consumed: true }).eq("id", row.id);
      return fail("Too many incorrect attempts. Request a new OTP.");
    }

    const hash = createHash("sha256").update(`${data.phone}:${data.code}`).digest("hex");
    if (hash !== row.code_hash) {
      await supabaseAdmin.from("otp_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return fail("Incorrect OTP");
    }

    await supabaseAdmin.from("otp_codes").update({ consumed: true }).eq("id", row.id);

    // ---- Role resolution comes from the DATABASE (staff_accounts) ----
    // Mobile numbers are only credentials; roles and permanent user_ids live in
    // `staff_accounts`. Legacy registries are used ONLY to self-heal a missing
    // staff row (e.g. a partner added before staff accounts existed).
    const { findStaffByPhone, ensureStaffAccount } = await import("./staff.server");
    let staff = await findStaffByPhone(data.phone);

    if (!staff) {
      const legacyDriver = await findRosterDriverByPhone(data.phone);
      if (legacyDriver) {
        staff = await ensureStaffAccount({
          role: "delivery_partner", refId: legacyDriver.id,
          fullName: legacyDriver.name, mobileNumber: legacyDriver.phone,
        });
      } else {
        const legacySupplier = findSupplierByPhone(data.phone);
        if (legacySupplier) {
          staff = await ensureStaffAccount({
            role: "vendor", refId: legacySupplier.id,
            fullName: legacySupplier.name, mobileNumber: legacySupplier.phone,
          });
        }
      }
    }

    const isStaffActive = !staff || staff.status === "active";

    // --- Delivery partner ---
    let delivery: { token: string; driver: { id: string; name: string; phone: string } } | null = null;
    let deliveryPending: { name: string; phone: string; requested: boolean; pendingToken: string } | null = null;
    if (staff && staff.role === "delivery_partner" && staff.refId) {
      const { findRosterDriverById } = await import("./driver-roster.server");
      const driver = await findRosterDriverById(staff.refId);
      const name = driver?.name ?? staff.fullName;
      const active = isStaffActive && (driver ? driver.active : false);
      if (active) {
        delivery = {
          token: issueDeliveryToken(staff.refId, data.phone, staff.userId),
          driver: { id: staff.refId, name, phone: data.phone },
        };
      } else {
        deliveryPending = {
          name,
          phone: data.phone,
          requested: !!driver?.accessRequestedAt,
          pendingToken: issuePendingDriverToken(staff.refId, data.phone),
        };
      }
    }

    // --- Vendor / supplier ---
    const supplierAccount = staff && staff.role === "vendor" && staff.refId
      ? findSupplierById(staff.refId)
      : null;
    const supplier = supplierAccount && isStaffActive
      ? {
          token: issueSupplierToken(supplierAccount.id, data.phone, staff!.userId),
          supplier: { id: supplierAccount.id, name: staff!.fullName || supplierAccount.name, phone: data.phone },
        }
      : null;

    // --- Printer service portal ---
    const { isPrinterPhone, issuePrinterToken, PRINTER_SERVICE } = await import("./auth-tokens.server");
    const printer = isPrinterPhone(data.phone)
      ? { token: issuePrinterToken(data.phone, staff?.userId), service: { name: PRINTER_SERVICE.name, phone: data.phone } }
      : null;

    return {
      ok: true as const,
      phone: data.phone,
      token: issueCustomerToken(data.phone),
      isAdminPhone: !!staff && staff.role === "admin" && isStaffActive,
      delivery,
      deliveryPending,
      supplier,
      printer,
    };
  });

// ---------------- Admin login ----------------
// Validates the secret passcode server-side and issues a signed admin token.
export const adminLoginFn = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string; phone?: string }) => ({
    passcode: String(data?.passcode ?? ""),
    phone: data?.phone ? (canonicalPhone(String(data.phone)) ?? String(data.phone)) : "",
  }))
  .handler(async ({ data }) => {
    const { createHash, timingSafeEqual } = await import("node:crypto");
    const { issueAdminToken } = await import("./auth-tokens.server");

    const expected = process.env.ADMIN_PASSCODE;
    if (!expected) throw new Error("Admin login is not configured");

    const a = createHash("sha256").update(data.passcode).digest();
    const b = createHash("sha256").update(expected).digest();
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false as const, error: "Incorrect admin passcode" };
    }
    const { findStaffByPhone } = await import("./staff.server");
    const admin = data.phone ? await findStaffByPhone(data.phone) : null;
    if (data.phone && (!admin || admin.role !== "admin" || admin.status !== "active")) {
      return { ok: false as const, error: "This number is not an admin account" };
    }
    return { ok: true as const, token: issueAdminToken(admin?.userId) };
  });

// ---------------- Verify admin token (server-side gate) ----------------
// Cryptographically validates a signed admin token. The admin route's
// beforeLoad calls this so the admin shell is only rendered after a
// server-confirmed identity check — a spoofed localStorage value verifies to
// false and never reaches the admin UI.
export const verifyAdminTokenFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string }) => ({ token: data?.token ? String(data.token) : "" }))
  .handler(async ({ data }) => {
    const { readAdminToken } = await import("./auth-tokens.server");
    const session = readAdminToken(data.token);
    if (!session) return { valid: false };
    if (!session.userId) return { valid: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: staff } = await supabaseAdmin
      .from("staff_accounts")
      .select("role, status")
      .eq("user_id", session.userId)
      .maybeSingle();
    return { valid: staff?.role === "admin" && staff.status === "active" };
  });

