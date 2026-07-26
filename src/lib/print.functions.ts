import { createServerFn } from "@tanstack/react-start";

// ---------------- Print store jobs ----------------
// A customer uploads a file for one of the print services. Every upload also
// creates a normal delivery order so the finished prints flow through the
// existing rider pipeline. When the print shop marks a job "ready", the linked
// order is moved to "packed" — that's what a delivery partner sees.

export const PRINT_SERVICES = {
  documents: { label: "Documents", accept: ".pdf,application/pdf", hint: "PDF only" },
  passport: { label: "Passport Photos", accept: ".jpg,.jpeg,.png,image/jpeg,image/png", hint: "JPG or PNG" },
  photos: { label: "Photos", accept: ".jpg,.jpeg,.png,image/jpeg,image/png", hint: "JPG or PNG" },
} as const;
export type PrintService = keyof typeof PRINT_SERVICES;

export const PRINT_STATUSES = ["received", "printing", "ready", "collected"] as const;
export type PrintStatus = (typeof PRINT_STATUSES)[number];

export type PrintJob = {
  id: string;
  orderId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  address: string | null;
  service: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  copies: number;
  notes: string | null;
  status: string;
  createdAt: string;
};

type JobRow = {
  id: string; order_id: string | null; customer_name: string | null; customer_phone: string | null;
  address: string | null; service: string; file_name: string; file_type: string; file_size: number;
  copies: number; notes: string | null; status: string; created_at: string;
};

const toJob = (r: JobRow, maskPhone = false): PrintJob => ({
  id: r.id,
  orderId: r.order_id,
  customerName: r.customer_name,
  customerPhone: maskPhone ? null : r.customer_phone,
  address: r.address,
  service: r.service,
  fileName: r.file_name,
  fileType: r.file_type,
  fileSize: Number(r.file_size ?? 0),
  copies: Number(r.copies ?? 1),
  notes: r.notes,
  status: r.status,
  createdAt: r.created_at,
});

const JOB_COLUMNS =
  "id, order_id, customer_name, customer_phone, address, service, file_name, file_type, file_size, copies, notes, status, created_at";

const MAX_BYTES = 8_000_000;

function validateFileForService(service: PrintService, fileType: string, fileName: string) {
  const lower = fileName.toLowerCase();
  if (service === "documents") {
    const ok = fileType === "application/pdf" || lower.endsWith(".pdf");
    if (!ok) throw new Error("Document printing accepts PDF files only");
  } else {
    const ok = /^image\/(jpeg|png)$/.test(fileType) || /\.(jpe?g|png)$/.test(lower);
    if (!ok) throw new Error("Photo printing accepts JPG or PNG files only");
  }
}

// ---------------- Customer: upload a file ----------------
export const createPrintJobFn = createServerFn({ method: "POST" })
  .inputValidator((data: {
    token: string; service: string; fileName: string; fileType: string;
    fileData: string; copies?: number; notes?: string; address?: string;
  }) => {
    const service = String(data?.service ?? "") as PrintService;
    if (!(service in PRINT_SERVICES)) throw new Error("Unknown print service");
    const fileName = String(data?.fileName ?? "").slice(0, 200);
    const fileType = String(data?.fileType ?? "");
    const fileData = String(data?.fileData ?? "");
    if (!fileName || !fileData) throw new Error("Please choose a file to upload");
    if (fileData.length > MAX_BYTES) throw new Error("That file is too large — please keep it under 5 MB");
    validateFileForService(service, fileType, fileName);
    return {
      token: String(data?.token ?? ""),
      service,
      fileName,
      fileType,
      fileData,
      copies: Math.max(1, Math.min(50, Math.floor(Number(data?.copies) || 1))),
      notes: String(data?.notes ?? "").slice(0, 300),
      address: String(data?.address ?? "").slice(0, 400).trim(),
    };
  })
  .handler(async ({ data }) => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    if (!session) throw new Error("Please log in to upload files for printing");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("name, address")
      .eq("phone", session.phone)
      .maybeSingle();

    const address = data.address || customer?.address || "";
    if (!address) throw new Error("Please add a delivery address for your prints");
    const name = customer?.name || "Kartogo customer";
    const label = `${PRINT_SERVICES[data.service].label} print — ${data.fileName}`;

    // Companion delivery order so the print reaches the rider pipeline.
    const orderId = `PR${Date.now().toString().slice(-6)}`;
    const { error: orderErr } = await supabaseAdmin.from("app_orders").insert({
      id: orderId,
      customer_phone: session.phone,
      customer_name: name,
      address,
      items: [{ productId: `print-${data.service}`, name: label, qty: data.copies, price: 0 }],
      subtotal: 0,
      delivery_fee: 0,
      total: 0,
      payment_method: "cash",
      status: "placed",
    });
    if (orderErr) throw new Error("Could not create your print order. Please try again.");

    const { data: row, error } = await supabaseAdmin
      .from("print_jobs")
      .insert({
        order_id: orderId,
        customer_phone: session.phone,
        customer_name: name,
        address,
        service: data.service,
        file_name: data.fileName,
        file_type: data.fileType || "application/octet-stream",
        file_size: data.fileData.length,
        file_data: data.fileData,
        copies: data.copies,
        notes: data.notes || null,
        status: "received",
      })
      .select(JOB_COLUMNS)
      .maybeSingle();
    if (error || !row) throw new Error("Upload failed. Please try again.");
    return toJob(row as JobRow);
  });

// ---------------- Customer: my print jobs ----------------
export const listMyPrintJobsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string }) => ({ token: String(data?.token ?? "") }))
  .handler(async ({ data }): Promise<PrintJob[]> => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    if (!session) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("print_jobs")
      .select(JOB_COLUMNS)
      .eq("customer_phone", session.phone)
      .order("created_at", { ascending: false })
      .limit(50);
    return ((rows ?? []) as JobRow[]).map((r) => toJob(r));
  });

// ---------------- Print shop (admin token): queue ----------------
export const listPrintJobsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken?: string }) => ({ adminToken: String(data?.adminToken ?? "") }))
  .handler(async ({ data }): Promise<PrintJob[]> => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("print_jobs")
      .select(JOB_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error("Could not load the print queue. Please try again.");
    return ((rows ?? []) as JobRow[]).map((r) => toJob(r));
  });

// ---------------- Print shop: download the uploaded file ----------------
export const getPrintJobFileFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken?: string; id: string }) => ({
    adminToken: String(data?.adminToken ?? ""),
    id: String(data?.id ?? ""),
  }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("print_jobs")
      .select("file_name, file_type, file_data")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("File not found");
    return { fileName: row.file_name as string, fileType: row.file_type as string, fileData: row.file_data as string };
  });

// ---------------- Print shop: update status ----------------
// "ready" also pushes the companion order to "packed" so the delivery partner
// sees it as ready to pick up.
export const setPrintJobStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken?: string; id: string; status: PrintStatus }) => {
    if (!PRINT_STATUSES.includes(data?.status)) throw new Error("Invalid status");
    return { adminToken: String(data?.adminToken ?? ""), id: String(data?.id ?? ""), status: data.status };
  })
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("print_jobs")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .select(JOB_COLUMNS)
      .maybeSingle();
    if (error || !row) throw new Error("Could not update this job. Please try again.");

    const job = toJob(row as JobRow);
    if (data.status === "ready" && job.orderId) {
      const { data: order } = await supabaseAdmin
        .from("app_orders")
        .select("status")
        .eq("id", job.orderId)
        .maybeSingle();
      if (order?.status === "placed") {
        await supabaseAdmin
          .from("app_orders")
          .update({ status: "packed", updated_at: new Date().toISOString() })
          .eq("id", job.orderId);
      }
    }
    return job;
  });
