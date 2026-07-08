-- Recompute order pricing and decrement stock server-side. Previously
-- create_order() trusted client-supplied prices/subtotal/discount/total
-- verbatim (0006/0007) -- any signed-in caller could set arbitrary prices via
-- the RPC directly. Now the client sends only {slug, qty} pairs; every other
-- number is derived from the current products row inside this transaction,
-- and stock is decremented atomically under row locks so two concurrent
-- checkouts can't both claim the last unit.
--
-- Delivery/promo constants mirror lib/cart-totals.ts (FREE_DELIVERY_THRESHOLD
-- = 300, DELIVERY_FEE = 40, PROMO_DISCOUNT = 20) -- keep both in sync if
-- either changes. Real per-code promo validation lands in a later migration;
-- p_promo_applied is still an honesty-system boolean like the client always
-- was, but the *discount amount* it produces is now server-computed instead
-- of client-supplied.

create or replace function public.create_order(
  p_items jsonb,
  p_payment_method payment_method,
  p_shipping jsonb,
  p_promo_applied boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_items jsonb;
  v_item jsonb;
  v_product record;
  v_qty int;
  v_subtotal numeric := 0;
  v_delivery numeric;
  v_discount numeric := 0;
  v_total numeric;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required to place an order';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  -- Collapse duplicate slugs into one row per slug BEFORE any stock check.
  -- The client always sends merged quantities (cart-context's
  -- mergeItemInto), but the RPC must not trust that: without this, two rows
  -- for the same product with stock_count = 1 could each independently pass
  -- a per-row "stock_count < qty" check while jointly overselling.
  select jsonb_agg(jsonb_build_object('slug', slug, 'qty', qty))
    into v_items
    from (
      select (elem ->> 'slug') as slug, sum((elem ->> 'qty')::int) as qty
      from jsonb_array_elements(p_items) as elem
      group by elem ->> 'slug'
    ) merged;

  if v_items is null or jsonb_array_length(v_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  -- Pass 1: validate, lock the rows for the rest of the transaction, and
  -- accumulate the subtotal strictly from DB prices (never from p_items).
  for v_item in select * from jsonb_array_elements(v_items)
  loop
    v_qty := (v_item ->> 'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'Invalid quantity';
    end if;

    select id, slug, name, brand, price, stock_count
      into v_product
      from public.products
      where slug = v_item ->> 'slug'
      for update;

    if not found then
      raise exception 'Unknown product: %', v_item ->> 'slug';
    end if;

    if v_product.stock_count < v_qty then
      raise exception 'INSUFFICIENT_STOCK:%', v_product.slug;
    end if;

    v_subtotal := v_subtotal + v_product.price * v_qty;
  end loop;

  v_delivery := case when v_subtotal >= 300 then 0 else 40 end;
  v_discount := case when p_promo_applied then least(20, v_subtotal) else 0 end;
  v_total := greatest(0, v_subtotal + v_delivery - v_discount);

  v_order_number := 'EP-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));

  insert into public.orders (
    order_number, user_id, subtotal, delivery_fee, discount, total, payment_method, shipping
  )
  values (
    v_order_number, auth.uid(), v_subtotal, v_delivery, v_discount, v_total, p_payment_method, p_shipping
  )
  returning id into v_order_id;

  -- Pass 2: insert the line-item snapshot (name/brand/price frozen at order
  -- time) and decrement stock now that every item has already passed the
  -- stock check above.
  for v_item in select * from jsonb_array_elements(v_items)
  loop
    v_qty := (v_item ->> 'qty')::int;

    select id, name, brand, price
      into v_product
      from public.products
      where slug = v_item ->> 'slug';

    insert into public.order_items (order_id, product_slug, name, brand, price, qty)
    values (v_order_id, v_item ->> 'slug', v_product.name, v_product.brand, v_product.price, v_qty);

    update public.products
      set stock_count = stock_count - v_qty
      where id = v_product.id;
  end loop;

  return v_order_number;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default; lock this new overload down
-- the same way 0006/0007 locked the old one, then remove the old signature
-- entirely so the insecure client-priced RPC can no longer be called.
revoke execute on function public.create_order(jsonb, payment_method, jsonb, boolean) from public, anon;
grant execute on function public.create_order(jsonb, payment_method, jsonb, boolean) to authenticated;

drop function if exists public.create_order(jsonb, numeric, numeric, numeric, numeric, payment_method, jsonb);
