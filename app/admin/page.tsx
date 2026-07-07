import Link from "next/link";
import { Wallet, Package, Users, AlertTriangle, Plus, ChevronRight } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import KpiCard from "@/components/admin/KpiCard";
import RevenueBarChart from "@/components/admin/RevenueBarChart";
import OrderStatusBadge from "@/components/admin/OrderStatusBadge";
import { getAdminOrders, getAdminInventory, getNewCustomersTodayCount } from "@/lib/queries";
import { computeAdminStats } from "@/lib/admin-stats";
import { formatEGP } from "@/lib/cart-totals";

export default async function AdminOverviewPage() {
  const [orders, inventory, newCustomersToday] = await Promise.all([
    getAdminOrders(),
    getAdminInventory(),
    getNewCustomersTodayCount(),
  ]);
  const stats = computeAdminStats(orders, inventory, newCustomersToday);

  const today = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const revenueDelta =
    stats.revenueDeltaPct === null
      ? "—"
      : `${stats.revenueDeltaPct >= 0 ? "+" : ""}${stats.revenueDeltaPct.toFixed(1)}%`;
  const ordersDelta = `${stats.ordersDelta >= 0 ? "+" : ""}${stats.ordersDelta}`;

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-5 md:px-10 md:py-8">
      <div className="mb-5 flex flex-col gap-3 md:mb-7 md:flex-row md:items-start md:justify-between md:gap-4">
        <div>
          <h1 className="m-0 font-headline text-2xl font-extrabold tracking-tight text-neutral-900 md:text-3xl">
            Good morning, Dr. Hend
          </h1>
          <p className="m-0 mt-1 text-sm text-neutral-500">{today} · here&apos;s how the pharmacy is doing today</p>
        </div>
        <Link href="/admin/inventory?add=1" className="self-start">
          <Button variant="primary" size="md">
            <Plus className="h-4 w-4" strokeWidth={2} /> Add item
          </Button>
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:mb-6 md:grid-cols-4 md:gap-4">
        <KpiCard
          label="Revenue today"
          value={formatEGP(stats.revenueToday)}
          icon={Wallet}
          iconBg="bg-primary-50"
          iconColor="text-primary-600"
          delta={revenueDelta}
          deltaLabel={stats.revenueDeltaPct === null ? "no sales yesterday" : "vs yesterday"}
          deltaTone={stats.revenueDeltaPct !== null && stats.revenueDeltaPct < 0 ? "danger" : "success"}
        />
        <KpiCard
          label="Orders today"
          value={String(stats.ordersToday)}
          icon={Package}
          iconBg="bg-secondary-50"
          iconColor="text-secondary-600"
          delta={ordersDelta}
          deltaLabel="vs yesterday"
          deltaTone={stats.ordersDelta < 0 ? "danger" : "success"}
        />
        <KpiCard
          label="New customers"
          value={String(stats.newCustomersToday)}
          icon={Users}
          iconBg="bg-tertiary-200"
          iconColor="text-primary-600"
          delta="Today"
          deltaLabel="signups"
          deltaTone="success"
        />
        <KpiCard
          label="Low stock alerts"
          value={String(stats.lowStockCount)}
          icon={AlertTriangle}
          iconBg="bg-danger-50"
          iconColor="text-danger-500"
          delta={stats.lowStockCount > 0 ? "Reorder" : "OK"}
          deltaLabel="suggested"
          deltaTone={stats.lowStockCount > 0 ? "danger" : "success"}
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:mb-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="font-headline text-lg font-bold text-neutral-900">Revenue, last 7 days</div>
              <div className="text-xs text-neutral-500">EGP, daily total</div>
            </div>
          </div>
          <RevenueBarChart bars={stats.weekBars} />
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div className="font-headline text-lg font-bold text-neutral-900">Needs attention</div>
            <Badge tone="danger">{stats.lowStockCount} low stock</Badge>
          </div>
          <div className="flex flex-col gap-0.5">
            {stats.lowStockItems.length === 0 && (
              <div className="py-6 text-center text-sm text-neutral-400">Nothing needs attention right now.</div>
            )}
            {stats.lowStockItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border-b border-neutral-100 py-2.5 last:border-0"
              >
                <div className="min-w-0">
                  <div className="truncate font-label text-sm font-semibold text-neutral-900">{item.name}</div>
                  <div className="text-[11px] text-neutral-400">{item.sku}</div>
                </div>
                <div className="ml-2 shrink-0 font-label text-sm font-bold text-danger-600">
                  {item.stockCount} left
                </div>
              </div>
            ))}
          </div>
          <Link
            href="/admin/inventory"
            className="mt-3 flex items-center gap-1 font-label text-sm font-semibold text-primary-600"
          >
            Review inventory <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
          </Link>
        </Card>
      </div>

      <Card padding={false}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="font-headline text-lg font-bold text-neutral-900">Recent orders</div>
          <Link href="/admin/orders" className="flex items-center gap-1 font-label text-sm font-semibold text-primary-600">
            View all <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
          </Link>
        </div>
        <div className="overflow-x-auto">
        <div className="min-w-[720px]">
        <div className="grid grid-cols-[100px_1.3fr_70px_90px_110px_1fr] gap-2 border-b border-neutral-100 px-5 pb-2.5 font-label text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
          <div>Order</div>
          <div>Customer</div>
          <div>Items</div>
          <div>Total</div>
          <div>Status</div>
          <div>Placed</div>
        </div>
        {stats.recentOrders.map((o) => (
          <Link
            key={o.id}
            href="/admin/orders"
            className="grid grid-cols-[100px_1.3fr_70px_90px_110px_1fr] items-center gap-2 border-b border-neutral-100 px-5 py-3 last:border-0 hover:bg-neutral-50"
          >
            <div className="font-label text-sm font-semibold text-neutral-900">{o.orderNumber}</div>
            <div className="truncate text-sm text-neutral-700">{o.customerName || "—"}</div>
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
          </Link>
        ))}
        {stats.recentOrders.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">No orders yet.</div>
        )}
        </div>
        </div>
      </Card>
    </main>
  );
}
