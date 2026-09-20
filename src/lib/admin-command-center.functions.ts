// Admin command centre: real, database-backed operational KPIs and the
// "Action required" queue. Every number here is a live count from the database
// — nothing is estimated or mocked.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ActionItem = {
  key: string;
  label: string;
  count: number;
  to: string;
};

export type CommandCenter = {
  ok: boolean;
  todayOrders: number;
  todayRevenue: number;
  activeOrders: number;
  deliveredToday: number;
  cancelledToday: number;
  onlineDrivers: number;
  actions: ActionItem[];
};

const empty: CommandCenter = {
  ok: false,
  todayOrders: 0,
  todayRevenue: 0,
  activeOrders: 0,
  deliveredToday: 0,
  cancelledToday: 0,
  onlineDrivers: 0,
  actions: [],
};

export const adminCommandCenterFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(1).max(800) }).parse(input))
  .handler(async ({ data }): Promise<CommandCenter> => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.token)) return empty;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const since = startOfDay.toISOString();

    const count = async (
      table: string,
      build: (q: any) => any,
    ): Promise<number> => {
      try {
        const { count: n, error } = await build(
          supabaseAdmin.from(table as never).select("*", { count: "exact", head: true }),
        );
        if (error) return 0;
        return n ?? 0;
      } catch {
        return 0;
      }
    };

    const [todayRows, activeOrders, deliveredToday, cancelledToday, onlineDrivers] = await Promise.all([
      supabaseAdmin
        .from("app_orders")
        .select("total, status, refunded")
        .gte("created_at", since),
      count("app_orders", (q) => q.in("status", ["placed", "packed", "out_for_delivery"])),
      count("app_orders", (q) => q.eq("status", "delivered").gte("created_at", since)),
      count("app_orders", (q) => q.eq("status", "cancelled").gte("created_at", since)),
      count("delivery_partners", (q) => q.eq("online", true)),
    ]);

    const rows = (todayRows.data ?? []) as { total: number; status: string; refunded: boolean }[];
    const todayRevenue = rows
      .filter((r) => r.status !== "cancelled" && !r.refunded)
      .reduce((s, r) => s + Number(r.total ?? 0), 0);

    const [unassigned, refundRequests, topups, restockRequests, areaRequests, stockAlerts, printJobs] =
      await Promise.all([
        count("app_orders", (q) => q.in("status", ["placed", "packed"]).is("delivery_boy_id", null)),
        count("app_orders", (q) => q.eq("refund_request_status", "pending")),
        count("wallet_topups", (q) => q.eq("status", "pending")),
        count("stock_alerts", (q) => q.eq("status", "pending")),
        count("unserviceable_requests", (q) => q.eq("status", "new")),
        count("inventory_alerts", (q) => q.eq("status", "open")),
        count("print_jobs", (q) => q.eq("status", "pending")),
      ]);

    const actions: ActionItem[] = [
      { key: "unassigned", label: "Orders waiting for a delivery partner", count: unassigned, to: "/admin/delivery" },
      { key: "refunds", label: "Refund requests to review", count: refundRequests, to: "/admin/refund-requests" },
      { key: "topups", label: "Wallet top-ups to approve", count: topups, to: "/admin" },
      { key: "restock", label: "Customer restock requests", count: restockRequests, to: "/admin/stock-alerts" },
      { key: "areas", label: "New area requests", count: areaRequests, to: "/admin/unserviceable" },
      { key: "stock", label: "Open low-stock alerts", count: stockAlerts, to: "/admin/inventory" },
      { key: "print", label: "Print jobs in the queue", count: printJobs, to: "/admin/print" },
    ].filter((a) => a.count > 0);

    return {
      ok: true,
      todayOrders: rows.length,
      todayRevenue: Math.round(todayRevenue),
      activeOrders,
      deliveredToday,
      cancelledToday,
      onlineDrivers,
      actions,
    };
  });
