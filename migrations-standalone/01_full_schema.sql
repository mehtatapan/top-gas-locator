-- ============================================================
-- VT Gas & Market — Consolidated Schema Bundle
-- Replay against a fresh Supabase project in one shot.
-- Generated 2026-07-08T21:10:49Z from supabase/migrations/*.
-- ============================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ---------- 20260708184212_cab15e25-1dea-4028-afac-456f02d6461f.sql ----------

-- =========================================================
-- Shared utility: updated_at trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- profiles
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_drive_file_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- roles / permissions / role_permissions / user_roles
-- =========================================================
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  description TEXT,
  module TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  store_id UUID,  -- optional store scope; FK added in migration 2 after stores exists
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id, store_id)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role_id);
CREATE INDEX idx_user_roles_store ON public.user_roles(store_id);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- Security-definer helpers (avoid RLS recursion)
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.key = _role_key
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _perm_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id AND p.key = _perm_key
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin')
      OR public.has_role(_user_id, 'owner');
$$;

CREATE OR REPLACE FUNCTION public.user_store_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id
  FROM public.user_roles
  WHERE user_id = _user_id AND store_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS TABLE (permission_key TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.key
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = auth.uid();
$$;

-- =========================================================
-- RLS policies
-- =========================================================

-- profiles
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_admin_insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "profiles_admin_delete" ON public.profiles
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- roles (readable by all authed; writes admin-only via service_role)
CREATE POLICY "roles_read" ON public.roles
  FOR SELECT TO authenticated USING (true);

-- permissions
CREATE POLICY "permissions_read" ON public.permissions
  FOR SELECT TO authenticated USING (true);

-- role_permissions
CREATE POLICY "role_permissions_read" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

-- user_roles
CREATE POLICY "user_roles_self_read" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "user_roles_admin_write" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- Seed roles & permissions
-- =========================================================
INSERT INTO public.roles (key, name, description) VALUES
  ('super_admin',      'Super Admin',       'Full system access'),
  ('owner',            'Owner',             'Business owner - full access'),
  ('regional_manager', 'Regional Manager',  'Manages multiple stores'),
  ('store_manager',    'Store Manager',     'Manages a single store'),
  ('employee',         'Employee',          'Store employee - limited access')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.permissions (key, module, description) VALUES
  -- tickets
  ('tickets.view',           'tickets',    'View tickets'),
  ('tickets.create',         'tickets',    'Create tickets'),
  ('tickets.edit',           'tickets',    'Edit tickets'),
  ('tickets.assign',         'tickets',    'Assign tickets'),
  ('tickets.close',          'tickets',    'Close tickets'),
  ('tickets.comment',        'tickets',    'Comment on tickets'),
  -- promotions
  ('promotions.view',        'promotions', 'View promotions'),
  ('promotions.manage',      'promotions', 'Create/edit/archive promotions'),
  -- gaming
  ('gaming.view',            'gaming',     'View gaming data'),
  ('gaming.open_period',     'gaming',     'Open a gaming period'),
  ('gaming.close_period',    'gaming',     'Close a gaming period'),
  ('gaming.record_txn',      'gaming',     'Record gaming transactions'),
  -- pnl
  ('pnl.view',               'pnl',        'View P&L data'),
  ('pnl.edit',               'pnl',        'Create/edit P&L entries'),
  -- uploads
  ('uploads.create',         'uploads',    'Upload files to Drive'),
  ('uploads.delete',         'uploads',    'Delete uploaded files'),
  -- admin
  ('admin.users',            'admin',      'Manage users and roles'),
  ('admin.stores',           'admin',      'Manage stores'),
  ('admin.audit',            'admin',      'View audit logs'),
  ('admin.settings',         'admin',      'Change system settings')
ON CONFLICT (key) DO NOTHING;

-- Grant all permissions to super_admin and owner
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key IN ('super_admin','owner')
ON CONFLICT DO NOTHING;

-- Regional manager: everything except admin.users/admin.settings
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key = 'regional_manager'
  AND p.key NOT IN ('admin.users','admin.settings')
ON CONFLICT DO NOTHING;

-- Store manager: store-level ops, no admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key = 'store_manager'
  AND p.key IN (
    'tickets.view','tickets.create','tickets.edit','tickets.assign','tickets.close','tickets.comment',
    'promotions.view','promotions.manage',
    'gaming.view','gaming.open_period','gaming.close_period','gaming.record_txn',
    'pnl.view','pnl.edit',
    'uploads.create','uploads.delete'
  )
ON CONFLICT DO NOTHING;

-- Employee: view + basic ticket ops
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key = 'employee'
  AND p.key IN (
    'tickets.view','tickets.create','tickets.comment',
    'promotions.view','gaming.view',
    'uploads.create'
  )
ON CONFLICT DO NOTHING;


-- ---------- 20260708184304_c64c9047-4e4e-4eb5-b82e-2749ea13626f.sql ----------

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


-- ---------- 20260708184427_0c56f99c-ce5b-41b1-99b7-4c4db99da98e.sql ----------

-- =========================================================
-- Enums
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM ('open','in_progress','waiting','resolved','closed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_priority AS ENUM ('low','medium','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.promotion_status AS ENUM ('draft','scheduled','active','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.gaming_period_status AS ENUM ('open','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pnl_kind AS ENUM ('expense','revenue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- Convenience helper: can this user access this store?
-- =========================================================
CREATE OR REPLACE FUNCTION public.can_access_store(_user_id UUID, _store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id)
      OR _store_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = _user_id
          AND (ur.store_id = _store_id OR ur.store_id IS NULL AND public.has_role(_user_id,'regional_manager'))
      )
      OR EXISTS (
        SELECT 1 FROM public.store_managers sm
        WHERE sm.user_id = _user_id AND sm.store_id = _store_id
      );
$$;
REVOKE EXECUTE ON FUNCTION public.can_access_store(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_store(UUID, UUID) TO authenticated, service_role;

-- =========================================================
-- ticket_categories
-- =========================================================
CREATE TABLE public.ticket_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ticket_categories TO authenticated;
GRANT ALL ON public.ticket_categories TO service_role;
ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket_categories_read" ON public.ticket_categories
  FOR SELECT TO authenticated USING (true);

-- =========================================================
-- tickets
-- =========================================================
CREATE SEQUENCE IF NOT EXISTS public.ticket_number_seq START 1001;

CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number BIGINT NOT NULL UNIQUE DEFAULT nextval('public.ticket_number_seq'),
  title TEXT NOT NULL,
  description TEXT,
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  category_id UUID REFERENCES public.ticket_categories(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_store ON public.tickets(store_id);
CREATE INDEX idx_tickets_assignee ON public.tickets(assignee_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_due ON public.tickets(due_at);
CREATE INDEX idx_tickets_created_at ON public.tickets(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "tickets_read" ON public.tickets
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR created_by = auth.uid()
    OR assignee_id = auth.uid()
    OR public.can_access_store(auth.uid(), store_id)
  );
CREATE POLICY "tickets_insert" ON public.tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(),'tickets.create')
    AND (store_id IS NULL OR public.can_access_store(auth.uid(), store_id))
  );
CREATE POLICY "tickets_update" ON public.tickets
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (public.has_permission(auth.uid(),'tickets.edit')
        AND (assignee_id = auth.uid() OR created_by = auth.uid() OR public.can_access_store(auth.uid(), store_id)))
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(),'tickets.edit')
  );
CREATE POLICY "tickets_delete_admin" ON public.tickets
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- =========================================================
-- ticket_comments / ticket_assignments / ticket_history
-- =========================================================
CREATE TABLE public.ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_comments_ticket ON public.ticket_comments(ticket_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_comments TO authenticated;
GRANT ALL ON public.ticket_comments TO service_role;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_ticket_comments_updated BEFORE UPDATE ON public.ticket_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "ticket_comments_read" ON public.ticket_comments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id));
CREATE POLICY "ticket_comments_insert" ON public.ticket_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.has_permission(auth.uid(),'tickets.comment'));
CREATE POLICY "ticket_comments_edit_own" ON public.ticket_comments
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (author_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "ticket_comments_delete_own" ON public.ticket_comments
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.ticket_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ
);
CREATE INDEX idx_ticket_assignments_ticket ON public.ticket_assignments(ticket_id);
GRANT SELECT, INSERT, UPDATE ON public.ticket_assignments TO authenticated;
GRANT ALL ON public.ticket_assignments TO service_role;
ALTER TABLE public.ticket_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket_assignments_read" ON public.ticket_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ticket_assignments_write" ON public.ticket_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'tickets.assign') OR public.is_admin(auth.uid()));
CREATE POLICY "ticket_assignments_update" ON public.ticket_assignments
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'tickets.assign') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'tickets.assign') OR public.is_admin(auth.uid()));

CREATE TABLE public.ticket_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_history_ticket ON public.ticket_history(ticket_id, created_at);
GRANT SELECT ON public.ticket_history TO authenticated;
GRANT ALL ON public.ticket_history TO service_role;
ALTER TABLE public.ticket_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket_history_read" ON public.ticket_history
  FOR SELECT TO authenticated USING (true);
-- writes via service_role/trigger only

-- Auto-log ticket field changes
CREATE OR REPLACE FUNCTION public.fn_log_ticket_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.ticket_history(ticket_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'status', OLD.status::text, NEW.status::text);
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.ticket_history(ticket_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'priority', OLD.priority::text, NEW.priority::text);
  END IF;
  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    INSERT INTO public.ticket_history(ticket_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'assignee', OLD.assignee_id::text, NEW.assignee_id::text);
  END IF;
  IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN
    INSERT INTO public.ticket_history(ticket_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'due_at', OLD.due_at::text, NEW.due_at::text);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fn_log_ticket_changes() FROM PUBLIC, anon;
CREATE TRIGGER trg_tickets_history AFTER UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_ticket_changes();

-- =========================================================
-- promotions
-- =========================================================
CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status public.promotion_status NOT NULL DEFAULT 'draft',
  banner_attachment_id UUID REFERENCES public.attachments(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_promotions_store ON public.promotions(store_id);
CREATE INDEX idx_promotions_status ON public.promotions(status);
CREATE INDEX idx_promotions_window ON public.promotions(starts_at, ends_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_promotions_updated BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "promotions_read" ON public.promotions
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'promotions.view') OR public.is_admin(auth.uid()));
CREATE POLICY "promotions_write" ON public.promotions
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'promotions.manage') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'promotions.manage') OR public.is_admin(auth.uid()));

-- =========================================================
-- gaming
-- =========================================================
CREATE TABLE public.gaming_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ,
  status public.gaming_period_status NOT NULL DEFAULT 'open',
  opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_gaming_periods_store ON public.gaming_periods(store_id, period_start DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gaming_periods TO authenticated;
GRANT ALL ON public.gaming_periods TO service_role;
ALTER TABLE public.gaming_periods ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_gaming_periods_updated BEFORE UPDATE ON public.gaming_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "gaming_periods_read" ON public.gaming_periods
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'gaming.view') AND public.can_access_store(auth.uid(), store_id));
CREATE POLICY "gaming_periods_insert" ON public.gaming_periods
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'gaming.open_period') AND public.can_access_store(auth.uid(), store_id));
CREATE POLICY "gaming_periods_update" ON public.gaming_periods
  FOR UPDATE TO authenticated
  USING (public.can_access_store(auth.uid(), store_id))
  WITH CHECK (
    public.has_permission(auth.uid(),'gaming.close_period')
    OR public.has_permission(auth.uid(),'gaming.open_period')
    OR public.is_admin(auth.uid())
  );

CREATE TABLE public.gaming_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.gaming_periods(id) ON DELETE CASCADE,
  machine_id TEXT,
  type TEXT NOT NULL,  -- e.g. 'cash_in','payout','adjustment'
  amount NUMERIC(14,2) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_gaming_txn_period ON public.gaming_transactions(period_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gaming_transactions TO authenticated;
GRANT ALL ON public.gaming_transactions TO service_role;
ALTER TABLE public.gaming_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gaming_txn_read" ON public.gaming_transactions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.gaming_periods gp
    WHERE gp.id = period_id
      AND public.has_permission(auth.uid(),'gaming.view')
      AND public.can_access_store(auth.uid(), gp.store_id)
  ));
CREATE POLICY "gaming_txn_write" ON public.gaming_transactions
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'gaming.record_txn') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'gaming.record_txn') OR public.is_admin(auth.uid()));

CREATE TABLE public.gaming_manual_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.gaming_periods(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  reason TEXT,
  paid_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_gaming_payouts_period ON public.gaming_manual_payouts(period_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gaming_manual_payouts TO authenticated;
GRANT ALL ON public.gaming_manual_payouts TO service_role;
ALTER TABLE public.gaming_manual_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gaming_payouts_read" ON public.gaming_manual_payouts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.gaming_periods gp
    WHERE gp.id = period_id
      AND public.has_permission(auth.uid(),'gaming.view')
      AND public.can_access_store(auth.uid(), gp.store_id)
  ));
CREATE POLICY "gaming_payouts_write" ON public.gaming_manual_payouts
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'gaming.record_txn') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'gaming.record_txn') OR public.is_admin(auth.uid()));

CREATE TABLE public.gaming_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.gaming_periods(id) ON DELETE CASCADE,
  pdf_attachment_id UUID REFERENCES public.attachments(id) ON DELETE SET NULL,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_gaming_reports_period ON public.gaming_reports(period_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gaming_reports TO authenticated;
GRANT ALL ON public.gaming_reports TO service_role;
ALTER TABLE public.gaming_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gaming_reports_read" ON public.gaming_reports
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.gaming_periods gp
    WHERE gp.id = period_id
      AND public.has_permission(auth.uid(),'gaming.view')
      AND public.can_access_store(auth.uid(), gp.store_id)
  ));
CREATE POLICY "gaming_reports_write" ON public.gaming_reports
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'gaming.close_period') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'gaming.close_period') OR public.is_admin(auth.uid()));

-- =========================================================
-- P&L
-- =========================================================
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expense_categories_read" ON public.expense_categories
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.revenue_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.revenue_categories(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.revenue_categories TO authenticated;
GRANT ALL ON public.revenue_categories TO service_role;
ALTER TABLE public.revenue_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "revenue_categories_read" ON public.revenue_categories
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.pnl_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,   -- first day of month
  kind public.pnl_kind NOT NULL,
  expense_category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  revenue_category_id UUID REFERENCES public.revenue_categories(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL,
  memo TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pnl_store_month ON public.pnl_entries(store_id, period_month);
CREATE INDEX idx_pnl_kind ON public.pnl_entries(kind);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pnl_entries TO authenticated;
GRANT ALL ON public.pnl_entries TO service_role;
ALTER TABLE public.pnl_entries ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_pnl_entries_updated BEFORE UPDATE ON public.pnl_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "pnl_read" ON public.pnl_entries
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'pnl.view') AND public.can_access_store(auth.uid(), store_id));
CREATE POLICY "pnl_write" ON public.pnl_entries
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'pnl.edit') AND public.can_access_store(auth.uid(), store_id))
  WITH CHECK (public.has_permission(auth.uid(),'pnl.edit') AND public.can_access_store(auth.uid(), store_id));

-- =========================================================
-- Seed data
-- =========================================================
INSERT INTO public.ticket_categories (key, name) VALUES
  ('maintenance','Maintenance'),
  ('equipment','Equipment'),
  ('it','IT / POS'),
  ('facilities','Facilities'),
  ('supply','Supply Request'),
  ('safety','Safety / Incident'),
  ('other','Other')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.expense_categories (key, name) VALUES
  ('utilities','Utilities'),
  ('payroll','Payroll'),
  ('cogs_fuel','COGS - Fuel'),
  ('cogs_merch','COGS - Merchandise'),
  ('rent','Rent'),
  ('maintenance','Maintenance & Repairs'),
  ('insurance','Insurance'),
  ('taxes','Taxes & Licenses'),
  ('marketing','Marketing'),
  ('bank_fees','Bank & Card Fees'),
  ('other_expense','Other Expense')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.revenue_categories (key, name) VALUES
  ('fuel_sales','Fuel Sales'),
  ('merch_sales','Merchandise Sales'),
  ('gaming_income','Gaming Income'),
  ('lottery_commission','Lottery Commission'),
  ('atm_fees','ATM Fees'),
  ('other_revenue','Other Revenue')
ON CONFLICT (key) DO NOTHING;


-- ---------- 20260708184748_0d1fb3d9-bcc9-4036-97ba-5d67f3fb8671.sql ----------

CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id UUID;
  v_existing INT;
BEGIN
  SELECT COUNT(*) INTO v_existing FROM public.user_roles;
  IF v_existing = 0 THEN
    SELECT id INTO v_role_id FROM public.roles WHERE key = 'super_admin' LIMIT 1;
    IF v_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (NEW.id, v_role_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS on_auth_user_created_bootstrap ON auth.users;
CREATE TRIGGER on_auth_user_created_bootstrap
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.bootstrap_first_admin();


-- ---------- 20260708190813_eeb32765-024d-4840-b4b3-9a38b36bdf6b.sql ----------

-- =========================================================
-- Migration 1: Shared primitives
--   - Generic `categories` lookup table (per-module taxonomies)
--   - Expand permission catalog to cover all current + future modules
--   - Seed default permission bundles for existing roles
-- =========================================================

-- ---------- Generic categories -----------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module      TEXT NOT NULL,                 -- e.g. 'tickets', 'expense', 'revenue', 'vendors'
  key         TEXT NOT NULL,                 -- machine key, unique per module
  name        TEXT NOT NULL,                 -- display label
  parent_id   UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  sort_order  INT  NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories readable by any authenticated user"
  ON public.categories FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "categories manageable by admins or settings permission"
  ON public.categories FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'admin.settings'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'admin.settings'));

CREATE INDEX IF NOT EXISTS categories_module_idx  ON public.categories(module, active);
CREATE INDEX IF NOT EXISTS categories_parent_idx  ON public.categories(parent_id);

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Expand permission catalog ---------------------------------
-- Add module column to permissions if missing, for grouping in UI
ALTER TABLE public.permissions
  ADD COLUMN IF NOT EXISTS module TEXT;

UPDATE public.permissions
   SET module = split_part(key, '.', 1)
 WHERE module IS NULL;

-- Seed permissions covering every current + planned module.
-- Uses ON CONFLICT so re-running is safe.
INSERT INTO public.permissions (key, module, description) VALUES
  -- Users & roles
  ('users.view',              'users',        'View users'),
  ('users.invite',            'users',        'Invite new users'),
  ('users.edit',              'users',        'Edit user profile/status'),
  ('users.delete',            'users',        'Deactivate users'),
  ('roles.view',              'roles',        'View roles and permissions'),
  ('roles.manage',            'roles',        'Create/edit roles and assign permissions'),

  -- Stores
  ('stores.view',             'stores',       'View stores'),
  ('stores.manage',           'stores',       'Create/edit/deactivate stores'),

  -- Fuel
  ('fuel.view',               'fuel',         'View fuel inventory & orders'),
  ('fuel.record_reading',     'fuel',         'Record fuel tank readings'),
  ('fuel.manage_orders',      'fuel',         'Create/approve fuel orders and deliveries'),

  -- Lottery
  ('lottery.view',            'lottery',      'View lottery data'),
  ('lottery.record',          'lottery',      'Record lottery shifts/transactions'),
  ('lottery.close_shift',     'lottery',      'Close lottery shift'),

  -- ATM
  ('atm.view',                'atm',          'View ATM data'),
  ('atm.record_event',        'atm',          'Record ATM cash events'),

  -- Vendors
  ('vendors.view',            'vendors',      'View vendors'),
  ('vendors.manage',          'vendors',      'Create/edit vendors and contracts'),

  -- Employees / schedule / payroll
  ('employees.view',          'employees',    'View employees'),
  ('employees.manage',        'employees',    'Create/edit employees and documents'),
  ('schedule.view',           'schedule',     'View shift schedule'),
  ('schedule.manage',         'schedule',     'Create/edit shifts and time entries'),
  ('payroll.view',            'payroll',      'View payroll periods and entries'),
  ('payroll.manage',          'payroll',      'Run payroll and edit entries'),

  -- Equipment & maintenance
  ('equipment.view',          'equipment',    'View equipment/assets'),
  ('equipment.manage',        'equipment',    'Create/edit equipment records'),
  ('maintenance.view',        'maintenance',  'View maintenance schedules & tasks'),
  ('maintenance.manage',      'maintenance',  'Schedule/close maintenance tasks'),

  -- Compliance
  ('compliance.view',         'compliance',   'View compliance runs'),
  ('compliance.perform',      'compliance',   'Complete compliance checklists'),
  ('compliance.manage',       'compliance',   'Create/edit checklists'),

  -- Reporting & dashboards
  ('reports.view',            'reports',      'View reports and dashboards'),
  ('reports.export',          'reports',      'Export reports'),
  ('reports.manage',          'reports',      'Create/edit report definitions')
ON CONFLICT (key) DO UPDATE
  SET module      = EXCLUDED.module,
      description = EXCLUDED.description;

-- Ensure existing rows also have `module` set
UPDATE public.permissions
   SET module = split_part(key, '.', 1)
 WHERE module IS NULL OR module = '';

CREATE INDEX IF NOT EXISTS permissions_module_idx ON public.permissions(module);

-- ---------- Grant new permissions to existing role bundles ------------
-- super_admin & owner already have full access via is_admin() bypass in RLS,
-- but we still map every permission to them so my_permissions() reports them.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r
  CROSS JOIN public.permissions p
 WHERE r.key IN ('super_admin','owner')
ON CONFLICT DO NOTHING;

-- regional_manager: full view + operational actions across all modules, no role/user admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r
  JOIN public.permissions p ON p.key = ANY (ARRAY[
    'stores.view','users.view','roles.view',
    'tickets.view','tickets.create','tickets.edit','tickets.comment','tickets.assign','tickets.close',
    'promotions.view','promotions.manage',
    'gaming.view','gaming.open_period','gaming.close_period','gaming.record_txn',
    'pnl.view','pnl.edit',
    'fuel.view','fuel.record_reading','fuel.manage_orders',
    'lottery.view','lottery.record','lottery.close_shift',
    'atm.view','atm.record_event',
    'vendors.view','vendors.manage',
    'employees.view','employees.manage',
    'schedule.view','schedule.manage',
    'payroll.view',
    'equipment.view','equipment.manage',
    'maintenance.view','maintenance.manage',
    'compliance.view','compliance.perform','compliance.manage',
    'reports.view','reports.export',
    'uploads.create','uploads.delete',
    'admin.audit'
  ])
 WHERE r.key = 'regional_manager'
ON CONFLICT DO NOTHING;

-- store_manager: operational access limited to their store (RLS enforces store scoping)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r
  JOIN public.permissions p ON p.key = ANY (ARRAY[
    'stores.view',
    'tickets.view','tickets.create','tickets.edit','tickets.comment','tickets.assign','tickets.close',
    'promotions.view','promotions.manage',
    'gaming.view','gaming.open_period','gaming.close_period','gaming.record_txn',
    'pnl.view','pnl.edit',
    'fuel.view','fuel.record_reading',
    'lottery.view','lottery.record','lottery.close_shift',
    'atm.view','atm.record_event',
    'vendors.view',
    'employees.view',
    'schedule.view','schedule.manage',
    'equipment.view',
    'maintenance.view','maintenance.manage',
    'compliance.view','compliance.perform',
    'reports.view',
    'uploads.create','uploads.delete'
  ])
 WHERE r.key = 'store_manager'
ON CONFLICT DO NOTHING;

-- employee: minimal read + own actions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r
  JOIN public.permissions p ON p.key = ANY (ARRAY[
    'stores.view',
    'tickets.view','tickets.create','tickets.comment',
    'schedule.view',
    'uploads.create'
  ])
 WHERE r.key = 'employee'
ON CONFLICT DO NOTHING;


-- ---------- 20260708191141_a25eb6c9-6ba9-4564-9217-d889c6af8075.sql ----------

-- =============================================================
-- Migration 2: Future module tables (fuel, lottery, ATM, vendors,
-- employees, schedule, payroll, equipment, maintenance, compliance,
-- reports). All with GRANTs, RLS, audit triggers.
-- =============================================================

-- Helper: standard RLS policies per store-scoped table.
-- We inline them below because Postgres has no policy templates.

-- =====================================================================
-- FUEL
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.fuel_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  grade TEXT,
  unit TEXT NOT NULL DEFAULT 'gallon',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuel_products TO authenticated;
GRANT ALL ON public.fuel_products TO service_role;
ALTER TABLE public.fuel_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fuel_products read"   ON public.fuel_products FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'fuel.view') OR public.is_admin(auth.uid()));
CREATE POLICY "fuel_products write"  ON public.fuel_products FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'admin.settings'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'admin.settings'));
CREATE TRIGGER trg_fuel_products_updated_at BEFORE UPDATE ON public.fuel_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_fuel_products AFTER INSERT OR UPDATE OR DELETE ON public.fuel_products
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('fuel');

CREATE TABLE IF NOT EXISTS public.fuel_tanks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.fuel_products(id) ON DELETE RESTRICT,
  label TEXT NOT NULL,
  capacity NUMERIC(12,2),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuel_tanks TO authenticated;
GRANT ALL ON public.fuel_tanks TO service_role;
ALTER TABLE public.fuel_tanks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fuel_tanks read"  ON public.fuel_tanks FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'fuel.view') AND public.can_access_store(auth.uid(), store_id)));
CREATE POLICY "fuel_tanks write" ON public.fuel_tanks FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'fuel.manage_orders') AND public.can_access_store(auth.uid(), store_id)))
  WITH CHECK (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'fuel.manage_orders') AND public.can_access_store(auth.uid(), store_id)));
CREATE INDEX ON public.fuel_tanks(store_id);
CREATE TRIGGER trg_fuel_tanks_updated_at BEFORE UPDATE ON public.fuel_tanks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_fuel_tanks AFTER INSERT OR UPDATE OR DELETE ON public.fuel_tanks
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('fuel');

CREATE TABLE IF NOT EXISTS public.fuel_inventory_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id UUID NOT NULL REFERENCES public.fuel_tanks(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  reading_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  volume NUMERIC(12,2) NOT NULL,
  entered_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuel_inventory_readings TO authenticated;
GRANT ALL ON public.fuel_inventory_readings TO service_role;
ALTER TABLE public.fuel_inventory_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fuel_readings read"  ON public.fuel_inventory_readings FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'fuel.view') AND public.can_access_store(auth.uid(), store_id)));
CREATE POLICY "fuel_readings write" ON public.fuel_inventory_readings FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'fuel.record_reading') AND public.can_access_store(auth.uid(), store_id)))
  WITH CHECK (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'fuel.record_reading') AND public.can_access_store(auth.uid(), store_id)));
CREATE INDEX ON public.fuel_inventory_readings(store_id, reading_at DESC);
CREATE INDEX ON public.fuel_inventory_readings(tank_id, reading_at DESC);
CREATE TRIGGER trg_fuel_readings_updated_at BEFORE UPDATE ON public.fuel_inventory_readings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_fuel_readings AFTER INSERT OR UPDATE OR DELETE ON public.fuel_inventory_readings
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('fuel');

CREATE TABLE IF NOT EXISTS public.fuel_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.fuel_products(id) ON DELETE RESTRICT,
  vendor_id UUID,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  volume NUMERIC(12,2) NOT NULL,
  unit_cost NUMERIC(12,4),
  total_cost NUMERIC(14,2),
  invoice_number TEXT,
  invoice_attachment_id UUID REFERENCES public.attachments(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuel_deliveries TO authenticated;
GRANT ALL ON public.fuel_deliveries TO service_role;
ALTER TABLE public.fuel_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fuel_deliveries read"  ON public.fuel_deliveries FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'fuel.view') AND public.can_access_store(auth.uid(), store_id)));
CREATE POLICY "fuel_deliveries write" ON public.fuel_deliveries FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'fuel.manage_orders') AND public.can_access_store(auth.uid(), store_id)))
  WITH CHECK (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'fuel.manage_orders') AND public.can_access_store(auth.uid(), store_id)));
CREATE INDEX ON public.fuel_deliveries(store_id, delivered_at DESC);
CREATE TRIGGER trg_fuel_deliveries_updated_at BEFORE UPDATE ON public.fuel_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_fuel_deliveries AFTER INSERT OR UPDATE OR DELETE ON public.fuel_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('fuel');

CREATE TABLE IF NOT EXISTS public.fuel_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.fuel_products(id) ON DELETE RESTRICT,
  vendor_id UUID,
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_at TIMESTAMPTZ,
  volume NUMERIC(12,2) NOT NULL,
  unit_price NUMERIC(12,4),
  status TEXT NOT NULL DEFAULT 'draft', -- draft|ordered|received|cancelled
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuel_orders TO authenticated;
GRANT ALL ON public.fuel_orders TO service_role;
ALTER TABLE public.fuel_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fuel_orders read"  ON public.fuel_orders FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'fuel.view') AND public.can_access_store(auth.uid(), store_id)));
CREATE POLICY "fuel_orders write" ON public.fuel_orders FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'fuel.manage_orders') AND public.can_access_store(auth.uid(), store_id)))
  WITH CHECK (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'fuel.manage_orders') AND public.can_access_store(auth.uid(), store_id)));
CREATE INDEX ON public.fuel_orders(store_id, status);
CREATE TRIGGER trg_fuel_orders_updated_at BEFORE UPDATE ON public.fuel_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_fuel_orders AFTER INSERT OR UPDATE OR DELETE ON public.fuel_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('fuel');

-- =====================================================================
-- LOTTERY
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.lottery_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ticket_price NUMERIC(10,2),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lottery_games TO authenticated;
GRANT ALL ON public.lottery_games TO service_role;
ALTER TABLE public.lottery_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lottery_games read"  ON public.lottery_games FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'lottery.view') OR public.is_admin(auth.uid()));
CREATE POLICY "lottery_games write" ON public.lottery_games FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'admin.settings'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'admin.settings'));
CREATE TRIGGER trg_lottery_games_updated_at BEFORE UPDATE ON public.lottery_games
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_lottery_games AFTER INSERT OR UPDATE OR DELETE ON public.lottery_games
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('lottery');

CREATE TABLE IF NOT EXISTS public.lottery_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end   TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open', -- open|closed
  opened_by UUID REFERENCES auth.users(id),
  closed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lottery_shifts TO authenticated;
GRANT ALL ON public.lottery_shifts TO service_role;
ALTER TABLE public.lottery_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lottery_shifts read"  ON public.lottery_shifts FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'lottery.view') AND public.can_access_store(auth.uid(), store_id)));
CREATE POLICY "lottery_shifts write" ON public.lottery_shifts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'lottery.record') AND public.can_access_store(auth.uid(), store_id)))
  WITH CHECK (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'lottery.record') AND public.can_access_store(auth.uid(), store_id)));
CREATE INDEX ON public.lottery_shifts(store_id, period_start DESC);
CREATE TRIGGER trg_lottery_shifts_updated_at BEFORE UPDATE ON public.lottery_shifts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_lottery_shifts AFTER INSERT OR UPDATE OR DELETE ON public.lottery_shifts
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('lottery');

CREATE TABLE IF NOT EXISTS public.lottery_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.lottery_shifts(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.lottery_games(id) ON DELETE RESTRICT,
  sold      NUMERIC(12,2) NOT NULL DEFAULT 0,
  redeemed  NUMERIC(12,2) NOT NULL DEFAULT 0,
  activated NUMERIC(12,2) NOT NULL DEFAULT 0,
  returned  NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lottery_transactions TO authenticated;
GRANT ALL ON public.lottery_transactions TO service_role;
ALTER TABLE public.lottery_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lottery_txn read"  ON public.lottery_transactions FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'lottery.view') AND public.can_access_store(auth.uid(), store_id)));
CREATE POLICY "lottery_txn write" ON public.lottery_transactions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'lottery.record') AND public.can_access_store(auth.uid(), store_id)))
  WITH CHECK (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'lottery.record') AND public.can_access_store(auth.uid(), store_id)));
CREATE INDEX ON public.lottery_transactions(shift_id);
CREATE INDEX ON public.lottery_transactions(store_id);
CREATE TRIGGER trg_lottery_txn_updated_at BEFORE UPDATE ON public.lottery_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_lottery_txn AFTER INSERT OR UPDATE OR DELETE ON public.lottery_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('lottery');

-- =====================================================================
-- ATM
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.atm_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  serial TEXT,
  provider TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atm_machines TO authenticated;
GRANT ALL ON public.atm_machines TO service_role;
ALTER TABLE public.atm_machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "atm_machines read"  ON public.atm_machines FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'atm.view') AND public.can_access_store(auth.uid(), store_id)));
CREATE POLICY "atm_machines write" ON public.atm_machines FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'admin.settings'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'admin.settings'));
CREATE INDEX ON public.atm_machines(store_id);
CREATE TRIGGER trg_atm_machines_updated_at BEFORE UPDATE ON public.atm_machines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_atm_machines AFTER INSERT OR UPDATE OR DELETE ON public.atm_machines
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('atm');

CREATE TABLE IF NOT EXISTS public.atm_cash_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atm_id UUID NOT NULL REFERENCES public.atm_machines(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, -- load|withdraw|reconcile
  amount NUMERIC(12,2) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  by_user UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atm_cash_events TO authenticated;
GRANT ALL ON public.atm_cash_events TO service_role;
ALTER TABLE public.atm_cash_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "atm_events read"  ON public.atm_cash_events FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'atm.view') AND public.can_access_store(auth.uid(), store_id)));
CREATE POLICY "atm_events write" ON public.atm_cash_events FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'atm.record_event') AND public.can_access_store(auth.uid(), store_id)))
  WITH CHECK (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'atm.record_event') AND public.can_access_store(auth.uid(), store_id)));
CREATE INDEX ON public.atm_cash_events(store_id, occurred_at DESC);
CREATE TRIGGER trg_atm_events_updated_at BEFORE UPDATE ON public.atm_cash_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_atm_events AFTER INSERT OR UPDATE OR DELETE ON public.atm_cash_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('atm');

CREATE TABLE IF NOT EXISTS public.atm_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atm_id UUID NOT NULL REFERENCES public.atm_machines(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  transactions INT,
  total_dispensed NUMERIC(14,2),
  fees NUMERIC(12,2),
  attachment_id UUID REFERENCES public.attachments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atm_reports TO authenticated;
GRANT ALL ON public.atm_reports TO service_role;
ALTER TABLE public.atm_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "atm_reports read"  ON public.atm_reports FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'atm.view') AND public.can_access_store(auth.uid(), store_id)));
CREATE POLICY "atm_reports write" ON public.atm_reports FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'atm.record_event') AND public.can_access_store(auth.uid(), store_id)))
  WITH CHECK (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'atm.record_event') AND public.can_access_store(auth.uid(), store_id)));
CREATE INDEX ON public.atm_reports(store_id, period_start DESC);
CREATE TRIGGER trg_atm_reports_updated_at BEFORE UPDATE ON public.atm_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_atm_reports AFTER INSERT OR UPDATE OR DELETE ON public.atm_reports
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('atm');

-- =====================================================================
-- VENDORS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_id TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendors read"  ON public.vendors FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'vendors.view') OR public.is_admin(auth.uid()));
CREATE POLICY "vendors write" ON public.vendors FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'vendors.manage'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'vendors.manage'));
CREATE INDEX ON public.vendors(name);
CREATE TRIGGER trg_vendors_updated_at BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_vendors AFTER INSERT OR UPDATE OR DELETE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('vendors');

-- Back-fill FK from fuel tables now that vendors exists
ALTER TABLE public.fuel_deliveries
  ADD CONSTRAINT fuel_deliveries_vendor_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;
ALTER TABLE public.fuel_orders
  ADD CONSTRAINT fuel_orders_vendor_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.vendor_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_contacts TO authenticated;
GRANT ALL ON public.vendor_contacts TO service_role;
ALTER TABLE public.vendor_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendor_contacts read"  ON public.vendor_contacts FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'vendors.view') OR public.is_admin(auth.uid()));
CREATE POLICY "vendor_contacts write" ON public.vendor_contacts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'vendors.manage'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'vendors.manage'));
CREATE INDEX ON public.vendor_contacts(vendor_id);
CREATE TRIGGER trg_vendor_contacts_updated_at BEFORE UPDATE ON public.vendor_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_vendor_contacts AFTER INSERT OR UPDATE OR DELETE ON public.vendor_contacts
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('vendors');

CREATE TABLE IF NOT EXISTS public.vendor_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  starts_at DATE,
  ends_at   DATE,
  terms TEXT,
  attachment_id UUID REFERENCES public.attachments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_contracts TO authenticated;
GRANT ALL ON public.vendor_contracts TO service_role;
ALTER TABLE public.vendor_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendor_contracts read"  ON public.vendor_contracts FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'vendors.view') OR public.is_admin(auth.uid()));
CREATE POLICY "vendor_contracts write" ON public.vendor_contracts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'vendors.manage'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'vendors.manage'));
CREATE INDEX ON public.vendor_contracts(vendor_id);
CREATE TRIGGER trg_vendor_contracts_updated_at BEFORE UPDATE ON public.vendor_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_vendor_contracts AFTER INSERT OR UPDATE OR DELETE ON public.vendor_contracts
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('vendors');

-- =====================================================================
-- EMPLOYEES / SCHEDULE / TIME / PAYROLL
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  position_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  hire_date DATE,
  termination_date DATE,
  hourly_rate NUMERIC(10,2),
  salary NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'active', -- active|on_leave|terminated
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees read"  ON public.employees FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid())
      OR (public.has_permission(auth.uid(),'employees.view')
          AND (store_id IS NULL OR public.can_access_store(auth.uid(), store_id)))
      OR user_id = auth.uid());
CREATE POLICY "employees write" ON public.employees FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())
      OR (public.has_permission(auth.uid(),'employees.manage')
          AND (store_id IS NULL OR public.can_access_store(auth.uid(), store_id))))
  WITH CHECK (public.is_admin(auth.uid())
      OR (public.has_permission(auth.uid(),'employees.manage')
          AND (store_id IS NULL OR public.can_access_store(auth.uid(), store_id))));
CREATE INDEX ON public.employees(store_id, status);
CREATE INDEX ON public.employees(last_name);
CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_employees AFTER INSERT OR UPDATE OR DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('employees');

CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at   TIMESTAMPTZ NOT NULL,
  role TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled|confirmed|completed|missed|cancelled
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shifts read"  ON public.shifts FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid())
      OR (public.has_permission(auth.uid(),'schedule.view') AND public.can_access_store(auth.uid(), store_id))
      OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = shifts.employee_id AND e.user_id = auth.uid()));
CREATE POLICY "shifts write" ON public.shifts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'schedule.manage') AND public.can_access_store(auth.uid(), store_id)))
  WITH CHECK (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'schedule.manage') AND public.can_access_store(auth.uid(), store_id)));
CREATE INDEX ON public.shifts(store_id, starts_at);
CREATE INDEX ON public.shifts(employee_id, starts_at);
CREATE TRIGGER trg_shifts_updated_at BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_shifts AFTER INSERT OR UPDATE OR DELETE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('schedule');

CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  clock_in  TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'manual', -- manual|kiosk|import
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "time_entries read"  ON public.time_entries FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid())
      OR (public.has_permission(auth.uid(),'schedule.view') AND public.can_access_store(auth.uid(), store_id))
      OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = time_entries.employee_id AND e.user_id = auth.uid()));
CREATE POLICY "time_entries write" ON public.time_entries FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'schedule.manage') AND public.can_access_store(auth.uid(), store_id)))
  WITH CHECK (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'schedule.manage') AND public.can_access_store(auth.uid(), store_id)));
CREATE INDEX ON public.time_entries(store_id, clock_in);
CREATE INDEX ON public.time_entries(employee_id, clock_in);
CREATE TRIGGER trg_time_entries_updated_at BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_time_entries AFTER INSERT OR UPDATE OR DELETE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('schedule');

CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft|processing|paid|closed
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_start, period_end)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_periods TO authenticated;
GRANT ALL ON public.payroll_periods TO service_role;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_periods read"  ON public.payroll_periods FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'payroll.view') OR public.is_admin(auth.uid()));
CREATE POLICY "payroll_periods write" ON public.payroll_periods FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'payroll.manage'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'payroll.manage'));
CREATE TRIGGER trg_payroll_periods_updated_at BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_payroll_periods AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('payroll');

CREATE TABLE IF NOT EXISTS public.payroll_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  regular_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  ot_hours      NUMERIC(10,2) NOT NULL DEFAULT 0,
  gross         NUMERIC(12,2) NOT NULL DEFAULT 0,
  deductions    JSONB NOT NULL DEFAULT '{}'::jsonb,
  net           NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_id, employee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_entries TO authenticated;
GRANT ALL ON public.payroll_entries TO service_role;
ALTER TABLE public.payroll_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_entries read"  ON public.payroll_entries FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid())
      OR public.has_permission(auth.uid(),'payroll.view')
      OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = payroll_entries.employee_id AND e.user_id = auth.uid()));
CREATE POLICY "payroll_entries write" ON public.payroll_entries FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'payroll.manage'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'payroll.manage'));
CREATE INDEX ON public.payroll_entries(period_id);
CREATE INDEX ON public.payroll_entries(employee_id);
CREATE TRIGGER trg_payroll_entries_updated_at BEFORE UPDATE ON public.payroll_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_payroll_entries AFTER INSERT OR UPDATE OR DELETE ON public.payroll_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('payroll');

-- =====================================================================
-- EQUIPMENT & MAINTENANCE
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  serial TEXT,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  purchased_at DATE,
  warranty_until DATE,
  status TEXT NOT NULL DEFAULT 'in_service', -- in_service|repair|retired
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment TO authenticated;
GRANT ALL ON public.equipment TO service_role;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipment read"  ON public.equipment FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'equipment.view') AND public.can_access_store(auth.uid(), store_id)));
CREATE POLICY "equipment write" ON public.equipment FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'equipment.manage') AND public.can_access_store(auth.uid(), store_id)))
  WITH CHECK (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'equipment.manage') AND public.can_access_store(auth.uid(), store_id)));
CREATE INDEX ON public.equipment(store_id, status);
CREATE TRIGGER trg_equipment_updated_at BEFORE UPDATE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_equipment AFTER INSERT OR UPDATE OR DELETE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('equipment');

CREATE TABLE IF NOT EXISTS public.maintenance_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  interval_days INT NOT NULL,
  next_due DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_schedules TO authenticated;
GRANT ALL ON public.maintenance_schedules TO service_role;
ALTER TABLE public.maintenance_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mschedules read"  ON public.maintenance_schedules FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'maintenance.view') AND public.can_access_store(auth.uid(), store_id)));
CREATE POLICY "mschedules write" ON public.maintenance_schedules FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'maintenance.manage') AND public.can_access_store(auth.uid(), store_id)))
  WITH CHECK (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'maintenance.manage') AND public.can_access_store(auth.uid(), store_id)));
CREATE INDEX ON public.maintenance_schedules(store_id, next_due);
CREATE TRIGGER trg_mschedules_updated_at BEFORE UPDATE ON public.maintenance_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_mschedules AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_schedules
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('maintenance');

CREATE TABLE IF NOT EXISTS public.maintenance_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.maintenance_schedules(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  scheduled_for DATE,
  completed_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES auth.users(id),
  cost NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_tasks TO authenticated;
GRANT ALL ON public.maintenance_tasks TO service_role;
ALTER TABLE public.maintenance_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mtasks read"  ON public.maintenance_tasks FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'maintenance.view') AND public.can_access_store(auth.uid(), store_id)));
CREATE POLICY "mtasks write" ON public.maintenance_tasks FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'maintenance.manage') AND public.can_access_store(auth.uid(), store_id)))
  WITH CHECK (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'maintenance.manage') AND public.can_access_store(auth.uid(), store_id)));
CREATE INDEX ON public.maintenance_tasks(store_id, scheduled_for);
CREATE INDEX ON public.maintenance_tasks(equipment_id);
CREATE TRIGGER trg_mtasks_updated_at BEFORE UPDATE ON public.maintenance_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_mtasks AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_tasks
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('maintenance');

-- =====================================================================
-- COMPLIANCE
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.compliance_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cadence TEXT, -- daily|weekly|monthly|quarterly|annual|adhoc
  active BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_checklists TO authenticated;
GRANT ALL ON public.compliance_checklists TO service_role;
ALTER TABLE public.compliance_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklists read"  ON public.compliance_checklists FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'compliance.view') OR public.is_admin(auth.uid()));
CREATE POLICY "checklists write" ON public.compliance_checklists FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'compliance.manage'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'compliance.manage'));
CREATE TRIGGER trg_checklists_updated_at BEFORE UPDATE ON public.compliance_checklists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_checklists AFTER INSERT OR UPDATE OR DELETE ON public.compliance_checklists
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('compliance');

CREATE TABLE IF NOT EXISTS public.compliance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.compliance_checklists(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  help TEXT,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_items TO authenticated;
GRANT ALL ON public.compliance_items TO service_role;
ALTER TABLE public.compliance_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compliance_items read"  ON public.compliance_items FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'compliance.view') OR public.is_admin(auth.uid()));
CREATE POLICY "compliance_items write" ON public.compliance_items FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'compliance.manage'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'compliance.manage'));
CREATE INDEX ON public.compliance_items(checklist_id, sort_order);
CREATE TRIGGER trg_compliance_items_updated_at BEFORE UPDATE ON public.compliance_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_compliance_items AFTER INSERT OR UPDATE OR DELETE ON public.compliance_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('compliance');

CREATE TABLE IF NOT EXISTS public.compliance_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.compliance_checklists(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  score NUMERIC(6,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_runs TO authenticated;
GRANT ALL ON public.compliance_runs TO service_role;
ALTER TABLE public.compliance_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compliance_runs read"  ON public.compliance_runs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'compliance.view') AND public.can_access_store(auth.uid(), store_id)));
CREATE POLICY "compliance_runs write" ON public.compliance_runs FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'compliance.perform') AND public.can_access_store(auth.uid(), store_id)))
  WITH CHECK (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'compliance.perform') AND public.can_access_store(auth.uid(), store_id)));
CREATE INDEX ON public.compliance_runs(store_id, due_at);
CREATE TRIGGER trg_compliance_runs_updated_at BEFORE UPDATE ON public.compliance_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_compliance_runs AFTER INSERT OR UPDATE OR DELETE ON public.compliance_runs
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('compliance');

CREATE TABLE IF NOT EXISTS public.compliance_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.compliance_runs(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.compliance_items(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  answer TEXT, -- yes|no|na|value
  notes TEXT,
  attachment_id UUID REFERENCES public.attachments(id) ON DELETE SET NULL,
  responded_by UUID REFERENCES auth.users(id),
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_responses TO authenticated;
GRANT ALL ON public.compliance_responses TO service_role;
ALTER TABLE public.compliance_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compliance_resp read"  ON public.compliance_responses FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'compliance.view') AND public.can_access_store(auth.uid(), store_id)));
CREATE POLICY "compliance_resp write" ON public.compliance_responses FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'compliance.perform') AND public.can_access_store(auth.uid(), store_id)))
  WITH CHECK (public.is_admin(auth.uid()) OR (public.has_permission(auth.uid(),'compliance.perform') AND public.can_access_store(auth.uid(), store_id)));
CREATE INDEX ON public.compliance_responses(run_id);
CREATE TRIGGER trg_compliance_resp_updated_at BEFORE UPDATE ON public.compliance_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_compliance_resp AFTER INSERT OR UPDATE OR DELETE ON public.compliance_responses
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('compliance');

-- =====================================================================
-- REPORTING
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.report_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  module TEXT NOT NULL,
  description TEXT,
  sql_snippet TEXT NOT NULL, -- whitelisted, admin only
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_definitions TO authenticated;
GRANT ALL ON public.report_definitions TO service_role;
ALTER TABLE public.report_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_defs read"  ON public.report_definitions FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'reports.view') OR public.is_admin(auth.uid()));
CREATE POLICY "report_defs write" ON public.report_definitions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'reports.manage'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'reports.manage'));
CREATE TRIGGER trg_report_defs_updated_at BEFORE UPDATE ON public.report_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_report_defs AFTER INSERT OR UPDATE OR DELETE ON public.report_definitions
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('reports');

CREATE TABLE IF NOT EXISTS public.report_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES public.report_definitions(id) ON DELETE CASCADE,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id),
  output_attachment_id UUID REFERENCES public.attachments(id) ON DELETE SET NULL,
  summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_snapshots TO authenticated;
GRANT ALL ON public.report_snapshots TO service_role;
ALTER TABLE public.report_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_snaps read"  ON public.report_snapshots FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'reports.view') OR public.is_admin(auth.uid()));
CREATE POLICY "report_snaps write" ON public.report_snapshots FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'reports.export'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'reports.export'));
CREATE INDEX ON public.report_snapshots(definition_id, generated_at DESC);
CREATE TRIGGER trg_report_snaps_updated_at BEFORE UPDATE ON public.report_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_report_snaps AFTER INSERT OR UPDATE OR DELETE ON public.report_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit('reports');


-- ---------- 20260708191900_6234c520-9994-4659-a882-e6c530cc9ab8.sql ----------
DROP POLICY IF EXISTS "stores_admin_write" ON public.stores;
CREATE POLICY "stores_manage_write" ON public.stores
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'stores.manage') OR public.has_permission(auth.uid(),'admin.stores'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'stores.manage') OR public.has_permission(auth.uid(),'admin.stores'));

-- ---------- 20260708194947_d12d9772-5f27-40fc-994a-aa5190412271.sql ----------

-- 1) Add image_url to promotions
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS image_url text;

-- 2) Public (anon) read of stores for the marketing site
GRANT SELECT ON public.stores TO anon;
DROP POLICY IF EXISTS stores_public_read ON public.stores;
CREATE POLICY stores_public_read ON public.stores
  FOR SELECT TO anon
  USING (active = true);

-- 3) Public (anon) read of currently-active promotions
GRANT SELECT ON public.promotions TO anon;
DROP POLICY IF EXISTS promotions_public_read ON public.promotions;
CREATE POLICY promotions_public_read ON public.promotions
  FOR SELECT TO anon
  USING (
    status = 'active'
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at   IS NULL OR ends_at   >= now())
  );


-- ---------- 20260708201341_96a6df19-69ab-4016-8c27-4c64bba84dd1.sql ----------

-- Public read for promotion images
CREATE POLICY "Public read promotion-images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'promotion-images');

CREATE POLICY "Authenticated write promotion-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'promotion-images');

CREATE POLICY "Authenticated update promotion-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'promotion-images');

CREATE POLICY "Authenticated delete promotion-images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'promotion-images');

-- Public read for location photos
CREATE POLICY "Public read location-photos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'location-photos');

CREATE POLICY "Authenticated write location-photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'location-photos');

CREATE POLICY "Authenticated update location-photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'location-photos');

CREATE POLICY "Authenticated delete location-photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'location-photos');

