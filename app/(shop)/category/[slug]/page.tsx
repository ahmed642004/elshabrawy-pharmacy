import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import CategoryListingClient from "@/components/listing/CategoryListingClient";
import { categoryLabel, resolveCategorySlug } from "@/lib/categories";
import { getFilteredProducts, getCategories, getBrands } from "@/lib/queries";
import { siteUrl } from "@/lib/site";
import { listingJsonLd } from "@/lib/seo";

function parseArrayParam(value?: string): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [categories, locale, t, tListing] = await Promise.all([
    getCategories(),
    getLocale(),
    getTranslations("common"),
    getTranslations("listing"),
  ]);

  const canonical = { alternates: { canonical: `/category/${slug}` } };
  if (slug === "offers") {
    return {
      title: tListing("offersTitle"),
      description: tListing("metaDescriptionOffers"),
      ...canonical,
    };
  }

  const resolvedId = resolveCategorySlug(
    slug,
    categories.map((c) => c.id)
  );
  const category = categories.find((c) => c.id === resolvedId);
  if (!category) {
    // Unknown slug: absolute title so the "%s | siteTitle" template doesn't
    // render the site name twice.
    return { title: { absolute: t("siteTitle") }, description: t("siteDescription"), ...canonical };
  }

  const label = categoryLabel(category, locale);
  return {
    title: label,
    description: tListing("metaDescription", { category: label }),
    ...canonical,
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

  const [products, brands, locale, tListing] = await Promise.all([
    getFilteredProducts({
      categoryIds: selectedCategories,
      brands: selectedBrands,
      priceRangeIds: selectedPriceRanges,
      sort,
      onSale: isOffers,
    }),
    getBrands(),
    getLocale(),
    getTranslations("listing"),
  ]);

  const category = categories.find((c) => c.id === initialCategoryId);
  const pageName = isOffers
    ? tListing("offersTitle")
    : category
      ? categoryLabel(category, locale)
      : tListing("allProducts");
  const jsonLd = listingJsonLd(siteUrl(), tListing("breadcrumbHome"), pageName, products);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Suspense fallback={null}>
        <CategoryListingClient
          initialCategoryId={initialCategoryId}
          products={products}
          categories={categories}
          brands={brands}
          offersMode={isOffers}
        />
      </Suspense>
    </>
  );
}
