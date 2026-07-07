import { ShieldCheck, Search, Sparkles, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";

const QUICK_SEARCH_KEYS = ["quick1", "quick2", "quick3"] as const;

export default function Hero() {
  const t = useTranslations("home.hero");

  return (
    <div className="flex flex-col overflow-hidden rounded-[28px] bg-[linear-gradient(120deg,var(--color-primary-600),var(--color-primary-500)_55%,var(--color-secondary-500))] text-white md:flex-row">
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-4 px-5 py-7 sm:px-8 md:px-12 md:py-11">
        <div className="flex w-fit items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 font-label text-[13px] font-semibold">
          <ShieldCheck className="h-4 w-4" /> {t("badge")}
        </div>

        <h1 className="m-0 font-headline text-[32px] leading-[1.05] font-black tracking-tight md:text-[42px]">
          {t("title")}
        </h1>

        <p className="m-0 max-w-[460px] font-body text-base leading-[1.55] text-white/90">{t("subtitle")}</p>

        <div className="max-w-[460px] rounded-full bg-white/[.98] p-1">
          <div className="flex h-11 items-center gap-2 rounded-full px-4 md:h-[52px]">
            <Search className="h-5 w-5 shrink-0 text-primary-500" />
            <input
              type="search"
              placeholder={t("searchPlaceholder")}
              className="h-full w-full min-w-0 border-none bg-transparent font-body text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_SEARCH_KEYS.map((key) => (
            <span
              key={key}
              className="cursor-pointer rounded-full bg-white/15 px-3.5 py-1.5 font-label text-[13px] font-medium"
            >
              {t(key)}
            </span>
          ))}
        </div>
      </div>

      <div className="hidden w-px shrink-0 bg-white/25 md:block" />

      <div className="hidden min-w-0 flex-1 flex-col justify-center gap-3.5 px-12 py-11 md:flex">
        <span className="flex h-14 w-14 items-center justify-center self-start rounded-[14px] bg-white/15">
          <Sparkles className="h-7 w-7" />
        </span>
        <h2 className="m-0 font-headline text-[26px] leading-[1.3] font-extrabold tracking-tight">
          {t("panelTitle")}
        </h2>
        <p className="m-0 max-w-[400px] font-body text-[15px] leading-[1.55] text-white/90">{t("panelText")}</p>
        <Button variant="inverted" size="lg" className="self-start">
          <ArrowRight className="h-[18px] w-[18px] rtl:rotate-180" /> {t("panelCta")}
        </Button>
      </div>
    </div>
  );
}
