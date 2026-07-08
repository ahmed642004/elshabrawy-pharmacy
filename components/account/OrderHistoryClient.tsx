"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, PackageSearch, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import OrderStatusBadge from "@/components/admin/OrderStatusBadge";
import { cancelMyOrder, getReorderItems } from "@/lib/actions";
import { formatEGP } from "@/lib/cart-totals";
import { useCart } from "@/lib/cart-context";
import { useToast } from "@/components/ui/ToastProvider";
import type { AdminOrder } from "@/lib/queries";

const TRACKING_STEPS = ["placed", "confirmed", "delivered"] as const;

function StatusTimeline({ status }: { status: AdminOrder["status"] }) {
  const t = useTranslations("account");

  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 rounded-[10px] bg-danger-50 px-3.5 py-2.5 text-[13px] font-semibold text-danger-600">
        <X className="h-4 w-4" /> {t("cancelled")}
      </div>
    );
  }

  const currentIndex = TRACKING_STEPS.findIndex((s) => s === status);

  return (
    <div className="flex items-start">
      {TRACKING_STEPS.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        const isLast = i === TRACKING_STEPS.length - 1;
        return (
          <div key={step} className={`flex items-center ${isLast ? "flex-none" : "flex-1"}`}>
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
                {t(`tracking.${step}`)}
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
  const t = useTranslations("account");
  const tCart = useTranslations("cart");
  const locale = useLocale();
  const dateLocale = locale === "ar" ? "ar-EG" : "en-US";
  const router = useRouter();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(orders[0]?.id ?? null);
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null);
  const [cancelErrorId, setCancelErrorId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [cancelPending, startCancelTransition] = useTransition();

  // Two-tap confirm auto-resets after a few seconds so a stray later click
  // elsewhere on the page can't land on an armed "confirm cancel" button.
  useEffect(() => {
    if (!confirmingCancelId) return;
    const timeout = setTimeout(() => setConfirmingCancelId(null), 4000);
    return () => clearTimeout(timeout);
  }, [confirmingCancelId]);

  function handleCancelClick(orderId: string) {
    if (confirmingCancelId !== orderId) {
      setConfirmingCancelId(orderId);
      return;
    }
    setConfirmingCancelId(null);
    setCancelErrorId(null);
    startCancelTransition(async () => {
      try {
        await cancelMyOrder(orderId);
        router.refresh();
      } catch {
        setCancelErrorId(orderId);
      }
    });
  }

  async function handleReorder(order: AdminOrder) {
    setReorderingId(order.id);
    try {
      const slugs = order.items.map((i) => i.slug).filter((s): s is string => !!s);
      const live = await getReorderItems(slugs);
      let added = 0;
      for (const item of live) {
        if (item.stock === "out") continue;
        const qty = order.items.find((i) => i.slug === item.slug)?.qty ?? 1;
        addItem({ slug: item.slug, name: item.name, brand: item.brand ?? undefined, price: item.price, stock: item.stock }, qty);
        added += 1;
      }
      if (added === 0) {
        showToast(t("reorderNone"));
        return;
      }
      const skipped = slugs.length - added;
      showToast(skipped > 0 ? `${t("reorderAdded", { count: added })} · ${t("reorderSkipped", { count: skipped })}` : t("reorderAdded", { count: added }));
      router.push("/cart");
    } finally {
      setReorderingId(null);
    }
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3.5 rounded-[28px] border border-neutral-200 bg-white px-6 py-12 text-center">
        <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-tertiary-100">
          <PackageSearch className="h-[34px] w-[34px] text-primary-500" />
        </span>
        <div className="font-headline text-xl font-extrabold text-neutral-900">{t("noOrders")}</div>
        <div className="max-w-[320px] text-sm text-neutral-500">
          {t("noOrdersHint")}
        </div>
        <Link href="/">
          <Button variant="primary" size="lg">
            {t("browseProducts")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {orders.map((order) => {
        const expanded = expandedId === order.id;
        const placedDate = new Intl.DateTimeFormat(dateLocale, {
          timeZone: "Africa/Cairo",
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(order.createdAt));
        const itemQty = order.items.reduce((n, i) => n + i.qty, 0);

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
                  {placedDate} · {t("itemCount", { count: itemQty })}
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
                    {t("items")}
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
                      <span>{tCart("subtotal")}</span>
                      <span>{formatEGP(order.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-neutral-500">
                      <span>{tCart("delivery")}</span>
                      <span>{order.deliveryFee > 0 ? formatEGP(order.deliveryFee) : tCart("free")}</span>
                    </div>
                    {order.discount > 0 && (
                      <div className="flex justify-between text-secondary-600">
                        <span>{tCart("discount")}</span>
                        <span>-{formatEGP(order.discount)}</span>
                      </div>
                    )}
                    <div className="mt-1 flex justify-between font-headline text-base font-bold text-neutral-900">
                      <span>{tCart("total")}</span>
                      <span>{formatEGP(order.total)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 font-label text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
                      {t("deliverTo")}
                    </div>
                    <div className="text-sm text-neutral-700">{order.customerName}</div>
                    <div className="text-sm text-neutral-500">{order.customerAddress || "—"}</div>
                  </div>
                  <div>
                    <div className="mb-1 font-label text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
                      {t("payment")}
                    </div>
                    <div className="text-sm text-neutral-700">
                      {t.has(`paymentMethods.${order.paymentMethod}`)
                        ? t(`paymentMethods.${order.paymentMethod}`)
                        : order.paymentMethod}
                    </div>
                  </div>
                </div>

                {(order.status === "placed" || order.status === "delivered" || order.status === "cancelled") && (
                  <div className="flex flex-col gap-2 border-t border-neutral-100 pt-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {order.status === "placed" && (
                        <Button
                          variant="outlined"
                          size="md"
                          disabled={cancelPending}
                          onClick={() => handleCancelClick(order.id)}
                        >
                          {confirmingCancelId === order.id ? t("cancelConfirm") : t("cancelOrder")}
                        </Button>
                      )}
                      {(order.status === "delivered" || order.status === "cancelled") && (
                        <Button
                          variant="outlined"
                          size="md"
                          disabled={reorderingId === order.id}
                          onClick={() => handleReorder(order)}
                        >
                          {reorderingId === order.id ? t("reordering") : t("reorder")}
                        </Button>
                      )}
                    </div>
                    {cancelErrorId === order.id && (
                      <div className="text-xs text-danger-500">{t("cancelFailed")}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
