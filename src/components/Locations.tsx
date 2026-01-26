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

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <LocationCard key={location.id} location={location} />
          ))}
        </div>
      </div>
    </section>
  );
};
