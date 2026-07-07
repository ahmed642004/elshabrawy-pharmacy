"use client";

import { Pill } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCart } from "@/lib/cart-context";
import { formatEGP } from "@/lib/cart-totals";

interface ReviewStepProps {
  recapAddress: string;
  recapPayment: string;
}

export default function ReviewStep({ recapAddress, recapPayment }: ReviewStepProps) {
  const t = useTranslations("checkout");
  const { items } = useCart();

  return (
    <div className="flex flex-col gap-4.5">
      <h2 className="m-0 font-headline text-xl font-extrabold text-neutral-900">{t("reviewTitle")}</h2>

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.slug} className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[10px] bg-neutral-100">
              <Pill className="h-5 w-5 text-neutral-300" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-headline text-sm font-bold text-neutral-900">{item.name}</div>
              <div className="text-[12.5px] text-neutral-500">{t("qty", { qty: item.qty })}</div>
            </div>
            <div className="font-headline text-sm font-bold text-neutral-900">
              {formatEGP(item.price * item.qty)}
            </div>
          </div>
        ))}
      </div>

      <div className="h-px bg-neutral-200" />

      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[13px] text-neutral-500">{t("deliverTo")}</span>
          <span className="text-end text-[13.5px] font-semibold text-neutral-900">{recapAddress}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-neutral-500">{t("paymentMethod")}</span>
          <span className="text-[13.5px] font-semibold text-neutral-900">{recapPayment}</span>
        </div>
      </div>
    </div>
  );
}
