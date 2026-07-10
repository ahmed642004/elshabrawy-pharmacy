"use client";

import { Banknote, BadgeCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useCart } from "@/lib/cart-context";

// Cash on delivery is the only live payment method — card / mobile-wallet
// options come back once a real gateway (Paymob) is integrated. The DB
// payment_method enum still carries 'card' | 'wallet' for historical orders,
// so only the checkout UI narrows to COD, not the types in lib/.
export default function PaymentStep() {
  const t = useTranslations("checkout");
  const tCart = useTranslations("cart");
  const { promoInput, setPromoInput, promo, promoError, applyPromo } = useCart();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="m-0 font-headline text-xl font-extrabold text-neutral-900">{t("paymentTitle")}</h2>

      <div className="flex items-start gap-3.5 rounded-[14px] border-2 border-primary-500 bg-primary-50 px-4 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
          <Banknote className="h-[22px] w-[22px] text-primary-500" />
        </span>
        <div>
          <div className="font-label text-[14.5px] font-bold text-neutral-900">{t("methods.cod")}</div>
          <div className="mt-1 text-[13px] leading-[1.6] text-neutral-600">{t("codHint")}</div>
        </div>
      </div>

      <div className="text-[12.5px] text-neutral-400">{t("onlinePaymentSoon")}</div>

      {promo ? (
        <div className="flex items-center gap-2 text-[13.5px] font-semibold text-secondary-600">
          <BadgeCheck className="h-4 w-4" /> {t("promoApplied", { code: promo.code })}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder={tCart("promoPlaceholder")}
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
              />
            </div>
            <Button variant="outlined" size="md" onClick={applyPromo}>
              {tCart("apply")}
            </Button>
          </div>
          {promoError && <div className="text-xs text-danger-500">{tCart("promoInvalid")}</div>}
        </div>
      )}
    </div>
  );
}
