"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronRight, ChevronDown, SlidersHorizontal, SearchX, X } from "lucide-react";
import Button from "@/components/ui/Button";
import ProductCard from "@/components/ProductCard";
import FilterGroups from "@/components/listing/FilterGroups";
import { PRICE_RANGES } from "@/lib/price-ranges";
import type { ListingProduct, CategoryRow } from "@/lib/queries";

const SORT_OPTIONS = [
  { id: "recommended", label: "Recommended" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "name-asc", label: "Name: A to Z" },
];

function toggleInArray(arr: string[], value: string) {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function parseArrayParam(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

export default function CategoryListingClient({
  initialCategoryId,
  products,
  categories,
  brands,
}: {
  initialCategoryId?: string;
  products: ListingProduct[];
  categories: CategoryRow[];
  brands: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const catParam = searchParams.get("cat");
  const selectedCategories = catParam !== null ? parseArrayParam(catParam) : initialCategoryId ? [initialCategoryId] : [];
  const selectedBrands = parseArrayParam(searchParams.get("brand"));
  const selectedPriceRanges = parseArrayParam(searchParams.get("price"));
  const sortBy = searchParams.get("sort") ?? "recommended";

  function replaceParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function setCategories(values: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (values.length) params.set("cat", values.join(","));
    else params.delete("cat");

    const targetPath = pathname === "/category" || pathname.startsWith("/category/") ? "/category" : pathname;
    const qs = params.toString();
    router.replace(qs ? `${targetPath}?${qs}` : targetPath, { scroll: false });
  }

  function setBrands(values: string[]) {
    replaceParams({ brand: values.length ? values.join(",") : null });
  }

  function setPriceRanges(values: string[]) {
    replaceParams({ price: values.length ? values.join(",") : null });
  }

  function setSortBy(value: string) {
    replaceParams({ sort: value === "recommended" ? null : value });
  }

  // Filtering/sorting already happened server-side (getFilteredProducts) based
  // on these same URL params, so `products` here is already the exact result
  // set — no client-side re-filtering needed.
  const activeCategory =
    selectedCategories.length === 1 ? categories.find((c) => c.id === selectedCategories[0]) : undefined;
  const pageTitle = activeCategory ? activeCategory.label : "All products";
  const resultCountLabel = `${products.length} product${products.length === 1 ? "" : "s"}`;
  const activeFilterCount = selectedCategories.length + selectedBrands.length + selectedPriceRanges.length;

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cat");
    params.delete("brand");
    params.delete("price");

    const targetPath = pathname === "/category" || pathname.startsWith("/category/") ? "/category" : pathname;
    const qs = params.toString();
    router.replace(qs ? `${targetPath}?${qs}` : targetPath, { scroll: false });
  }

  const filterGroupsProps = {
    categories,
    selectedCategories,
    onToggleCategory: (id: string) => setCategories(toggleInArray(selectedCategories, id)),
    priceRanges: PRICE_RANGES,
    selectedPriceRanges,
    onTogglePrice: (id: string) => setPriceRanges(toggleInArray(selectedPriceRanges, id)),
    brands,
    selectedBrands,
    onToggleBrand: (brand: string) => setBrands(toggleInArray(selectedBrands, brand)),
    onClear: clearFilters,
  };

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 px-4 py-4 md:gap-7 md:px-10 md:py-8">
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[13px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-700">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-neutral-900">{pageTitle}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="m-0 font-headline text-2xl font-extrabold tracking-tight text-neutral-900 md:text-[32px]">
            {pageTitle}
          </h1>
          <span className="text-sm text-neutral-500">{resultCountLabel}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setFilterSheetOpen(true)}
          className="flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[10px] border border-neutral-300 bg-white font-label text-sm font-semibold text-neutral-700 md:hidden"
        >
          <SlidersHorizontal className="h-[18px] w-[18px]" /> Filters
          {activeFilterCount > 0 && (
            <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary-500 px-1 text-[11px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>

        <div className="relative shrink-0 md:ml-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-[46px] min-w-[200px] appearance-none rounded-[10px] border border-neutral-300 bg-white py-0 pr-10 pl-4 font-label text-sm font-semibold text-neutral-700"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[240px_1fr]">
        <aside className="sticky top-[100px] hidden flex-col gap-6 md:flex">
          <FilterGroups {...filterGroupsProps} />
        </aside>

        <div>
          {products.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-[14px] border border-neutral-200 bg-white px-6 py-16 text-center">
              <SearchX className="h-9 w-9 text-neutral-300" />
              <div className="font-headline text-[17px] font-bold text-neutral-900">
                No products match your filters
              </div>
              <div className="max-w-[320px] text-sm text-neutral-500">
                Try removing a filter or clearing all to see more results.
              </div>
              <Button variant="outlined" size="sm" onClick={clearFilters}>
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      </div>

      {filterSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
          <div onClick={() => setFilterSheetOpen(false)} className="absolute inset-0 bg-neutral-900/40" />
          <div className="relative flex max-h-[82vh] flex-col rounded-t-[20px] bg-white shadow-lg">
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-4">
              <span className="font-headline text-[17px] font-extrabold text-neutral-900">Filters</span>
              <button
                type="button"
                onClick={() => setFilterSheetOpen(false)}
                aria-label="Close filters"
                className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-neutral-300 bg-white"
              >
                <X className="h-[18px] w-[18px] text-neutral-700" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <FilterGroups {...filterGroupsProps} hideTitle />
            </div>
            <div className="flex shrink-0 gap-2.5 border-t border-neutral-200 px-5 py-4">
              <Button variant="outlined" size="lg" className="flex-1" onClick={clearFilters}>
                Clear all
              </Button>
              <Button variant="primary" size="lg" className="flex-1" onClick={() => setFilterSheetOpen(false)}>
                Show {products.length} results
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
