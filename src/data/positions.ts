export interface Position {
  id: string;
  title: string;
  description: string;
  type: "Full-Time" | "Part-Time" | "Full-Time / Part-Time";
}

export const positions: Position[] = [
  {
    id: "cashier",
    title: "Cashier",
    description:
      "Greet customers, ring up sales, and keep the store running smoothly. Perfect for friendly, dependable team members who love working with people.",
    type: "Full-Time / Part-Time",
  },
  {
    id: "assistant-store-manager",
    title: "Assistant Store Manager",
    description:
      "Support the Store Manager with daily operations, scheduling, inventory, and team leadership. A great step toward store management.",
    type: "Full-Time",
  },
  {
    id: "store-manager",
    title: "Store Manager",
    description:
      "Lead a VT Gas & Market location end-to-end — operations, P&L, hiring, customer experience, and community presence.",
    type: "Full-Time",
  },
];

export const storeLocationOptions = [
  "Fritch",
  "Borger",
  "Spearman",
  "Coulter Amarillo",
  "Western Amarillo",
] as const;

export type StoreLocationOption = (typeof storeLocationOptions)[number];
