import { Sparkles, Leaf, Pill, Scissors, Droplet, Stethoscope, type LucideIcon } from "lucide-react";

export type CategoryTone = "lead" | "accent" | "neutral";

interface CategoryVisual {
  icon: LucideIcon;
  tone: CategoryTone;
}

// Category id/label now live in the `categories` table (see lib/queries.ts's
// getCategories()) — icon/tone are UI-only and can't live in the database, so
// this is the one piece of category "data" left hardcoded on purpose. Falls
// back to a generic icon/tone for any category id not listed here (e.g. a new
// category added to the database before this map is updated).
const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  skincare: { icon: Sparkles, tone: "lead" },
  vitamins: { icon: Leaf, tone: "accent" },
  supplements: { icon: Pill, tone: "accent" },
  hair: { icon: Scissors, tone: "lead" },
  personal: { icon: Droplet, tone: "accent" },
  devices: { icon: Stethoscope, tone: "neutral" },
};

const DEFAULT_VISUAL: CategoryVisual = { icon: Pill, tone: "neutral" };

export function getCategoryVisual(id: string): CategoryVisual {
  return CATEGORY_VISUALS[id] ?? DEFAULT_VISUAL;
}

// Picks the customer-facing category label by locale: Arabic when the locale
// is "ar" and an Arabic label exists, otherwise the English label. Admin UI
// stays LTR/English and reads `label` directly, so it never calls this.
export function categoryLabel(
  category: { label: string; labelAr: string | null },
  locale: string,
): string {
  return locale === "ar" && category.labelAr ? category.labelAr : category.label;
}

// Maps old/alias category slugs (e.g. Home's earlier hair-care/personal-care
// copy) to a canonical id. This is pure URL-compatibility logic, not data, so
// it stays hardcoded — but it's validated against the real category ids
// passed in (from Supabase), not a hardcoded id list, so it can't drift out
// of sync with the actual catalog.
const SLUG_ALIASES: Record<string, string> = {
  "hair-care": "hair",
  "personal-care": "personal",
  "vitamins-supplements": "vitamins",
};

export function resolveCategorySlug(slug: string, validIds: string[]): string | undefined {
  if (validIds.includes(slug)) return slug;
  const alias = SLUG_ALIASES[slug];
  return alias && validIds.includes(alias) ? alias : undefined;
}
