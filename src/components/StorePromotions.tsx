import { useState } from "react";
import { Tag, Plus, X } from "lucide-react";
import type { PublicPromotion } from "@/hooks/useLocationStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageLightbox } from "@/components/ImageLightbox";
import { Button } from "@/components/ui/button";

interface StorePromotionsProps {
  locationName: string;
  promotions: PublicPromotion[];
  loading?: boolean;
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=600&auto=format&fit=crop";

const MAIN_COUNT = 4;

function windowLabel(p: PublicPromotion): string | null {
  if (p.ends_at) {
    return `Ends ${new Date(p.ends_at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })}`;
  }
  if (p.starts_at) return "Limited time offer";
  return "While supplies last";
}

function PromoCard({
  promo,
  onImageClick,
}: {
  promo: PublicPromotion;
  onImageClick: (src: string, alt: string) => void;
}) {
  const label = windowLabel(promo);
  const src = promo.image_url || FALLBACK_IMAGE;
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl bg-[hsl(var(--card-elevated))] card-shadow transition-all duration-300 hover:-translate-y-1 hover:elevated-shadow">
      <button
        type="button"
        onClick={() => onImageClick(src, promo.title)}
        className="relative block aspect-[4/5] w-full overflow-hidden bg-muted"
        aria-label={`View full poster: ${promo.title}`}
      >
        <img
          src={src}
          alt={promo.title}
          className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        {label && (
          <div className="absolute bottom-2 left-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
            {label}
          </div>
        )}
        {promo.store_id === null && (
          <div className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            All stores
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100">
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-foreground">
            View full poster
          </span>
        </div>
      </button>
      <div className="flex-1 p-3">
        <h3 className="mb-1 font-display text-sm font-bold leading-tight text-foreground line-clamp-2">
          {promo.title}
        </h3>
        {promo.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{promo.description}</p>
        )}
      </div>
    </div>
  );
}

export const StorePromotions = ({ locationName, promotions, loading }: StorePromotionsProps) => {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [allOpen, setAllOpen] = useState(false);

  if (!loading && promotions.length === 0) return null;

  const main = promotions.slice(0, MAIN_COUNT);
  const extraCount = Math.max(0, promotions.length - MAIN_COUNT);

  const openImg = (src: string, alt: string) => setLightbox({ src, alt });

  return (
    <section className="bg-gradient-to-br from-primary/5 to-accent/10 py-16">
      <div className="container">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
            <Tag className="h-5 w-5 text-primary" />
            <span className="font-semibold text-primary">In-Store Deals</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            Current Promotions
          </h2>
          <p className="mt-2 text-muted-foreground">
            Check out what's on sale at {locationName}
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {main.map((p) => (
                <PromoCard key={p.id} promo={p} onImageClick={openImg} />
              ))}
            </div>

            {extraCount > 0 && (
              <div className="mt-8 flex justify-center">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setAllOpen(true)}
                  className="gap-2 rounded-full"
                >
                  <Plus className="h-4 w-4" />
                  See {extraCount} more promotion{extraCount === 1 ? "" : "s"}
                </Button>
              </div>
            )}
          </>
        )}

        <p className="mt-8 text-center text-sm text-muted-foreground">
          * Promotions may vary by location. See store for details.
        </p>
      </div>

      <Dialog open={allOpen} onOpenChange={setAllOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>All promotions at {locationName}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[75vh] overflow-y-auto pr-1">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {promotions.map((p) => (
                <PromoCard key={p.id} promo={p} onImageClick={openImg} />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ImageLightbox
        src={lightbox?.src ?? null}
        alt={lightbox?.alt}
        onClose={() => setLightbox(null)}
      />
    </section>
  );
};
