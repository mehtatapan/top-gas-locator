
-- Add kiosk amounts to gaming_periods
ALTER TABLE public.gaming_periods
  ADD COLUMN IF NOT EXISTS starting_kiosk_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ending_kiosk_amount numeric NULL;

-- New unified entries table for a gaming period
CREATE TABLE IF NOT EXISTS public.gaming_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.gaming_periods(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('gaming_machine','kiosk_add','bank_deposit','cash_on_side','manual_payout')),
  amount numeric NOT NULL DEFAULT 0,
  -- For gaming_machine entries:
  kiosk_current numeric NULL,          -- money in the kiosk at that moment
  bank_deposit_split numeric NULL,     -- portion going to bank
  cash_on_side_split numeric NULL,     -- portion set aside as cash
  kiosk_added_split numeric NULL,      -- portion put back into the kiosk
  notes text NULL,
  reason text NULL,                    -- for manual_payout / bank_deposit memo
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gaming_entries TO authenticated;
GRANT ALL ON public.gaming_entries TO service_role;

ALTER TABLE public.gaming_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gaming_entries_read"
  ON public.gaming_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gaming_periods gp
      WHERE gp.id = gaming_entries.period_id
        AND public.can_access_store(auth.uid(), gp.store_id)
    )
  );

CREATE POLICY "gaming_entries_write"
  ON public.gaming_entries FOR ALL
  TO authenticated
  USING (
    public.has_permission(auth.uid(), 'gaming.record_txn')
    AND EXISTS (
      SELECT 1 FROM public.gaming_periods gp
      WHERE gp.id = gaming_entries.period_id
        AND public.can_access_store(auth.uid(), gp.store_id)
    )
  )
  WITH CHECK (
    public.has_permission(auth.uid(), 'gaming.record_txn')
    AND EXISTS (
      SELECT 1 FROM public.gaming_periods gp
      WHERE gp.id = gaming_entries.period_id
        AND public.can_access_store(auth.uid(), gp.store_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_gaming_entries_period ON public.gaming_entries(period_id, occurred_at DESC);

CREATE TRIGGER trg_gaming_entries_updated_at
  BEFORE UPDATE ON public.gaming_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
