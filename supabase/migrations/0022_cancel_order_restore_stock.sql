-- Cancel an order and restore the stock it decremented. Previously
-- cancellation was a bare `orders.update({ status })` in lib/actions.ts —
-- create_order() decrements products.stock_count when an order is placed,
-- but nothing ever gave it back on cancel, so every cancellation permanently
-- lost sellable inventory. This RPC fixes that and is now the ONLY sanctioned
-- way to cancel an order.
--
-- Callable by:
--   - the order owner, only while status = 'placed'
--   - an admin, while status in ('placed', 'confirmed') -- mirrors the
--     canCancelOrder() rule in lib/order-status.ts
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
begin
  -- Row lock: a concurrent second cancel call (double-click, or admin +
  -- customer racing) blocks here, then fails the status re-check below
  -- instead of restoring stock twice.
  select id, user_id, status into v_order
  from public.orders
  where id = p_order_id
  for update;

  if v_order.id is null then
    raise exception 'CANCEL_NOT_FOUND';
  end if;

  if public.is_admin() then
    if v_order.status not in ('placed', 'confirmed') then
      raise exception 'CANCEL_NOT_ALLOWED';
    end if;
  else
    if auth.uid() is null or v_order.user_id is distinct from auth.uid() then
      raise exception 'CANCEL_NOT_ALLOWED';
    end if;
    if v_order.status <> 'placed' then
      raise exception 'CANCEL_NOT_ALLOWED';
    end if;
  end if;

  -- Restore stock. Joined on slug (immutable) rather than a product_id FK --
  -- order_items only ever stored the slug snapshot. A since-deleted product
  -- simply matches nothing, which is the graceful outcome. The stock_count
  -- update fires trg_sync_product_stock_state (0010/0011), which re-derives
  -- the in/low/out badge automatically -- no extra write needed.
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
