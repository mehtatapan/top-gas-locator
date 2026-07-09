
CREATE TABLE public.promotion_stores (
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (promotion_id, store_id)
);

GRANT SELECT ON public.promotion_stores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotion_stores TO authenticated;
GRANT ALL ON public.promotion_stores TO service_role;

ALTER TABLE public.promotion_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotion_stores_public_read" ON public.promotion_stores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.promotions p
      WHERE p.id = promotion_stores.promotion_id
        AND p.status = 'active'
        AND (p.starts_at IS NULL OR p.starts_at <= now())
        AND (p.ends_at IS NULL OR p.ends_at >= now())
    )
  );

CREATE POLICY "promotion_stores_read" ON public.promotion_stores
  FOR SELECT USING (has_permission(auth.uid(), 'promotions.view') OR is_admin(auth.uid()));

CREATE POLICY "promotion_stores_write" ON public.promotion_stores
  FOR ALL USING (has_permission(auth.uid(), 'promotions.manage') OR is_admin(auth.uid()))
  WITH CHECK (has_permission(auth.uid(), 'promotions.manage') OR is_admin(auth.uid()));

CREATE INDEX idx_promotion_stores_store ON public.promotion_stores(store_id);

-- Backfill existing single-store promotions into the junction table
INSERT INTO public.promotion_stores (promotion_id, store_id)
SELECT id, store_id FROM public.promotions WHERE store_id IS NOT NULL
ON CONFLICT DO NOTHING;
