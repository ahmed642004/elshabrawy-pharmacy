"use client";

import { X } from "lucide-react";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import OrderStatusBadge from "@/components/admin/OrderStatusBadge";
import { formatEGP } from "@/lib/cart-totals";
import { ORDER_STATUS_META, canCancelOrder } from "@/lib/order-status";
import type { AdminOrder } from "@/lib/queries";

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cod: "Cash on delivery",
  card: "Card on delivery",
  wallet: "Mobile wallet",
};

interface OrderDetailDrawerProps {
  order: AdminOrder;
  onClose: () => void;
  onAdvance: () => void;
  onCancel: () => void;
  pending: boolean;
}

export default function OrderDetailDrawer({ order, onClose, onAdvance, onCancel, pending }: OrderDetailDrawerProps) {
  const meta = ORDER_STATUS_META[order.status];
  const placedDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(order.createdAt));

  return (
    <div className="fixed inset-0 z-50" style={{ animation: "ccOverlayIn 160ms ease-out" }}>
      <div onClick={onClose} className="absolute inset-0 bg-neutral-900/40" />
      {/* Admin is pinned dir="ltr", so the physical-X slide keyframe is safe here. */}
      <div
        className="absolute top-0 right-0 flex h-full w-full max-w-[420px] flex-col bg-white shadow-lg"
        style={{ animation: "ccSlideInX 220ms ease-out" }}
      >
        <div className="flex items-start justify-between border-b border-neutral-200 p-6">
          <div>
            <div className="font-headline text-xl font-bold text-neutral-900">{order.orderNumber}</div>
            <div className="mt-0.5 text-xs text-neutral-500">{placedDate}</div>
          </div>
          <IconButton icon={X} aria-label="Close" shape="circle" size="sm" onClick={onClose} />
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          <div>
            <OrderStatusBadge status={order.status} variant="solid" />
          </div>

          <div>
            <div className="mb-2 font-label text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
              Customer
            </div>
            <div className="font-label text-sm font-semibold text-neutral-900">{order.customerName || "—"}</div>
            <div className="mt-0.5 text-sm text-neutral-500">{order.customerPhone || "—"}</div>
            <div className="mt-0.5 text-sm text-neutral-500">{order.customerAddress || "—"}</div>
          </div>

          <div>
            <div className="mb-2 font-label text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
              Items
            </div>
            <div className="flex flex-col gap-2.5">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-neutral-900">{item.name}</div>
                    <div className="text-xs text-neutral-400">Qty {item.qty}</div>
                  </div>
                  <div className="font-label text-sm font-semibold text-neutral-900">
                    {formatEGP(item.price * item.qty)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3.5 flex flex-col gap-1.5 border-t border-neutral-200 pt-3.5">
              <div className="flex items-center justify-between text-sm text-neutral-500">
                <span>Subtotal</span>
                <span>{formatEGP(order.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-neutral-500">
                <span>Delivery</span>
                <span>{order.deliveryFee > 0 ? formatEGP(order.deliveryFee) : "Free"}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex items-center justify-between text-sm text-secondary-600">
                  <span>Discount</span>
                  <span>-{formatEGP(order.discount)}</span>
                </div>
              )}
              <div className="mt-1 flex items-center justify-between">
                <div className="font-label text-sm font-bold text-neutral-900">Total</div>
                <div className="font-headline text-lg font-bold text-neutral-900">{formatEGP(order.total)}</div>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 font-label text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
              Payment
            </div>
            <div className="text-sm text-neutral-700">
              {PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}
            </div>
          </div>
        </div>

        {(meta.next || canCancelOrder(order.status)) && (
          <div className="flex gap-2.5 border-t border-neutral-200 p-5">
            {meta.next && (
              <Button variant="primary" size="md" fullWidth disabled={pending} onClick={onAdvance}>
                {pending ? "Updating…" : meta.nextLabel}
              </Button>
            )}
            {canCancelOrder(order.status) && (
              <Button variant="outlined" size="md" disabled={pending} onClick={onCancel}>
                Cancel order
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
