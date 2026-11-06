CREATE TABLE public.kitchen_staff (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), phone text NOT NULL UNIQUE, kitchen_id text NOT NULL, name text, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.kitchen_staff TO service_role;
ALTER TABLE public.kitchen_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS kitchen_status text NOT NULL DEFAULT 'NEW', ADD COLUMN IF NOT EXISTS kitchen_ready_at timestamptz, ADD COLUMN IF NOT EXISTS kitchen_printed_at timestamptz;