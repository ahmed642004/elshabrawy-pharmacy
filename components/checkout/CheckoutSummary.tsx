"use client";

import { useCart } from "@/lib/cart-context";
import { getCartTotals, formatEGP } from "@/lib/cart-totals";

export default function CheckoutSummary() {
  const { items, promoApplied } = useCart();
  const { subtotal, deliveryFree, deliveryFee, discount, total } = getCartTotals(items, promoApplied);

  return (
    <div className="flex flex-col gap-4 rounded-[14px] bg-white p-6 shadow-sm">
      <div className="font-headline text-base font-extrabold text-neutral-900">Order summary</div>

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.slug} className="flex justify-between text-[13px] text-neutral-700">
            <span>
              {item.name} × {item.qty}
            </span>
            <span>{formatEGP(item.price * item.qty)}</span>
          </div>
        ))}
      </div>

      <div className="h-px bg-neutral-200" />

      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-[13.5px] text-neutral-700">
          <span>Subtotal</span>
          <span>{formatEGP(subtotal)}</span>
        </div>
        <div className="flex justify-between text-[13.5px] text-neutral-700">
          <span>Delivery</span>
          <span className={deliveryFree ? "font-bold text-secondary-600" : ""}>
            {deliveryFree ? "Free" : formatEGP(deliveryFee)}
          </span>
        </div>
        {promoApplied && (
          <div className="flex justify-between text-[13.5px] text-secondary-600">
            <span>Discount</span>
            <span>-{formatEGP(discount)}</span>
          </div>
        )}
      </div>

      <div className="h-px bg-neutral-200" />

      <div className="flex items-baseline justify-between">
        <span className="font-headline text-sm font-bold text-neutral-900">Total</span>
        <span className="font-headline text-[22px] font-black text-neutral-900">{formatEGP(total)}</span>
      </div>
    </div>
  );
}
