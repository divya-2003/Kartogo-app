ALTER TABLE public.app_orders
  ADD COLUMN IF NOT EXISTS return_stage text,
  ADD COLUMN IF NOT EXISTS return_picked_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_initiated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.driver_availability (
  driver_id text PRIMARY KEY,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.driver_availability TO service_role;
ALTER TABLE public.driver_availability ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_driver_availability_updated_at
BEFORE UPDATE ON public.driver_availability
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text,
  customer_phone text NOT NULL,
  customer_name text,
  address text,
  service text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  file_data text NOT NULL,
  copies integer NOT NULL DEFAULT 1,
  notes text,
  status text NOT NULL DEFAULT 'received',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.print_jobs TO service_role;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS print_jobs_status_idx ON public.print_jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS print_jobs_phone_idx ON public.print_jobs (customer_phone, created_at DESC);

CREATE TRIGGER trg_print_jobs_updated_at
BEFORE UPDATE ON public.print_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();