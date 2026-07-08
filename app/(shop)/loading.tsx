import Skeleton from "@/components/ui/Skeleton";
import ProductCardSkeleton from "@/components/ProductCardSkeleton";

export default function HomeLoading() {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-8 px-4 py-4 md:gap-11 md:px-10 md:py-8">
      <Skeleton className="h-[280px] w-full rounded-[24px] md:h-[360px]" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-[16px] md:h-36" />
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </main>
  );
}
