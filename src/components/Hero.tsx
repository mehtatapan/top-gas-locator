import heroImage from "@/assets/hero-station.jpg";
import { MapPin } from "lucide-react";

export const Hero = () => {
  const scrollToLocations = () => {
    const element = document.getElementById("locations");
    element?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-[80vh] overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="VT Gas & Market Station"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-secondary/95 via-secondary/80 to-secondary/40" />
      </div>

      <div className="container relative z-10 flex min-h-[80vh] items-center py-20">
        <div className="max-w-2xl animate-slide-up">
          <span className="mb-4 inline-block rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground">
            5 Convenient Locations
          </span>
          
          <h1 className="mb-6 font-display text-4xl font-bold leading-tight text-primary-foreground sm:text-5xl md:text-6xl lg:text-7xl">
            VT Gas & Market
          </h1>
          
          <p className="mb-4 font-display text-xl text-accent sm:text-2xl">
            Your Hometown Stop
          </p>
          
          <p className="mb-8 max-w-lg text-lg text-primary-foreground/80">
            Quality Conoco fuel, friendly service, and everything you need for the road. 
            Find us across 5 convenient Texas Panhandle locations.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <button
              onClick={scrollToLocations}
              className="flex items-center justify-center gap-2 rounded-md bg-primary px-8 py-4 font-display text-lg font-semibold text-primary-foreground transition-all duration-200 hover:bg-primary/90 hover:scale-105"
            >
              <MapPin className="h-5 w-5" />
              Find a Location
            </button>
            <a
              href="tel:+18068980494"
              className="flex items-center justify-center rounded-md border-2 border-primary-foreground/30 px-8 py-4 font-display text-lg font-semibold text-primary-foreground transition-all duration-200 hover:border-primary-foreground hover:bg-primary-foreground/10"
            >
              Call Us Today
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
