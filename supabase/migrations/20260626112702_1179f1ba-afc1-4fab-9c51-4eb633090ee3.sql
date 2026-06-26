-- Remove the permissive public SELECT policy on order_status_log.
-- This table holds internal order IDs and their full status transition history,
-- which should never be readable by anonymous/public users. Access remains
-- available to service-role server functions (which bypass RLS), consistent
-- with the default-deny posture of the other order-related tables.
DROP POLICY IF EXISTS "Anyone can read order status log" ON public.order_status_log;

-- Revoke any direct Data API access from anon/authenticated so the table is
-- only reachable via trusted server-side (service-role) code.
REVOKE SELECT ON public.order_status_log FROM anon;
REVOKE SELECT ON public.order_status_log FROM authenticated;