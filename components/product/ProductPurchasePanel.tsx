"use client";

import { useState, useTransition } from "react";
import { Star, Minus, Plus, ShoppingCart, Bell, Share2, Truck, ShieldCheck, Headset } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import type { StockState } from "@/components/ProductCard";
import { useCart } from "@/lib/cart-context";
import { useToast } from "@/components/ui/ToastProvider";
import { toggleNotifyRequest } from "@/lib/actions";
import { formatEGP, MAX_ITEM_QTY } from "@/lib/cart-totals";

interface ProductPurchasePanelProps {
  slug: string;
  brand: string;
  name: string;
  price: number;
  wasPrice?: number;
  stock: StockState;
  rating: number | null;
  reviewCount: number;
  notifyRequested: boolean;
}

const stockToneClasses: Record<StockState, string> = {
  in: "bg-success-50 text-success-600",
  low: "bg-warning-50 text-warning-600",
  out: "bg-danger-50 text-danger-600",
};

export default function ProductPurchasePanel({
  slug,
  brand,
  name,
  price,
  wasPrice,
  stock,
  rating,
  reviewCount,
  notifyRequested,
}: ProductPurchasePanelProps) {
  const t = useTranslations("product");
  const tCard = useTranslations("productCard");
  const [qty, setQty] = useState(1);
  const [notified, setNotified] = useState(notifyRequested);
  const [notifyPending, startNotifyTransition] = useTransition();
  const outOfStock = stock === "out";
  const discountPct = wasPrice ? Math.round((1 - price / wasPrice) * 100) : 0;
  const { addItem } = useCart();
  const { showToast } = useToast();

  function handleNotifyToggle() {
    startNotifyTransition(async () => {
      const result = await toggleNotifyRequest(slug);
      if (result === "unauthenticated") {
        showToast(t("notifySignIn"));
        return;
      }
      setNotified(result === "added");
      if (result === "removed") showToast(t("notifyRemoved"));
    });
  }

  async function handleShare() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: name, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        showToast(t("linkCopied"));
      }
    } catch (err) {
      // The user dismissing the native share sheet throws AbortError — not a
      // real failure, so it stays silent rather than surfacing a toast.
      if ((err as Error).name !== "AbortError") {
        /* no-op */
      }
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <div>
        <div className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">{brand}</div>
        <h1 className="mt-1.5 font-headline text-[22px] font-extrabold tracking-tight text-neutral-900 md:text-[28px]">
          {name}
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${stockToneClasses[stock]}`}>
          {tCard(`stock.${stock}`)}
        </span>
        {rating != null && (
          <div className="flex items-center gap-1 text-[13px] text-neutral-500">
            <Star className="h-3.5 w-3.5 fill-warning-500 text-warning-500" />
            <span className="font-bold text-neutral-900">{rating}</span> {t("reviewsShort", { count: reviewCount })}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2.5">
        <span className="font-headline text-[26px] font-black text-neutral-900 md:text-[32px]">
          {formatEGP(price)}
        </span>
        {wasPrice != null && (
          <>
            <span className="text-base text-neutral-400 line-through">{formatEGP(wasPrice)}</span>
            <span className="rounded-full bg-danger-50 px-2 py-0.5 text-[11px] font-semibold text-danger-600">
              -{discountPct}%
            </span>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {outOfStock ? (
          <Button
            variant="outlined"
            size="lg"
            className="min-w-[220px] flex-1"
            disabled={notifyPending}
            onClick={handleNotifyToggle}
          >
            <Bell className="h-[18px] w-[18px]" /> {notified ? t("notified") : t("notifyAvailable")}
          </Button>
        ) : (
          <>
            <div className="flex h-12 items-center gap-3 rounded-[10px] border border-neutral-300 px-1.5">
              <button
                type="button"
                aria-label={t("decreaseQty")}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-9 w-9 items-center justify-center text-neutral-700"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[20px] text-center font-label text-[15px] font-bold text-neutral-900">
                {qty}
              </span>
              <button
                type="button"
                aria-label={t("increaseQty")}
                onClick={() => setQty((q) => Math.min(MAX_ITEM_QTY, q + 1))}
                disabled={qty >= MAX_ITEM_QTY}
                className="flex h-9 w-9 items-center justify-center text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="min-w-[180px] flex-1"
              onClick={() => {
                addItem({ slug, name, brand, price, stock }, qty);
                showToast(tCard("addedToast", { name }));
              }}
            >
              <ShoppingCart className="h-[18px] w-[18px]" /> {t("addToCart")}
            </Button>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-1.5 text-[13.5px] font-semibold text-neutral-500"
        >
          <Share2 className="h-[18px] w-[18px]" /> {t("share")}
        </button>
      </div>

      <div className="mt-1.5 flex flex-col gap-2.5 rounded-[14px] border border-primary-100 bg-tertiary-100 px-4 py-3.5">
        <div className="flex items-center gap-2.5 text-[13px] text-neutral-700">
          <Truck className="h-4 w-4 shrink-0 text-primary-500" /> {t("deliveryInfo")}
        </div>
        <div className="flex items-center gap-2.5 text-[13px] text-neutral-700">
          <ShieldCheck className="h-4 w-4 shrink-0 text-secondary-500" /> {t("genuineInfo")}
        </div>
        <div className="flex items-center gap-2.5 text-[13px] text-neutral-700">
          <Headset className="h-4 w-4 shrink-0 text-primary-500" /> {t("askInfo")}
        </div>
      </div>
    </div>
  );
}
