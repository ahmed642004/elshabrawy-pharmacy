-- Guest (unauthenticated) checkout is no longer allowed — the client
-- requires a signed-in account to place an order. The /checkout page also
-- gates unauthenticated visitors before they ever reach this RPC, but this
-- keeps the database enforcing the same rule even if create_order() were
-- called directly (e.g. via the REST API).

create or replace function public.create_order(
  p_items jsonb,
  p_subtotal numeric,
  p_delivery_fee numeric,
  p_discount numeric,
  p_total numeric,
  p_payment_method payment_method,
  p_shipping jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required to place an order';
  end if;

  v_order_number := 'EP-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));

  insert into public.orders (
    order_number, user_id, subtotal, delivery_fee, discount, total, payment_method, shipping
  )
  values (
    v_order_number, auth.uid(), p_subtotal, p_delivery_fee, p_discount, p_total, p_payment_method, p_shipping
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (order_id, product_slug, name, brand, price, qty)
    values (
      v_order_id,
      v_item ->> 'slug',
      v_item ->> 'name',
      v_item ->> 'brand',
      (v_item ->> 'price')::numeric,
      (v_item ->> 'qty')::int
    );
  end loop;

  return v_order_number;
end;
$$;

revoke execute on function public.create_order (jsonb, numeric, numeric, numeric, numeric, payment_method, jsonb) from anon;
