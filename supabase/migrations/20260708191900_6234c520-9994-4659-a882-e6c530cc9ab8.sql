DROP POLICY IF EXISTS "stores_admin_write" ON public.stores;
CREATE POLICY "stores_manage_write" ON public.stores
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'stores.manage') OR public.has_permission(auth.uid(),'admin.stores'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'stores.manage') OR public.has_permission(auth.uid(),'admin.stores'));