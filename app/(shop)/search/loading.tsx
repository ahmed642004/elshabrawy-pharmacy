import Skeleton from "@/components/ui/Skeleton";
import ProductCardSkeleton from "@/components/ProductCardSkeleton";

export default function SearchLoading() {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 px-4 py-4 md:gap-7 md:px-10 md:py-8">
      <div>
        <Skeleton className="mb-2 h-3.5 w-32" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}
