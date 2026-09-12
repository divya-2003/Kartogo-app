DROP POLICY IF EXISTS "Catalog items are publicly readable" ON public.catalog_items;
CREATE POLICY "Catalog items are publicly readable" ON public.catalog_items FOR SELECT USING (is_deleted = false);