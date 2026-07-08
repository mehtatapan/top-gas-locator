import { useParams, Link } from "react-router-dom";
import { locations } from "@/data/locations";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LocationSEO } from "@/components/LocationSEO";
import { StorePromotions } from "@/components/StorePromotions";
import { useLocationStore, usePublicPromotions } from "@/hooks/useLocationStore";
import { MapPin, Phone, Clock, Navigation, Utensils, ArrowLeft, Fuel, Coffee, CreditCard } from "lucide-react";

// Fallback stock images if a store has no custom photos configured yet.
const fallbackImages = {
  hero: "https://images.unsplash.com/photo-1567954970774-58d6aa6c50dc?w=800&auto=format&fit=crop",
  interior: "https://images.unsplash.com/photo-1527018601619-a508a2be00cd?w=800&auto=format&fit=crop",
  products: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop",
};

const offerings = [
  {
    title: "Fresh Coffee Daily",
    description: "Start your day with our freshly brewed coffee. Multiple flavors available!",
    icon: Coffee,
  },
  {
    title: "Quality Conoco Fuel",
    description: "Top-tier Conoco gasoline to keep your vehicle running at its best.",
    icon: Fuel,
  },
  {
    title: "Easy Payment Options",
    description: "We accept all major credit cards, debit cards, and mobile payments.",
    icon: CreditCard,
  },
];

const LocationPage = () => {
  const { locationId } = useParams<{ locationId: string }>();
  const location = locations.find((loc) => loc.id === locationId);
  const storeQ = useLocationStore(locationId);
  const promosQ = usePublicPromotions(storeQ.data?.id);

  const photos = storeQ.data?.meta?.photos ?? {};
  const heroImg = photos.hero || fallbackImages.hero;
  const interiorImg = photos.interior || fallbackImages.interior;
  const productsImg = photos.products || fallbackImages.products;

  if (!location) {
    return (
      <>
        <Header />
        <main className="container py-20 text-center">
          <h1 className="mb-4 font-display text-3xl font-bold">Location Not Found</h1>
          <p className="mb-8 text-muted-foreground">
            Sorry, we couldn't find the location you're looking for.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <LocationSEO location={location} />
      <Header />
      <main>
        {/* Hero Section */}
        <section className="bg-secondary py-12">
          <div className="container">
            <Link
              to="/#locations"
              className="mb-6 inline-flex items-center gap-2 text-sm text-secondary-foreground/70 transition-colors hover:text-accent"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to All Locations
            </Link>
            <h1 className="mb-2 font-display text-3xl font-bold text-secondary-foreground sm:text-4xl md:text-5xl">
              {location.name}
            </h1>
            <p className="text-lg text-secondary-foreground/80">
              Your neighborhood gas station & convenience store
            </p>
          </div>
        </section>

        {/* Store Info & Photos */}
        <section className="py-16">
          <div className="container">
            <div className="grid gap-12 lg:grid-cols-2">
              {/* Store Details */}
              <div>
                <h2 className="mb-6 font-display text-2xl font-bold text-foreground">
                  Store Information
                </h2>
                <div className="space-y-4 rounded-lg bg-card p-6 card-shadow">
                  <div className="flex items-start gap-4">
                    <MapPin className="mt-1 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">Address</p>
                      <p className="text-muted-foreground">
                        {location.address}<br />
                        {location.city}, {location.state} {location.zip}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <Phone className="mt-1 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">Phone</p>
                      <a
                        href={`tel:${location.phone.replace(/[^0-9+]/g, "")}`}
                        className="text-muted-foreground transition-colors hover:text-primary"
                      >
                        {location.phone}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <Clock className="mt-1 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">Hours</p>
                      <p className="text-muted-foreground">{location.hours}</p>
                    </div>
                  </div>

                  {location.foodOfferings && location.foodOfferings.length > 0 && (
                    <div className="flex items-start gap-4">
                      <Utensils className="mt-1 h-5 w-5 shrink-0 text-primary" />
                      <div>
                        <p className="font-semibold text-foreground">Food Available</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {location.foodOfferings.map((food, index) => (
                            <span
                              key={index}
                              className="inline-block rounded-full bg-accent/20 px-3 py-1 text-sm font-medium text-accent-foreground"
                            >
                              {food}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <a
                    href={location.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all duration-200 hover:bg-primary/90"
                  >
                    <Navigation className="h-5 w-5" />
                    Get Directions
                  </a>
                </div>
              </div>

              {/* Store Photos */}
              <div>
                <h2 className="mb-6 font-display text-2xl font-bold text-foreground">
                  Store Photos
                </h2>
                <div className="grid gap-4">
                  <div className="overflow-hidden rounded-lg">
                    <img
                      src={storeImages[0]}
                      alt={`${location.name} exterior`}
                      className="h-64 w-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="overflow-hidden rounded-lg">
                      <img
                        src={storeImages[1]}
                        alt={`${location.name} interior`}
                        className="h-40 w-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    </div>
                    <div className="overflow-hidden rounded-lg">
                      <img
                        src={storeImages[2]}
                        alt={`${location.name} products`}
                        className="h-40 w-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Promotions */}
        <section className="bg-muted py-16">
          <div className="container">
            <h2 className="mb-8 text-center font-display text-2xl font-bold text-foreground sm:text-3xl">
              What We Offer
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {promotions.map((promo, index) => (
                <div
                  key={index}
                  className="rounded-lg bg-[hsl(var(--card-elevated))] p-6 card-shadow transition-all duration-300 hover:-translate-y-1 hover:elevated-shadow"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <promo.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 font-display text-lg font-bold text-foreground">
                    {promo.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{promo.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Store Promotions */}
        <StorePromotions locationName={location.name} />

        {/* Directions */}
        <section className="py-16">
          <div className="container">
            <h2 className="mb-8 text-center font-display text-2xl font-bold text-foreground sm:text-3xl">
              Find Us
            </h2>
            <div className="mx-auto max-w-4xl space-y-6">
              <div className="overflow-hidden rounded-lg card-shadow">
                <iframe
                  title={`Map of ${location.name}`}
                  src={`https://www.google.com/maps?q=${encodeURIComponent(
                    `${location.address}, ${location.city}, ${location.state} ${location.zip}`
                  )}&output=embed`}
                  width="100%"
                  height="400"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
              <div className="rounded-lg bg-[hsl(var(--card-elevated))] p-6 text-center card-shadow">
                <MapPin className="mx-auto mb-3 h-8 w-8 text-primary" />
                <p className="mb-1 font-semibold text-foreground">{location.name}</p>
                <p className="mb-5 text-muted-foreground">
                  {location.address}, {location.city}, {location.state} {location.zip}
                </p>
                <a
                  href={location.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all duration-200 hover:bg-primary/90"
                >
                  <Navigation className="h-5 w-5" />
                  Open in Google Maps
                </a>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
};

export default LocationPage;
