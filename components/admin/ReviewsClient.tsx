"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Eye, EyeOff, Trash2, Star } from "lucide-react";
import IconButton from "@/components/ui/IconButton";
import { hideReview, deleteReviewAdmin } from "@/lib/actions";
import type { AdminReview } from "@/lib/queries";

type Filter = "all" | "visible" | "hidden";

function StatusPill({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <span className="w-fit rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-500">
      Hidden
    </span>
  ) : (
    <span className="w-fit rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-semibold text-success-600">
      Visible
    </span>
  );
}

export default function ReviewsClient({ reviews }: { reviews: AdminReview[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function withPending(id: string, fn: () => Promise<void>) {
    setPendingIds((prev) => new Set(prev).add(id));
    setRowError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch {
        setRowError(id);
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
  }

  function handleToggleHidden(review: AdminReview) {
    withPending(review.id, () => hideReview(review.id, !review.hidden));
  }

  function handleDeleteClick(id: string) {
    if (confirmingDelete !== id) {
      setConfirmingDelete(id);
      return;
    }
    setConfirmingDelete(null);
    withPending(id, () => deleteReviewAdmin(id));
  }

  const filtered = useMemo(() => {
    if (filter === "visible") return reviews.filter((r) => !r.hidden);
    if (filter === "hidden") return reviews.filter((r) => r.hidden);
    return reviews;
  }, [filter, reviews]);

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-5 md:px-10 md:py-8">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div>
          <h1 className="m-0 font-headline text-2xl font-extrabold tracking-tight text-neutral-900 md:text-3xl">
            Reviews
          </h1>
          <p className="m-0 mt-1 text-sm text-neutral-500">
            {reviews.length} review{reviews.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-1.5">
          {(["all", "visible", "hidden"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`h-9 rounded-full px-3.5 font-label text-sm font-semibold capitalize transition-colors ${
                filter === f
                  ? "bg-primary-500 text-white shadow-[0_1px_2px_rgba(15,82,255,0.25)]"
                  : "border border-neutral-300 bg-white text-neutral-600"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-[20px] border border-neutral-200 bg-white shadow-sm">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[180px_140px_80px_1fr_110px_100px_120px] gap-2 border-b border-neutral-100 px-5 py-3.5 font-label text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
            <div>Product</div>
            <div>Author</div>
            <div>Rating</div>
            <div>Body</div>
            <div>Date</div>
            <div>Status</div>
            <div>Actions</div>
          </div>
          {filtered.map((review) => {
            const pending = pendingIds.has(review.id);
            return (
              <div key={review.id}>
                <div className="grid grid-cols-[180px_140px_80px_1fr_110px_100px_120px] items-center gap-2 border-b border-neutral-100 px-5 py-3.5 last:border-0">
                  <div className="truncate text-sm font-semibold text-neutral-900">
                    {review.productSlug ? (
                      <Link href={`/product/${review.productSlug}`} target="_blank" className="hover:text-primary-500">
                        {review.productName}
                      </Link>
                    ) : (
                      review.productName
                    )}
                  </div>
                  <div className="truncate text-sm text-neutral-700">{review.authorName}</div>
                  <div className="flex items-center gap-1 text-sm text-neutral-700">
                    <Star className="h-3.5 w-3.5 fill-warning-400 text-warning-400" />
                    {review.rating}/5
                  </div>
                  <div className="line-clamp-2 text-sm text-neutral-600">{review.body || "—"}</div>
                  <div className="text-sm text-neutral-500">{dateFormatter.format(new Date(review.createdAt))}</div>
                  <StatusPill hidden={review.hidden} />
                  <div className="flex gap-1.5">
                    <IconButton
                      icon={review.hidden ? Eye : EyeOff}
                      aria-label={review.hidden ? "Unhide review" : "Hide review"}
                      size="sm"
                      disabled={pending}
                      onClick={() => handleToggleHidden(review)}
                    />
                    <IconButton
                      icon={Trash2}
                      tone={confirmingDelete === review.id ? "danger" : "neutral"}
                      aria-label="Delete review"
                      size="sm"
                      disabled={pending}
                      onClick={() => handleDeleteClick(review.id)}
                    />
                  </div>
                </div>
                {rowError === review.id && (
                  <div className="border-b border-neutral-100 bg-danger-50 px-5 py-2 text-xs text-danger-600">
                    Something went wrong. Please try again.
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
              <Star className="h-8 w-8 text-neutral-300" strokeWidth={1.5} />
              <div className="text-sm text-neutral-400">No reviews here.</div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
