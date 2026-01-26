import { MapPin, Phone, Clock, Navigation, Utensils } from "lucide-react";
import type { Location } from "@/data/locations";

interface LocationCardProps {
  location: Location;
}

export const LocationCard = ({ location }: LocationCardProps) => {
  return (
    <article
      className="group relative overflow-hidden rounded-lg bg-card p-6 card-shadow transition-all duration-300 hover:elevated-shadow hover:-translate-y-1"
      itemScope
      itemType="https://schema.org/GasStation"
    >
      <div className="absolute top-0 left-0 h-1 w-full bg-primary" />
      
      <h3 
        className="mb-4 font-display text-xl font-bold text-foreground"
        itemProp="name"
      >
        {location.name}
      </h3>
      
      <div 
        className="space-y-3 text-sm"
        itemProp="address"
        itemScope
        itemType="https://schema.org/PostalAddress"
      >
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p itemProp="streetAddress">{location.address}</p>
            <p>
              <span itemProp="addressLocality">{location.city}</span>,{" "}
              <span itemProp="addressRegion">{location.state}</span>{" "}
              <span itemProp="postalCode">{location.zip}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Phone className="h-4 w-4 shrink-0 text-primary" />
          <a
            href={`tel:${location.phone.replace(/[^0-9]/g, "")}`}
            className="text-foreground transition-colors hover:text-primary"
            itemProp="telephone"
          >
            {location.phone}
          </a>
        </div>

        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 shrink-0 text-primary" />
          <span itemProp="openingHours">{location.hours}</span>
        </div>

        {location.foodOfferings && location.foodOfferings.length > 0 && (
          <div className="flex items-start gap-3">
            <Utensils className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="flex flex-wrap gap-1">
              {location.foodOfferings.map((food, index) => (
                <span 
                  key={index}
                  className="inline-block rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-foreground"
                >
                  {food}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <a
        href={location.googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 font-semibold text-primary-foreground transition-all duration-200 hover:bg-primary/90"
      >
        <Navigation className="h-4 w-4" />
        Get Directions
      </a>

      <meta itemProp="latitude" content={String(location.latitude)} />
      <meta itemProp="longitude" content={String(location.longitude)} />
    </article>
  );
};
