ALTER TABLE public.catalog_items ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.catalog_items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.catalog_items ADD COLUMN IF NOT EXISTS deleted_by text;