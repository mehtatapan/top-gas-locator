import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LocationStoreRow {
  id: string;
  slug: string;
  name: string;
  meta: {
    photos?: {
      hero?: string;
      interior?: string;
      products?: string;
    };
  } | null;
}

export interface PublicPromotion {
  id: string;
  store_id: string | null;
  title: string;
  description: string | null;
  image_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  priority: number | null;
}

/** Fetch the store row for a public location slug (matches locations[].id). */
export function useLocationStore(slug: string | undefined) {
  return useQuery({
    enabled: !!slug,
    queryKey: ["public", "store", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, slug, name, meta")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as LocationStoreRow | null;
    },
  });
}

/** Active promotions for a store (including chain-wide). RLS filters to active + in-window. */
export function usePublicPromotions(storeId: string | undefined) {
  return useQuery({
    enabled: !!storeId,
    queryKey: ["public", "promotions", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("id, store_id, title, description, image_url, starts_at, ends_at, priority, promotion_stores(store_id)")
        .order("priority", { ascending: true, nullsFirst: false })
        .order("starts_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      type Row = PublicPromotion & { promotion_stores: { store_id: string }[] | null };
      const rows = (data ?? []) as unknown as Row[];
      return rows
        .filter((r) => {
          const links = r.promotion_stores ?? [];
          // No links = chain-wide (visible to every store). Otherwise must include this store.
          if (links.length === 0) return true;
          return links.some((l) => l.store_id === storeId);
        })
        .map(({ promotion_stores, ...p }) => ({
          ...p,
          // Expose chain-wide as store_id=null so the UI "All stores" badge keeps working.
          store_id: (promotion_stores?.length ?? 0) === 0 ? null : storeId!,
        })) as PublicPromotion[];
    },
  });
}
