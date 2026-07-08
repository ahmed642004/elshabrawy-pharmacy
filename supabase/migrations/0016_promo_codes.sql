-- Real promo codes. Previously any non-empty code the customer typed
-- unlocked EGP 20 off (lib/cart-context.tsx's old applyPromo just checked
-- the string wasn't empty) -- "asdf" got the same discount as a real code.
-- Codes now live in their own table, validated server-side, and the
-- discount amount is computed by create_order() itself (never trusting a
-- client-supplied number), same as prices/stock in migration 0015.

create table public.promo_codes (
  code text primary key check (code = upper(code)),
  discount_egp numeric(10,2) not null check (discount_egp > 0),
  min_subtotal numeric(10,2) not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.promo_codes enable row level security;

-- Deliberately NO select policy for anon/authenticated -- customers must not
-- be able to enumerate valid codes via a direct table read. Validation goes
-- through validate_promo() below (security definer), and admins manage rows
-- via the is_admin() pattern established in 0009.
create policy promo_admin_all on public.promo_codes for all
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.validate_promo(p_code text, p_subtotal numeric)
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select discount_egp from public.promo_codes
  where code = upper(trim(p_code))
    and active
    and (expires_at is null or expires_at > now())
    and p_subtotal >= min_subtotal
$$;

grant execute on function public.validate_promo(text, numeric) to authenticated, anon;

insert into public.promo_codes (code, discount_egp, min_subtotal) values ('WELCOME20', 20, 100);

-- Fold promo validation into create_order() itself: p_promo_applied (an
-- honesty-system boolean from 0015) becomes p_promo_code text, and the
-- discount is now looked up from promo_codes/validate_promo rather than a
-- flat least(20, subtotal). Everything else (stock locking, price snapshot,
-- duplicate-slug collapsing) is unchanged from 0015.
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
      raise exception 'INSUFFICIENT_STOCK:%', v_product.slug;
    end if;

    v_subtotal := v_subtotal + v_product.price * v_qty;
  end loop;

  v_delivery := case when v_subtotal >= 300 then 0 else 40 end;
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

drop function if exists public.create_order(jsonb, payment_method, jsonb, boolean);
