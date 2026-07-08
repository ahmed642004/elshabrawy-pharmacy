import { Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import ReviewForm from "@/components/product/ReviewForm";

export interface Review {
  authorName: string;
  rating: number;
  body: string | null;
  createdAt: string;
}

function formatReviewDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", {
    month: "long",
    year: "numeric",
  });
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < Math.round(rating) ? "fill-warning-500 text-warning-500" : "text-neutral-200"}`}
        />
      ))}
    </div>
  );
}

interface ProductReviewsProps {
  slug: string;
  isLoggedIn: boolean;
  rating: number | null;
  reviewCount: number;
  reviews: Review[];
}

export default function ProductReviews({ slug, isLoggedIn, rating, reviewCount, reviews }: ProductReviewsProps) {
  const t = useTranslations("product");
  const locale = useLocale();

  return (
    <div>
      <h2 className="m-0 mb-4 font-headline text-xl font-extrabold tracking-tight text-neutral-900 md:text-2xl">
        {t("reviews")}
      </h2>
      <div className="grid grid-cols-1 items-start gap-7 md:grid-cols-[220px_1fr]">
        <div className="flex flex-col items-start gap-1.5 rounded-[14px] border border-primary-100 bg-tertiary-100 p-5 md:items-center">
          <span className="font-headline text-4xl leading-none font-black text-neutral-900">{rating ?? "—"}</span>
          <StarRow rating={rating ?? 0} />
          <span className="text-[13px] text-neutral-500">{t("basedOn", { count: reviewCount })}</span>
        </div>

        <div className="flex flex-col gap-[18px]">
          {reviews.length > 0 ? (
            reviews.map((r, i) => (
              <div key={i} className="border-b border-neutral-200 pb-[18px] last:border-b-0 last:pb-0">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="font-headline text-sm font-bold text-neutral-900">{r.authorName}</span>
                  <span className="text-xs text-neutral-400">{formatReviewDate(r.createdAt, locale)}</span>
                </div>
                <div className="mb-2">
                  <StarRow rating={r.rating} />
                </div>
                {r.body && <p className="m-0 text-sm leading-[1.6] text-neutral-700">{r.body}</p>}
              </div>
            ))
          ) : (
            <p className="m-0 text-sm text-neutral-500">{t("noReviews")}</p>
          )}

          <div className="max-w-[520px]">
            <ReviewForm slug={slug} isLoggedIn={isLoggedIn} />
          </div>
        </div>
      </div>
    </div>
  );
}
