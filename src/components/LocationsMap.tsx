import { useEffect, useRef } from "react";
import { locations } from "@/data/locations";
import vtLogo from "@/assets/vt-logo-transparent.png";

declare global {
  interface Window {
    google: any;
    initVTLocationsMap?: () => void;
  }
}

const BROWSER_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY ||
  import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;

let mapsLoaderPromise: Promise<void> | null = null;

const loadGoogleMaps = (): Promise<void> => {
  if (typeof window === "undefined") return Promise.reject("no window");
  if (window.google?.maps) return Promise.resolve();
  if (mapsLoaderPromise) return mapsLoaderPromise;

  mapsLoaderPromise = new Promise<void>((resolve, reject) => {
    window.initVTLocationsMap = () => resolve();
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: BROWSER_KEY ?? "",
      loading: "async",
      callback: "initVTLocationsMap",
    });
    if (TRACKING_ID) params.set("channel", TRACKING_ID);
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

  return mapsLoaderPromise;
};

export const LocationsMap = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google?.maps) return;

        const map = new window.google.maps.Map(containerRef.current, {
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          gestureHandling: "cooperative",
        });

        const bounds = new window.google.maps.LatLngBounds();
        const info = new window.google.maps.InfoWindow();

        locations.forEach((loc) => {
          const position = { lat: loc.latitude, lng: loc.longitude };
          bounds.extend(position);

          const marker = new window.google.maps.Marker({
            position,
            map,
            title: loc.name,
            icon: {
              url: vtLogo,
              scaledSize: new window.google.maps.Size(48, 48),
              anchor: new window.google.maps.Point(24, 24),
            },
          });

          marker.addListener("click", () => {
            info.setContent(
              `<div style="font-family: system-ui; min-width: 200px;">
                <strong style="display:block; margin-bottom:4px;">${loc.name}</strong>
                <div style="font-size:13px; color:#444;">${loc.address}<br/>${loc.city}, ${loc.state} ${loc.zip}</div>
                <a href="${loc.googleMapsUrl}" target="_blank" rel="noopener noreferrer"
                   style="display:inline-block; margin-top:6px; color:#c8102e; font-weight:600; font-size:13px;">
                   Get Directions →
                </a>
              </div>`
            );
            info.open({ anchor: marker, map });
          });
        });

        map.fitBounds(bounds, 60);

        const listener = window.google.maps.event.addListenerOnce(map, "bounds_changed", () => {
          if (map.getZoom() > 10) map.setZoom(10);
        });

        return () => {
          window.google.maps.event.removeListener(listener);
        };
      })
      .catch((err) => console.error("Google Maps failed to load:", err));

    return () => {
      cancelled = true;
    };
  }, []);

  if (!BROWSER_KEY) {
    return (
      <div className="flex h-[420px] items-center justify-center bg-muted text-sm text-muted-foreground">
        Map unavailable
      </div>
    );
  }

  return <div ref={containerRef} className="h-[420px] w-full" />;
};
