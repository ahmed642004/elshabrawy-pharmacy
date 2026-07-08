"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Pill } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import StarRatingInput from "@/components/product/StarRatingInput";
import { submitReview } from "@/lib/actions";
import type { PendingReview } from "@/lib/queries";

// Only auto-open once per browser session — navigating between storefront
// pages re-renders this (it's in the shop layout), and re-popping on every
// route change would be the opposite of delightful.
const SESSION_KEY = "elshabrawy-review-prompt-seen";

export default function ReviewPrompt({ products }: { products: PendingReview[] }) {
  const t = useTranslations("reviewPrompt");
  const router = useRouter();
  // Snapshot the list once. submitReview() is a server action, so completing
  // one review triggers Next to re-fetch this layout — shrinking the `products`
  // prop mid-flow. Driving the modal off a frozen local copy keeps `index`
  // aligned so a submitted product doesn't cause the next one to be skipped.
  const [queue] = useState(products);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (queue.length === 0) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    // Mount-time decision gated on sessionStorage, which isn't available
    // during SSR — this can only run in an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [queue.length]);

  if (!open || queue.length === 0) return null;

  const current = queue[index];
  // Guard: if the list somehow runs out (e.g. index past the end), close out.
  if (!current) return null;

  function reset() {
    setRating(0);
    setBody("");
    setError("");
  }

  function close() {
    setOpen(false);
    // Any reviews just submitted mean product pages / rating aggregates changed.
    router.refresh();
  }

  function advance() {
    if (index + 1 < queue.length) {
      setIndex((i) => i + 1);
      reset();
    } else {
      close();
    }
  }

  async function handleSubmit() {
    if (submitting || rating === 0) return;
    setSubmitting(true);
    setError("");
    try {
      await submitReview({ productSlug: current.slug, rating, body });
      advance();
    } catch {
      setError(t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      style={{ animation: "ccOverlayIn 160ms ease-out" }}
    >
      <div onClick={close} className="absolute inset-0 bg-neutral-900/40" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative mx-0 w-full max-w-[420px] rounded-t-[20px] bg-white p-5 shadow-lg sm:mx-4 sm:rounded-[20px] sm:p-6"
        style={{ animation: "ccScaleIn 200ms ease-out" }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="font-headline text-lg font-extrabold text-neutral-900">{t("title")}</div>
            {queue.length > 1 && (
              <div className="mt-0.5 text-xs text-neutral-500">
                {t("progress", { current: index + 1, total: queue.length })}
              </div>
            )}
          </div>
          <IconButton icon={X} aria-label={t("close")} shape="circle" size="sm" onClick={close} />
        </div>

        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-neutral-100">
            {current.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Pill className="h-6 w-6 text-neutral-300" strokeWidth={1.5} />
            )}
          </span>
          <div className="min-w-0">
            <div className="text-xs text-neutral-500">{t("subtitle")}</div>
            <div className="truncate font-headline text-sm font-bold text-neutral-900">{current.name}</div>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <StarRatingInput value={rating} onChange={setRating} size="lg" />
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder={t("bodyPlaceholder")}
          className="mt-4 w-full rounded-[10px] border border-neutral-300 bg-white px-3.5 py-2.5 font-body text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-primary-500 focus:ring-3 focus:ring-primary-500/20"
        />

        {error && <div className="mt-2 text-xs text-danger-500">{error}</div>}

        <div className="mt-4 flex gap-2.5">
          <Button type="button" variant="outlined" size="md" onClick={advance}>
            {t("skip")}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            fullWidth
            disabled={submitting || rating === 0}
            onClick={handleSubmit}
          >
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
