import OrdersClient from "@/components/admin/OrdersClient";
import { getAdminOrders } from "@/lib/queries";

export default async function AdminOrdersPage() {
  const orders = await getAdminOrders();
  return <OrdersClient orders={orders} />;
}
