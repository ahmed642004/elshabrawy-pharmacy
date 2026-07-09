import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import CategoryListingClient from "@/components/listing/CategoryListingClient";
import { categoryLabel, resolveCategorySlug } from "@/lib/categories";
import { getFilteredProducts, getCategories, getBrands } from "@/lib/queries";

function parseArrayParam(value?: string): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [categories, locale, t] = await Promise.all([
    getCategories(),
    getLocale(),
    getTranslations("common"),
  ]);

  let label: string;
  if (slug === "offers") {
    label = (await getTranslations("listing"))("offersTitle");
  } else {
    const resolvedId = resolveCategorySlug(
      slug,
      categories.map((c) => c.id)
    );
    const category = categories.find((c) => c.id === resolvedId);
    label = category ? categoryLabel(category, locale) : t("siteTitle");
  }

  return {
    title: `${label} | ${t("siteTitle")}`,
    alternates: { canonical: `/category/${slug}` },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cat?: string; brand?: string; price?: string; sort?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const categories = await getCategories();

  // /category/offers isn't a real category — resolveCategorySlug() would
  // return undefined for it — so it's special-cased to the on_sale filter
  // instead of a category match. cat/brand/price/sort still compose on top.
  const isOffers = slug === "offers";
  const initialCategoryId = isOffers
    ? undefined
    : resolveCategorySlug(
        slug,
        categories.map((c) => c.id)
      );
  const selectedCategories =
    sp.cat !== undefined ? parseArrayParam(sp.cat) : initialCategoryId ? [initialCategoryId] : [];
  const selectedBrands = parseArrayParam(sp.brand);
  const selectedPriceRanges = parseArrayParam(sp.price);
  const sort = sp.sort ?? "recommended";

  const [products, brands] = await Promise.all([
    getFilteredProducts({
      categoryIds: selectedCategories,
      brands: selectedBrands,
      priceRangeIds: selectedPriceRanges,
      sort,
      onSale: isOffers,
    }),
    getBrands(),
  ]);

  return (
    <Suspense fallback={null}>
      <CategoryListingClient
        initialCategoryId={initialCategoryId}
        products={products}
        categories={categories}
        brands={brands}
        offersMode={isOffers}
      />
    </Suspense>
  );
}
