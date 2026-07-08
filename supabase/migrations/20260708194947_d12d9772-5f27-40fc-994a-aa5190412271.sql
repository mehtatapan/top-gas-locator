
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
