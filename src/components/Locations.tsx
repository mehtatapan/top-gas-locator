import { locations } from "@/data/locations";
import { LocationCard } from "./LocationCard";

export const Locations = () => {
  return (
    <section id="locations" className="py-20">
      <div className="container">
        <div className="mb-12 text-center">
          <span className="mb-2 inline-block font-semibold text-primary">
            Find Us Near You
          </span>
          <h2 className="mb-4 font-display text-3xl font-bold text-foreground sm:text-4xl">
            Our 5 Locations
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            VT Gas & Market has 5 convenient locations serving Fritch, Spearman, Borger,
            and Amarillo in the Texas Panhandle. Find the one nearest you!
          </p>
        </div>

        <div className="mb-10 overflow-hidden rounded-lg card-shadow">
          <iframe
            title="VT Gas & Market locations map"
            src="https://www.google.com/maps?q=VT+Gas+and+Market+Texas+Panhandle&output=embed"
            width="100%"
            height="420"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <LocationCard key={location.id} location={location} />
          ))}
        </div>

      </div>
    </section>
  );
};
