"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, Truck, Stethoscope, Plus, ArrowRight, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import { formatEGP } from "@/lib/cart-totals";
import type { Product } from "@/components/ProductCard";

const QUICK_SEARCH_KEYS = ["quick1", "quick2", "quick3"] as const;

// Twinkle particle positions (percentages of the right-hand scene).
const SPARKS = [
  { top: "12%", left: "18%", size: 5, delay: "0s" },
  { top: "22%", left: "78%", size: 4, delay: "0.9s" },
  { top: "55%", left: "8%", size: 4, delay: "1.7s" },
  { top: "72%", left: "85%", size: 5, delay: "0.4s" },
  { top: "85%", left: "30%", size: 3, delay: "2.3s" },
  { top: "8%", left: "55%", size: 3, delay: "1.2s" },
] as const;

export default function Hero({ products = [] }: { products?: Product[] }) {
  const t = useTranslations("home.hero");
  const sceneRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const [active, setActive] = useState(0);

  // Rotate the showcase every 4s. Skipped entirely for a single product or
  // when the user prefers reduced motion (first product stays, still a link).
  useEffect(() => {
    if (products.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setActive((i) => (i + 1) % products.length), 4000);
    return () => clearInterval(id);
  }, [products.length]);

  // Mouse parallax: writes normalized pointer coords (-1..1) into CSS vars on
  // the scene; each floating layer multiplies them by its own depth. rAF-throttled
  // so pointermove never does layout work more than once a frame.
  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = sceneRef.current;
    if (!el || e.pointerType !== "mouse") return;
    const rect = el.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const my = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--mx", mx.toFixed(3));
      el.style.setProperty("--my", my.toFixed(3));
    });
  }

  function handlePointerLeave() {
    const el = sceneRef.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.setProperty("--mx", "0");
    el.style.setProperty("--my", "0");
  }

  return (
    <div className="hero-motion relative flex flex-col overflow-hidden rounded-[28px] bg-[linear-gradient(120deg,var(--color-primary-600),var(--color-primary-500)_55%,var(--color-secondary-500))] text-white md:flex-row">
      {/* Aurora blobs drifting behind everything. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-16 h-[340px] w-[340px] rounded-full bg-secondary-400/40 blur-3xl"
        style={{ animation: "heroBlobA 14s ease-in-out infinite" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -bottom-28 h-[380px] w-[380px] rounded-full bg-primary-300/35 blur-3xl"
        style={{ animation: "heroBlobB 18s ease-in-out infinite" }}
      />

      {/* Left: copy + CTA, staggered entrance. */}
      <div className="relative flex min-w-0 flex-1 flex-col justify-center gap-4 px-5 py-7 sm:px-8 md:px-12 md:py-11">
        <div
          className="relative flex w-fit items-center gap-2 overflow-hidden rounded-full bg-white/15 px-3.5 py-1.5 font-label text-[13px] font-semibold"
          style={{ animation: "heroFadeUp 0.6s ease-out both" }}
        >
          <ShieldCheck className="h-4 w-4" /> {t("badge")}
          {/* Recurring light sweep. */}
          <span
            aria-hidden
            className="absolute inset-y-0 w-10 bg-white/25"
            style={{ animation: "heroShimmer 3.2s ease-in-out 1s infinite" }}
          />
        </div>

        <h1
          className="m-0 font-headline text-[32px] leading-[1.05] font-black tracking-tight md:text-[42px]"
          style={{ animation: "heroFadeUp 0.6s ease-out 0.12s both" }}
        >
          {t("title")}
        </h1>

        <p
          className="m-0 max-w-[460px] font-body text-base leading-[1.55] text-white/90"
          style={{ animation: "heroFadeUp 0.6s ease-out 0.24s both" }}
        >
          {t("subtitle")}
        </p>

        <div style={{ animation: "heroFadeUp 0.6s ease-out 0.36s both" }}>
          <Link href="/category">
            <Button variant="inverted" size="lg">
              {t("cta")} <ArrowRight className="h-[18px] w-[18px] rtl:rotate-180" />
            </Button>
          </Link>
        </div>

        <div
          className="flex flex-wrap items-center gap-2"
          style={{ animation: "heroFadeUp 0.6s ease-out 0.48s both" }}
        >
          <span className="flex items-center gap-1.5 font-label text-[12px] font-semibold text-white/70">
            <TrendingUp className="h-3.5 w-3.5" /> {t("trending")}
          </span>
          {QUICK_SEARCH_KEYS.map((key) => (
            <Link
              key={key}
              href={`/search?q=${encodeURIComponent(t(key))}`}
              className="rounded-full bg-white/15 px-3.5 py-1.5 font-label text-[13px] font-medium transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-white/25"
            >
              {t(key)}
            </Link>
          ))}
        </div>
      </div>

      <div className="hidden w-px shrink-0 bg-white/25 md:block" />

      {/* Right: animated scene — pulsing pharmacy cross + parallax glass cards. */}
      <div
        ref={sceneRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="relative hidden min-h-[380px] min-w-0 flex-1 items-center justify-center overflow-hidden md:flex"
        style={{ "--mx": "0", "--my": "0" } as React.CSSProperties}
      >
        {/* Twinkling particles. */}
        {SPARKS.map((s, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute rounded-full bg-white"
            style={{
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              animation: `heroTwinkle 2.8s ease-in-out ${s.delay} infinite`,
            }}
          />
        ))}

        {/* Pulse rings + glowing cross (deepest parallax layer). */}
        <div
          className="relative flex items-center justify-center transition-transform duration-300 ease-out"
          style={{ transform: "translate3d(calc(var(--mx) * -10px), calc(var(--my) * -10px), 0)" }}
        >
          {[0, 1.3, 2.6].map((delay) => (
            <span
              key={delay}
              aria-hidden
              className="absolute h-64 w-64 rounded-full border-2 border-white/30"
              style={{ animation: `heroRing 3.9s ease-out ${delay}s infinite` }}
            />
          ))}
          {products.length === 0 ? (
            <span
              className="flex h-28 w-28 items-center justify-center rounded-[28px] bg-white/15 shadow-[0_0_60px_rgba(255,255,255,0.35)] backdrop-blur-sm"
              style={{ animation: "heroGlow 4s ease-in-out infinite" }}
            >
              <Plus className="h-14 w-14 text-white" strokeWidth={2.5} />
            </span>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <span className="rounded-full bg-white/15 px-3 py-1 font-label text-[11px] font-semibold tracking-wide uppercase">
                {t("featured")}
              </span>
              <div
                className="relative h-52 w-52 overflow-hidden rounded-full bg-white/15 shadow-[0_0_60px_rgba(255,255,255,0.35)] backdrop-blur-sm"
                style={{ animation: "heroGlow 4s ease-in-out infinite" }}
              >
                {products.map((p, i) => (
                  <Link
                    key={p.slug}
                    href={`/product/${p.slug}`}
                    tabIndex={i === active ? 0 : -1}
                    aria-hidden={i !== active}
                    className={`absolute inset-0 flex flex-col items-center justify-center gap-1.5 transition-[opacity,transform] duration-700 ease-out ${
                      i === active ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"
                    }`}
                  >
                    <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-white p-2">
                      <Image
                        src={p.imageUrl!}
                        alt=""
                        width={96}
                        height={96}
                        priority={i === 0}
                        className="h-full w-full rounded-full object-contain"
                      />
                    </span>
                    <span className="line-clamp-1 px-4 text-center font-label text-[13px] font-bold">{p.name}</span>
                    <span className="font-headline text-[15px] font-extrabold">{formatEGP(p.price)}</span>
                  </Link>
                ))}
              </div>
              {products.length > 1 && (
                <div aria-hidden className="flex gap-1.5">
                  {products.map((p, i) => (
                    <span
                      key={p.slug}
                      className={`h-1.5 w-1.5 rounded-full transition-[background-color,transform] duration-300 ${
                        i === active ? "scale-125 bg-white" : "bg-white/40"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating glass cards — outer div = parallax depth, inner div = bob. */}
        <div
          className="absolute top-[7%] left-[5%] transition-transform duration-300 ease-out"
          style={{ transform: "translate3d(calc(var(--mx) * 22px), calc(var(--my) * 22px), 0)" }}
        >
          <div
            className="flex items-center gap-2.5 rounded-[14px] bg-white/15 px-4 py-3 shadow-lg backdrop-blur-md"
            style={{ animation: "heroFloat 5s ease-in-out infinite" }}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/20">
              <Truck className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <div className="font-label text-[13px] font-bold">{t("cardDelivery")}</div>
              <div className="text-[11px] text-white/75">{t("cardDeliverySub")}</div>
            </div>
          </div>
        </div>

        <div
          className="absolute right-[3%] bottom-[14%] transition-transform duration-300 ease-out"
          style={{ transform: "translate3d(calc(var(--mx) * 32px), calc(var(--my) * 32px), 0)" }}
        >
          <div
            className="flex items-center gap-2.5 rounded-[14px] bg-white/15 px-4 py-3 shadow-lg backdrop-blur-md"
            style={{ animation: "heroFloat 6s ease-in-out 0.8s infinite" }}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/20">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <div className="font-label text-[13px] font-bold">{t("cardLicensed")}</div>
              <div className="text-[11px] text-white/75">{t("cardLicensedSub")}</div>
            </div>
          </div>
        </div>

        <div
          className="absolute bottom-[10%] left-[16%] transition-transform duration-300 ease-out"
          style={{ transform: "translate3d(calc(var(--mx) * 16px), calc(var(--my) * 16px), 0)" }}
        >
          <div
            className="flex items-center gap-2.5 rounded-[14px] bg-white/15 px-4 py-3 shadow-lg backdrop-blur-md"
            style={{ animation: "heroFloat 5.5s ease-in-out 1.6s infinite" }}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/20">
              <Stethoscope className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <div className="font-label text-[13px] font-bold">{t("cardPharmacist")}</div>
              <div className="text-[11px] text-white/75">{t("cardPharmacistSub")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
