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
    id: "fritch",
    name: "VT Gas & Market - Fritch",
    address: "100 E Broadway St",
    city: "Fritch",
    state: "TX",
    zip: "79036",
    phone: "+1 (806) 898-0494",
    hours: "24 Hours",
    latitude: 35.6392,
    longitude: -101.6034,
    googleMapsUrl: "https://www.google.com/maps/dir/?api=1&destination=100+E+Broadway+St+Fritch+TX+79036",
    foodOfferings: ["Hunt's Brother Pizza", "Chicken", "Fried Items", "Burgers", "Breakfast Items"],
  },
  {
    id: "spearman",
    name: "VT Gas & Market - Spearman",
    address: "107 Collard St",
    city: "Spearman",
    state: "TX",
    zip: "79081",
    phone: "+1 (806) 694-9005",
    hours: "24 Hours",
    latitude: 36.1987,
    longitude: -101.1918,
    googleMapsUrl: "https://www.google.com/maps/dir/?api=1&destination=107+Collard+St+Spearman+TX+79081",
    foodOfferings: ["Hunt's Brother Pizza", "Chicken"],
  },
  {
    id: "borger",
    name: "VT Gas & Market - Borger",
    address: "3302 Fairlanes Blvd",
    city: "Borger",
    state: "TX",
    zip: "79007",
    phone: "+1 (806) 621-5960",
    hours: "24 Hours",
    latitude: 35.6678,
    longitude: -101.3971,
    googleMapsUrl: "https://www.google.com/maps/dir/?api=1&destination=3302+Fairlanes+Blvd+Borger+TX+79007",
    foodOfferings: ["Fresh Made Food"],
  },
  {
    id: "amarillo-coulter",
    name: "VT Gas & Market - Amarillo Coulter",
    address: "3400 Coulter St S",
    city: "Amarillo",
    state: "TX",
    zip: "79121",
    phone: "+1 (806) 898-0494",
    hours: "6:00 AM - 11:00 PM",
    latitude: 35.1814,
    longitude: -101.9101,
    googleMapsUrl: "https://www.google.com/maps/dir/?api=1&destination=3400+Coulter+St+S+Amarillo+TX+79121",
  },
  {
    id: "amarillo-western",
    name: "VT Gas & Market - Amarillo Western",
    address: "4430 S Western St",
    city: "Amarillo",
    state: "TX",
    zip: "79109",
    phone: "+1 (806) 807-8817",
    hours: "6:00 AM - 11:00 PM",
    latitude: 35.1654,
    longitude: -101.8876,
    googleMapsUrl: "https://www.google.com/maps/dir/?api=1&destination=4430+S+Western+St+Amarillo+TX+79109",
  },
];
