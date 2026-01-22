import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Locations } from "@/components/Locations";
import { Services } from "@/components/Services";
import { About } from "@/components/About";
import { Footer } from "@/components/Footer";
import { LocalBusinessSchema } from "@/components/LocalBusinessSchema";

const Index = () => {
  return (
    <>
      <LocalBusinessSchema />
      <Header />
      <main>
        <Hero />
        <Locations />
        <Services />
        <About />
      </main>
      <Footer />
    </>
  );
};

export default Index;
