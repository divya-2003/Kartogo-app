import { createServerFn } from "@tanstack/react-start";
import type { Json } from "@/integrations/supabase/types";

// Server-authoritative customer profile.
// Name, email, address and saved delivery locations live in the database keyed
// by the customer's verified phone number, so the SAME person sees the details
// they entered earlier no matter which device they log in from. Identity is
// proven by the signed customer token used everywhere else — a browser can only
// read/write ITS OWN profile.

export type StoredProfile = {
  name: string;
  email: string;
  address: string;
  savedAddresses: Json[];
  deliveryAddresses: Json[];
};

const str = (v: unknown, max = 300): string => String(v ?? "").trim().slice(0, max);

const cleanArray = (v: unknown, max = 20): Json[] => {
  if (!Array.isArray(v)) return [];
  return v.slice(0, max) as Json[];
};

async function loadProfile(phone: string): Promise<StoredProfile | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("name, email, address, saved_addresses")
    .eq("phone", phone)
    .maybeSingle();
  if (error) {
    console.error("Failed to load customer profile", error);
    return null;
  }
  if (!data) return null;
  const bag = (data.saved_addresses ?? {}) as Record<string, unknown>;
  // Support both the new { locations, delivery } shape and a legacy bare array.
  const locations = Array.isArray(bag) ? bag : cleanArray(bag.locations, 20);
  const delivery = Array.isArray(bag) ? [] : cleanArray(bag.delivery, 20);
  return {
    name: str(data.name),
    email: str(data.email),
    address: str(data.address),
    savedAddresses: locations,
    deliveryAddresses: delivery,
  };
}

// ---------------- Read the profile (token-scoped) ----------------
export const getCustomerProfileFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string }) => ({ token: data?.token ? String(data.token) : "" }))
  .handler(async ({ data }) => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    if (!session) return { profile: null as StoredProfile | null };
    return { profile: await loadProfile(session.phone) };
  });

// ---------------- Save name / email / address ----------------
export const saveCustomerProfileFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string; name?: string; email?: string; address?: string }) => ({
    token: data?.token ? String(data.token) : "",
    name: str(data?.name, 120),
    email: str(data?.email, 200),
    address: str(data?.address, 500),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    if (!session) throw new Error("Please log in to save your details");

    const { error } = await supabaseAdmin
      .from("customers")
      .upsert(
        { phone: session.phone, name: data.name, email: data.email, address: data.address },
        { onConflict: "phone" },
      );
    if (error) {
      console.error("Failed to save customer profile", error);
      throw new Error("Could not save your details. Please try again.");
    }
    return { profile: await loadProfile(session.phone) };
  });

// ---------------- Save saved locations / delivery addresses ----------------
export const saveCustomerAddressesFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string; savedAddresses?: unknown; deliveryAddresses?: unknown }) => ({
    token: data?.token ? String(data.token) : "",
    savedAddresses: cleanArray(data?.savedAddresses, 20),
    deliveryAddresses: cleanArray(data?.deliveryAddresses, 20),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    if (!session) throw new Error("Please log in to save your addresses");

    const { error } = await supabaseAdmin
      .from("customers")
      .upsert(
        {
          phone: session.phone,
          saved_addresses: { locations: data.savedAddresses, delivery: data.deliveryAddresses },
        },
        { onConflict: "phone" },
      );
    if (error) {
      console.error("Failed to save customer addresses", error);
      throw new Error("Could not save your addresses. Please try again.");
    }
    return { profile: await loadProfile(session.phone) };
  });
