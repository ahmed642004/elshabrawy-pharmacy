# PLAN: Server-side order pricing + atomic stock decrement

## Goal

`create_order()` currently **trusts every number the client sends** — item prices, subtotal, discount, and total all arrive as RPC parameters ([lib/actions.ts:22-30](lib/actions.ts), `supabase/migrations/0006_require_auth_for_checkout.sql`). Any signed-in user can craft a request and buy the whole catalog for EGP 1. It also **never decrements stock**, so overselling is silent. Fix: recompute all money server-side from the `products` table and decrement stock atomically in the same transaction.

## Files to touch

1. `supabase/migrations/0015_secure_create_order.sql` (new)
2. `lib/actions.ts` — `placeOrder` (top of file, ~lines 10-34)
3. `components/checkout/CheckoutClient.tsx` — the `placeOrder` call site (search `placeOrder(`)
4. `lib/database.types.ts` — regenerate after migration
5. `messages/en.json` + `messages/ar.json` — new checkout error keys
6. `CLAUDE.md` — update the "Checkout" bullet

## Implementation order

### Step 1 — Migration `0015_secure_create_order.sql`

Replace `create_order` with a version that takes only what the server can't know:

```sql
create or replace function public.create_order(
  p_items jsonb,            -- [{slug, qty}] — ONLY slug + qty now
  p_payment_method payment_method,
  p_shipping jsonb,
  p_promo_applied boolean default false
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid; v_order_number text; v_item jsonb;
  v_product record; v_qty int;
  v_subtotal numeric := 0; v_delivery numeric; v_discount numeric := 0; v_line numeric;
begin
  if auth.uid() is null then raise exception 'Sign in is required to place an order'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;

  -- First pass: validate + lock + accumulate subtotal from DB prices.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 99 then raise exception 'Invalid quantity'; end if;
    select id, slug, name, brand, price, stock_count into v_product
      from public.products where slug = v_item->>'slug' for update;
    if not found then raise exception 'Unknown product: %', v_item->>'slug'; end if;
    if v_product.stock_count < v_qty then
      raise exception 'INSUFFICIENT_STOCK:%', v_product.slug;
    end if;
    v_subtotal := v_subtotal + v_product.price * v_qty;
  end loop;

  -- Mirrors lib/cart-totals.ts (FREE_DELIVERY_THRESHOLD=300, DELIVERY_FEE=40,
  -- PROMO_DISCOUNT=20). If you change one, change the other.
  v_delivery := case when v_subtotal >= 300 then 0 else 40 end;
  v_discount := case when p_promo_applied then least(20, v_subtotal) else 0 end;

  v_order_number := 'EP-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
  -- insert into orders (copy the existing column list from 0006, but use
  -- v_subtotal / v_delivery / v_discount / v_subtotal+v_delivery-v_discount)
  -- Second pass: insert order_items with the DB price snapshot AND decrement:
  --   update public.products set stock_count = stock_count - qty where id = ...
  ...
  return v_order_number;
end $$;
```

Then (copy the pattern from `0007_revoke_create_order_from_public.sql`):

```sql
revoke execute on function public.create_order(jsonb, payment_method, jsonb, boolean) from public, anon;
grant execute on function public.create_order(jsonb, payment_method, jsonb, boolean) to authenticated;
-- Drop the OLD 7-parameter overload — otherwise both signatures coexist and
-- the insecure one remains callable:
drop function if exists public.create_order(jsonb, numeric, numeric, numeric, numeric, payment_method, jsonb);
```

Apply via Supabase MCP `apply_migration` (no local CLI — see CLAUDE.md), then `generate_typescript_types` → overwrite `lib/database.types.ts`.

### Step 2 — `lib/actions.ts`

Shrink `PlaceOrderInput` to `{ items: {slug, qty}[], paymentMethod, shipping, promoApplied }`. Map only slug+qty into `p_items`. Delete the subtotal/fee/discount/total params.

### Step 3 — `components/checkout/CheckoutClient.tsx`

Update the call site to stop passing totals. The on-screen totals (from `getCartTotals`) remain display-only. Catch errors: if `error.message` contains `INSUFFICIENT_STOCK`, show `t("errors.outOfStock")` in the existing `orderError` banner; otherwise keep the generic message.

### Step 4 — i18n

Add to `checkout.errors` in **both** `messages/en.json` and `messages/ar.json` (keep key parity):
- `outOfStock`: en "Some items in your cart are no longer in stock. Please review your cart." / ar "بعض المنتجات في سلتك لم تعد متوفرة. راجع سلتك من فضلك."

## Edge cases a weaker model would miss

- **PostgreSQL function overloading**: `create or replace` with a different signature creates a SECOND function. You must `drop` the old 7-arg version or the exploit remains live.
- **`for update` row locks** are what make concurrent checkouts of the last unit safe. Without them, two simultaneous orders both pass the stock check.
- **Two-pass loop**: lock/validate everything before inserting anything, so a failure on item 3 doesn't leave items 1-2 decremented (the whole function is one transaction, but raising after partial inserts still burns an order_number and relies on rollback — the two-pass shape keeps it clean).
- Client cart prices can be stale (admin repriced mid-session). The server price wins silently — the order totals shown on the confirmation screen come from the server flow (`/account/orders` reads DB rows), so nothing extra to do, but do NOT try to "verify" client price equality and reject — that just breaks checkout after any repricing.
- `order_items.product_slug` is the join key (there's no product_id column) — keep writing the slug snapshot.
- `stock_count` reaching 0 must flow into the storefront stock badge; `lib/queries.ts` already derives `stock` from `stock_count`/`low_stock_threshold`, so no UI change needed — verify, don't rebuild.
- Cart context is NOT cleared on failure — only call `clearCart()` after a successful RPC (check existing behavior in CheckoutClient and preserve it).

## Acceptance criteria

1. `npx tsc --noEmit` and `npm run lint` pass.
2. Place a normal order in the preview browser (signed in): order succeeds, order appears in `/account/orders` with correct totals, and the product's `stock_count` in `/admin/inventory` dropped by the ordered qty.
3. Free delivery boundary: cart subtotal ≥ EGP 300 → delivery 0; below → 40 (verify on the confirmation totals for one order each side).
4. Set a product's stock to 1 in admin, order qty 2 → checkout shows the out-of-stock error banner (in Arabic under the ar locale), no order row created, stock unchanged.
5. Call the RPC directly with only `{slug, qty}` — confirm you cannot influence price (there is no price parameter to send anymore).
6. `select proname, pronargs from pg_proc where proname = 'create_order'` returns exactly ONE row (4 args).
