
CREATE TABLE public.refund_config (
  id INT PRIMARY KEY DEFAULT 1,
  threshold_amount NUMERIC NOT NULL DEFAULT 500,
  gst_percent NUMERIC NOT NULL DEFAULT 5,
  credit_expiry_days INT NOT NULL DEFAULT 365,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT refund_config_singleton CHECK (id = 1)
);
GRANT ALL ON public.refund_config TO service_role;
ALTER TABLE public.refund_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.refund_config (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.refund_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  customer_phone TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
  resolution TEXT,
  order_total NUMERIC,
  credit_amount NUMERIC NOT NULL DEFAULT 0,
  credit_expires_at TIMESTAMPTZ,
  threshold_amount NUMERIC,
  gst_percent NUMERIC,
  actor TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.refund_audit_log TO service_role;
ALTER TABLE public.refund_audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX refund_audit_log_order_idx ON public.refund_audit_log (order_id);
CREATE INDEX refund_audit_log_created_idx ON public.refund_audit_log (created_at DESC);
