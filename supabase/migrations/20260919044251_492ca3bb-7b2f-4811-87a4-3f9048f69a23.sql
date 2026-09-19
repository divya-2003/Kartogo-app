-- Idempotency key for order placement (additive, nullable)
ALTER TABLE public.app_orders ADD COLUMN IF NOT EXISTS client_request_id text;
CREATE UNIQUE INDEX IF NOT EXISTS app_orders_client_request_id_key
  ON public.app_orders (client_request_id) WHERE client_request_id IS NOT NULL;

-- Admin / staff audit trail
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL,
  actor_role text NOT NULL DEFAULT 'admin',
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: the audit trail is written and read only by
-- trusted server code (service role), matching the other operational tables.

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_entity_idx ON public.admin_audit_log (entity_type, entity_id);

-- Performance indexes for the hottest operational reads (additive only)
CREATE INDEX IF NOT EXISTS app_orders_status_created_idx ON public.app_orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS app_orders_phone_created_idx ON public.app_orders (customer_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS order_status_log_order_idx ON public.order_status_log (order_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS inventory_reservations_order_idx ON public.inventory_reservations (order_id, status);