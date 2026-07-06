"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, PackageSearch, X } from "lucide-react";
import Button from "@/components/ui/Button";
import OrderStatusBadge from "@/components/admin/OrderStatusBadge";
import { formatEGP } from "@/lib/cart-totals";
import type { AdminOrder } from "@/lib/queries";

const TRACKING_STEPS = [
  { key: "placed", label: "Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "delivered", label: "Delivered" },
] as const;

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cod: "Cash on delivery",
  card: "Card on delivery",
  wallet: "Mobile wallet",
};

function StatusTimeline({ status }: { status: AdminOrder["status"] }) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 rounded-[10px] bg-danger-50 px-3.5 py-2.5 text-[13px] font-semibold text-danger-600">
        <X className="h-4 w-4" /> This order was cancelled.
      </div>
    );
  }

  const currentIndex = TRACKING_STEPS.findIndex((s) => s.key === status);

  return (
    <div className="flex items-start">
      {TRACKING_STEPS.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        const isLast = i === TRACKING_STEPS.length - 1;
        return (
          <div key={step.key} className={`flex items-center ${isLast ? "flex-none" : "flex-1"}`}>
            <div className="flex shrink-0 flex-col items-center gap-1.5">
              <span
                className={`flex h-[26px] w-[26px] items-center justify-center rounded-full font-label text-xs font-bold ${
                  done || current ? "bg-primary-500 text-white" : "bg-neutral-100 text-neutral-400"
                }`}
              >
                {done || (current && status === "delivered") ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={`text-[11px] whitespace-nowrap ${
                  current ? "font-bold text-neutral-900" : "font-semibold text-neutral-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {!isLast && <div className={`mt-[13px] h-0.5 flex-1 ${done ? "bg-primary-500" : "bg-neutral-200"}`} />}
          </div>
        );
      })}
    </div>
  );
}

export default function OrderHistoryClient({ orders }: { orders: AdminOrder[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(orders[0]?.id ?? null);

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3.5 rounded-[28px] border border-neutral-200 bg-white px-6 py-12 text-center">
        <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-tertiary-100">
          <PackageSearch className="h-[34px] w-[34px] text-primary-500" />
        </span>
        <div className="font-headline text-xl font-extrabold text-neutral-900">No orders yet</div>
        <div className="max-w-[320px] text-sm text-neutral-500">
          When you place an order, it will show up here so you can track it.
        </div>
        <Link href="/">
          <Button variant="primary" size="lg">
            Browse products
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {orders.map((order) => {
        const expanded = expandedId === order.id;
        const placedDate = new Intl.DateTimeFormat("en-US", {
          timeZone: "Africa/Cairo",
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(order.createdAt));

        return (
          <div key={order.id} className="overflow-hidden rounded-[20px] border border-neutral-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : order.id)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-neutral-50"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-headline text-base font-bold text-neutral-900">{order.orderNumber}</span>
                  <OrderStatusBadge status={order.status} />
                </div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  {placedDate} · {order.items.reduce((n, i) => n + i.qty, 0)} item
                  {order.items.reduce((n, i) => n + i.qty, 0) === 1 ? "" : "s"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-headline text-base font-bold text-neutral-900">{formatEGP(order.total)}</span>
                <ChevronDown
                  className={`h-4 w-4 text-neutral-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </div>
            </button>

            {expanded && (
              <div className="flex flex-col gap-5 border-t border-neutral-100 px-5 py-5">
                <StatusTimeline status={order.status} />

                <div>
                  <div className="mb-2 font-label text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
                    Items
                  </div>
                  <div className="flex flex-col gap-2">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-neutral-700">
                          {item.name} <span className="text-neutral-400">× {item.qty}</span>
                        </span>
                        <span className="font-semibold text-neutral-900">{formatEGP(item.price * item.qty)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-col gap-1 border-t border-neutral-100 pt-3 text-sm">
                    <div className="flex justify-between text-neutral-500">
                      <span>Subtotal</span>
                      <span>{formatEGP(order.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-neutral-500">
                      <span>Delivery</span>
                      <span>{order.deliveryFee > 0 ? formatEGP(order.deliveryFee) : "Free"}</span>
                    </div>
                    {order.discount > 0 && (
                      <div className="flex justify-between text-secondary-600">
                        <span>Discount</span>
                        <span>-{formatEGP(order.discount)}</span>
                      </div>
                    )}
                    <div className="mt-1 flex justify-between font-headline text-base font-bold text-neutral-900">
                      <span>Total</span>
                      <span>{formatEGP(order.total)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 font-label text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
                      Deliver to
                    </div>
                    <div className="text-sm text-neutral-700">{order.customerName}</div>
                    <div className="text-sm text-neutral-500">{order.customerAddress || "—"}</div>
                  </div>
                  <div>
                    <div className="mb-1 font-label text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
                      Payment
                    </div>
                    <div className="text-sm text-neutral-700">
                      {PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
