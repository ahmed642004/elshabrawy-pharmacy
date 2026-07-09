# PLAN: Admin customers directory

**New-batch rank: 5 of 5 (rounds out the admin into a real back office — who buys, how often, how much).**

## Goal

The admin has orders, inventory, promos (and soon reviews/categories) — but **no view of customers at all**: `profiles` is invisible to staff, there's no way to look up "who is this order's customer, how often do they buy, what's their history." Build `/admin/customers`: a directory of every registered customer with contact info, order count, lifetime spend, last-order date, and a per-customer expansion listing their orders.

## Current shape (verified)

- `profiles`: `id (=auth.users.id), full_name, phone, created_at` + `is_admin` (0009). RLS in 0001 is **owner-only** on all verbs; 0009 must be checked for an admin read-all policy (`getNewCustomersTodayCount()` in `lib/queries.ts` counts profiles from an admin session — if that returns real numbers today, an admin SELECT policy exists; verify via `pg_policies` and do NOT assume).
- **Email lives in `auth.users`, not `profiles`** — unreachable through PostgREST no matter the RLS. Getting email requires a SECURITY DEFINER RPC (the established pattern: `get_pending_reviews()` in 0021, hardened per 0011: `security definer`, `set search_path = public`, internal `is_admin()` gate, `revoke from public/anon`, `grant to authenticated`).
- Orders: `orders.user_id` (nullable — legacy/guest rows), `total`, `status`, `created_at`. The revenue rule everywhere else excludes cancelled orders (`lib/admin-stats.ts`'s `countsForRevenue`) — reuse the same definition for lifetime spend.
- Admin UI patterns to copy: `app/admin/promos/page.tsx` + `components/admin/PromosClient.tsx` (page/loading/client trio), `AdminSidebar.tsx` `NAV_ITEMS` array, `formatEGP` from `lib/cart-totals.ts`.
- `getAdminOrders()` already returns every order with items — the per-customer expansion can reuse it client-side (small scale) or fetch per-customer; prefer the RPC returning aggregates + reusing `getAdminOrders()` filtered client-side for the expansion (zero new order queries).

## Exact files to touch

| File | Change |
|---|---|
| `supabase/migrations/00XX_admin_customers.sql` | NEW — `get_admin_customers()` RPC (+ admin profiles SELECT policy only if missing) |
| `lib/database.types.ts` | Regenerate |
| `lib/queries.ts` | `AdminCustomer` interface + `getAdminCustomers()` |
| `app/admin/customers/page.tsx` + `loading.tsx` | NEW — server page (fetch customers + orders in `Promise.all`) |
| `components/admin/CustomersClient.tsx` | NEW — table + search filter + expandable order history |
| `components/admin/AdminSidebar.tsx` | Nav item `{ href: "/admin/customers", label: "Customers", icon: Users }` |

No i18n (admin is English/LTR).

## Step-by-step implementation order

### Step 1 — Migration: `get_admin_customers()`

```sql
-- Staff-only customer directory. SECURITY DEFINER because customer emails
-- live in auth.users, which PostgREST can never expose; the is_admin() gate
-- inside the function is the authorization boundary (0011 convention).
create or replace function public.get_admin_customers()
returns table (
  id uuid,
  email text,
  full_name text,
  phone text,
  joined_at timestamptz,
  order_count bigint,
  lifetime_spend numeric,
  last_order_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    u.email::text,
    p.full_name,
    p.phone,
    p.created_at,
    count(o.id) filter (where o.status <> 'cancelled'),
    coalesce(sum(o.total) filter (where o.status <> 'cancelled'), 0),
    max(o.created_at) filter (where o.status <> 'cancelled')
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.orders o on o.user_id = p.id
  where public.is_admin()
    and p.is_admin = false  -- staff accounts aren't customers
  group by p.id, u.email, p.full_name, p.phone, p.created_at
  order by max(o.created_at) desc nulls last, p.created_at desc;
$$;

revoke all on function public.get_admin_customers() from public, anon;
grant execute on function public.get_admin_customers() to authenticated;
```

Note the gate style: `where public.is_admin()` makes the function return **zero rows** for non-admins rather than raising — consistent with `get_pending_reviews()`. (Either style works; pick the existing one.)

Check `pg_policies` for an admin SELECT policy on `profiles`; this plan doesn't strictly need one (the RPC bypasses RLS), so only add it if some existing admin feature already relies on it being missing/broken — otherwise leave RLS untouched.

### Step 2 — Regenerate `lib/database.types.ts` via MCP.

### Step 3 — `lib/queries.ts`

```ts
export interface AdminCustomer {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  joinedAt: string;
  orderCount: number;
  lifetimeSpend: number;
  lastOrderAt: string | null;
}

export async function getAdminCustomers(): Promise<AdminCustomer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_customers");
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    phone: r.phone,
    joinedAt: r.joined_at,
    orderCount: Number(r.order_count),      // PostgREST numerics arrive as strings
    lifetimeSpend: Number(r.lifetime_spend),
    lastOrderAt: r.last_order_at,
  }));
}
```

### Step 4 — Page

```tsx
export default async function AdminCustomersPage() {
  const [customers, orders] = await Promise.all([getAdminCustomers(), getAdminOrders()]);
  return <CustomersClient customers={customers} orders={orders} />;
}
```

`loading.tsx`: copy the inventory skeleton.

### Step 5 — `components/admin/CustomersClient.tsx`

- Header: title + a plain client-side text filter (name/email/phone `includes`, case-insensitive) — no server round-trip, list is small.
- Table columns: **Customer** (full name, email under it in neutral-500), **Phone** (or "—"), **Joined** (date), **Orders** (count), **Lifetime spend** (`formatEGP`), **Last order** (relative or date).
- Row click toggles an expansion panel listing that customer's orders (filter the `orders` prop by `order.userId ?? never-matches` — see edge case below), each row: order number, date, status badge (reuse `OrderStatusBadge`), total. Link each to `/admin/orders` (no per-order deep link exists; don't invent one).
- Empty state: "No customers yet."

### Step 6 — Sidebar

Add `{ href: "/admin/customers", label: "Customers", icon: Users }` to `NAV_ITEMS` (single shared array drives mobile + desktop).

## Edge cases a weaker model would miss

- **`AdminOrder` may not carry `user_id` today** — check `toAdminOrder()`/`ORDER_SELECT_WITH_ITEMS` in `lib/queries.ts`; if `user_id` isn't selected/mapped, add `userId: string | null` to the mapper (RLS: admin read-all on orders already covers it, verified in Step 1 checks). Without this the expansion panel can't match orders to customers.
- **Guest/legacy orders have `user_id = null`** (`on delete set null` FK) — they belong to no customer; the expansion filter must be `o.userId === customer.id` (null never matches), and lifetime totals from the RPC already exclude them naturally via the join.
- **Cancelled orders excluded from count/spend/last-order but still shown in the expansion list** (with their status badge) — the aggregates answer "how valuable is this customer", the list answers "what happened"; don't silently hide cancellations from history.
- **`filter (where ...)` on every aggregate, not a `where o.status <> 'cancelled'` in the join** — a WHERE would also drop customers whose only orders were cancelled from having correct zero-aggregates… actually it would drop the rows before grouping; the `left join` + `filter` combination keeps every customer with sensible zeros. This is exactly the distinction a weaker model flattens.
- **`count(o.id)` not `count(*)`** — `count(*)` counts the customer row itself even when the left join found no orders (would show 1 order for order-less customers).
- **Emails are PII**: they appear only inside `/admin/*` (layout-gated) and come only from the `is_admin()`-gated RPC — never add them to any storefront-reachable query. State this in the code comment on the RPC.
- **PostgREST returns `bigint`/`numeric` as strings** — `Number()` in the mapper (the repo hits this repeatedly).
- **Staff accounts filtered out** (`p.is_admin = false`) — the QA/admin accounts placing test orders would otherwise pollute the customer list; note that flipping a customer to admin hides them here (fine).

## Acceptance criteria

1. `/admin/customers` lists every non-admin registered account with correct email (cross-check one against `auth.users` via SQL), order count, lifetime spend matching the sum of their non-cancelled order totals (verify one customer via SQL), and last-order date.
2. A customer with only cancelled orders shows count 0 / spend EGP 0, but their cancelled orders still appear in the expansion.
3. The text filter narrows by partial name AND by email fragment.
4. Row expansion lists that customer's orders with correct status badges; guest orders (null user) appear under no customer.
5. As a non-admin: `/admin/customers` unreachable (layout gate) and calling `get_admin_customers()` via REST with a customer JWT returns zero rows.
6. `npx tsc --noEmit` and `npm run lint` clean.
