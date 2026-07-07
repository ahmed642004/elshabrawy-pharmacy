import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

// Link keys per column — rendered as plain text, not <Link>s, since most of
// these destinations don't have real pages yet (see CLAUDE.md).
const FOOTER_COLUMNS = [
  { titleKey: "shop", linkKeys: ["skincare", "vitamins", "hair", "offers"] },
  { titleKey: "company", linkKeys: ["about", "careers", "pharmacies"] },
  { titleKey: "support", linkKeys: ["help", "track", "ask"] },
  { titleKey: "legal", linkKeys: ["privacy", "terms", "licensing"] },
] as const;

export default function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-neutral-200 bg-white px-4 pt-7 md:px-10 md:pt-9">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-7 grid grid-cols-2 gap-7 lg:grid-cols-4">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.titleKey}>
              <div className="mb-3 font-headline text-[13px] font-bold tracking-wide text-neutral-900 uppercase">
                {t(col.titleKey)}
              </div>
              <div className="flex flex-col gap-2.5">
                {col.linkKeys.map((linkKey) => (
                  <span key={linkKey} className="text-[13.5px] text-neutral-500">
                    {t(linkKey)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-neutral-200 py-5 md:flex-row md:items-center">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-primary-500">
              <Plus className="h-4 w-4 text-white" />
            </span>
            <span className="text-[13px] text-neutral-500">
              {t("copyright", { year: new Date().getFullYear() })}
            </span>
          </div>
          <div className="flex flex-wrap gap-4 text-[13px] text-neutral-500">
            <span>{t("privacy")}</span>
            <span>{t("terms")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
