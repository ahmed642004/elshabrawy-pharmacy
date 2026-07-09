# PLAN: Admin sales analytics (best-sellers + revenue-by-category)

**Leverage rank: 3 of 5.**

## Goal

`app/admin/page.tsx`'s Overview is KPIs + 7-day chart + low-stock + recent-orders, all derived in `computeAdminStats()` from data `getAdminOrders()`/`getAdminInventory()` **already fetch in full** (every order's line items include `slug`/`name`/`brand`/`price`/`qty`; inventory includes `categoryLabel` per product). Add two pure-aggregation derived views — a top-products list and a revenue-by-category breakdown — with **zero new queries, zero migration, zero new Supabase round-trip**.

## Current shape (verified)

- `app/admin/page.tsx:14-19`: `Promise.all([getAdminOrders(), getAdminInventory(), getNewCustomersTodayCount()])` → `computeAdminStats(orders, inventory, newCustomersToday)`. Both `orders` and `inventory` are already fully in scope in this file.
- `AdminOrderItem` (`lib/queries.ts:381-387`): `{ slug: string | null, name: string, brand: string | null, price: number, qty: number }` — `slug` is **nullable** (a deleted product's historic order line has `product_slug: null` since `order_items` snapshots by slug, not FK).
- `AdminInventoryItem` (`lib/queries.ts:513-540`) has `slug` and `categoryLabel`.
- `lib/admin-stats.ts`'s existing revenue-inclusion rule (`o.status !== "cancelled"`, already used by `weekBars`/`revenueToday`) — reuse it verbatim so the new numbers agree with the existing KPIs instead of introducing a second definition of "revenue."
- `recharts` is already a dependency (`RevenueBarChart.tsx` uses it) but a simple proportional-width-bar list (matching the existing "Needs attention" card's visual language) is cheaper and avoids a second chart config — recommended for v1.

## Exact files to touch

| File | Change |
|---|---|
| `lib/admin-stats.ts` | `BestSeller`, `CategoryRevenue` interfaces; `computeBestSellers()`, `computeCategoryRevenue()`; wire into `AdminStats`/`computeAdminStats()` |
| `components/admin/BestSellersCard.tsx` | NEW — small presentational card, mirrors `KpiCard.tsx`/existing "Needs attention" list |
| `components/admin/CategoryRevenueCard.tsx` | NEW — proportional-bar list |
| `app/admin/page.tsx` | Mount the two new cards |

No migration, no `database.types.ts` regen, no i18n (admin-only).

## Step-by-step implementation order

### Step 1 — `lib/admin-stats.ts`

```ts
export interface BestSeller {
  slug: string | null;
  name: string;
  qty: number;
  revenue: number;
}

export interface CategoryRevenue {
  categoryLabel: string;
  revenue: number;
  pct: number; // 0-100, share of total revenue across all categories
}

function computeBestSellers(orders: AdminOrder[], limit = 5): BestSeller[] {
  const byKey = new Map<string, BestSeller>();
  for (const o of orders.filter(countsForRevenue)) {
    for (const item of o.items) {
      // Group by slug when known; fall back to name for historic lines whose
      // product was later deleted (product_slug is nullable — see
      // AdminOrderItem). Using name as the fallback key avoids silently
      // merging two different deleted products that both have slug: null.
      const key = item.slug ?? `name:${item.name}`;
      const existing = byKey.get(key) ?? { slug: item.slug, name: item.name, qty: 0, revenue: 0 };
      existing.qty += item.qty;
      existing.revenue += item.price * item.qty;
      byKey.set(key, existing);
    }
  }
  return Array.from(byKey.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);
}

function computeCategoryRevenue(orders: AdminOrder[], inventory: AdminInventoryItem[]): CategoryRevenue[] {
  const slugToCategory = new Map(inventory.map((i) => [i.slug, i.categoryLabel || "Uncategorized"]));
  const byCategory = new Map<string, number>();
  let total = 0;
  for (const o of orders.filter(countsForRevenue)) {
    for (const item of o.items) {
      const label = (item.slug && slugToCategory.get(item.slug)) || "Uncategorized";
      const lineTotal = item.price * item.qty;
      byCategory.set(label, (byCategory.get(label) ?? 0) + lineTotal);
      total += lineTotal;
    }
  }
  return Array.from(byCategory.entries())
    .map(([categoryLabel, revenue]) => ({ categoryLabel, revenue, pct: total > 0 ? (revenue / total) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
}
```

Add `bestSellers: BestSeller[]` and `categoryRevenue: CategoryRevenue[]` to the `AdminStats` interface, and populate both in `computeAdminStats()`'s return object using the two functions above (all-time aggregation across every fetched order — same "not paginated, small pharmacy scale" tradeoff already documented for `getAdminOrders()`). Use the exact existing `countsForRevenue` predicate already defined in this file — don't redefine it.

### Step 2 — `components/admin/BestSellersCard.tsx`

Small `Card` (reuse `components/ui/Card.tsx`), title "Top products", ranked list `1. Name — N sold — EGP total`, linking each row to `/product/[slug]` when `slug` is non-null (plain text, no link, when null — a delisted product). Empty state: "No sales yet." (mirror the "Nothing needs attention right now." copy style from the low-stock card).

### Step 3 — `components/admin/CategoryRevenueCard.tsx`

Title "Revenue by category", each row: label + `formatEGP(revenue)` + a thin proportional-width bar (`style={{ width: \`${pct}%\` }}` on an inline div, same technique already used elsewhere for progress-style bars) + `pct.toFixed(0)}%`. Empty state matches BestSellersCard's.

### Step 4 — `app/admin/page.tsx`

Add a new `grid grid-cols-1 gap-4 md:grid-cols-2` row (matching the existing `mb-4 grid ... lg:grid-cols-[1.4fr_1fr]` pattern already used for the revenue-chart/needs-attention pair) below the "Recent orders" card, mounting `<BestSellersCard items={stats.bestSellers} />` and `<CategoryRevenueCard items={stats.categoryRevenue} />`.

## Edge cases a weaker model would miss

- **Reuse `countsForRevenue`, don't reinvent it**: a second ad-hoc "exclude cancelled" check that drifts from the existing one would make the new cards disagree with `revenueToday`/`weekBars` on the same page — confusing for the pharmacist.
- **`item.slug` is nullable**: `AdminOrderItem.slug` can be `null` for a since-deleted product's historic line — grouping key must fall back to name, and the UI must render plain text (not a broken `/product/null` link) for those rows.
- **Category lookup must go through `slug`, not `name`/`brand`** — `order_items` has no `category_id`; the only reliable join key back to a product's current category is the slug, via the inventory list already in scope. A product that changed category after the order was placed will attribute historically to its **current** category (acceptable simplification for v1 — no `category_id` snapshot exists in `order_items` to do otherwise; note this as a known limitation, not a bug).
- **Products removed from inventory entirely**: their slug won't be in `slugToCategory` → falls into "Uncategorized" bucket, not silently dropped from the total (dropping them would make revenue-by-category sum to less than total revenue, which is a worse bug than an "Uncategorized" bucket).
- **All-time window, not 7-day**: intentionally different scope from `weekBars` — label the cards clearly ("Top products" without a date qualifier implies all-time; a 7-day-scoped version is a fast follow-up, not this plan's job) so there's no ambiguity about what's being measured.
- **No new Supabase round-trip**: both `orders` and `inventory` are function parameters already flowing through `computeAdminStats()` — resist the urge to add a third `getAdminInventory()`-like fetch "for categories," it's already there.

## Acceptance criteria

1. `/admin` shows two new cards ("Top products", "Revenue by category") below Recent orders, matching the existing card visual language.
2. Top products list sums quantities across multiple orders for the same product correctly (verify: place 2 orders containing the same product, confirm combined qty).
3. A cancelled order's items do not appear in either card's totals (verify by cancelling a placed order and confirming both cards' numbers shrink accordingly).
4. Revenue-by-category percentages sum to ~100% across all rows.
5. A historic order line for a since-deleted product renders in "Top products" as plain (non-linked) text and buckets into "Uncategorized" in the category card, without erroring.
6. `npx tsc --noEmit` and `npm run lint` clean; no new network request appears in the Network tab for `/admin` beyond what already loads today.
