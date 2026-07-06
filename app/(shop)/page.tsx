import Hero from "@/components/home/Hero";
import CategoryGrid from "@/components/home/CategoryGrid";
import ProductCarousel from "@/components/home/ProductCarousel";
import TrustStrip from "@/components/home/TrustStrip";
import Newsletter from "@/components/home/Newsletter";
import { getPopularProducts } from "@/lib/queries";

export default async function Home() {
  const products = await getPopularProducts();

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-8 px-4 py-4 md:gap-11 md:px-10 md:py-8">
      <Hero />
      <CategoryGrid />
      <ProductCarousel products={products} />
      <TrustStrip />
      <Newsletter />
    </main>
  );
}
