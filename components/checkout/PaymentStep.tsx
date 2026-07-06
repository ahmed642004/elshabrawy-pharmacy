"use client";

import { Banknote, CreditCard, Wallet, BadgeCheck } from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useCart } from "@/lib/cart-context";

export type PaymentMethodId = "cod" | "card" | "wallet";

export interface CardDetails {
  number: string;
  expiry: string;
  cvv: string;
  name: string;
}

export const PAYMENT_METHODS: { id: PaymentMethodId; label: string; icon: typeof Banknote }[] = [
  { id: "cod", label: "Cash on delivery", icon: Banknote },
  { id: "card", label: "Credit / debit card", icon: CreditCard },
  { id: "wallet", label: "Mobile wallet", icon: Wallet },
];

interface PaymentStepProps {
  paymentMethod: PaymentMethodId;
  onSelectPaymentMethod: (id: PaymentMethodId) => void;
  card: CardDetails;
  errors: Partial<Record<keyof CardDetails, string>>;
  onCardChange: (field: keyof CardDetails, value: string) => void;
}

export default function PaymentStep({
  paymentMethod,
  onSelectPaymentMethod,
  card,
  errors,
  onCardChange,
}: PaymentStepProps) {
  const { promoCode, setPromoCode, promoApplied, applyPromo } = useCart();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="m-0 font-headline text-xl font-extrabold text-neutral-900">Payment method</h2>

      <div className="grid grid-cols-3 gap-3">
        {PAYMENT_METHODS.map((pm) => {
          const selected = paymentMethod === pm.id;
          const Icon = pm.icon;
          return (
            <button
              key={pm.id}
              type="button"
              onClick={() => onSelectPaymentMethod(pm.id)}
              className={`flex flex-col items-center gap-2 rounded-[14px] border px-3 py-4.5 ${
                selected ? "border-2 border-primary-500 bg-primary-50" : "border-neutral-300 bg-white"
              }`}
            >
              <Icon className={`h-[22px] w-[22px] ${selected ? "text-primary-500" : "text-neutral-500"}`} />
              <span className="font-label text-[13.5px] font-semibold text-neutral-900">{pm.label}</span>
            </button>
          );
        })}
      </div>

      {paymentMethod === "card" && (
        <div className="flex flex-col gap-3.5 rounded-[14px] border border-neutral-200 bg-white p-4.5">
          <div>
            <Input
              placeholder="Card number"
              value={card.number}
              onChange={(e) => onCardChange("number", e.target.value)}
            />
            {errors.number && <div className="mt-1 text-xs text-danger-500">{errors.number}</div>}
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <Input placeholder="MM / YY" value={card.expiry} onChange={(e) => onCardChange("expiry", e.target.value)} />
              {errors.expiry && <div className="mt-1 text-xs text-danger-500">{errors.expiry}</div>}
            </div>
            <div>
              <Input placeholder="CVV" value={card.cvv} onChange={(e) => onCardChange("cvv", e.target.value)} />
              {errors.cvv && <div className="mt-1 text-xs text-danger-500">{errors.cvv}</div>}
            </div>
          </div>
          <Input placeholder="Name on card" value={card.name} onChange={(e) => onCardChange("name", e.target.value)} />
        </div>
      )}

      {promoApplied ? (
        <div className="flex items-center gap-2 text-[13.5px] font-semibold text-secondary-600">
          <BadgeCheck className="h-4 w-4" /> Promo code WELCOME20 applied
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="flex-1">
            <Input placeholder="Promo code" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} />
          </div>
          <Button variant="outlined" size="md" onClick={applyPromo}>
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}
