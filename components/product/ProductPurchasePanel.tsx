"use client";

import { useState } from "react";
import { Star, Minus, Plus, ShoppingCart, Bell, Heart, Share2, Truck, ShieldCheck, Headset } from "lucide-react";
import Button from "@/components/ui/Button";
import type { StockState } from "@/components/ProductCard";
import { useCart } from "@/lib/cart-context";
import { formatEGP } from "@/lib/cart-totals";

interface ProductPurchasePanelProps {
  slug: string;
  brand: string;
  name: string;
  price: number;
  wasPrice?: number;
  stock: StockState;
  rating: number | null;
  reviewCount: number;
}

const stockToneClasses: Record<StockState, string> = {
  in: "bg-success-50 text-success-600",
  low: "bg-warning-50 text-warning-600",
  out: "bg-danger-50 text-danger-600",
};

const stockLabel: Record<StockState, string> = {
  in: "In stock",
  low: "Low stock",
  out: "Out of stock",
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
}: ProductPurchasePanelProps) {
  const [qty, setQty] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  const [notified, setNotified] = useState(false);
  const outOfStock = stock === "out";
  const discountPct = wasPrice ? Math.round((1 - price / wasPrice) * 100) : 0;
  const { addItem } = useCart();

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
          {stockLabel[stock]}
        </span>
        {rating != null && (
          <div className="flex items-center gap-1 text-[13px] text-neutral-500">
            <Star className="h-3.5 w-3.5 fill-warning-500 text-warning-500" />
            <span className="font-bold text-neutral-900">{rating}</span> ({reviewCount} reviews)
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
          <Button variant="outlined" size="lg" className="min-w-[220px] flex-1" onClick={() => setNotified(true)}>
            <Bell className="h-[18px] w-[18px]" /> {notified ? "We’ll notify you" : "Notify me when available"}
          </Button>
        ) : (
          <>
            <div className="flex h-12 items-center gap-3 rounded-[10px] border border-neutral-300 px-1.5">
              <button
                type="button"
                aria-label="Decrease quantity"
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
                aria-label="Increase quantity"
                onClick={() => setQty((q) => q + 1)}
                className="flex h-9 w-9 items-center justify-center text-neutral-700"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="min-w-[180px] flex-1"
              onClick={() => addItem({ slug, name, brand, price, stock }, qty)}
            >
              <ShoppingCart className="h-[18px] w-[18px]" /> Add to cart
            </Button>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setWishlisted((v) => !v)}
          className={`flex items-center gap-1.5 text-[13.5px] font-semibold ${
            wishlisted ? "text-danger-500" : "text-neutral-500"
          }`}
        >
          <Heart className={`h-[18px] w-[18px] ${wishlisted ? "fill-current" : ""}`} />
          {wishlisted ? "Wishlisted" : "Add to wishlist"}
        </button>
        <button type="button" className="flex items-center gap-1.5 text-[13.5px] font-semibold text-neutral-500">
          <Share2 className="h-[18px] w-[18px]" /> Share
        </button>
      </div>

      <div className="mt-1.5 flex flex-col gap-2.5 rounded-[14px] border border-primary-100 bg-tertiary-100 px-4 py-3.5">
        <div className="flex items-center gap-2.5 text-[13px] text-neutral-700">
          <Truck className="h-4 w-4 shrink-0 text-primary-500" /> Delivery in 2 hours across Greater Cairo
        </div>
        <div className="flex items-center gap-2.5 text-[13px] text-neutral-700">
          <ShieldCheck className="h-4 w-4 shrink-0 text-secondary-500" /> 100% genuine, licensed pharmacy
        </div>
        <div className="flex items-center gap-2.5 text-[13px] text-neutral-700">
          <Headset className="h-4 w-4 shrink-0 text-primary-500" /> Ask a pharmacist — free chat, 24/7
        </div>
      </div>
    </div>
  );
}
