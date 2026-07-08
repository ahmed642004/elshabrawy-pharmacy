import Skeleton from "@/components/ui/Skeleton";

export default function InventoryLoading() {
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-5 md:px-10 md:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-[12px]" />
        ))}
      </div>
    </main>
  );
}
