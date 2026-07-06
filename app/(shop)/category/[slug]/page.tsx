import { Suspense } from "react";
import CategoryListingClient from "@/components/listing/CategoryListingClient";
import { resolveCategorySlug } from "@/lib/categories";
import { getAllProducts, getCategories } from "@/lib/queries";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [products, categories] = await Promise.all([getAllProducts(), getCategories()]);
  const initialCategoryId = resolveCategorySlug(
    slug,
    categories.map((c) => c.id)
  );

  return (
    <Suspense fallback={null}>
      <CategoryListingClient initialCategoryId={initialCategoryId} products={products} categories={categories} />
    </Suspense>
  );
}
