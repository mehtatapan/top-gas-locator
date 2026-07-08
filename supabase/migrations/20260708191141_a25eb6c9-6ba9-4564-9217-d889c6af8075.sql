
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
