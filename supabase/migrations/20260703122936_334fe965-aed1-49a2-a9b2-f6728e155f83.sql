ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS address text;

ALTER TABLE public.customers ALTER COLUMN name SET DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_phone_key'
  ) THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_phone_key UNIQUE (phone);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;