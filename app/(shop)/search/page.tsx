import Link from "next/link";
import { ChevronRight, SearchX } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { searchProducts } from "@/lib/queries";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query ? await searchProducts(query) : [];

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 px-4 py-4 md:gap-7 md:px-10 md:py-8">
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[13px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-700">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-neutral-900">Search results</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="m-0 font-headline text-2xl font-extrabold tracking-tight text-neutral-900 md:text-[32px]">
            {query ? `Search results for “${query}”` : "Search"}
          </h1>
          {query && (
            <span className="text-sm text-neutral-500">
              {results.length} product{results.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {results.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {results.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-[14px] border border-neutral-200 bg-white px-6 py-16 text-center">
          <SearchX className="h-9 w-9 text-neutral-300" />
          <div className="font-headline text-[17px] font-bold text-neutral-900">
            {query ? "No products found" : "Search for a product"}
          </div>
          <div className="max-w-[320px] text-sm text-neutral-500">
            {query
              ? `We couldn't find anything matching “${query}”. Try a different name or brand.`
              : "Use the search bar above to find medicines, brands, or health needs."}
          </div>
        </div>
      )}
    </main>
  );
}
