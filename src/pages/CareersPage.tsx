import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import {
  DollarSign,
  CalendarClock,
  TrendingUp,
  Users,
  MapPin,
  GraduationCap,
  Briefcase,
  ArrowRight,
} from "lucide-react";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { positions } from "@/data/positions";
import { ApplicationForm } from "@/components/careers/ApplicationForm";
import heroImage from "@/assets/hero-station.jpg";

const benefits = [
  { icon: DollarSign, title: "Competitive Pay", text: "Fair, market-leading wages with regular reviews." },
  { icon: CalendarClock, title: "Flexible Scheduling", text: "Shifts that fit school, family, and life." },
  { icon: TrendingUp, title: "Career Growth", text: "Promote-from-within culture — cashier to manager." },
  { icon: Users, title: "Friendly Team", text: "A close-knit hometown crew that has your back." },
  { icon: MapPin, title: "Multiple Locations", text: "5 stores across the Texas Panhandle." },
  { icon: GraduationCap, title: "Training & Development", text: "Hands-on training and leadership coaching." },
];

const CareersPage = () => {
  const [selectedPosition, setSelectedPosition] = useState<string | undefined>();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const scrollToApply = (positionTitle?: string) => {
    if (positionTitle) setSelectedPosition(positionTitle);
    setTimeout(() => {
      document.getElementById("apply")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const jobPostingsLd = positions.map((p) => ({
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: p.title,
    description: p.description,
    employmentType: p.type.toUpperCase().replace(/ \/ /g, "_OR_").replace(/-/g, ""),
    datePosted: new Date().toISOString().slice(0, 10),
    hiringOrganization: {
      "@type": "Organization",
      name: "VT Gas & Market",
      sameAs: "https://www.vtgasandmarket.com",
      logo: "https://www.vtgasandmarket.com/VT-Logo.png",
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressRegion: "TX",
        addressCountry: "US",
      },
    },
    applicantLocationRequirements: { "@type": "Country", name: "US" },
  }));

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Careers at VT Gas & Market | Jobs in the Texas Panhandle</title>
        <meta
          name="description"
          content="Join the VT Gas & Market team. Apply now for Cashier, Assistant Store Manager, and Store Manager positions across our Fritch, Borger, Spearman, and Amarillo locations."
        />
        <link rel="canonical" href="/careers" />
        <meta property="og:title" content="Careers at VT Gas & Market" />
        <meta property="og:description" content="Hiring hardworking, customer-focused team members across 5 Texas Panhandle locations." />
        <meta property="og:url" content="/careers" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://www.vtgasandmarket.com/og-careers.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Careers at VT Gas & Market" />
        <meta name="twitter:description" content="Now hiring across 5 Texas Panhandle locations." />
        <meta name="twitter:image" content="https://www.vtgasandmarket.com/og-careers.jpg" />
        {jobPostingsLd.map((ld, i) => (
          <script key={i} type="application/ld+json">{JSON.stringify(ld)}</script>
        ))}
      </Helmet>

      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt="VT Gas & Market team" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-secondary/95 via-secondary/85 to-secondary/50" />
        </div>
        <div className="container relative z-10 flex min-h-[60vh] items-center py-20">
          <div className="max-w-2xl animate-slide-up">
            <span className="mb-4 inline-block rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground">
              We're Hiring
            </span>
            <h1 className="mb-6 font-display text-4xl font-bold leading-tight text-primary-foreground sm:text-5xl md:text-6xl">
              Join Our Team
            </h1>
            <p className="mb-8 max-w-xl text-lg text-primary-foreground/85">
              We are always looking for hardworking, dependable, and customer-focused individuals
              to join the VT Gas & Market family. Explore exciting opportunities across our
              convenience stores and fuel stations.
            </p>
            <Button
              size="lg"
              onClick={() => scrollToApply()}
              className="bg-primary hover:bg-primary/90 hover:scale-105 transition-transform"
            >
              <Briefcase className="mr-2 h-5 w-5" /> Apply Now
            </Button>
          </div>
        </div>
      </section>

      {/* Why Work With Us */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">Why Work With Us</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Real benefits and a real team. Here's what makes VT Gas & Market a great place to grow.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((b, i) => (
              <div
                key={b.title}
                className="rounded-xl border bg-card-elevated p-6 card-shadow transition-all duration-300 hover:-translate-y-1 hover:shadow-lg animate-slide-up"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <b.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg font-bold">{b.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Current Opportunities */}
      <section className="bg-muted/40 py-16 md:py-24">
        <div className="container">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">Current Opportunities</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Open roles across our Texas Panhandle locations.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {positions.map((p) => (
              <div
                key={p.id}
                className="flex flex-col rounded-xl border bg-card-elevated p-6 card-shadow transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <span className="mb-3 inline-block w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  {p.type}
                </span>
                <h3 className="font-display text-xl font-bold">{p.title}</h3>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.description}</p>
                <Button onClick={() => scrollToApply(p.title)} className="mt-5 w-full">
                  Apply <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section id="apply" className="py-16 md:py-24">
        <div className="container max-w-4xl">
          <div className="mb-10 text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">Apply Today</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Tell us about yourself. It takes about 5 minutes.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-10">
            <ApplicationForm defaultPosition={selectedPosition} />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CareersPage;
