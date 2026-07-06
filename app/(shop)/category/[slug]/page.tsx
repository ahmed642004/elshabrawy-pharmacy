import { Suspense } from "react";
import CategoryListingClient from "@/components/listing/CategoryListingClient";
import { resolveCategorySlug } from "@/lib/categories";
import { getFilteredProducts, getCategories, getBrands } from "@/lib/queries";

function parseArrayParam(value?: string): string[] {
  return value ? value.split(",").filter(Boolean) : [];
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

  const initialCategoryId = resolveCategorySlug(
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
      />
    </Suspense>
  );
}
