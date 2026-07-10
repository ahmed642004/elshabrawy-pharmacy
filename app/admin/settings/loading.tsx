import Skeleton from "@/components/ui/Skeleton";

export default function SettingsLoading() {
  return (
    <main className="mx-auto max-w-[720px] px-4 py-5 md:px-10 md:py-8">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex flex-col gap-5 rounded-[20px] border border-neutral-200 bg-white p-6 shadow-sm md:p-7">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-16 w-full rounded-[12px]" />
        <Skeleton className="h-16 w-full rounded-[12px]" />
        <Skeleton className="h-10 w-32" />
      </div>
    </main>
  );
}
