"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import ProductCard, { type Product } from "@/components/ProductCard";

export default function RelatedProducts({ products }: { products: Product[] }) {
  const t = useTranslations("product");
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  // Same direction-aware scroll math as ProductCarousel — under dir="rtl"
  // scrollLeft runs negative from the start position.
  const updateScrollState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const scrolled = Math.abs(el.scrollLeft);
    setCanScrollPrev(scrolled > 4);
    setCanScrollNext(scrolled + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  function scroll(direction: -1 | 1) {
    const el = trackRef.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: (rtl ? -direction : direction) * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="m-0 font-headline text-xl font-extrabold tracking-tight text-neutral-900 md:text-2xl">
          {t("related")}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t("prevAria")}
            onClick={() => scroll(-1)}
            disabled={!canScrollPrev}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
          >
            <ChevronLeft className="h-[18px] w-[18px] rtl:rotate-180" />
          </button>
          <button
            type="button"
            aria-label={t("nextAria")}
            onClick={() => scroll(1)}
            disabled={!canScrollNext}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
          >
            <ChevronRight className="h-[18px] w-[18px] rtl:rotate-180" />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="-mx-2 flex snap-x snap-mandatory gap-[18px] overflow-x-auto scroll-smooth px-2 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((product) => (
          <div key={product.slug} className="w-[190px] shrink-0 snap-start md:w-[220px]">
            <ProductCard product={product} sizes="(min-width: 768px) 220px, 190px" />
          </div>
        ))}
      </div>
    </div>
  );
}
