import type { AdminInventoryItem, AdminOrder } from "@/lib/queries";

const CAIRO_TZ = "Africa/Cairo";

// Formats a Date as its Africa/Cairo calendar date ("YYYY-MM-DD" via the
// en-CA locale) — used to bucket orders/customers by the pharmacy's local
// day rather than the server's, without manual timezone-offset math.
export function cairoDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CAIRO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Walks back N calendar days from a "YYYY-MM-DD" key using UTC date
// arithmetic (Date.UTC rolls months/years for us). Deliberately not done by
// subtracting 24h chunks of milliseconds from `now`: Egypt observes DST, so
// a fixed-milliseconds walk can skip or repeat a Cairo calendar day across a
// transition. A UTC-midnight anchor has no DST, so day arithmetic is exact.
function shiftDateKey(key: string, days: number): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days));
}

// The shifted dates are UTC-midnight anchors of pure calendar dates, so both
// the key and the weekday label must be read back in UTC, not Cairo time.
const utcDateKey = (date: Date) => date.toISOString().slice(0, 10);
const utcWeekdayFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });

export interface WeekBar {
  label: string;
  value: number;
}

export interface AdminStats {
  revenueToday: number;
  // Percent change vs yesterday's revenue; null when yesterday had no
  // revenue to compare against (avoids a divide-by-zero "+Infinity%").
  revenueDeltaPct: number | null;
  ordersToday: number;
  ordersDelta: number;
  newCustomersToday: number;
  lowStockCount: number;
  lowStockItems: AdminInventoryItem[];
  weekBars: WeekBar[];
  recentOrders: AdminOrder[];
}

const countsForRevenue = (o: AdminOrder) => o.status !== "cancelled";
const revenueOf = (orders: AdminOrder[]) =>
  orders.filter(countsForRevenue).reduce((sum, o) => sum + o.total, 0);

// Derives all Overview KPIs from already-fetched data rather than storing
// them, mirroring lib/cart-totals.ts's getCartTotals().
export function computeAdminStats(
  orders: AdminOrder[],
  inventory: AdminInventoryItem[],
  newCustomersToday: number
): AdminStats {
  const todayKey = cairoDateKey(new Date());
  const yesterdayKey = utcDateKey(shiftDateKey(todayKey, -1));

  const ordersToday = orders.filter((o) => cairoDateKey(new Date(o.createdAt)) === todayKey);
  const ordersYesterday = orders.filter((o) => cairoDateKey(new Date(o.createdAt)) === yesterdayKey);

  const revenueToday = revenueOf(ordersToday);
  const revenueYesterday = revenueOf(ordersYesterday);
  const revenueDeltaPct =
    revenueYesterday > 0 ? ((revenueToday - revenueYesterday) / revenueYesterday) * 100 : null;

  const lowStockItems = inventory
    .filter((i) => i.stockCount <= i.lowStockThreshold)
    .sort((a, b) => a.stockCount - a.lowStockThreshold - (b.stockCount - b.lowStockThreshold));

  const weekBars: WeekBar[] = Array.from({ length: 7 }, (_, i) => {
    const date = shiftDateKey(todayKey, -(6 - i));
    const key = utcDateKey(date);
    const value = revenueOf(orders.filter((o) => cairoDateKey(new Date(o.createdAt)) === key));
    return { label: utcWeekdayFormat.format(date), value };
  });

  return {
    revenueToday,
    revenueDeltaPct,
    ordersToday: ordersToday.length,
    ordersDelta: ordersToday.length - ordersYesterday.length,
    newCustomersToday,
    lowStockCount: lowStockItems.length,
    lowStockItems: lowStockItems.slice(0, 4),
    weekBars,
    recentOrders: orders.slice(0, 5),
  };
}
