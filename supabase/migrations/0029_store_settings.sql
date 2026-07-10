-- Configurable delivery rule. The free-delivery threshold (and the flat
-- delivery fee) were hardcoded as 300/40 in BOTH create_order() and the
-- TypeScript cart math (lib/cart-totals.ts) — a store owner couldn't change
-- them without a code change. They now live in a single-row settings table
-- that create_order() reads server-side (authoritative for order totals) and
-- the storefront reads for display, so the two can never disagree.

-- Singleton: `id boolean primary key check (id)` allows only the value true,
-- so at most one row ever exists. No delete/insert is exposed; the row is
-- seeded here and only ever updated.
create table public.store_settings (
  id boolean primary key default true check (id),
  free_delivery_threshold numeric(10,2) not null default 300 check (free_delivery_threshold >= 0),
  delivery_fee numeric(10,2) not null default 40 check (delivery_fee >= 0),
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id) values (true);

alter table public.store_settings enable row level security;

-- The delivery threshold/fee are shown on the storefront (home trust badge,
-- cart, checkout), so they are not secret — anyone may read the single row.
create policy store_settings_public_read on public.store_settings
  for select using (true);

-- Only admins may change them (same is_admin() gate as promo_codes in 0016).
-- Update-only: the singleton row already exists and must never be removed.
create policy store_settings_admin_update on public.store_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- Fold the settings lookup into create_order(). Body is otherwise identical
-- to 0028_create_order_insufficient_stock_detail.sql; the only change is
-- v_delivery now derives from store_settings instead of the literal
-- `case when v_subtotal >= 300 then 0 else 40 end`. coalesce() keeps a missing
-- row from ever nulling out an order total.
create or replace function public.create_order(
  p_items jsonb,
  p_payment_method payment_method,
  p_shipping jsonb,
  p_promo_code text default null
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
  v_free_threshold numeric;
  v_delivery_fee numeric;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required to place an order';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

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
      raise exception 'INSUFFICIENT_STOCK:%:%:%', v_product.slug, v_product.stock_count, v_qty;
    end if;

    v_subtotal := v_subtotal + v_product.price * v_qty;
  end loop;

  select free_delivery_threshold, delivery_fee
    into v_free_threshold, v_delivery_fee
    from public.store_settings
    where id;

  v_delivery := case when v_subtotal >= coalesce(v_free_threshold, 300) then 0 else coalesce(v_delivery_fee, 40) end;
  v_discount := least(coalesce(public.validate_promo(p_promo_code, v_subtotal), 0), v_subtotal);
  v_total := greatest(0, v_subtotal + v_delivery - v_discount);

  v_order_number := 'EP-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));

  insert into public.orders (
    order_number, user_id, subtotal, delivery_fee, discount, total, payment_method, shipping
  )
  values (
    v_order_number, auth.uid(), v_subtotal, v_delivery, v_discount, v_total, p_payment_method, p_shipping
  )
  returning id into v_order_id;

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

revoke execute on function public.create_order(jsonb, payment_method, jsonb, text) from public, anon;
grant execute on function public.create_order(jsonb, payment_method, jsonb, text) to authenticated;
