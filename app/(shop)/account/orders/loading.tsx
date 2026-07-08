import Skeleton from "@/components/ui/Skeleton";

export default function OrdersLoading() {
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-5 px-4 py-6 md:px-6 md:py-10">
      <div>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[14px]" />
        ))}
      </div>
    </main>
  );
}
