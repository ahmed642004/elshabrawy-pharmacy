import Link from "next/link";
import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Button from "@/components/ui/Button";

// Root-level 404 — catches any unmatched URL across the whole app (including
// typos under /admin). Renders inside the root layout only: no shop
// Header/Footer here on purpose, since mounting them would drag shop data
// fetching into every unmatched URL. The product-detail 404
// (app/(shop)/product/[slug]/not-found.tsx) gets shop chrome from its segment.
export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex flex-col items-center gap-3.5 rounded-[28px] border border-neutral-200 bg-white px-6 py-12 text-center">
        <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-tertiary-100">
          <SearchX className="h-[34px] w-[34px] text-primary-500" />
        </span>
        <div className="font-headline text-xl font-extrabold text-neutral-900">{t("title")}</div>
        <div className="max-w-[320px] text-sm text-neutral-500">{t("body")}</div>
        <Link href="/">
          <Button variant="primary" size="lg">
            {t("home")}
          </Button>
        </Link>
      </div>
    </main>
  );
}
