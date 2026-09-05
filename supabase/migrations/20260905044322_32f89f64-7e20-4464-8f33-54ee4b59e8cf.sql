CREATE POLICY "admin_access_no_direct_reads"
ON public.admin_access
FOR SELECT
TO authenticated
USING (false);

CREATE POLICY "admin_access_no_direct_writes"
ON public.admin_access
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);