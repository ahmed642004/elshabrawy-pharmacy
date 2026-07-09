import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Button from "@/components/ui/Button";

// Shown when the product page calls notFound() for an unknown slug. This
// segment's layout still mounts Header/Footer, unlike the root not-found.tsx.
export default async function ProductNotFound() {
  const t = await getTranslations("notFound");

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 items-center justify-center px-4 py-16">
      <div className="flex flex-col items-center gap-3.5 rounded-[28px] border border-neutral-200 bg-white px-6 py-12 text-center">
        <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-tertiary-100">
          <PackageSearch className="h-[34px] w-[34px] text-primary-500" />
        </span>
        <div className="font-headline text-xl font-extrabold text-neutral-900">{t("productTitle")}</div>
        <div className="max-w-[320px] text-sm text-neutral-500">{t("productBody")}</div>
        <Link href="/category">
          <Button variant="primary" size="lg">
            {t("browse")}
          </Button>
        </Link>
      </div>
    </main>
  );
}
