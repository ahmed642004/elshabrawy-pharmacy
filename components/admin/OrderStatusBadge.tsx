import Badge from "@/components/ui/Badge";
import { ORDER_STATUS_META, type OrderStatus } from "@/lib/order-status";

export default function OrderStatusBadge({
  status,
  variant = "soft",
}: {
  status: OrderStatus;
  variant?: "soft" | "solid";
}) {
  const meta = ORDER_STATUS_META[status];
  return (
    <Badge tone={meta.tone} variant={variant}>
      {meta.label}
    </Badge>
  );
}
