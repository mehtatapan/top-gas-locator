export const About = () => {
  return (
    <section id="about" className="bg-secondary py-20 text-secondary-foreground">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-2 inline-block font-semibold text-accent">
            Est. 2025
          </span>
          <h2 className="mb-6 font-display text-3xl font-bold sm:text-4xl">
            Your Hometown Stop
          </h2>
          <p className="mb-6 text-lg text-secondary-foreground/80">
            VT Gas & Market is proudly serving our communities with 
            quality fuel, fresh products, and the kind of friendly service that makes you feel right at home.
          </p>
          <p className="text-secondary-foreground/80">
            As a locally owned and operated business, we take pride in supporting our neighbors 
            and providing a convenient, reliable stop for all your fuel and convenience needs. 
            Whether you're commuting to work, heading out on a road trip, or just need to grab 
            a quick snack, VT Gas & Market is here to serve you.
          </p>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <div>
              <p className="font-display text-4xl font-bold text-accent">5</p>
              <p className="mt-2 text-sm text-secondary-foreground/70">Convenient Locations</p>
            </div>
            <div>
              <p className="font-display text-4xl font-bold text-accent">New</p>
              <p className="mt-2 text-sm text-secondary-foreground/70">& Growing</p>
            </div>
            <div>
              <p className="font-display text-4xl font-bold text-accent">24/7</p>
              <p className="mt-2 text-sm text-secondary-foreground/70">Select Locations</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
