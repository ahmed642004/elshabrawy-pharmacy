"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import { useCart, type CartItem } from "@/lib/cart-context";
import { getCartTotals, formatEGP } from "@/lib/cart-totals";
import CartItemRow from "@/components/cart/CartItemRow";
import OrderSummary from "@/components/cart/OrderSummary";

export default function CartPageClient() {
  const router = useRouter();
  const t = useTranslations("cart");
  const tListing = useTranslations("listing");
  const { items, savedItems, addItem, removeItem, moveToCart, promo } = useCart();
  const [toast, setToast] = useState<CartItem | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function handleRemove(item: CartItem) {
    removeItem(item.slug);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(item);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }

  function handleUndo() {
    if (!toast) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    addItem(toast, toast.qty);
    setToast(null);
  }

  const isEmpty = items.length === 0 && savedItems.length === 0;
  const { total } = getCartTotals(items, promo?.discount ?? 0);
  // create_order() would reject an out-of-stock line server-side anyway —
  // this just surfaces that up front instead of letting checkout fail.
  const hasOutOfStock = items.some((i) => i.stock === "out");

  return (
    <main
      className={`mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-7 px-4 py-4 md:px-10 md:py-8 ${
        items.length > 0 ? "pb-24 md:pb-8" : ""
      }`}
    >
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[13px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-700">
            {tListing("breadcrumbHome")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
          <span className="font-semibold text-neutral-900">{t("title")}</span>
        </div>
        <h1 className="m-0 font-headline text-2xl font-extrabold tracking-tight text-neutral-900 md:text-[30px]">
          {t("title")}
        </h1>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center gap-3.5 rounded-[28px] border border-neutral-200 bg-white px-6 py-12 text-center md:py-18">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-tertiary-100">
            <ShoppingCart className="h-[34px] w-[34px] text-primary-500" />
          </span>
          <div className="font-headline text-xl font-extrabold text-neutral-900">{t("empty")}</div>
          <div className="max-w-[320px] text-sm text-neutral-500">{t("emptyHint")}</div>
          <Button variant="primary" size="lg" onClick={() => router.push("/")}>
            {t("browse")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[1fr_360px]">
          <div className="flex flex-col">
            {items.map((item) => (
              <CartItemRow key={item.slug} item={item} onRemove={handleRemove} />
            ))}

            {savedItems.length > 0 && (
              <div className="mt-2">
                <div className="mb-3 font-headline text-[15px] font-bold text-neutral-900">
                  {t("savedForLater", { count: savedItems.length })}
                </div>
                {savedItems.map((s) => (
                  <div key={s.slug} className="flex items-center gap-3.5 border-t border-neutral-200 py-3.5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[10px] bg-neutral-100">
                      <ShoppingCart className="h-5 w-5 text-neutral-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-headline text-sm font-bold text-neutral-900">{s.name}</div>
                      <div className="text-[12.5px] text-neutral-500">{formatEGP(s.price)}</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => moveToCart(s.slug)}>
                      {t("moveToCart")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="md:sticky md:top-[96px]">
            <OrderSummary hasOutOfStock={hasOutOfStock} />
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="fixed right-0 bottom-0 left-0 z-[35] flex flex-col gap-1.5 border-t border-neutral-200 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.08)] md:hidden">
          {hasOutOfStock && <div className="text-xs text-danger-500">{t("removeOutOfStock")}</div>}
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <div className="text-[11.5px] text-neutral-500">{t("total")}</div>
              <div className="font-headline text-lg font-black whitespace-nowrap text-neutral-900">
                {formatEGP(total)}
              </div>
            </div>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="flex-1"
              disabled={hasOutOfStock}
              onClick={() => router.push("/checkout")}
            >
              {t("proceed")}
            </Button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 md:bottom-6">
          <div className="flex items-center gap-3.5 rounded-[10px] bg-neutral-800 px-4 py-3 text-[13.5px] whitespace-nowrap text-white shadow-lg">
            <span>{t("removedToast", { name: toast.name })}</span>
            <button type="button" onClick={handleUndo} className="font-bold text-white underline">
              {t("undo")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
