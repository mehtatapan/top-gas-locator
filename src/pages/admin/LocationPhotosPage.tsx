import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Save, Trash2, ArrowUp, ArrowDown, Star } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";

interface StoreRow {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  active: boolean;
  meta: Record<string, unknown> | null;
}

/** Extract an ordered gallery, merging any legacy hero/interior/products keys. */
function extractGallery(meta: Record<string, unknown> | null | undefined): string[] {
  const p = (meta?.photos ?? {}) as {
    gallery?: unknown;
    hero?: unknown;
    interior?: unknown;
    products?: unknown;
  };
  if (Array.isArray(p.gallery)) {
    return p.gallery.filter((x): x is string => typeof x === "string" && x.trim() !== "");
  }
  return [p.hero, p.interior, p.products].filter(
    (x): x is string => typeof x === "string" && x.trim() !== "",
  );
}

export default function LocationPhotosPage() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const canManage = can("stores.manage") || can("admin.stores");

  const storesQ = useQuery({
    queryKey: ["admin", "stores-photos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, slug, name, city, active, meta")
        .order("name");
      if (error) throw error;
      return data as unknown as StoreRow[];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Location Photos</h1>
        <p className="text-sm text-muted-foreground">
          Add as many photos as you like for each store. The first 3 are shown as the main
          gallery on the public location page; the rest appear behind a "+ See more" button.
          Use the arrows to reorder — top items are the featured ones.
        </p>
      </div>

      {storesQ.isLoading && <p className="text-muted-foreground">Loading stores…</p>}
      {storesQ.error && (
        <p className="text-destructive">{(storesQ.error as Error).message}</p>
      )}

      <div className="grid gap-4">
        {(storesQ.data ?? []).map((store) => (
          <StoreCard
            key={store.id}
            store={store}
            canManage={canManage}
            onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "stores-photos"] })}
          />
        ))}
      </div>
    </div>
  );
}

function StoreCard({
  store,
  canManage,
  onSaved,
}: {
  store: StoreRow;
  canManage: boolean;
  onSaved: () => void;
}) {
  const [gallery, setGallery] = useState<string[]>([]);
  const [pending, setPending] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setGallery(extractGallery(store.meta));
  }, [store.meta]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= gallery.length) return;
    const next = [...gallery];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setGallery(next);
  };

  const remove = (i: number) => setGallery((g) => g.filter((_, idx) => idx !== i));

  const addPending = () => {
    if (!pending.trim()) return;
    setGallery((g) => [...g, pending.trim()]);
    setPending("");
  };

  const save = useMutation({
    mutationFn: async () => {
      const cleaned = gallery.map((s) => s.trim()).filter(Boolean);
      const prevMeta = (store.meta ?? {}) as Record<string, unknown>;
      const prevPhotos = (prevMeta.photos ?? {}) as Record<string, unknown>;
      // Keep gallery as the source of truth; drop legacy hero/interior/products.
      const nextPhotos = { ...prevPhotos, gallery: cleaned };
      delete (nextPhotos as Record<string, unknown>).hero;
      delete (nextPhotos as Record<string, unknown>).interior;
      delete (nextPhotos as Record<string, unknown>).products;
      const nextMeta = { ...prevMeta, photos: nextPhotos };
      const { error } = await supabase
        .from("stores")
        .update({ meta: nextMeta as never })
        .eq("id", store.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: `Photos updated for ${store.name}` });
      onSaved();
    },
    onError: (e: Error) =>
      toast({ title: "Save failed", description: e.message, variant: "destructive" }),
    onSettled: () => setBusy(false),
  });

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{store.name}</h2>
          <p className="text-xs text-muted-foreground">
            /location/{store.slug}
            {store.city ? ` · ${store.city}` : ""} · {gallery.length} photo
            {gallery.length === 1 ? "" : "s"}
          </p>
        </div>
        {canManage && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              save.mutate();
            }}
          >
            <Save className="mr-2 h-4 w-4" />
            {busy ? "Saving…" : "Save"}
          </Button>
        )}
      </div>

      {gallery.length === 0 && (
        <p className="mb-4 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          No photos yet. Add one below.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {gallery.map((src, i) => (
          <div key={`${src}-${i}`} className="overflow-hidden rounded-md border bg-muted">
            <div className="relative aspect-video">
              <img src={src} alt={`photo ${i + 1}`} className="h-full w-full object-cover" />
              {i < 3 && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  <Star className="h-3 w-3" /> Main #{i + 1}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-1 p-2">
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  disabled={!canManage || i === 0}
                  onClick={() => move(i, i - 1)}
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  disabled={!canManage || i === gallery.length - 1}
                  onClick={() => move(i, i + 1)}
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Button
                size="icon"
                variant="ghost"
                disabled={!canManage}
                onClick={() => remove(i)}
                aria-label="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {canManage && (
        <div className="mt-4 rounded-md border border-dashed p-4">
          <p className="mb-2 text-sm font-medium">Add a photo</p>
          <ImageUpload
            value={pending}
            onChange={(v) => {
              setPending(v);
              // If the user uploaded an image (URL was set), auto-add it to the gallery.
              if (v && v.trim() !== "") {
                setGallery((g) => [...g, v.trim()]);
                setPending("");
              }
            }}
            module="location-photos"
            subPath={`${store.slug}/gallery`}
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={addPending} disabled={!pending.trim()}>
              Add pasted URL
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Don't forget to click <b>Save</b> at the top after reordering or removing photos.
          </p>
        </div>
      )}
    </div>
  );
}
