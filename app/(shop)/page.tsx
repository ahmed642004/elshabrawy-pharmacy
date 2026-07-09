import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Hero from "@/components/home/Hero";
import CategoryGrid from "@/components/home/CategoryGrid";
import ProductCarousel from "@/components/home/ProductCarousel";
import TrustStrip from "@/components/home/TrustStrip";
import Newsletter from "@/components/home/Newsletter";
import Reveal from "@/components/ui/Reveal";
import { getPopularProducts } from "@/lib/queries";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
  const [products, t] = await Promise.all([getPopularProducts(), getTranslations("common")]);
  // The hero showcase needs product images; slice a few for the rotation.
  const heroProducts = products.filter((p) => p.imageUrl).slice(0, 4);

  const base = siteUrl();
  // Organization + WebSite (with SearchAction) structured data for rich results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Pharmacy",
        "@id": `${base}/#organization`,
        name: t("siteTitle"),
        description: t("siteDescription"),
        url: base,
      },
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        name: t("siteTitle"),
        url: base,
        publisher: { "@id": `${base}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${base}/search?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-8 px-4 py-4 md:gap-11 md:px-10 md:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Hero products={heroProducts} />
      <Reveal>
        <CategoryGrid />
      </Reveal>
      <Reveal delay={80}>
        <ProductCarousel products={products} />
      </Reveal>
      <Reveal>
        <TrustStrip />
      </Reveal>
      <Reveal>
        <Newsletter />
      </Reveal>
    </main>
  );
}
