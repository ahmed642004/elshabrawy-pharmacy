"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import StarRatingInput from "@/components/product/StarRatingInput";
import { submitReview } from "@/lib/actions";

export default function ReviewForm({ slug, isLoggedIn }: { slug: string; isLoggedIn: boolean }) {
  const t = useTranslations("product.reviewForm");
  const tHeader = useTranslations("header");
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!isLoggedIn) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-neutral-200 bg-white p-4.5 text-sm text-neutral-600">
        <span>{t("signInPrompt")}</span>
        <Link href={`/auth?redirect=/product/${slug}`} className="font-semibold text-primary-600">
          {tHeader("signIn")}
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="rounded-[14px] border border-secondary-100 bg-secondary-50 p-4.5 text-sm text-secondary-700">
        {t("thanks")}
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || rating === 0) return;
    setSubmitting(true);
    setError("");
    try {
      await submitReview({ productSlug: slug, rating, body });
      setSubmitted(true);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message === "NOT_PURCHASED" ? t("notPurchased") : t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-[14px] border border-neutral-200 bg-white p-4.5">
      <div className="font-headline text-sm font-bold text-neutral-900">{t("title")}</div>

      <StarRatingInput value={rating} onChange={setRating} />

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder={t("bodyPlaceholder")}
        className="w-full rounded-[10px] border border-neutral-300 bg-white px-3.5 py-2.5 font-body text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-primary-500 focus:ring-3 focus:ring-primary-500/20"
      />

      {error && <div className="text-xs text-danger-500">{error}</div>}

      <Button type="submit" variant="primary" size="md" disabled={submitting || rating === 0} className="self-start">
        {submitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
