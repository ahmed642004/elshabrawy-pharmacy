import Skeleton from "@/components/ui/Skeleton";

export default function AccountLoading() {
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-5 px-4 py-6 md:px-6 md:py-10">
      <div>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
      <div className="flex flex-col gap-4 rounded-[16px] border border-neutral-200 bg-white p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full rounded-[10px]" />
        <Skeleton className="h-10 w-full rounded-[10px]" />
      </div>
      <div className="flex flex-col gap-3 rounded-[16px] border border-neutral-200 bg-white p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full rounded-[10px]" />
        <Skeleton className="h-16 w-full rounded-[10px]" />
      </div>
    </main>
  );
}
