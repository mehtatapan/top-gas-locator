import { locations } from "@/data/locations";

export const LocalBusinessSchema = () => {
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "VT Gas & Market",
    description: "VT Gas & Market - Your Hometown Stop. Quality fuel, convenience store, and friendly service at 5 locations in Illinois.",
    url: "https://vtgasmarket.com",
    logo: "https://vtgasmarket.com/logo.png",
    sameAs: [],
    department: locations.map((location) => ({
      "@type": "GasStation",
      name: location.name,
      description: `VT Gas & Market gas station and convenience store in ${location.city}, ${location.state}. Quality fuel, fresh coffee, snacks, and friendly hometown service.`,
      address: {
        "@type": "PostalAddress",
        streetAddress: location.address,
        addressLocality: location.city,
        addressRegion: location.state,
        postalCode: location.zip,
        addressCountry: "US",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: location.latitude,
        longitude: location.longitude,
      },
      telephone: location.phone,
      openingHours: location.hours === "24 Hours" ? "Mo-Su 00:00-24:00" : "Mo-Su 05:00-23:00",
      priceRange: "$$",
      hasMap: location.googleMapsUrl,
      paymentAccepted: "Cash, Credit Card, Debit Card, Mobile Payment",
      amenityFeature: [
        { "@type": "LocationFeatureSpecification", name: "Fuel" },
        { "@type": "LocationFeatureSpecification", name: "Convenience Store" },
        { "@type": "LocationFeatureSpecification", name: "ATM" },
        { "@type": "LocationFeatureSpecification", name: "Restrooms" },
      ],
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
    />
  );
};
