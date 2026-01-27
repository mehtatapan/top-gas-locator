import { useEffect, useRef, useState } from "react";
import { locations } from "@/data/locations";
import vtLogo from "@/assets/vt-logo.png";

const GOOGLE_MAPS_API_KEY = "AIzaSyB4bmAc1wVXxnHwKrJueOH-ZQwV_JwR1JQ";

export const InteractiveMap = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if script is already loaded
    if (window.google?.maps) {
      setIsLoaded(true);
      return;
    }

    // Load Google Maps script with async loading
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&loading=async`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => setIsLoaded(true);
    script.onerror = () => setError("Failed to load Google Maps");
    
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google?.maps) return;

    // Calculate center point (average of all locations)
    const centerLat = locations.reduce((sum, loc) => sum + loc.latitude, 0) / locations.length;
    const centerLng = locations.reduce((sum, loc) => sum + loc.longitude, 0) / locations.length;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: centerLat, lng: centerLng },
      zoom: 8,
      styles: [
        {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "off" }],
        },
      ],
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    // Create markers with custom logo icon
    locations.forEach((location) => {
      // Create info window content
      const infoContent = `
        <div style="padding: 8px; max-width: 220px;">
          <h3 style="margin: 0 0 8px; font-weight: bold; color: #1a1a1a; font-size: 14px;">
            ${location.name}
          </h3>
          <p style="margin: 0 0 4px; font-size: 12px; color: #666;">
            ${location.address}<br/>
            ${location.city}, ${location.state} ${location.zip}
          </p>
          <p style="margin: 0 0 4px; font-size: 12px; color: #666;">
            <strong>Hours:</strong> ${location.hours}
          </p>
          <p style="margin: 0 0 8px; font-size: 12px; color: #666;">
            <strong>Phone:</strong> ${location.phone}
          </p>
          <a 
            href="${location.googleMapsUrl}" 
            target="_blank" 
            rel="noopener noreferrer"
            style="
              display: inline-block;
              background: #dc2626;
              color: white;
              padding: 6px 12px;
              border-radius: 4px;
              text-decoration: none;
              font-size: 12px;
              font-weight: 600;
            "
          >
            Get Directions
          </a>
        </div>
      `;

      const infoWindow = new window.google.maps.InfoWindow({
        content: infoContent,
      });

      // Use regular marker with custom logo icon
      const marker = new window.google.maps.Marker({
        map,
        position: { lat: location.latitude, lng: location.longitude },
        title: location.name,
        icon: {
          url: vtLogo,
          scaledSize: new window.google.maps.Size(44, 44),
        },
      });

      marker.addListener("click", () => {
        infoWindow.open(map, marker);
      });
    });
  }, [isLoaded]);

  if (error) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg bg-muted">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border shadow-lg">
      <div 
        ref={mapRef} 
        className="h-[400px] w-full bg-muted"
        style={{ minHeight: "400px" }}
      >
        {!isLoaded && (
          <div className="flex h-full items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading map...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
