import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type UnserviceableRequest = {
  id: string;
  phone: string | null;
  pincode: string | null;
  areaText: string | null;
  lat: number | null;
  lng: number | null;
  note: string | null;
  status: "pending" | "reviewed" | "closed";
  createdAt: string;
};

type Row = {
  id: string; phone: string | null; pincode: string | null; area_text: string | null;
  lat: number | null; lng: number | null; note: string | null; status: string; created_at: string;
};

const toReq = (r: Row): UnserviceableRequest => ({
  id: r.id, phone: r.phone, pincode: r.pincode, areaText: r.area_text,
  lat: r.lat, lng: r.lng, note: r.note,
  status: (["pending", "reviewed", "closed"].includes(r.status) ? r.status : "pending") as UnserviceableRequest["status"],
  createdAt: r.created_at,
});

const createSchema = z.object({
  phone: z.string().max(20).optional().nullable(),
  pincode: z.string().max(10).optional().nullable(),
  areaText: z.string().max(400).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

export const createUnserviceableRequestFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("unserviceable_requests")
      .insert({
        phone: data.phone || null,
        pincode: data.pincode || null,
        area_text: data.areaText || null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        note: data.note || null,
      })
      .select("*").maybeSingle();
    if (error || !row) throw new Error("Could not submit your request. Please try again.");
    return toReq(row as Row);
  });

export const listUnserviceableRequestsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string }) => ({ adminToken: String(data?.adminToken ?? "") }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("unserviceable_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load requests");
    return (rows as Row[]).map(toReq);
  });

export const updateUnserviceableStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string; id: string; status: "pending" | "reviewed" | "closed" }) => ({
    adminToken: String(data?.adminToken ?? ""),
    id: z.string().uuid().parse(data?.id),
    status: z.enum(["pending", "reviewed", "closed"]).parse(data?.status),
  }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("unserviceable_requests")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error("Could not update request");
    return { ok: true };
  });
