import type { Enums } from "@/lib/database.types";

export type OrderStatus = Enums<"order_status">;
export type OrderStatusTone = "primary" | "success" | "warning" | "danger";

interface OrderStatusMeta {
  label: string;
  tone: OrderStatusTone;
  next: OrderStatus | null;
  nextLabel: string | null;
}

// Maps the real 4-state order_status enum (placed/confirmed/delivered/
// cancelled) to display metadata and the admin advance-status chain.
export const ORDER_STATUS_META: Record<OrderStatus, OrderStatusMeta> = {
  placed: { label: "Placed", tone: "warning", next: "confirmed", nextLabel: "Mark as confirmed" },
  confirmed: { label: "Confirmed", tone: "primary", next: "delivered", nextLabel: "Mark as delivered" },
  delivered: { label: "Delivered", tone: "success", next: null, nextLabel: null },
  cancelled: { label: "Cancelled", tone: "danger", next: null, nextLabel: null },
};

export function canCancelOrder(status: OrderStatus): boolean {
  return status !== "delivered" && status !== "cancelled";
}
