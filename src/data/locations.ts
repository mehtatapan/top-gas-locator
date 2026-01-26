export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  hours: string;
  latitude: number;
  longitude: number;
  googleMapsUrl: string;
  foodOfferings?: string[];
}

export const locations: Location[] = [
  {
    id: "location-fritch",
    name: "VT Gas & Market - Fritch",
    address: "100 E Broadway St",
    city: "Fritch",
    state: "TX",
    zip: "79036",
    phone: "(806) 555-0101",
    hours: "24 Hours",
    latitude: 35.6392,
    longitude: -101.6034,
    googleMapsUrl: "https://maps.google.com/?q=100+E+Broadway+St+Fritch+TX+79036",
    foodOfferings: ["Hunt's Brother Pizza", "Chicken", "Fried Items", "Burgers", "Breakfast Items"],
  },
  {
    id: "location-spearman",
    name: "VT Gas & Market - Spearman",
    address: "107 Collard St",
    city: "Spearman",
    state: "TX",
    zip: "79081",
    phone: "(806) 555-0102",
    hours: "24 Hours",
    latitude: 36.1987,
    longitude: -101.1918,
    googleMapsUrl: "https://maps.google.com/?q=107+Collard+St+Spearman+TX+79081",
    foodOfferings: ["Hunt's Brother Pizza", "Chicken"],
  },
  {
    id: "location-borger",
    name: "VT Gas & Market - Borger",
    address: "3302 Fairlanes Blvd",
    city: "Borger",
    state: "TX",
    zip: "79007",
    phone: "(806) 555-0103",
    hours: "24 Hours",
    latitude: 35.6678,
    longitude: -101.3971,
    googleMapsUrl: "https://maps.google.com/?q=3302+Fairlanes+Blvd+Borger+TX+79007",
    foodOfferings: ["Fresh Made Food"],
  },
  {
    id: "location-amarillo-coulter",
    name: "VT Gas & Market - Amarillo Coulter",
    address: "3400 Coulter St S",
    city: "Amarillo",
    state: "TX",
    zip: "79121",
    phone: "(806) 555-0104",
    hours: "6:00 AM - 11:00 PM",
    latitude: 35.1814,
    longitude: -101.9101,
    googleMapsUrl: "https://maps.google.com/?q=3400+Coulter+St+S+Amarillo+TX+79121",
  },
  {
    id: "location-amarillo-western",
    name: "VT Gas & Market - Amarillo Western",
    address: "4430 S Western St",
    city: "Amarillo",
    state: "TX",
    zip: "79109",
    phone: "(806) 555-0105",
    hours: "6:00 AM - 11:00 PM",
    latitude: 35.1654,
    longitude: -101.8876,
    googleMapsUrl: "https://maps.google.com/?q=4430+S+Western+St+Amarillo+TX+79109",
  },
];
