"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";

// Client component required by Next's error boundary convention — can't use
// getTranslations (server-only); useTranslations works because
// NextIntlClientProvider sits in the root layout, above this segment.
export default function ShopError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPage");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex flex-col items-center gap-3.5 rounded-[28px] border border-neutral-200 bg-white px-6 py-12 text-center">
        <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-danger-50">
          <AlertTriangle className="h-[34px] w-[34px] text-danger-500" />
        </span>
        <div className="font-headline text-xl font-extrabold text-neutral-900">{t("title")}</div>
        <div className="max-w-[320px] text-sm text-neutral-500">{t("body")}</div>
        <Button variant="primary" size="lg" onClick={reset}>
          {t("retry")}
        </Button>
      </div>
    </main>
  );
}
