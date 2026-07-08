"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";

// Interactive 1-5 star picker shared by the product-page ReviewForm and the
// post-delivery ReviewPrompt. Renders 1→5 in source order so it mirrors
// correctly under RTL (no absolute positioning).
export default function StarRatingInput({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange: (value: number) => void;
  size?: "md" | "lg";
}) {
  const t = useTranslations("product.reviewForm");
  const [hover, setHover] = useState(0);
  const starClass = size === "lg" ? "h-8 w-8" : "h-6 w-6";

  return (
    <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {Array.from({ length: 5 }).map((_, i) => {
        const star = i + 1;
        const filled = star <= (hover || value);
        return (
          <button
            key={star}
            type="button"
            aria-label={t("ratingLabel", { value: star })}
            onMouseEnter={() => setHover(star)}
            onClick={() => onChange(star)}
          >
            <Star
              className={`${starClass} transition-transform hover:scale-110 ${
                filled ? "fill-warning-500 text-warning-500" : "text-neutral-200"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
