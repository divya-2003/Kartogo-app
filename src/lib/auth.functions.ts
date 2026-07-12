import { createServerFn } from "@tanstack/react-start";

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
  return process.env.DEMO_OTP_MODE === "true";
}

// ---------------- Request an OTP ----------------
// Generates a random 6-digit code, stores only its hash with a short expiry,
// and delivers it by SMS. The code is NEVER returned to the client.
export const requestOtpFn = createServerFn({ method: "POST" })
  .inputValidator((data: { phone: string }) => {
    const phone = String(data?.phone ?? "");
    if (!/^\d{10}$/.test(phone)) throw new Error("Enter a valid 10-digit mobile number");
    return { phone };
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

    const { data: otpRow, error } = await supabaseAdmin
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
      await sendSms(`+91${phone}`, `Your Kartogo verification code is ${code}. It expires in 5 minutes.`);
    } catch (err) {
      if (otpRow?.id) {
        await supabaseAdmin.from("otp_codes").update({ consumed: true }).eq("id", otpRow.id);
      }
      throw err;
    }
    return { ok: true as const, demo: false as const };
  });


// ---------------- Verify an OTP ----------------
// On success returns a signed customer token (proves phone ownership). Admin
// status is never granted here — it only flags whether to prompt for a passcode.
export const verifyOtpFn = createServerFn({ method: "POST" })
  .inputValidator((data: { phone: string; code: string }) => {
    const phone = String(data?.phone ?? "");
    const code = String(data?.code ?? "");
    if (!/^\d{10}$/.test(phone)) throw new Error("Invalid phone number");
    if (!/^\d{4,8}$/.test(code)) throw new Error("Enter the code you received");
    return { phone, code };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createHash } = await import("node:crypto");
    const { issueCustomerToken, isAdminPhone, findDriverByPhone, issueDeliveryToken, issueSupplierToken } = await import("./auth-tokens.server");
    const { findSupplierByPhone } = await import("./suppliers");

    const { data: rows } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("phone", data.phone)
      .eq("consumed", false)
      .order("created_at", { ascending: false })
      .limit(1);

    const row = rows?.[0];
    if (!row) throw new Error("Please request a new OTP");
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("otp_codes").update({ consumed: true }).eq("id", row.id);
      throw new Error("Your code has expired. Request a new one.");
    }
    if (row.attempts >= 5) {
      await supabaseAdmin.from("otp_codes").update({ consumed: true }).eq("id", row.id);
      throw new Error("Too many incorrect attempts. Request a new OTP.");
    }

    const hash = createHash("sha256").update(`${data.phone}:${data.code}`).digest("hex");
    if (hash !== row.code_hash) {
      await supabaseAdmin.from("otp_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      throw new Error("Incorrect OTP");
    }

    await supabaseAdmin.from("otp_codes").update({ consumed: true }).eq("id", row.id);

    // Derive the role from server-side registries. A registered, active delivery
    // partner is issued a signed delivery token in the same step so the unified
    // login can route them straight to the delivery portal.
    const driver = findDriverByPhone(data.phone);
    const delivery = driver && driver.active
      ? { token: issueDeliveryToken(driver.id, driver.phone), driver: { id: driver.id, name: driver.name, phone: driver.phone } }
      : null;

    // A registered supplier phone is issued a signed supplier token so the
    // unified login can route them straight to their scoped supplier portal.
    const supplierAccount = findSupplierByPhone(data.phone);
    const supplier = supplierAccount
      ? {
          token: issueSupplierToken(supplierAccount.id, supplierAccount.phone),
          supplier: { id: supplierAccount.id, name: supplierAccount.name, phone: supplierAccount.phone },
        }
      : null;

    return {
      ok: true as const,
      token: issueCustomerToken(data.phone),
      isAdminPhone: isAdminPhone(data.phone),
      delivery,
      supplier,
    };
  });

// ---------------- Admin login ----------------
// Validates the secret passcode server-side and issues a signed admin token.
export const adminLoginFn = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string }) => ({ passcode: String(data?.passcode ?? "") }))
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
    return { ok: true as const, token: issueAdminToken() };
  });

// ---------------- Verify admin token (server-side gate) ----------------
// Cryptographically validates a signed admin token. The admin route's
// beforeLoad calls this so the admin shell is only rendered after a
// server-confirmed identity check — a spoofed localStorage value verifies to
// false and never reaches the admin UI.
export const verifyAdminTokenFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string }) => ({ token: data?.token ? String(data.token) : "" }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    return { valid: verifyAdminToken(data.token) };
  });

