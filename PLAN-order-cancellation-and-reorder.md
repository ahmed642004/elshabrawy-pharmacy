# PLAN: Order cancellation (stock-restoring) + Reorder

**Leverage rank: 1 of 5 — do this first.**

## Goal

Three deliverables, in priority order:

1. **Fix a live inventory-corruption bug**: `create_order()` (migration 0015/0016) decrements `products.stock_count` when an order is placed, but cancelling an order (admin, via `updateOrderStatus` in `lib/actions.ts:193`) is a bare `orders.update({ status })` — the stock is never returned. Every admin cancellation today permanently loses sellable inventory.
2. **Customer self-cancel**: customers can cancel their own order while it is still `placed` (not yet confirmed), from `/account/orders`.
3. **Reorder button**: one click on a past order refills the cart with the still-available items at **current** prices.

## Exact files to touch

| File | Change |
|---|---|
| `supabase/migrations/0022_cancel_order_restore_stock.sql` | NEW — `cancel_order()` RPC |
| `lib/database.types.ts` | Regenerate via Supabase MCP `generate_typescript_types` after migration |
| `lib/actions.ts` | Add `cancelOrderAdmin`, `cancelMyOrder`, `getReorderItems`; guard `updateOrderStatus` against `"cancelled"` |
| `lib/queries.ts` | Add `product_slug` to `ORDER_SELECT_WITH_ITEMS` and `slug` to `AdminOrderItem` |
| `components/admin/OrdersClient.tsx` | Route its cancel path through `cancelOrderAdmin` |
| `components/account/OrderHistoryClient.tsx` | Cancel button (placed only) + Reorder button |
| `messages/en.json` + `messages/ar.json` | New `account.*` keys (keep parity) |

## Step-by-step implementation order

### Step 1 — Migration `0022_cancel_order_restore_stock.sql`

Apply via Supabase MCP `apply_migration` (project `gjwkuhbhhueoxkmhoyrm`) AND save the identical SQL to `supabase/migrations/0022_cancel_order_restore_stock.sql`.

```sql
-- Cancel an order and return its decremented stock.
-- Callable by: the order owner (only while status = 'placed'),
-- or an admin (while status in ('placed','confirmed') — mirrors canCancelOrder).
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_is_admin boolean;
begin
  -- Row lock: a concurrent second cancel waits here, then fails the status
  -- re-check below instead of restoring stock twice.
  select id, user_id, status into v_order
  from public.orders
  where id = p_order_id
  for update;

  if v_order.id is null then
    raise exception 'CANCEL_NOT_FOUND';
  end if;

  v_is_admin := public.is_admin();

  if v_is_admin then
    if v_order.status not in ('placed', 'confirmed') then
      raise exception 'CANCEL_NOT_ALLOWED';
    end if;
  else
    if v_order.user_id is distinct from auth.uid() then
      raise exception 'CANCEL_NOT_ALLOWED';
    end if;
    if v_order.status <> 'placed' then
      raise exception 'CANCEL_NOT_ALLOWED';
    end if;
  end if;

  -- Restore stock. Join on slug (slugs are immutable; a since-deleted product
  -- simply matches nothing, which is the graceful outcome). The 0010 trigger
  -- trg_sync_product_stock_state re-derives the in/low/out badge automatically.
  update public.products p
  set stock_count = p.stock_count + oi.qty
  from public.order_items oi
  where oi.order_id = p_order_id
    and p.slug = oi.product_slug;

  update public.orders set status = 'cancelled' where id = p_order_id;
end;
$$;

revoke execute on function public.cancel_order(uuid) from public, anon;
grant execute on function public.cancel_order(uuid) to authenticated;
```

### Step 2 — Regenerate `lib/database.types.ts`

Supabase MCP `generate_typescript_types`, overwrite the file. Confirm `cancel_order` appears under `Functions`.

### Step 3 — `lib/actions.ts`

Follow the existing error convention (see comment near the top of the file): PostgrestError objects are redacted crossing the server-action boundary, so always re-throw a plain `Error` with a short code.

```ts
export async function cancelOrderAdmin(orderId: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId });
  if (error) throw new Error("CANCEL_FAILED");
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
}

export async function cancelMyOrder(orderId: string): Promise<void> {
  // No assertAdmin — the RPC enforces ownership + status internally.
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId });
  if (error) throw new Error("CANCEL_FAILED");
  revalidatePath("/account/orders");
}

export interface ReorderItem {
  slug: string;
  name: string;
  brand: string;
  price: number;
  stock: "in" | "low" | "out";
  imageUrl: string | null;
}

// Current catalog state for a list of slugs. Order snapshots are stale
// (prices change, products get delisted), and cart-context persists price
// into localStorage + the server cart, so reorder MUST use live data.
export async function getReorderItems(slugs: string[]): Promise<ReorderItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("slug, name, brand, price, stock, product_images(url, position)")
    .in("slug", slugs.slice(0, 50));
  if (error || !data) return [];
  // map to ReorderItem; imageUrl = lowest-position image or null; Number(price)
}
```

Also harden the old path so the unguarded cancel can never come back:

```ts
export async function updateOrderStatus(orderId: string, newStatus: Enums<"order_status">): Promise<void> {
  await assertAdmin();
  // Cancellation must go through cancel_order() so stock is restored.
  if (newStatus === "cancelled") throw new Error("USE_CANCEL_ORDER");
  ...
```

### Step 4 — `lib/queries.ts`

- In `ORDER_SELECT_WITH_ITEMS` add `product_slug` to the `order_items(...)` embed.
- In `AdminOrderItem` add `slug: string;` and map it in the row mapper. This interface is shared by admin AND customer order views — the addition is additive and safe.

### Step 5 — `components/admin/OrdersClient.tsx`

Find where cancel currently calls `updateOrderStatus(id, "cancelled")` (check `OrderDetailDrawer.tsx` too — the drawer has a cancel path gated by `canCancelOrder` from `lib/order-status.ts`). Replace that call with `cancelOrderAdmin(id)`. Keep the existing pending/`useTransition` pattern.

### Step 6 — `components/account/OrderHistoryClient.tsx`

- **Cancel**: render a Cancel button only when `order.status === "placed"`. Use a two-tap inline confirm (first tap flips the button to a "confirm cancel?" state, second tap fires; a click elsewhere or 4s timeout resets) — there is no confirm-dialog component in this repo. On confirm: `useTransition` → `await cancelMyOrder(order.id)` → `router.refresh()` (props come from the server page; refresh re-renders with the new status). On error, show `t("account.cancelFailed")` inline.
- **Reorder**: render on `delivered` and `cancelled` orders. On click:
  1. `const live = await getReorderItems(order.items.map(i => i.slug))`
  2. For each live item with `stock !== "out"`, call `addItem(...)` from `useCart()` with the original order qty (the cart context merges quantities into existing lines).
  3. Toast a summary via `useToast`: `t("account.reorderAdded", { count })`, and if any items were missing/out-of-stock, append `t("account.reorderSkipped", { count })`.
  4. `router.push("/cart")`.

### Step 7 — i18n keys (both files, same keys)

`account.cancelOrder`, `account.cancelConfirm`, `account.cancelFailed`, `account.reorder`, `account.reorderAdded` (ICU plural with `{count}`), `account.reorderSkipped` (ICU plural with `{count}`). Translate naturally into Arabic in `ar.json` — do not leave English values there. Match the existing ICU plural style used by `account.itemCount`.

## Edge cases a weaker model would miss

- **Double-restore race**: two cancel clicks, or admin + customer cancelling simultaneously. The `for update` row lock plus re-checking `status` inside the lock means the second caller raises `CANCEL_NOT_ALLOWED` instead of restoring stock twice. Do not move the status check outside the locked select.
- **Admin vs customer windows differ**: admin may cancel `placed` and `confirmed` (mirrors `canCancelOrder` in `lib/order-status.ts:22`); customers only `placed`. Both rules live inside the ONE RPC — never trust client-side checks alone.
- **Error redaction**: raw PostgrestError messages become a generic string on the client. Re-throw plain `Error("CANCEL_FAILED")` etc. — this is the documented repo convention in `lib/actions.ts` (see the `INSUFFICIENT_STOCK` mapping in `createOrder`).
- **Deleted products on restore**: the slug join silently skips products that no longer exist — correct behavior, no error.
- **Stock badge**: do NOT manually update `products.stock`; the 0010 trigger derives it from `stock_count`.
- **Reorder prices**: must come from `getReorderItems` (live), never from `order.items` (snapshot) — stale prices would poison localStorage and the server-synced cart via `replace_cart`.
- **Reorder merging**: `addItem` merges qty into an existing cart line rather than replacing — acceptable; reflect this in toast copy ("added to cart").
- **RTL**: any new button rows must use logical spacing (`ms-`/`me-`, `gap`) — no `ml-`/`mr-`.
- **Next 16**: any new server code touching `params`/`searchParams` must `await` them (not expected here, but the account page is dynamic).

## Acceptance criteria

1. Note a product's `stock_count`; place an order for qty 2; `stock_count` drops by 2; admin cancels the order from `/admin/orders` → `stock_count` returns to the original value and the in/low/out badge updates.
2. Customer sees a Cancel button ONLY on `placed` orders; cancelling flips the timeline to cancelled and restores stock (verify via SQL).
3. Calling `cancel_order` via RPC as a different (non-admin) user, or on a `delivered` order, raises an error — no status change, no stock change.
4. Rapid double-click on Cancel does not double-restore stock (verify `stock_count` via SQL).
5. Reorder on an old order adds only still-existing, in-stock products at CURRENT prices; a toast reports how many were added/skipped; the cart page shows them.
6. `updateOrderStatus(id, "cancelled")` now throws; no call site passes `"cancelled"` to it anymore.
7. `npx tsc --noEmit` and `npm run lint` are clean; both message files stay in key parity.
