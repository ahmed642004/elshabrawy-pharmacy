import { Plus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

// Every entry here must have a real destination — no placeholder/dead links.
const FOOTER_COLUMNS = [
  {
    titleKey: "shop",
    links: [
      { key: "skincare", href: "/category/skincare" },
      { key: "vitamins", href: "/category/vitamins" },
      { key: "hair", href: "/category/hair" },
      { key: "offers", href: "/category/offers" },
    ],
  },
  { titleKey: "support", links: [{ key: "track", href: "/account/orders" }] },
] as const;

export default function Footer() {
  const t = useTranslations("footer");

  return (
    // No positioning/z-index here on purpose: Cart/Checkout render a
    // mobile-only fixed bottom action bar over their <main>. A plain
    // (static) footer can never paint above a position:fixed element, so
    // the bar always stays reachable. The mobile-only spacer at the bottom
    // (below) keeps the copyright line from ending up in the same on-screen
    // band the bar occupies, so nothing gets visually covered either way.
    <footer className="border-t border-neutral-200 bg-white px-4 pt-7 md:px-10 md:pt-9">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-7 grid grid-cols-2 gap-7">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.titleKey}>
              <div className="mb-3 font-headline text-[13px] font-bold tracking-wide text-neutral-900 uppercase">
                {t(col.titleKey)}
              </div>
              <div className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <Link
                    key={link.key}
                    href={link.href}
                    className="text-[13.5px] text-neutral-500 transition-colors hover:text-primary-500"
                  >
                    {t(link.key)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2.5 border-t border-neutral-200 py-5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-primary-500">
            <Plus className="h-4 w-4 text-white" />
          </span>
          <span className="text-[13px] text-neutral-500">
            {t("copyright", { year: new Date().getFullYear() })}
          </span>
        </div>
      </div>
      {/* Reserves the screen band the mobile Cart/Checkout fixed action bar
          occupies, so scrolling to the true bottom never tucks real footer
          content behind it. Harmless empty space on routes without the bar. */}
      <div className="h-20 md:hidden" aria-hidden />
    </footer>
  );
}
