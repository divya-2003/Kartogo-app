import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { canonicalPhone, canonicalToE164, normalizeIncomingPhone } from "./phone";

/**
 * Accept Indian AND international numbers. The value is normalised to a
 * canonical form (bare 10 digits for India, full E.164 digits otherwise) so a
 * number typed as +91 98..., 098... or +1 415... always resolves to one row.
 */
function normalizeNewMobile(raw: unknown): string {
  const canonical = canonicalPhone(String(raw ?? "")) ?? normalizeIncomingPhone(raw);
  if (!canonical || !/^\d{8,15}$/.test(canonical)) {
    throw new Error("Enter a valid mobile number, including the country code for international numbers");
  }
  return canonical;
}

export type StaffProfile = {
  userId: string;
  fullName: string;
  mobileNumber: string;
  role: "admin" | "vendor" | "delivery_partner";
  status: "active" | "inactive";
  createdAt: string;
};

const roleSchema = z.enum(["admin", "vendor", "delivery_partner"]);

const sessionSchema = z.object({
  role: roleSchema,
  token: z.string().min(1),
});

const changeSchema = sessionSchema.extend({
  newMobile: z.string().min(6).transform(normalizeNewMobile),
});

const confirmSchema = changeSchema.extend({
  code: z.string().regex(/^\d{4,8}$/, "Enter the code you received"),
});

/** Resolve the signed-in staff member from their role-specific session token. */
async function resolveSession(role: "admin" | "vendor" | "delivery_partner", token: string) {
  const tokens = await import("./auth-tokens.server");
  const { findStaffById, findStaffByRef } = await import("./staff.server");

  if (role === "admin") {
    const t = tokens.readAdminToken(token);
    if (!t) throw new Error("Session expired. Please sign in again.");
    const account = t.userId ? await findStaffById(t.userId) : await findStaffByRef("admin", "admin");
    if (!account) throw new Error("Admin account not found");
    return account;
  }
  if (role === "vendor") {
    const t = tokens.verifySupplierToken(token);
    if (!t) throw new Error("Session expired. Please sign in again.");
    const account = t.userId ? await findStaffById(t.userId) : await findStaffByRef("vendor", t.supplierId);
    if (!account) throw new Error("Supplier account not found");
    return account;
  }
  const t = tokens.verifyDeliveryToken(token);
  if (!t) throw new Error("Session expired. Please sign in again.");
  const account = t.userId ? await findStaffById(t.userId) : await findStaffByRef("delivery_partner", t.driverId);
  if (!account) throw new Error("Delivery partner account not found");
  return account;
}

export const getStaffProfileFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => sessionSchema.parse(data))
  .handler(async ({ data }): Promise<StaffProfile> => {
    const a = await resolveSession(data.role, data.token);
    return {
      userId: a.userId, fullName: a.fullName, mobileNumber: a.mobileNumber,
      role: a.role, status: a.status, createdAt: a.createdAt,
    };
  });

/**
 * Step 1 of a mobile-number change: reject duplicates, then send an OTP to the
 * NEW number. Nothing is changed until that OTP is verified.
 */
export const requestMobileChangeOtpFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => changeSchema.parse(data))
  .handler(async ({ data }) => {
    const account = await resolveSession(data.role, data.token);
    if (account.mobileNumber === data.newMobile) {
      throw new Error("This is already your current mobile number.");
    }

    const { findStaffByPhone, MOBILE_IN_USE } = await import("./staff.server");
    if (await findStaffByPhone(data.newMobile)) throw new Error(MOBILE_IN_USE);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createHash, randomInt } = await import("node:crypto");

    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await supabaseAdmin
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("phone", data.newMobile)
      .gte("created_at", hourAgo);
    if ((count ?? 0) >= 5) throw new Error("Too many OTP requests. Please try again later.");

    const code = String(randomInt(100000, 1000000));
    const codeHash = createHash("sha256").update(`${data.newMobile}:${code}`).digest("hex");
    await supabaseAdmin.from("otp_codes").update({ consumed: true })
      .eq("phone", data.newMobile).eq("consumed", false);
    const { error } = await supabaseAdmin.from("otp_codes").insert({
      phone: data.newMobile,
      code_hash: codeHash,
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    if (error) throw new Error("Could not send a verification code. Please try again.");

    // The code is delivered by SMS only. It is returned in the response solely
    // in private/staging environments where the server-only DEMO_OTP_MODE flag
    // is explicitly set to "true" (never set in production).
    if (process.env.DEMO_OTP_MODE === "true") {
      return { ok: true as const, demo: true as const, demoCode: code };
    }
    const { sendSms } = await import("./sms.server");
    await sendSms(canonicalToE164(data.newMobile) ?? `+${data.newMobile}`, `Your Kartogo verification code is ${code}. It expires in 5 minutes.`);
    return { ok: true as const, demo: false as const, demoCode: undefined };
  });

/**
 * Step 2: verify the OTP and update ONLY the mobile number. The permanent
 * user_id, role and every referencing record (orders, earnings, analytics,
 * notifications, settings) stay exactly as they are.
 */
export const confirmMobileChangeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => confirmSchema.parse(data))
  .handler(async ({ data }) => {
    const account = await resolveSession(data.role, data.token);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createHash } = await import("node:crypto");

    const { data: rows } = await supabaseAdmin
      .from("otp_codes").select("*")
      .eq("phone", data.newMobile).eq("consumed", false)
      .order("created_at", { ascending: false }).limit(1);
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
    const hash = createHash("sha256").update(`${data.newMobile}:${data.code}`).digest("hex");
    if (hash !== row.code_hash) {
      await supabaseAdmin.from("otp_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      throw new Error("Incorrect OTP");
    }
    await supabaseAdmin.from("otp_codes").update({ consumed: true }).eq("id", row.id);

    const { changeStaffMobile } = await import("./staff.server");
    const updated = await changeStaffMobile(account.userId, data.newMobile, `${account.role}:${account.userId}`);

    // Re-issue the session token so it carries the new number (same user_id).
    const tokens = await import("./auth-tokens.server");
    let token: string | null = null;
    if (updated.role === "admin") token = tokens.issueAdminToken(updated.userId);
    else if (updated.role === "vendor" && updated.refId) token = tokens.issueSupplierToken(updated.refId, updated.mobileNumber, updated.userId);
    else if (updated.role === "delivery_partner" && updated.refId) token = tokens.issueDeliveryToken(updated.refId, updated.mobileNumber, updated.userId);

    return {
      ok: true as const,
      token,
      profile: {
        userId: updated.userId, fullName: updated.fullName, mobileNumber: updated.mobileNumber,
        role: updated.role, status: updated.status, createdAt: updated.createdAt,
      } satisfies StaffProfile,
    };
  });
