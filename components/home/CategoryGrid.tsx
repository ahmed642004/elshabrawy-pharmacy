import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { categoryLabel, getCategoryVisual, type CategoryTone } from "@/lib/categories";
import { getCategories } from "@/lib/queries";
import Image from "next/image";

const toneClasses: Record<CategoryTone, { bg: string; fg: string }> = {
  lead: { bg: "bg-primary-50", fg: "text-primary-600" },
  accent: { bg: "bg-secondary-50", fg: "text-secondary-600" },
  neutral: { bg: "bg-neutral-100", fg: "text-neutral-600" },
};

export default async function CategoryGrid() {
  const [categories, t, locale] = await Promise.all([
    getCategories(),
    getTranslations("home.categories"),
    getLocale(),
  ]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="m-0 font-headline text-xl font-extrabold tracking-tight text-neutral-900 md:text-2xl">
          {t("title")}
        </h2>
        <Link
          href="/category"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-[10px] bg-transparent px-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-100"
        >
          {t("viewAll")} <ArrowRight className="h-[15px] w-[15px] rtl:rotate-180" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 lg:grid-cols-6">
        {categories.map((category) => {
          const { icon: Icon, tone: toneId } = getCategoryVisual(category.id);
          const tone = toneClasses[toneId];
          return (
            <Link
              key={category.id}
              href={`/category/${category.id}`}
              className="group relative aspect-square overflow-hidden rounded-[14px]"
            >
              {category.imageUrl ? (
                <Image
                  src={category.imageUrl}
                  alt=""
                  fill
                  // Without sizes, fill defaults to 100vw and the optimizer is
                  // asked for a 3840px variant of a ~200px tile — on these
                  // 3-5MB source PNGs that blows past the dev optimizer's
                  // upstream timeout and the image silently never renders.
                  sizes="(min-width: 1024px) 200px, (min-width: 768px) 33vw, 50vw"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className={`absolute inset-0 flex items-center justify-center ${tone.bg}`}>
                  <Icon className={`h-9 w-9 transition-transform duration-300 group-hover:scale-110 ${tone.fg}`} strokeWidth={1.5} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/70 via-neutral-900/5 to-transparent" />
              {/* Second overlay fades in on hover (opacity, not background). */}
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/85 via-neutral-900/15 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <span className="absolute end-0 bottom-0 start-0 px-3 py-2.5 font-label text-[13px] font-semibold text-white transition-transform duration-300 group-hover:-translate-y-0.5">
                {categoryLabel(category, locale)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
