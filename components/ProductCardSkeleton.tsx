import Skeleton from "@/components/ui/Skeleton";

export default function ProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[14px] bg-white shadow-sm">
      <div className="p-3">
        <Skeleton className="aspect-[4/3] w-full rounded-[10px]" />
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-3/4" />
        <div className="mt-auto flex items-end justify-between pt-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
    </div>
  );
}
