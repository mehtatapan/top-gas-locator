import { Tag } from "lucide-react";
import type { PublicPromotion } from "@/hooks/useLocationStore";

interface StorePromotionsProps {
  locationName: string;
  promotions: PublicPromotion[];
  loading?: boolean;
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=600&auto=format&fit=crop";

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

export const StorePromotions = ({ locationName, promotions, loading }: StorePromotionsProps) => {
  if (!loading && promotions.length === 0) return null;

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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {promotions.map((promo) => {
              const label = windowLabel(promo);
              return (
                <div
                  key={promo.id}
                  className="group overflow-hidden rounded-xl bg-[hsl(var(--card-elevated))] card-shadow transition-all duration-300 hover:-translate-y-1 hover:elevated-shadow"
                >
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={promo.image_url || FALLBACK_IMAGE}
                      alt={promo.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                    {label && (
                      <div className="absolute bottom-3 left-3 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                        {label}
                      </div>
                    )}
                    {promo.store_id === null && (
                      <div className="absolute right-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                        All stores
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="mb-2 font-display text-lg font-bold text-foreground">
                      {promo.title}
                    </h3>
                    {promo.description && (
                      <p className="text-sm text-muted-foreground">{promo.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-center text-sm text-muted-foreground">
          * Promotions may vary by location. See store for details.
        </p>
      </div>
    </section>
  );
};
