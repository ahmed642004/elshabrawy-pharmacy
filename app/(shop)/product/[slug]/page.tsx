import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import ProductGallery from "@/components/product/ProductGallery";
import ProductPurchasePanel from "@/components/product/ProductPurchasePanel";
import ProductTabs from "@/components/product/ProductTabs";
import RelatedProducts from "@/components/product/RelatedProducts";
import ProductReviews from "@/components/product/ProductReviews";
import { getProductBySlug, getRelatedProducts, isSignedIn } from "@/lib/queries";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [related, tListing, signedIn] = await Promise.all([
    getRelatedProducts(product.category, product.slug),
    getTranslations("listing"),
    isSignedIn(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-8 px-4 py-4 md:gap-10 md:px-10 md:py-8">
      <div className="flex items-center gap-1.5 text-[13px] text-neutral-500">
        <Link href="/" className="hover:text-neutral-700">
          {tListing("breadcrumbHome")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
        <span>{product.categoryLabel}</span>
        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
        <span className="font-semibold text-neutral-900">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 items-start gap-9 md:grid-cols-2">
        <ProductGallery name={product.name} images={product.images} />
        <ProductPurchasePanel
          slug={product.slug}
          brand={product.brand ?? ""}
          name={product.name}
          price={product.price}
          wasPrice={product.wasPrice}
          stock={product.stock ?? "in"}
          rating={product.rating}
          reviewCount={product.reviewCount}
        />
      </div>

      <ProductTabs
        description={product.description}
        dosage={product.dosage}
        ingredients={product.ingredients}
        warnings={product.warnings}
        storage={product.storage}
      />
      {related.length > 0 && <RelatedProducts products={related} />}
      <ProductReviews
        slug={product.slug}
        isLoggedIn={signedIn}
        rating={product.rating}
        reviewCount={product.reviewCount}
        reviews={product.reviews}
      />
    </main>
  );
}
