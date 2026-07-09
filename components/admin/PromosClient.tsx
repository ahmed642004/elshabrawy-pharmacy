"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Ban, CheckCircle2, TicketPercent } from "lucide-react";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import PromoFormModal from "@/components/admin/PromoFormModal";
import { deletePromoCode, togglePromoActive } from "@/lib/actions";
import { formatEGP } from "@/lib/cart-totals";
import type { AdminPromoCode } from "@/lib/queries";

function StatusPill({ promo }: { promo: AdminPromoCode }) {
  const expired = promo.expiresAt != null && new Date(promo.expiresAt) < new Date();
  if (expired) {
    return (
      <span className="w-fit rounded-full bg-warning-50 px-2.5 py-1 text-[11px] font-semibold text-warning-600">
        Expired
      </span>
    );
  }
  return promo.active ? (
    <span className="w-fit rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-semibold text-success-600">
      Active
    </span>
  ) : (
    <span className="w-fit rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-500">
      Inactive
    </span>
  );
}

export default function PromosClient({ promos }: { promos: AdminPromoCode[] }) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<AdminPromoCode | null>(null);
  const [pendingCodes, setPendingCodes] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function withPending(code: string, fn: () => Promise<void>) {
    setPendingCodes((prev) => new Set(prev).add(code));
    setRowError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch {
        setRowError(code);
      } finally {
        setPendingCodes((prev) => {
          const next = new Set(prev);
          next.delete(code);
          return next;
        });
      }
    });
  }

  function handleToggle(promo: AdminPromoCode) {
    withPending(promo.code, () => togglePromoActive(promo.code, !promo.active));
  }

  function handleDeleteClick(code: string) {
    if (confirmingDelete !== code) {
      setConfirmingDelete(code);
      return;
    }
    setConfirmingDelete(null);
    withPending(code, () => deletePromoCode(code));
  }

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-5 md:px-10 md:py-8">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div>
          <h1 className="m-0 font-headline text-2xl font-extrabold tracking-tight text-neutral-900 md:text-3xl">
            Promo codes
          </h1>
          <p className="m-0 mt-1 text-sm text-neutral-500">
            {promos.length} code{promos.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setAddModalOpen(true)}>
          <Plus className="h-4 w-4" strokeWidth={2} /> Add code
        </Button>
      </div>

      <div className="overflow-x-auto rounded-[20px] border border-neutral-200 bg-white shadow-sm">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[140px_110px_120px_130px_100px_140px] gap-2 border-b border-neutral-100 px-5 py-3.5 font-label text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
            <div>Code</div>
            <div>Discount</div>
            <div>Min subtotal</div>
            <div>Expires</div>
            <div>Status</div>
            <div>Actions</div>
          </div>
          {promos.map((promo) => {
            const pending = pendingCodes.has(promo.code);
            return (
              <div key={promo.code}>
                <div className="grid grid-cols-[140px_110px_120px_130px_100px_140px] items-center gap-2 border-b border-neutral-100 px-5 py-3.5 last:border-0">
                  <div className="font-label text-sm font-bold tracking-wide text-neutral-900">{promo.code}</div>
                  <div className="text-sm text-neutral-700">{formatEGP(promo.discountEgp)}</div>
                  <div className="text-sm text-neutral-700">
                    {promo.minSubtotal > 0 ? formatEGP(promo.minSubtotal) : "—"}
                  </div>
                  <div className="text-sm text-neutral-500">
                    {promo.expiresAt ? dateFormatter.format(new Date(promo.expiresAt)) : "—"}
                  </div>
                  <StatusPill promo={promo} />
                  <div className="flex gap-1.5">
                    <IconButton
                      icon={promo.active ? Ban : CheckCircle2}
                      aria-label={promo.active ? `Deactivate ${promo.code}` : `Activate ${promo.code}`}
                      size="sm"
                      disabled={pending}
                      onClick={() => handleToggle(promo)}
                    />
                    <IconButton
                      icon={Pencil}
                      aria-label={`Edit ${promo.code}`}
                      size="sm"
                      onClick={() => setEditingPromo(promo)}
                    />
                    <IconButton
                      icon={Trash2}
                      tone={confirmingDelete === promo.code ? "danger" : "neutral"}
                      aria-label={`Delete ${promo.code}`}
                      size="sm"
                      disabled={pending}
                      onClick={() => handleDeleteClick(promo.code)}
                    />
                  </div>
                </div>
                {rowError === promo.code && (
                  <div className="border-b border-neutral-100 bg-danger-50 px-5 py-2 text-xs text-danger-600">
                    Something went wrong. Please try again.
                  </div>
                )}
              </div>
            );
          })}
          {promos.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
              <TicketPercent className="h-8 w-8 text-neutral-300" strokeWidth={1.5} />
              <div className="text-sm text-neutral-400">No promo codes yet.</div>
            </div>
          )}
        </div>
      </div>

      {addModalOpen && <PromoFormModal onClose={() => setAddModalOpen(false)} />}
      {editingPromo && <PromoFormModal promo={editingPromo} onClose={() => setEditingPromo(null)} />}
    </main>
  );
}
