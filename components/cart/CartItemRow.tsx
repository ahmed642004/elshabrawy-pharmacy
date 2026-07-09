"use client";

import { Pill, Minus, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCart, type CartItem } from "@/lib/cart-context";
import { formatEGP, MAX_ITEM_QTY } from "@/lib/cart-totals";

interface CartItemRowProps {
  item: CartItem;
  onRemove: (item: CartItem) => void;
}

export default function CartItemRow({ item, onRemove }: CartItemRowProps) {
  const t = useTranslations("cart");
  const { updateQty, saveForLater } = useCart();
  const outOfStock = item.stock === "out";

  return (
    <div className={`border-b border-neutral-200 py-5 ${outOfStock ? "opacity-65" : ""}`}>
      <div className="flex gap-4">
        <div
          className={`flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-[12px] bg-neutral-100 md:h-[92px] md:w-[92px] ${
            outOfStock ? "opacity-45" : ""
          }`}
        >
          <Pill className="h-8 w-8 text-neutral-300" strokeWidth={1.5} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {item.brand && (
                <div className="text-[11.5px] font-semibold tracking-wide text-neutral-400 uppercase">
                  {item.brand}
                </div>
              )}
              <div
                className={`font-headline text-base leading-tight font-bold ${
                  outOfStock ? "text-neutral-400" : "text-neutral-900"
                }`}
              >
                {item.name}
              </div>
            </div>
            <div
              className={`font-headline text-base font-extrabold whitespace-nowrap ${
                outOfStock ? "text-neutral-400" : "text-neutral-900"
              }`}
            >
              {formatEGP(item.price)}
            </div>
          </div>

          {outOfStock && (
            <div className="flex flex-wrap gap-1.5">
              <span className="w-fit rounded-full bg-danger-50 px-2 py-0.5 text-[11px] font-semibold text-danger-600">
                {t("noLongerAvailable")}
              </span>
            </div>
          )}

          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
            {!outOfStock && (
              <div className="flex h-9 w-fit items-center gap-2.5 rounded-[10px] border border-neutral-300 px-1">
                <button
                  type="button"
                  aria-label={t("decreaseQty", { name: item.name })}
                  onClick={() => updateQty(item.slug, item.qty - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-[6px] text-neutral-700"
                >
                  <Minus className="h-[15px] w-[15px]" />
                </button>
                <span className="min-w-[16px] text-center font-label text-sm font-bold text-neutral-900">
                  {item.qty}
                </span>
                <button
                  type="button"
                  aria-label={t("increaseQty", { name: item.name })}
                  onClick={() => updateQty(item.slug, item.qty + 1)}
                  disabled={item.qty >= MAX_ITEM_QTY}
                  className="flex h-7 w-7 items-center justify-center rounded-[6px] text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-[15px] w-[15px]" />
                </button>
              </div>
            )}
            {!outOfStock && (
              <span className="font-headline text-[15px] font-extrabold text-neutral-900">
                {formatEGP(item.price * item.qty)}
              </span>
            )}
          </div>

          <div className="mt-1 flex gap-4">
            <button
              type="button"
              onClick={() => onRemove(item)}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-500"
            >
              <Trash2 className="h-3.5 w-3.5" /> {t("remove")}
            </button>
            {!outOfStock && (
              <button
                type="button"
                onClick={() => saveForLater(item.slug)}
                className="text-[13px] font-semibold text-neutral-500"
              >
                {t("saveForLater")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
