
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
