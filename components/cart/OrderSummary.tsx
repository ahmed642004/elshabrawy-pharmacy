"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import { useCart } from "@/lib/cart-context";
import { getCartTotals, formatEGP } from "@/lib/cart-totals";

export default function OrderSummary() {
  const router = useRouter();
  const t = useTranslations("cart");
  const { items, promoCode, setPromoCode, promoApplied, applyPromo } = useCart();
  const { subtotal, deliveryFree, deliveryFee, discount, total } = getCartTotals(items, promoApplied);

  return (
    <div className="flex flex-col gap-6 rounded-[14px] bg-white p-6 shadow-sm md:p-7">
      <div className="font-headline text-[17px] font-extrabold text-neutral-900">{t("summary")}</div>

      <div className="flex flex-col gap-3.5">
        <div className="flex justify-between text-sm text-neutral-700">
          <span>{t("subtotal")}</span>
          <span>{formatEGP(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-neutral-700">
          <span>{t("delivery")}</span>
          <span className={deliveryFree && subtotal > 0 ? "font-bold text-secondary-600" : ""}>
            {subtotal === 0 ? "—" : deliveryFree ? t("free") : formatEGP(deliveryFee)}
          </span>
        </div>
        {promoApplied && (
          <div className="flex justify-between text-sm text-secondary-600">
            <span>{t("promoLine")}</span>
            <span>-{formatEGP(discount)}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder={t("promoPlaceholder")}
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          className="h-[42px] flex-1 rounded-[10px] border border-neutral-300 bg-white px-3.5 font-body text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-primary-500"
        />
        <Button variant="outlined" size="md" onClick={applyPromo}>
          {t("apply")}
        </Button>
      </div>

      <div className="h-px bg-neutral-200" />

      <div className="flex items-baseline justify-between">
        <span className="font-headline text-[15px] font-bold text-neutral-900">{t("total")}</span>
        <span className="font-headline text-2xl font-black text-neutral-900">{formatEGP(total)}</span>
      </div>

      <div className="hidden flex-col gap-3 md:flex">
        <Button variant="primary" size="lg" fullWidth onClick={() => router.push("/checkout")}>
          {t("proceed")}
        </Button>
        <Link href="/" className="text-center text-[13.5px] font-semibold text-neutral-500">
          {t("continueShopping")}
        </Link>
      </div>
    </div>
  );
}
