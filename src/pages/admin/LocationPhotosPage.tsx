import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ImageIcon, Save } from "lucide-react";

interface StoreRow {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  active: boolean;
  meta: Record<string, unknown> | null;
}

interface PhotoSet {
  hero: string;
  interior: string;
  products: string;
}

const EMPTY: PhotoSet = { hero: "", interior: "", products: "" };

function extractPhotos(meta: Record<string, unknown> | null | undefined): PhotoSet {
  const p = (meta?.photos ?? {}) as Partial<PhotoSet>;
  return {
    hero: p.hero ?? "",
    interior: p.interior ?? "",
    products: p.products ?? "",
  };
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
          Update the photos displayed on each location's public page. Paste an image URL for
          each slot. Leave blank to use a default stock photo.
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
  const [photos, setPhotos] = useState<PhotoSet>(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPhotos(extractPhotos(store.meta));
  }, [store.meta]);

  const update = (patch: Partial<PhotoSet>) => setPhotos((p) => ({ ...p, ...patch }));

  const save = useMutation({
    mutationFn: async () => {
      const nextMeta = { ...(store.meta ?? {}), photos };
      const { error } = await supabase
        .from("stores")
        .update({ meta: nextMeta })
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
            {store.city ? ` · ${store.city}` : ""}
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

      <div className="grid gap-4 md:grid-cols-3">
        <PhotoField
          label="Hero (large)"
          value={photos.hero}
          onChange={(v) => update({ hero: v })}
          disabled={!canManage}
        />
        <PhotoField
          label="Interior"
          value={photos.interior}
          onChange={(v) => update({ interior: v })}
          disabled={!canManage}
        />
        <PhotoField
          label="Products"
          value={photos.products}
          onChange={(v) => update({ products: v })}
          disabled={!canManage}
        />
      </div>
    </div>
  );
}

function PhotoField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-md border bg-muted">
        {value ? (
          <img
            src={value}
            alt={label}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.opacity = "0.2";
            }}
          />
        ) : (
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <Input
        value={value}
        placeholder="https://…/photo.jpg"
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
