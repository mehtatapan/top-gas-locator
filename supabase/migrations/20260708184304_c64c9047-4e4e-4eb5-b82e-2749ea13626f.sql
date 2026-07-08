
-- =========================================================
-- Lock down previous SECURITY DEFINER helpers from anon
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_store_ids(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_permissions() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_store_ids(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_permissions() TO authenticated, service_role;

-- =========================================================
-- stores
-- =========================================================
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  address TEXT,
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_stores_updated BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "stores_read" ON public.stores
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "stores_admin_write" ON public.stores
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'admin.stores'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'admin.stores'));

-- Back-fill FK on user_roles.store_id now that stores exists
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;

-- =========================================================
-- store_managers
-- =========================================================
CREATE TABLE public.store_managers (
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_managers TO authenticated;
GRANT ALL ON public.store_managers TO service_role;
ALTER TABLE public.store_managers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_managers_read" ON public.store_managers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "store_managers_admin_write" ON public.store_managers
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- drive_folders  (cache of Drive folder path -> id)
-- =========================================================
CREATE TABLE public.drive_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL UNIQUE,       -- e.g. 'Promotions/Fritch'
  drive_folder_id TEXT NOT NULL,
  parent_id UUID REFERENCES public.drive_folders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.drive_folders TO authenticated;
GRANT ALL ON public.drive_folders TO service_role;
ALTER TABLE public.drive_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drive_folders_read" ON public.drive_folders
  FOR SELECT TO authenticated USING (true);
-- writes only via service_role (server functions)

-- =========================================================
-- attachments  (metadata only; files live in Google Drive)
-- =========================================================
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,            -- e.g. 'tickets','promotions','gaming','pnl','equipment','employees'
  entity_type TEXT,                -- optional discriminator
  entity_id UUID,                  -- FK'd loosely: the module's record id
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  drive_file_id TEXT NOT NULL,
  drive_folder_id TEXT,
  drive_folder_path TEXT,
  name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  web_view_link TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_attachments_module_entity ON public.attachments(module, entity_id);
CREATE INDEX idx_attachments_store ON public.attachments(store_id);
CREATE INDEX idx_attachments_uploaded_by ON public.attachments(uploaded_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attachments_read" ON public.attachments
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR uploaded_by = auth.uid()
    OR store_id IS NULL
    OR store_id IN (SELECT public.user_store_ids(auth.uid()))
  );
CREATE POLICY "attachments_insert" ON public.attachments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'uploads.create') OR public.is_admin(auth.uid()));
CREATE POLICY "attachments_update_own_or_admin" ON public.attachments
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (uploaded_by = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "attachments_delete" ON public.attachments
  FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (uploaded_by = auth.uid() AND public.has_permission(auth.uid(),'uploads.delete'))
  );

-- =========================================================
-- audit_logs
-- =========================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  before JSONB,
  after JSONB,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_module ON public.audit_logs(module, entity_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_admin_read" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'admin.audit'));
-- No insert/update/delete policies -> writes only via service_role.

-- Generic audit trigger (attach later per table if desired)
CREATE OR REPLACE FUNCTION public.fn_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_module TEXT := TG_ARGV[0];
BEGIN
  INSERT INTO public.audit_logs (actor_id, module, action, entity_type, entity_id, before, after)
  VALUES (
    auth.uid(),
    v_module,
    TG_OP,
    TG_TABLE_NAME,
    COALESCE((NEW).id, (OLD).id),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fn_audit() FROM PUBLIC, anon;

-- =========================================================
-- notifications
-- =========================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id) WHERE read_at IS NULL;

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_self_read" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_self_update" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =========================================================
-- email_queue
-- =========================================================
CREATE TABLE public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  template TEXT NOT NULL,
  subject TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|sending|sent|failed
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  send_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_email_queue_pending ON public.email_queue(status, send_after);
GRANT SELECT ON public.email_queue TO authenticated;
GRANT ALL ON public.email_queue TO service_role;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_email_queue_updated BEFORE UPDATE ON public.email_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "email_queue_admin_read" ON public.email_queue
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'admin.audit'));

-- =========================================================
-- Seed stores from src/data/locations.ts (5 TX stores)
-- =========================================================
INSERT INTO public.stores (slug, name, city, state) VALUES
  ('fritch',          'VT Gas & Market - Fritch',           'Fritch',   'TX'),
  ('borger',          'VT Gas & Market - Borger',           'Borger',   'TX'),
  ('spearman',        'VT Gas & Market - Spearman',         'Spearman', 'TX'),
  ('amarillo-coulter','VT Gas & Market - Amarillo Coulter', 'Amarillo', 'TX'),
  ('amarillo-western','VT Gas & Market - Amarillo Western', 'Amarillo', 'TX')
ON CONFLICT (slug) DO NOTHING;
