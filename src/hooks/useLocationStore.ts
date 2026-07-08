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
        .select("id, store_id, title, description, image_url, starts_at, ends_at, priority")
        .or(`store_id.eq.${storeId},store_id.is.null`)
        .order("priority", { ascending: true, nullsFirst: false })
        .order("starts_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as PublicPromotion[];
    },
  });
}
