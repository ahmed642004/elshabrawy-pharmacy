"use client";

import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import Input from "@/components/ui/Input";
import OrderStatusBadge from "@/components/admin/OrderStatusBadge";
import OrderDetailDrawer from "@/components/admin/OrderDetailDrawer";
import { updateOrderStatus } from "@/lib/actions";
import { formatEGP } from "@/lib/cart-totals";
import { ORDER_STATUS_META, type OrderStatus } from "@/lib/order-status";
import type { AdminOrder } from "@/lib/queries";

const STATUS_TABS: { id: OrderStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "placed", label: "Placed" },
  { id: "confirmed", label: "Confirmed" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

export default function OrdersClient({ orders }: { orders: AdminOrder[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (query && !(o.orderNumber.toLowerCase().includes(query) || o.customerName.toLowerCase().includes(query))) {
        return false;
      }
      return true;
    });
  }, [orders, search, statusFilter]);

  const selectedOrder = orders.find((o) => o.id === selectedId) ?? null;

  function handleAdvance() {
    if (!selectedOrder) return;
    const next = ORDER_STATUS_META[selectedOrder.status].next;
    if (!next) return;
    startTransition(async () => {
      await updateOrderStatus(selectedOrder.id, next);
    });
  }

  function handleCancel() {
    if (!selectedOrder) return;
    startTransition(async () => {
      await updateOrderStatus(selectedOrder.id, "cancelled");
    });
  }

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-5 md:px-10 md:py-8">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div>
          <h1 className="m-0 font-headline text-2xl font-extrabold tracking-tight text-neutral-900 md:text-3xl">
            Orders
          </h1>
          <p className="m-0 mt-1 text-sm text-neutral-500">
            {filtered.length} order{filtered.length === 1 ? "" : "s"} · fulfillment &amp; delivery tracking
          </p>
        </div>
        <div className="relative w-full md:w-[280px]">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search order id or customer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const active = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`h-[34px] rounded-full px-4 font-label text-sm font-semibold transition-colors ${
                active
                  ? "bg-primary-500 text-white shadow-[0_1px_2px_rgba(15,82,255,0.25)]"
                  : "border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-[20px] border border-neutral-200 bg-white shadow-sm">
        <div className="min-w-[700px]">
        <div className="grid grid-cols-[100px_1.2fr_60px_90px_120px_140px] gap-2 border-b border-neutral-100 px-5 py-3.5 font-label text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
          <div>Order</div>
          <div>Customer</div>
          <div>Items</div>
          <div>Total</div>
          <div>Status</div>
          <div>Placed</div>
        </div>
        {filtered.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setSelectedId(o.id)}
            className="grid w-full grid-cols-[100px_1.2fr_60px_90px_120px_140px] items-center gap-2 border-b border-neutral-100 px-5 py-3.5 text-left last:border-0 hover:bg-neutral-50"
          >
            <div className="font-label text-sm font-semibold text-neutral-900">{o.orderNumber}</div>
            <div className="min-w-0">
              <div className="truncate text-sm text-neutral-700">{o.customerName || "—"}</div>
              <div className="truncate text-[11px] text-neutral-400">{o.customerAddress}</div>
            </div>
            <div className="text-sm text-neutral-500">{o.items.reduce((n, i) => n + i.qty, 0)}</div>
            <div className="font-label text-sm font-semibold text-neutral-900">{formatEGP(o.total)}</div>
            <div>
              <OrderStatusBadge status={o.status} />
            </div>
            <div className="text-xs text-neutral-400">
              {new Intl.DateTimeFormat("en-US", {
                timeZone: "Africa/Cairo",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }).format(new Date(o.createdAt))}
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">No orders match this search.</div>
        )}
        </div>
      </div>

      {selectedOrder && (
        <OrderDetailDrawer
          order={selectedOrder}
          onClose={() => setSelectedId(null)}
          onAdvance={handleAdvance}
          onCancel={handleCancel}
          pending={pending}
        />
      )}
    </main>
  );
}
