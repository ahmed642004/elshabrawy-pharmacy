import Skeleton from "@/components/ui/Skeleton";
import ProductCardSkeleton from "@/components/ProductCardSkeleton";

export default function CategoryLoading() {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 px-4 py-4 md:gap-7 md:px-10 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="flex gap-6">
        <div className="hidden w-[220px] shrink-0 flex-col gap-5 md:flex">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>

        <div className="grid flex-1 grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </main>
  );
}
