
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
