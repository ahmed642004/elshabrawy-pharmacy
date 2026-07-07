"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import { useCart } from "@/lib/cart-context";
import { getCartTotals, formatEGP } from "@/lib/cart-totals";
import { createOrder, saveAddress } from "@/lib/actions";
import DeliveryStep, { type Address, type DeliveryForm } from "@/components/checkout/DeliveryStep";
import PaymentStep, { type PaymentMethodId, type CardDetails } from "@/components/checkout/PaymentStep";
import ReviewStep from "@/components/checkout/ReviewStep";
import CheckoutSummary from "@/components/checkout/CheckoutSummary";

const STEPS = [{ key: "delivery" }, { key: "payment" }, { key: "review" }] as const;

export default function CheckoutClient({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const t = useTranslations("checkout");
  const tCart = useTranslations("cart");
  const { items, promoApplied, clearCart } = useCart();

  const [stepIndex, setStepIndex] = useState(0);

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(addresses[0]?.id ?? null);
  const [addingNew, setAddingNew] = useState(addresses.length === 0);
  const [form, setForm] = useState<DeliveryForm>({ fullName: "", phone: "", address: "", city: "", notes: "" });
  const [touchedDelivery, setTouchedDelivery] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("cod");
  const [card, setCard] = useState<CardDetails>({ number: "", expiry: "", cvv: "", name: "" });
  const [touchedPayment, setTouchedPayment] = useState(false);

  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [orderError, setOrderError] = useState("");

  function validateDelivery(): Partial<Record<keyof DeliveryForm, string>> {
    const errors: Partial<Record<keyof DeliveryForm, string>> = {};
    if (addingNew || !selectedAddressId) {
      if (!form.fullName.trim()) errors.fullName = t("errors.fullName");
      if (!form.phone.trim()) errors.phone = t("errors.phone");
      if (!form.address.trim()) errors.address = t("errors.address");
      if (!form.city.trim()) errors.city = t("errors.city");
    }
    return errors;
  }

  function validatePayment(): Partial<Record<keyof CardDetails, string>> {
    const errors: Partial<Record<keyof CardDetails, string>> = {};
    if (paymentMethod === "card") {
      if (!card.number.trim()) errors.number = t("errors.cardNumber");
      if (!card.expiry.trim()) errors.expiry = t("errors.expiry");
      if (!card.cvv.trim()) errors.cvv = t("errors.cvv");
    }
    return errors;
  }

  const deliveryErrors = touchedDelivery ? validateDelivery() : {};
  const paymentErrors = touchedPayment ? validatePayment() : {};

  const currentKey = STEPS[stepIndex].key;
  const isReviewStep = currentKey === "review";

  function handleSelectAddress(id: string) {
    setSelectedAddressId(id);
    setAddingNew(false);
  }

  function handleSelectAddNew() {
    setAddingNew(true);
    setSelectedAddressId(null);
  }

  function handleFormChange(field: keyof DeliveryForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleCardChange(field: keyof CardDetails, value: string) {
    setCard((prev) => ({ ...prev, [field]: value }));
  }

  function nextStep() {
    if (currentKey === "delivery") {
      const errors = validateDelivery();
      if (Object.keys(errors).length) {
        setTouchedDelivery(true);
        return;
      }
    }
    if (currentKey === "payment") {
      const errors = validatePayment();
      if (Object.keys(errors).length) {
        setTouchedPayment(true);
        return;
      }
    }
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
    setTouchedDelivery(false);
    setTouchedPayment(false);
  }

  function prevStep() {
    if (stepIndex === 0) {
      router.push("/cart");
      return;
    }
    setStepIndex((i) => Math.max(0, i - 1));
  }

  async function placeOrder() {
    if (placingOrder) return;
    setPlacingOrder(true);
    setOrderError("");

    const { subtotal, deliveryFee, discount, total: orderTotal } = getCartTotals(items, promoApplied);
    const shipping = addingNew || !selectedAddr
      ? { fullName: form.fullName, phone: form.phone, address: form.address, city: form.city, notes: form.notes }
      : { fullName: selectedAddr.name, phone: selectedAddr.phone, address: selectedAddr.address, city: selectedAddr.city };

    try {
      const [num] = await Promise.all([
        createOrder({
          items,
          subtotal,
          deliveryFee,
          discount,
          total: orderTotal,
          paymentMethod,
          shipping,
        }),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
      setOrderNumber(num);
      setOrderPlaced(true);
      clearCart();

      if (addingNew) {
        saveAddress({
          recipient: form.fullName,
          phone: form.phone,
          street: form.address,
          city: form.city,
        }).catch(() => {
          // Best-effort: the order already succeeded, so a failure to save
          // the address for next time shouldn't surface as an order error.
        });
      }
    } catch {
      setOrderError(t("orderError"));
    } finally {
      setPlacingOrder(false);
    }
  }

  const selectedAddr = addresses.find((a) => a.id === selectedAddressId);
  const recapAddress = addingNew
    ? [form.fullName, form.address, form.city].filter(Boolean).join(", ") || t("newAddress")
    : selectedAddr
      ? `${selectedAddr.address}, ${selectedAddr.city}`
      : "—";
  const recapPayment = t(`methods.${paymentMethod}`);

  const { total } = getCartTotals(items, promoApplied);

  if (orderPlaced) {
    return (
      <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-col px-4 py-6 md:px-6 md:py-10">
        <div className="flex flex-col items-center gap-4 rounded-[28px] border border-neutral-200 bg-white px-6 py-12 text-center md:py-16">
          <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-secondary-50">
            <Check className="h-[38px] w-[38px] text-secondary-600" />
          </span>
          <div className="font-headline text-2xl font-extrabold text-neutral-900">{t("confirmedTitle")}</div>
          <div className="max-w-[380px] text-[14.5px] text-neutral-500">
            {t("confirmedHint")}
          </div>
          <div className="mt-1.5 flex flex-wrap justify-center gap-7 rounded-[14px] border border-primary-100 bg-tertiary-100 px-6 py-4">
            <div>
              <div className="text-[11.5px] font-semibold tracking-wide text-neutral-500 uppercase">{t("orderNumber")}</div>
              <div className="font-headline text-base font-extrabold text-neutral-900">{orderNumber}</div>
            </div>
            <div>
              <div className="text-[11.5px] font-semibold tracking-wide text-neutral-500 uppercase">
                {t("estimatedDelivery")}
              </div>
              <div className="font-headline text-base font-extrabold text-neutral-900">{t("withinTwoHours")}</div>
            </div>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="mt-2.5 min-w-[220px]"
            onClick={() => router.push("/account/orders")}
          >
            {t("trackOrder")}
          </Button>
          <Link href="/" className="text-[13.5px] font-semibold text-neutral-500">
            {tCart("continueShopping")}
          </Link>
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-col px-4 py-6 md:px-6 md:py-10">
        <div className="flex flex-col items-center gap-3.5 rounded-[28px] border border-neutral-200 bg-white px-6 py-12 text-center">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-tertiary-100">
            <ShoppingCart className="h-[34px] w-[34px] text-primary-500" />
          </span>
          <div className="font-headline text-xl font-extrabold text-neutral-900">{tCart("empty")}</div>
          <div className="max-w-[320px] text-sm text-neutral-500">
            {t("emptyHint")}
          </div>
          <Button variant="primary" size="lg" onClick={() => router.push("/")}>
            {tCart("browse")}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-col gap-6 px-4 py-4 pb-24 md:px-6 md:py-8 md:pb-8">
      <div className="flex items-start">
        {STEPS.map((step, i) => {
          const done = i < stepIndex;
          const current = i === stepIndex;
          const isLast = i === STEPS.length - 1;
          return (
            <div key={step.key} className={`flex items-center ${isLast ? "flex-none" : "flex-1"}`}>
              <div className="flex shrink-0 flex-col items-center gap-1.5">
                <span
                  className={`flex h-[30px] w-[30px] items-center justify-center rounded-full font-label text-[13px] font-bold ${
                    done || current ? "bg-primary-500 text-white" : "bg-neutral-100 text-neutral-500"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span
                  className={`text-xs whitespace-nowrap ${
                    current ? "font-bold text-neutral-900" : "font-semibold text-neutral-500"
                  }`}
                >
                  {t(`steps.${step.key}`)}
                </span>
              </div>
              {!isLast && (
                <div className={`mt-[15px] h-0.5 flex-1 ${done ? "bg-primary-500" : "bg-neutral-200"}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          {currentKey === "delivery" && (
            <DeliveryStep
              addresses={addresses}
              selectedAddressId={selectedAddressId}
              addingNew={addingNew}
              form={form}
              errors={deliveryErrors}
              onSelectAddress={handleSelectAddress}
              onSelectAddNew={handleSelectAddNew}
              onFormChange={handleFormChange}
            />
          )}
          {currentKey === "payment" && (
            <PaymentStep
              paymentMethod={paymentMethod}
              onSelectPaymentMethod={setPaymentMethod}
              card={card}
              errors={paymentErrors}
              onCardChange={handleCardChange}
            />
          )}
          {isReviewStep && <ReviewStep recapAddress={recapAddress} recapPayment={recapPayment} />}
          {isReviewStep && orderError && (
            <div className="rounded-[10px] border border-danger-50 bg-danger-50 px-3.5 py-3 text-[13px] text-danger-600">
              {orderError}
            </div>
          )}

          <div className="hidden justify-end gap-2.5 md:flex">
            <Button variant="outlined" size="lg" onClick={prevStep}>
              {t("back")}
            </Button>
            {!isReviewStep ? (
              <Button variant="primary" size="lg" className="min-w-[160px]" onClick={nextStep}>
                {t("continue")}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                className="min-w-[200px]"
                disabled={placingOrder}
                onClick={placeOrder}
              >
                {placingOrder ? t("placingOrder") : t("placeOrder")}
              </Button>
            )}
          </div>
          {isReviewStep && (
            <div className="hidden text-end text-[12.5px] text-neutral-400 md:block">
              {t("secureLine")}
            </div>
          )}
        </div>

        <div className="hidden md:sticky md:top-[96px] md:block">
          <CheckoutSummary />
        </div>
      </div>

      <div className="fixed end-0 bottom-0 start-0 z-[35] flex items-center gap-3 border-t border-neutral-200 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.08)] md:hidden">
        <div className="min-w-0 shrink-0">
          <div className="text-[11px] text-neutral-500">{tCart("total")}</div>
          <div className="font-headline text-lg font-black whitespace-nowrap text-neutral-900">
            {formatEGP(total)}
          </div>
        </div>
        <Button variant="outlined" size="lg" onClick={prevStep}>
          {t("back")}
        </Button>
        {!isReviewStep ? (
          <Button variant="primary" size="lg" fullWidth className="flex-1" onClick={nextStep}>
            {t("continue")}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="flex-1"
            disabled={placingOrder}
            onClick={placeOrder}
          >
            {placingOrder ? "…" : t("placeOrder")}
          </Button>
        )}
      </div>
    </main>
  );
}
