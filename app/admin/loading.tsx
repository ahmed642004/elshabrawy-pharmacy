import Skeleton from "@/components/ui/Skeleton";

export default function AdminOverviewLoading() {
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-5 md:px-10 md:py-8">
      <div className="mb-5 flex flex-col gap-3 md:mb-7 md:flex-row md:items-start md:justify-between md:gap-4">
        <div>
          <Skeleton className="h-7 w-56" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:mb-6 md:grid-cols-4 md:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[16px]" />
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:mb-6 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-64 w-full rounded-[16px]" />
        <Skeleton className="h-64 w-full rounded-[16px]" />
      </div>

      <Skeleton className="h-72 w-full rounded-[16px]" />
    </main>
  );
}
