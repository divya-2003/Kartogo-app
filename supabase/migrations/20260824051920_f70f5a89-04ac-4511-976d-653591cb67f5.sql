ALTER TABLE public.wallet_topups DROP CONSTRAINT IF EXISTS wallet_topups_status_check;
ALTER TABLE public.wallet_topups ADD CONSTRAINT wallet_topups_status_check CHECK (status = ANY (ARRAY['pending'::text,'success'::text,'failed'::text]));
ALTER TABLE public.wallet_topups ADD COLUMN IF NOT EXISTS reference text;
ALTER TABLE public.wallet_topups ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.wallet_topups ADD COLUMN IF NOT EXISTS reviewed_by text;

ALTER PUBLICATION supabase_realtime DROP TABLE public.inventory_items;
ALTER PUBLICATION supabase_realtime DROP TABLE public.inventory_alerts;
ALTER PUBLICATION supabase_realtime DROP TABLE public.driver_access_events;