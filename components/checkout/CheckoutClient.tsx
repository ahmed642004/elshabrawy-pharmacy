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
import type { GeoFix, ReverseGeocodeResult } from "@/lib/geolocation";
import PaymentStep from "@/components/checkout/PaymentStep";
import ReviewStep from "@/components/checkout/ReviewStep";
import CheckoutSummary from "@/components/checkout/CheckoutSummary";

const STEPS = [{ key: "delivery" }, { key: "payment" }, { key: "review" }] as const;

export default function CheckoutClient({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const t = useTranslations("checkout");
  const tCart = useTranslations("cart");
  const { items, promo, clearCart } = useCart();

  const [stepIndex, setStepIndex] = useState(0);

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(addresses[0]?.id ?? null);
  const [addingNew, setAddingNew] = useState(addresses.length === 0);
  const [form, setForm] = useState<DeliveryForm>({
    fullName: "",
    phone: "",
    address: "",
    city: "",
    notes: "",
    lat: null,
    lng: null,
    geoAccuracyM: null,
  });
  const [touchedDelivery, setTouchedDelivery] = useState(false);

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

  const deliveryErrors = touchedDelivery ? validateDelivery() : {};

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

  // Prefill only empty fields — GPS coords are the ground truth for the
  // driver, but never overwrite text the user already typed themselves.
  function handleLocationCaptured(fix: GeoFix, geocoded: ReverseGeocodeResult | null) {
    setForm((prev) => ({
      ...prev,
      lat: fix.lat,
      lng: fix.lng,
      geoAccuracyM: fix.accuracyM,
      address: !prev.address.trim() && geocoded?.street ? geocoded.street : prev.address,
      city: !prev.city.trim() && geocoded?.city ? geocoded.city : prev.city,
    }));
  }

  function handleLocationCleared() {
    setForm((prev) => ({ ...prev, lat: null, lng: null, geoAccuracyM: null }));
  }

  function nextStep() {
    if (currentKey === "delivery") {
      const errors = validateDelivery();
      if (Object.keys(errors).length) {
        setTouchedDelivery(true);
        return;
      }
    }
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
    setTouchedDelivery(false);
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

    const shipping = addingNew || !selectedAddr
      ? {
          fullName: form.fullName,
          phone: form.phone,
          address: form.address,
          city: form.city,
          notes: form.notes,
          ...(form.lat != null && form.lng != null ? { lat: form.lat, lng: form.lng } : {}),
        }
      : {
          fullName: selectedAddr.name,
          phone: selectedAddr.phone,
          address: selectedAddr.address,
          city: selectedAddr.city,
          ...(selectedAddr.lat != null && selectedAddr.lng != null
            ? { lat: selectedAddr.lat, lng: selectedAddr.lng }
            : {}),
        };

    try {
      const [result] = await Promise.all([
        createOrder({
          items: items.map((i) => ({ slug: i.slug, qty: i.qty })),
          paymentMethod: "cod",
          shipping,
          promoCode: promo?.code ?? null,
        }),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);

      if ("error" in result) {
        if (result.error === "INSUFFICIENT_STOCK") {
          // The RPC only knows the slug — look up the display name from the
          // cart items already in scope rather than round-tripping again.
          const name = items.find((i) => i.slug === result.slug)?.name ?? result.slug;
          setOrderError(
            t("errors.insufficientStock", { name, available: result.available, requested: result.requested })
          );
        } else {
          setOrderError(t("orderError"));
        }
        return;
      }

      setOrderNumber(result.orderNumber);
      setOrderPlaced(true);
      clearCart();

      if (addingNew) {
        saveAddress({
          recipient: form.fullName,
          phone: form.phone,
          street: form.address,
          city: form.city,
          lat: form.lat,
          lng: form.lng,
          geoAccuracyM: form.geoAccuracyM,
        }).catch(() => {
          // Best-effort: the order already succeeded, so a failure to save
          // the address for next time shouldn't surface as an order error.
        });
      }
    } catch {
      // createOrder() no longer throws for its expected failure modes (see
      // its comment — thrown Server Action errors are redacted to a generic
      // message in production) — a throw here means something genuinely
      // unexpected (network failure, etc.), so there's no code to match on.
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
  const recapPayment = t("methods.cod");

  const { total } = getCartTotals(items, promo?.discount ?? 0);

  if (orderPlaced) {
    return (
      <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-col px-4 py-6 md:px-6 md:py-10">
        <div className="flex flex-col items-center gap-4 rounded-[28px] border border-neutral-200 bg-white px-6 py-12 text-center md:py-16">
          <span
            className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-secondary-50"
            style={{ animation: "ccPopIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
          >
            <Check className="h-[38px] w-[38px] text-secondary-600" />
          </span>
          <div
            className="font-headline text-2xl font-extrabold text-neutral-900"
            style={{ animation: "heroFadeUp 0.5s ease-out 0.1s both" }}
          >
            {t("confirmedTitle")}
          </div>
          <div
            className="max-w-[380px] text-[14.5px] text-neutral-500"
            style={{ animation: "heroFadeUp 0.5s ease-out 0.2s both" }}
          >
            {t("confirmedHint")}
          </div>
          <div
            className="mt-1.5 flex flex-wrap justify-center gap-7 rounded-[14px] border border-primary-100 bg-tertiary-100 px-6 py-4"
            style={{ animation: "heroFadeUp 0.5s ease-out 0.3s both" }}
          >
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
          <div style={{ animation: "heroFadeUp 0.5s ease-out 0.4s both" }}>
            <Button
              variant="primary"
              size="lg"
              className="mt-2.5 min-w-[220px]"
              onClick={() => router.push("/account/orders")}
            >
              {t("trackOrder")}
            </Button>
          </div>
          <Link
            href="/"
            className="text-[13.5px] font-semibold text-neutral-500"
            style={{ animation: "heroFadeUp 0.5s ease-out 0.5s both" }}
          >
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
                  className={`flex h-[30px] w-[30px] items-center justify-center rounded-full font-label text-[13px] font-bold transition-[background-color,color,transform] duration-300 ${
                    done || current ? "bg-primary-500 text-white" : "bg-neutral-100 text-neutral-500"
                  } ${current ? "scale-110" : ""}`}
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
                // Connector fills toward the reading direction in both locales.
                <div className="relative mt-[15px] h-0.5 flex-1 overflow-hidden bg-neutral-200">
                  <div
                    className={`absolute inset-0 origin-left bg-primary-500 transition-transform duration-500 ease-out rtl:origin-right ${
                      done ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          {/* Keyed wrapper re-animates step content on next/back (translateY
              is deliberately used over translateX, which would need per-
              direction keyframes to read as "forward" in RTL). */}
          <div key={currentKey} className="flex flex-col gap-5" style={{ animation: "heroFadeUp 300ms ease-out both" }}>
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
                onLocationCaptured={handleLocationCaptured}
                onLocationCleared={handleLocationCleared}
              />
            )}
            {currentKey === "payment" && <PaymentStep />}
            {isReviewStep && <ReviewStep recapAddress={recapAddress} recapPayment={recapPayment} />}
            {isReviewStep && orderError && (
              <div className="rounded-[10px] border border-danger-50 bg-danger-50 px-3.5 py-3 text-[13px] text-danger-600">
                {orderError}
              </div>
            )}
          </div>

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
