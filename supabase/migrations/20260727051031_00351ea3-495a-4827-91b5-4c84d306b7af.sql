ALTER TABLE public.driver_availability
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS shift_type text,
  ADD COLUMN IF NOT EXISTS shift_start text,
  ADD COLUMN IF NOT EXISTS shift_end text,
  ADD COLUMN IF NOT EXISTS access_requested_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS driver_availability_phone_key
  ON public.driver_availability (phone) WHERE phone IS NOT NULL;