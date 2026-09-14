import { Hero } from "components/hero";
import Footer from "components/layout/footer";
import { ProductShowcase } from "components/product-showcase";
import { VerifiedBand } from "components/verified-band";

export const metadata = {
  description:
    "Research-grade peptides with a certificate of analysis on every lot. A headless storefront running on the dsco commerce API.",
  openGraph: {
    type: "website",
  },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <ProductShowcase />
      <VerifiedBand />
      <Footer />
    </>
  );
}
