"use client";

import { useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Pill, Plus, Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCart } from "@/lib/cart-context";
import { useToast } from "@/components/ui/ToastProvider";
import { toggleNotifyRequest } from "@/lib/actions";
import { formatEGP } from "@/lib/cart-totals";

export type BadgeTone = "sale" | "bestseller" | "new";
export type StockState = "in" | "low" | "out";

export interface Product {
  slug: string;
  name: string;
  brand?: string;
  sub?: string;
  price: number;
  wasPrice?: number;
  imageUrl?: string;
  badge?: { label: string; tone: BadgeTone };
  stock?: StockState;
}

interface ProductCardProps {
  product: Product;
  className?: string;
}

const badgeToneClasses: Record<BadgeTone, string> = {
  sale: "bg-danger-500 text-white",
  bestseller: "bg-secondary-50 text-secondary-600",
  new: "bg-primary-50 text-primary-600",
};

const stockToneClasses: Record<StockState, string> = {
  in: "bg-success-50 text-success-600",
  low: "bg-warning-50 text-warning-600",
  out: "bg-danger-50 text-danger-600",
};

export default function ProductCard({ product, className = "" }: ProductCardProps) {
  const { slug, name, brand, sub, price, wasPrice, imageUrl, badge } = product;
  const stock = product.stock ?? "in";
  const outOfStock = stock === "out";
  const { addItem } = useCart();
  const { showToast } = useToast();
  const t = useTranslations("product");
  const tCard = useTranslations("productCard");
  const [notifyPending, startNotifyTransition] = useTransition();

  function handleNotifyClick(e: React.MouseEvent) {
    // The card's own surface is a full-bleed link overlay (below) — without
    // this, tapping the bell would navigate to the product page instead of
    // toggling the request.
    e.preventDefault();
    e.stopPropagation();
    startNotifyTransition(async () => {
      const result = await toggleNotifyRequest(slug);
      if (result === "unauthenticated") showToast(t("notifySignIn"));
      else showToast(result === "added" ? t("notified") : t("notifyRemoved"));
    });
  }

  return (
    <div
      className={`group relative flex h-full flex-col overflow-hidden rounded-[14px] bg-white shadow-sm transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-lg ${className}`}
    >
      <Link href={`/product/${slug}`} className="absolute inset-0 z-10" aria-label={name} />

      <div className="p-3">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[10px]">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={name}
              fill
              sizes="(min-width: 1024px) 300px, (min-width: 768px) 45vw, 90vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-neutral-100">
              <Pill className="h-8 w-8 text-neutral-300" strokeWidth={1.5} />
            </div>
          )}
          {badge && (
            <span
              className={`absolute start-2.5 top-2.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeToneClasses[badge.tone]}`}
            >
              {badge.label}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-4 pb-4">
        <div className="flex flex-wrap gap-1.5">
          <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${stockToneClasses[stock]}`}>
            {tCard(`stock.${stock}`)}
          </span>
        </div>

        {brand && (
          <div className="text-[11.5px] font-semibold tracking-wide text-neutral-400 uppercase">{brand}</div>
        )}
        <div className="font-headline text-[15px] leading-tight font-bold text-neutral-900">{name}</div>
        {sub && <div className="text-[12.5px] text-neutral-500">{sub}</div>}

        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <span className="font-headline text-[17px] font-extrabold text-neutral-900">{formatEGP(price)}</span>
            {wasPrice != null && (
              <span className="ms-1.5 text-xs text-neutral-400 line-through">{formatEGP(wasPrice)}</span>
            )}
          </div>
          <button
            type="button"
            aria-label={outOfStock ? tCard("notifyMe", { name }) : tCard("addToCart", { name })}
            disabled={outOfStock ? notifyPending : false}
            onClick={
              outOfStock
                ? handleNotifyClick
                : () => {
                    addItem({ slug, name, brand, price, imageUrl, stock });
                    showToast(tCard("addedToast", { name }));
                  }
            }
            className={`relative z-20 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-[background-color,transform] duration-150 hover:scale-105 active:scale-90 disabled:cursor-not-allowed ${
              outOfStock ? "bg-neutral-400" : "bg-primary-500 hover:bg-primary-600"
            }`}
          >
            {outOfStock ? <Bell className="h-[18px] w-[18px]" /> : <Plus className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>
    </div>
  );
}
