import Skeleton from "@/components/ui/Skeleton";

export default function ProductLoading() {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-8 px-4 py-4 md:gap-10 md:px-10 md:py-8">
      <Skeleton className="h-4 w-64" />

      <div className="grid grid-cols-1 items-start gap-9 md:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-[20px]" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-3 h-12 w-full rounded-[12px]" />
          <Skeleton className="h-12 w-full rounded-[12px]" />
        </div>
      </div>

      <Skeleton className="h-40 w-full rounded-[16px]" />
    </main>
  );
}
