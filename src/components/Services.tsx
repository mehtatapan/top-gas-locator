import { Fuel, Coffee, UtensilsCrossed, CreditCard, Clock, ShoppingBag } from "lucide-react";

const services = [
  {
    icon: Fuel,
    title: "Conoco Fuel",
    description: "Premium Conoco gasoline - Regular, Plus, and Premium at competitive prices. Diesel available at select locations.",
  },
  {
    icon: Coffee,
    title: "Fresh Coffee",
    description: "Hot, fresh coffee brewed throughout the day. Multiple roasts and flavors available.",
  },
  {
    icon: UtensilsCrossed,
    title: "Fresh Food",
    description: "Hunt's Brother Pizza, chicken, burgers, breakfast items, and fresh made food at select locations.",
  },
  {
    icon: CreditCard,
    title: "Easy Payment",
    description: "Accept all major credit cards, debit cards, and mobile payments for your convenience.",
  },
  {
    icon: Clock,
    title: "Extended Hours",
    description: "Many locations open 24/7. Check individual store hours for availability.",
  },
  {
    icon: ShoppingBag,
    title: "Convenience Store",
    description: "Snacks, beverages, tobacco products, and everyday essentials all under one roof.",
  },
];

export const Services = () => {
  return (
    <section id="services" className="bg-muted py-20">
      <div className="container">
        <div className="mb-12 text-center">
          <span className="mb-2 inline-block font-semibold text-primary">
            What We Offer
          </span>
          <h2 className="mb-4 font-display text-3xl font-bold text-foreground sm:text-4xl">
            Our Services
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Everything you need for the road and more. Stop by any VT Gas & Market location for quality Conoco fuel, 
            fresh refreshments, and friendly hometown service.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <div
              key={service.title}
              className="group rounded-lg bg-[hsl(var(--card-elevated))] p-6 card-shadow transition-all duration-300 hover:-translate-y-1"
            >
              <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3">
                <service.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 font-display text-xl font-bold text-foreground">
                {service.title}
              </h3>
              <p className="text-sm text-muted-foreground">{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
