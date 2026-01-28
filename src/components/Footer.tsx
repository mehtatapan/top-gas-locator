import vtLogo from "@/assets/vt-logo-transparent.png";
import { locations } from "@/data/locations";
import { Mail, Phone, MapPin } from "lucide-react";

export const Footer = () => {
  return (
    <footer id="contact" className="bg-secondary py-16 text-secondary-foreground">
      <div className="container">
        <div className="grid gap-12 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <div className="mb-4 flex items-center gap-3">
              <img src={vtLogo} alt="VT Gas & Market" className="h-12 w-12 rounded-full" />
              <div>
                <p className="font-display text-xl font-bold">VT Gas & Market</p>
                <p className="text-sm text-secondary-foreground/70">Your Hometown Stop</p>
              </div>
            </div>
            <p className="mb-6 text-sm text-secondary-foreground/80">
              Quality fuel and friendly service since 1995. 
              Visit any of our 5 convenient locations today.
            </p>
            <div className="space-y-2 text-sm">
              <a 
                href="mailto:info@vtgasmarket.com" 
                className="flex items-center gap-2 transition-colors hover:text-accent"
              >
                <Mail className="h-4 w-4" />
                info@vtgasmarket.com
              </a>
              <a 
                href="tel:+12175550101" 
                className="flex items-center gap-2 transition-colors hover:text-accent"
              >
                <Phone className="h-4 w-4" />
                (217) 555-0101
              </a>
            </div>
          </div>

          <div className="lg:col-span-3">
            <h3 className="mb-6 font-display text-lg font-bold">Our Locations</h3>
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {locations.map((location) => (
                <div key={location.id} className="text-sm">
                  <p className="font-semibold text-accent">{location.city}</p>
                  <p className="mt-1 text-secondary-foreground/70">{location.address}</p>
                  <a 
                    href={location.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs transition-colors hover:text-accent"
                  >
                    <MapPin className="h-3 w-3" />
                    Directions
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-secondary-foreground/10 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-secondary-foreground/60">
              © {new Date().getFullYear()} VT Gas & Market. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-secondary-foreground/60">
              <a href="#" className="transition-colors hover:text-accent">Privacy Policy</a>
              <a href="#" className="transition-colors hover:text-accent">Terms of Service</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
