"use client";

import { useState, useTransition } from "react";
import { Truck, CheckCircle2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatEGP, type DeliverySettings } from "@/lib/cart-totals";
import { updateDeliverySettings } from "@/lib/actions";

// Parses a money field: empty or non-numeric is invalid, negatives are
// rejected. Returns null when the raw text can't become a valid amount so the
// form can block the save with a clear message.
function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export default function SettingsClient({ settings }: { settings: DeliverySettings }) {
  const [threshold, setThreshold] = useState(String(settings.freeDeliveryThreshold));
  const [fee, setFee] = useState(String(settings.deliveryFee));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const parsedThreshold = parseAmount(threshold);
  const parsedFee = parseAmount(fee);
  const valid = parsedThreshold !== null && parsedFee !== null;
  // Reflects the last saved values, so the Save button can disable when there's
  // nothing to persist.
  const dirty =
    parsedThreshold !== settings.freeDeliveryThreshold || parsedFee !== settings.deliveryFee;

  function handleSave() {
    if (!valid) {
      setError("Enter valid amounts (0 or more).");
      return;
    }
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateDeliverySettings({
          freeDeliveryThreshold: parsedThreshold,
          deliveryFee: parsedFee,
        });
        setSaved(true);
      } catch {
        setError("Couldn't save. Please try again.");
      }
    });
  }

  return (
    <main className="mx-auto max-w-[720px] px-4 py-5 md:px-10 md:py-8">
      <div className="mb-6">
        <h1 className="m-0 font-headline text-2xl font-extrabold tracking-tight text-neutral-900 md:text-3xl">
          Store settings
        </h1>
        <p className="m-0 mt-1 text-sm text-neutral-500">Delivery pricing shown across the storefront and charged at checkout.</p>
      </div>

      <div className="rounded-[20px] border border-neutral-200 bg-white p-6 shadow-sm md:p-7">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-tertiary-100 text-primary-500">
            <Truck className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </span>
          <div className="font-headline text-base font-bold text-neutral-900">Delivery</div>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <label className="mb-1.5 block font-label text-[13px] font-semibold text-neutral-700">
              Free delivery threshold
            </label>
            <div className="flex items-center gap-2">
              <span className="font-label text-sm font-semibold text-neutral-400">EGP</span>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step={5}
                value={threshold}
                onChange={(e) => {
                  setThreshold(e.target.value);
                  setSaved(false);
                  setError(null);
                }}
                className="max-w-[180px]"
              />
            </div>
            <p className="mt-1.5 text-[12.5px] text-neutral-500">
              Orders at or above this subtotal ship free. Set to 0 to make every order free.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block font-label text-[13px] font-semibold text-neutral-700">
              Delivery fee
            </label>
            <div className="flex items-center gap-2">
              <span className="font-label text-sm font-semibold text-neutral-400">EGP</span>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step={5}
                value={fee}
                onChange={(e) => {
                  setFee(e.target.value);
                  setSaved(false);
                  setError(null);
                }}
                className="max-w-[180px]"
              />
            </div>
            <p className="mt-1.5 text-[12.5px] text-neutral-500">
              Charged on orders below the free-delivery threshold.
            </p>
          </div>

          {valid && (
            <div className="rounded-[12px] border border-primary-100 bg-tertiary-100 px-4 py-3 text-[13px] leading-relaxed text-neutral-700">
              Orders of <strong>{formatEGP(parsedThreshold)}</strong> or more ship free. Below that,
              delivery costs <strong>{formatEGP(parsedFee)}</strong>.
            </div>
          )}

          {error && (
            <div className="rounded-[10px] border border-danger-50 bg-danger-50 px-3.5 py-3 text-[13px] text-danger-600">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="md"
              disabled={isPending || !valid || !dirty}
              onClick={handleSave}
            >
              {isPending ? "Saving…" : "Save changes"}
            </Button>
            {saved && !dirty && (
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-secondary-600">
                <CheckCircle2 className="h-4 w-4" /> Saved
              </span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
