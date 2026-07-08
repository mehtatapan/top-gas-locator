
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
