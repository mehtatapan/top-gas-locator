import { Helmet } from "react-helmet-async";
import { Location } from "@/data/locations";

interface LocationSEOProps {
  location: Location;
}

export const LocationSEO = ({ location }: LocationSEOProps) => {
  const pageTitle = `${location.name} | Gas Station & Convenience Store in ${location.city}, TX`;
  const pageDescription = `Visit ${location.name} at ${location.address}, ${location.city}, TX ${location.zip}. Quality Conoco fuel, fresh coffee, snacks, and convenience store items. ${location.hours === "24 Hours" ? "Open 24 hours." : `Hours: ${location.hours}.`} Call ${location.phone}.`;
  const canonicalUrl = `https://vtgasmarket.com/location/${location.id}`;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "GasStation",
    name: location.name,
    description: pageDescription,
    url: canonicalUrl,
    telephone: location.phone,
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
    openingHours: location.hours === "24 Hours" ? "Mo-Su 00:00-24:00" : "Mo-Su 06:00-23:00",
    priceRange: "$$",
    hasMap: location.googleMapsUrl,
    paymentAccepted: "Cash, Credit Card, Debit Card, Mobile Payment",
    brand: {
      "@type": "Brand",
      name: "Conoco",
    },
    parentOrganization: {
      "@type": "Organization",
      name: "VT Gas & Market",
      url: "https://vtgasmarket.com",
    },
    amenityFeature: [
      { "@type": "LocationFeatureSpecification", name: "Conoco Fuel", value: true },
      { "@type": "LocationFeatureSpecification", name: "Convenience Store", value: true },
      { "@type": "LocationFeatureSpecification", name: "ATM", value: true },
      { "@type": "LocationFeatureSpecification", name: "Restrooms", value: true },
      ...(location.foodOfferings?.map((food) => ({
        "@type": "LocationFeatureSpecification",
        name: food,
        value: true,
      })) || []),
    ],
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: location.googleMapsUrl,
        actionPlatform: ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"],
      },
      name: "Get Directions",
    },
  };

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <meta
        name="keywords"
        content={`gas station ${location.city}, Conoco ${location.city}, convenience store ${location.city}, VT Gas Market ${location.city}, fuel ${location.city} TX, ${location.city} gas station, Texas Panhandle gas station`}
      />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type" content="business.business" />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content="https://vtgasmarket.com/store-sign.jpg" />
      <meta property="og:site_name" content="VT Gas & Market" />
      <meta property="business:contact_data:street_address" content={location.address} />
      <meta property="business:contact_data:locality" content={location.city} />
      <meta property="business:contact_data:region" content={location.state} />
      <meta property="business:contact_data:postal_code" content={location.zip} />
      <meta property="business:contact_data:country_name" content="USA" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />

      {/* Geo tags */}
      <meta name="geo.region" content="US-TX" />
      <meta name="geo.placename" content={location.city} />
      <meta name="geo.position" content={`${location.latitude};${location.longitude}`} />
      <meta name="ICBM" content={`${location.latitude}, ${location.longitude}`} />

      {/* Structured Data */}
      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
    </Helmet>
  );
};
