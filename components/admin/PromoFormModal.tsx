"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import IconButton from "@/components/ui/IconButton";
import { createPromoCode, updatePromoCode } from "@/lib/actions";
import type { AdminPromoCode } from "@/lib/queries";

interface PromoFormModalProps {
  // When set, the modal edits this code instead of creating a new one.
  promo?: AdminPromoCode;
  onClose: () => void;
}

const labelClass = "mb-1.5 block font-label text-xs font-semibold text-neutral-500";

// <input type="datetime-local"> has no timezone of its own — the string is
// naive, and `new Date(value)` interprets it as the browser's (i.e. the
// Cairo-based admin's) local time, which is exactly the conversion wanted.
// Egypt has DST, so don't hand-roll an offset.
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CODE: "Code must be 3-24 letters/numbers.",
  INVALID_AMOUNT: "Discount must be a positive number.",
  INVALID_MIN: "Minimum subtotal can't be negative.",
  CODE_EXISTS: "A code with this name already exists.",
};

export default function PromoFormModal({ promo, onClose }: PromoFormModalProps) {
  const editing = Boolean(promo);
  const [code, setCode] = useState(promo?.code ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const discountEgp = Number(formData.get("discountEgp"));
    const minSubtotal = Number(formData.get("minSubtotal"));
    const expiresRaw = String(formData.get("expiresAt") ?? "").trim();
    const expiresAt = expiresRaw ? new Date(expiresRaw).toISOString() : null;

    try {
      if (editing && promo) {
        await updatePromoCode(promo.code, { discountEgp, minSubtotal, expiresAt });
      } else {
        await createPromoCode({ code, discountEgp, minSubtotal, expiresAt });
      }
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(ERROR_MESSAGES[message] ?? "Could not save the promo code.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ animation: "ccOverlayIn 160ms ease-out" }}
    >
      <div onClick={onClose} className="absolute inset-0 bg-neutral-900/40" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative mx-4 w-full max-w-[400px] rounded-[20px] bg-white p-5 shadow-lg md:p-7"
        style={{ animation: "ccScaleIn 200ms ease-out" }}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="font-headline text-xl font-bold text-neutral-900">
              {editing ? "Edit code" : "Add code"}
            </div>
            <div className="mt-0.5 text-sm text-neutral-500">
              {editing ? promo?.code : "New promo code for checkout"}
            </div>
          </div>
          <IconButton icon={X} aria-label="Close" shape="circle" size="sm" onClick={onClose} />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className={labelClass}>Code</label>
            <Input
              name="code"
              required
              disabled={editing}
              placeholder="e.g. SUMMER10"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className={editing ? "bg-neutral-50 text-neutral-500" : ""}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Discount (EGP)</label>
              <Input
                name="discountEgp"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="0"
                defaultValue={promo?.discountEgp ?? ""}
              />
            </div>
            <div>
              <label className={labelClass}>Min subtotal (EGP)</label>
              <Input
                name="minSubtotal"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                defaultValue={promo?.minSubtotal ?? 0}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Expires (optional)</label>
            <Input name="expiresAt" type="datetime-local" defaultValue={toDatetimeLocalValue(promo?.expiresAt ?? null)} />
          </div>

          {error && <div className="rounded-[10px] bg-danger-50 px-3.5 py-2.5 text-[13px] text-danger-600">{error}</div>}

          <div className="mt-1 flex gap-2.5">
            <Button type="button" variant="outlined" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" fullWidth disabled={submitting}>
              {submitting ? "Saving…" : editing ? "Save changes" : "Save code"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
