"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import ProductCard, { type Product } from "@/components/ProductCard";

export default function ProductCarousel({ products }: { products: Product[] }) {
  const router = useRouter();
  const t = useTranslations("home.popular");
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  // Under dir="rtl" the browser reports scrollLeft as 0 at the start and
  // increasingly NEGATIVE toward the end, so both the position checks and
  // the scroll direction must be direction-aware.
  const updateScrollState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    // Tolerance must exceed the ~8px rest offset that snap-mandatory
    // produces with the -mx-2/px-2 gutters (notably under RTL).
    const scrolled = Math.abs(el.scrollLeft);
    setCanScrollPrev(scrolled > 12);
    setCanScrollNext(scrolled + el.clientWidth < el.scrollWidth - 12);
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
          {t("title")}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push("/category")}>
            {t("viewAll")} <ArrowRight className="h-[15px] w-[15px] rtl:rotate-180" />
          </Button>
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

      <div className="relative">
        {/* Edge fade overlays hint at more content; they appear only when
            scrollable in that direction. Tailwind gradient directions are
            physical, so each logical edge needs its rtl: flip. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 start-0 z-10 w-10 bg-gradient-to-r from-neutral-50 to-transparent transition-opacity duration-300 rtl:bg-gradient-to-l ${
            canScrollPrev ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 end-0 z-10 w-10 bg-gradient-to-l from-neutral-50 to-transparent transition-opacity duration-300 rtl:bg-gradient-to-r ${
            canScrollNext ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          ref={trackRef}
          className="-mx-2 flex snap-x snap-mandatory gap-[18px] overflow-x-auto scroll-smooth px-2 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {products.map((product) => (
            <div key={product.slug} className="w-[200px] shrink-0 snap-start md:w-[240px]">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
