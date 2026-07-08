import Skeleton from "@/components/ui/Skeleton";

export default function CheckoutLoading() {
  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-col gap-5 px-4 py-6 md:px-6 md:py-10">
      <Skeleton className="h-8 w-48" />
      <div className="flex flex-col gap-4 rounded-[16px] border border-neutral-200 bg-white p-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-20 w-full rounded-[12px]" />
        <Skeleton className="h-20 w-full rounded-[12px]" />
      </div>
      <div className="flex flex-col gap-4 rounded-[16px] border border-neutral-200 bg-white p-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-12 w-full rounded-[12px]" />
      </div>
    </main>
  );
}
