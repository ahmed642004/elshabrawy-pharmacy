"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";

// Cookie-based locale switch (no URL prefixes — see i18n/request.ts). The
// button label shows the language you'd switch TO, and router.refresh()
// re-renders the server tree with the new cookie, same pattern the header
// uses after sign-out.
export default function LocaleSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("header");
  const router = useRouter();

  function switchLocale() {
    const next = locale === "ar" ? "en" : "ar";
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={switchLocale}
      className={`flex h-10 items-center gap-1.5 rounded-full border border-neutral-200 px-3 font-label text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50 ${className}`}
    >
      <Globe className="h-4 w-4" />
      {t("switchLocale")}
    </button>
  );
}
