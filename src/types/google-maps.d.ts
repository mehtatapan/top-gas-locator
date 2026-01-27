declare global {
  interface Window {
    google: {
      maps: {
        Map: new (element: HTMLElement, options: google.maps.MapOptions) => google.maps.Map;
        Marker: new (options: google.maps.MarkerOptions) => google.maps.Marker;
        InfoWindow: new (options?: google.maps.InfoWindowOptions) => google.maps.InfoWindow;
        Size: new (width: number, height: number) => google.maps.Size;
        marker?: {
          AdvancedMarkerElement: new (options: {
            map: google.maps.Map;
            position: { lat: number; lng: number };
            content?: HTMLElement;
            title?: string;
          }) => google.maps.marker.AdvancedMarkerElement;
        };
      };
    };
  }
}

declare namespace google.maps {
  interface MapOptions {
    center: { lat: number; lng: number };
    zoom: number;
    styles?: MapTypeStyle[];
    mapTypeControl?: boolean;
    streetViewControl?: boolean;
    fullscreenControl?: boolean;
  }

  interface MapTypeStyle {
    featureType?: string;
    elementType?: string;
    stylers: { visibility?: string }[];
  }

  interface Map {
    setCenter(latlng: { lat: number; lng: number }): void;
  }

  interface MarkerOptions {
    map: Map;
    position: { lat: number; lng: number };
    title?: string;
    icon?: {
      url: string;
      scaledSize: Size;
    };
  }

  interface Marker {
    addListener(event: string, handler: () => void): void;
  }

  interface InfoWindowOptions {
    content?: string | HTMLElement;
  }

  interface InfoWindow {
    open(map: Map, anchor?: Marker | marker.AdvancedMarkerElement): void;
    close(): void;
  }

  interface Size {
    width: number;
    height: number;
  }

  namespace marker {
    interface AdvancedMarkerElement {
      addListener(event: string, handler: () => void): void;
    }
  }
}

export {};
