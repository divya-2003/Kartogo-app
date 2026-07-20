
ALTER TABLE public.app_orders
  ADD COLUMN IF NOT EXISTS refund_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_request_reason text,
  ADD COLUMN IF NOT EXISTS refund_request_type text,
  ADD COLUMN IF NOT EXISTS refund_request_resolution text,
  ADD COLUMN IF NOT EXISTS refund_request_status text;
