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
}

export const locations: Location[] = [
  {
    id: "location-1",
    name: "VT Gas & Market - Downtown",
    address: "123 Main Street",
    city: "Springfield",
    state: "IL",
    zip: "62701",
    phone: "(217) 555-0101",
    hours: "24 Hours",
    latitude: 39.7817,
    longitude: -89.6501,
    googleMapsUrl: "https://maps.google.com/?q=123+Main+Street+Springfield+IL",
  },
  {
    id: "location-2",
    name: "VT Gas & Market - Westside",
    address: "456 Oak Avenue",
    city: "Decatur",
    state: "IL",
    zip: "62521",
    phone: "(217) 555-0102",
    hours: "5:00 AM - 11:00 PM",
    latitude: 39.8403,
    longitude: -88.9548,
    googleMapsUrl: "https://maps.google.com/?q=456+Oak+Avenue+Decatur+IL",
  },
  {
    id: "location-3",
    name: "VT Gas & Market - Highway 66",
    address: "789 Route 66",
    city: "Bloomington",
    state: "IL",
    zip: "61701",
    phone: "(309) 555-0103",
    hours: "24 Hours",
    latitude: 40.4842,
    longitude: -88.9937,
    googleMapsUrl: "https://maps.google.com/?q=789+Route+66+Bloomington+IL",
  },
  {
    id: "location-4",
    name: "VT Gas & Market - Northgate",
    address: "321 Commerce Drive",
    city: "Champaign",
    state: "IL",
    zip: "61820",
    phone: "(217) 555-0104",
    hours: "5:00 AM - 12:00 AM",
    latitude: 40.1164,
    longitude: -88.2434,
    googleMapsUrl: "https://maps.google.com/?q=321+Commerce+Drive+Champaign+IL",
  },
  {
    id: "location-5",
    name: "VT Gas & Market - Lakeside",
    address: "555 Lake Shore Road",
    city: "Peoria",
    state: "IL",
    zip: "61602",
    phone: "(309) 555-0105",
    hours: "24 Hours",
    latitude: 40.6936,
    longitude: -89.589,
    googleMapsUrl: "https://maps.google.com/?q=555+Lake+Shore+Road+Peoria+IL",
  },
];
