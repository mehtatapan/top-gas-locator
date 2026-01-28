import vtLogo from "@/assets/vt-logo-transparent.png";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth" });
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center justify-between md:h-20">
        <a href="/" className="flex items-center gap-3" aria-label="VT Gas & Market Home">
          <img 
            src={vtLogo} 
            alt="VT Gas & Market Logo" 
            className="h-12 w-12 rounded-full md:h-14 md:w-14"
          />
          <div className="hidden sm:block">
            <span className="font-display text-xl font-bold text-foreground md:text-2xl">
              VT Gas & Market
            </span>
            <p className="text-xs text-muted-foreground">Your Hometown Stop</p>
          </div>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          <button 
            onClick={() => scrollTo("locations")} 
            className="font-medium text-foreground transition-colors hover:text-primary"
          >
            Locations
          </button>
          <button 
            onClick={() => scrollTo("services")} 
            className="font-medium text-foreground transition-colors hover:text-primary"
          >
            Services
          </button>
          <button 
            onClick={() => scrollTo("about")} 
            className="font-medium text-foreground transition-colors hover:text-primary"
          >
            About Us
          </button>
          <button 
            onClick={() => scrollTo("contact")} 
            className="rounded-md bg-primary px-5 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Contact
          </button>
        </nav>

        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 md:hidden"
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {isMenuOpen && (
        <nav className="border-t border-border bg-background p-4 md:hidden">
          <div className="flex flex-col gap-4">
            <button 
              onClick={() => scrollTo("locations")} 
              className="py-2 text-left font-medium"
            >
              Locations
            </button>
            <button 
              onClick={() => scrollTo("services")} 
              className="py-2 text-left font-medium"
            >
              Services
            </button>
            <button 
              onClick={() => scrollTo("about")} 
              className="py-2 text-left font-medium"
            >
              About Us
            </button>
            <button 
              onClick={() => scrollTo("contact")} 
              className="rounded-md bg-primary py-2 font-semibold text-primary-foreground"
            >
              Contact
            </button>
          </div>
        </nav>
      )}
    </header>
  );
};
