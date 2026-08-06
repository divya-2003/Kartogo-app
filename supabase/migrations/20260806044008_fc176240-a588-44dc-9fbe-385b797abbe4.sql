CREATE TABLE public.notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience text NOT NULL DEFAULT 'admin',
  channel text NOT NULL DEFAULT 'email',
  address text NOT NULL,
  label text NOT NULL DEFAULT '',
  kinds text[] NOT NULL DEFAULT ARRAY['low_stock','out_of_stock','critical','supplier_reminder'],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.notification_recipients TO service_role;
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'low_stock',
  channel text NOT NULL DEFAULT 'in_app',
  recipient text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.market_replenish_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid,
  market_name text NOT NULL DEFAULT '',
  product_id text NOT NULL DEFAULT '',
  product_name text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.market_replenish_requests TO service_role;
ALTER TABLE public.market_replenish_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notification_log_created ON public.notification_log (created_at DESC);
CREATE INDEX idx_replenish_market ON public.market_replenish_requests (market_id, created_at DESC);

CREATE TRIGGER notification_recipients_touch BEFORE UPDATE ON public.notification_recipients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();