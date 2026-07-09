import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import CategoryListingClient from "@/components/listing/CategoryListingClient";
import { getFilteredProducts, getCategories, getBrands } from "@/lib/queries";
import { siteUrl } from "@/lib/site";
import { listingJsonLd } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const tListing = await getTranslations("listing");
  return {
    title: tListing("allProducts"),
    description: tListing("metaDescriptionAll"),
    alternates: { canonical: "/category" },
  };
}

function parseArrayParam(value?: string): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

export default async function CategoryIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; brand?: string; price?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const selectedCategories = parseArrayParam(sp.cat);
  const selectedBrands = parseArrayParam(sp.brand);
  const selectedPriceRanges = parseArrayParam(sp.price);
  const sort = sp.sort ?? "recommended";

  const [categories, products, brands, tListing] = await Promise.all([
    getCategories(),
    getFilteredProducts({
      categoryIds: selectedCategories,
      brands: selectedBrands,
      priceRangeIds: selectedPriceRanges,
      sort,
    }),
    getBrands(),
    getTranslations("listing"),
  ]);

  const jsonLd = listingJsonLd(
    siteUrl(),
    tListing("breadcrumbHome"),
    tListing("allProducts"),
    products
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Suspense fallback={null}>
        <CategoryListingClient products={products} categories={categories} brands={brands} />
      </Suspense>
    </>
  );
}
