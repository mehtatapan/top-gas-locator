import { Tag } from "lucide-react";

interface Promotion {
  title: string;
  description: string;
  image: string;
  validUntil?: string;
}

interface StorePromotionsProps {
  locationName: string;
  promotions?: Promotion[];
}

// Default promotions - can be customized per location later
const defaultPromotions: Promotion[] = [
  {
    title: "2 for $3 Energy Drinks",
    description: "Grab any two energy drinks for just $3. Mix and match your favorites!",
    image: "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=400&auto=format&fit=crop",
    validUntil: "While supplies last",
  },
  {
    title: "Fresh Coffee Deal",
    description: "Any size coffee for $1.50. Start your morning right!",
    image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&auto=format&fit=crop",
    validUntil: "Daily special",
  },
  {
    title: "Snack Combo Special",
    description: "Get a fountain drink and any bag of chips for just $2.99.",
    image: "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&auto=format&fit=crop",
    validUntil: "Limited time offer",
  },
];

export const StorePromotions = ({ locationName, promotions = defaultPromotions }: StorePromotionsProps) => {
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

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {promotions.map((promo, index) => (
            <div
              key={index}
              className="group overflow-hidden rounded-xl bg-card card-shadow transition-all duration-300 hover:-translate-y-1 hover:elevated-shadow"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={promo.image}
                  alt={promo.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                {promo.validUntil && (
                  <div className="absolute bottom-3 left-3 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                    {promo.validUntil}
                  </div>
                )}
              </div>
              <div className="p-5">
                <h3 className="mb-2 font-display text-lg font-bold text-foreground">
                  {promo.title}
                </h3>
                <p className="text-sm text-muted-foreground">{promo.description}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          * Promotions may vary by location. See store for details.
        </p>
      </div>
    </section>
  );
};
