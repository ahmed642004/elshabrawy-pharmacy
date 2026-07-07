import { useLocale, useTranslations } from "next-intl";
import { categoryLabel } from "@/lib/categories";
import type { CategoryRow } from "@/lib/queries";

export interface PriceRange {
  id: string;
  label: string;
}

interface FilterGroupsProps {
  categories: CategoryRow[];
  selectedCategories: string[];
  onToggleCategory: (id: string) => void;
  priceRanges: PriceRange[];
  selectedPriceRanges: string[];
  onTogglePrice: (id: string) => void;
  brands: string[];
  selectedBrands: string[];
  onToggleBrand: (brand: string) => void;
  onClear: () => void;
  hideTitle?: boolean;
}

const groupTitleClass =
  "mb-2.5 font-headline text-[12.5px] font-bold tracking-wide text-neutral-900 uppercase";
const rowClass = "flex min-h-8 cursor-pointer items-center gap-2.5 py-1.5";
const checkboxClass = "h-[18px] w-[18px] shrink-0 cursor-pointer accent-primary-500";
const rowLabelClass = "text-sm text-neutral-700";

export default function FilterGroups({
  categories,
  selectedCategories,
  onToggleCategory,
  priceRanges,
  selectedPriceRanges,
  onTogglePrice,
  brands,
  selectedBrands,
  onToggleBrand,
  onClear,
  hideTitle = false,
}: FilterGroupsProps) {
  const t = useTranslations("listing");
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-6">
      {!hideTitle && (
        <div className="flex items-center justify-between">
          <span className="font-headline text-base font-extrabold text-neutral-900">{t("filters")}</span>
          <button type="button" onClick={onClear} className="font-label text-[13px] font-semibold text-primary-500">
            {t("clearAll")}
          </button>
        </div>
      )}

      <div>
        <div className={groupTitleClass}>{t("groups.category")}</div>
        {categories.map((c) => (
          <label key={c.id} className={rowClass}>
            <input
              type="checkbox"
              checked={selectedCategories.includes(c.id)}
              onChange={() => onToggleCategory(c.id)}
              className={checkboxClass}
            />
            <span className={rowLabelClass}>{categoryLabel(c, locale)}</span>
          </label>
        ))}
      </div>

      <div>
        <div className={groupTitleClass}>{t("groups.price")}</div>
        {priceRanges.map((r) => (
          <label key={r.id} className={rowClass}>
            <input
              type="checkbox"
              checked={selectedPriceRanges.includes(r.id)}
              onChange={() => onTogglePrice(r.id)}
              className={checkboxClass}
            />
            <span className={rowLabelClass}>{r.label}</span>
          </label>
        ))}
      </div>

      <div>
        <div className={groupTitleClass}>{t("groups.brand")}</div>
        <div className="flex max-h-[220px] flex-col overflow-y-auto">
          {brands.map((b) => (
            <label key={b} className={rowClass}>
              <input
                type="checkbox"
                checked={selectedBrands.includes(b)}
                onChange={() => onToggleBrand(b)}
                className={checkboxClass}
              />
              <span className={rowLabelClass}>{b}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
