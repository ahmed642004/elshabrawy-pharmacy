-- Lint fixes flagged by get_advisors after the previous two migrations:
-- 1. New functions were missing `set search_path`, same class of issue the
--    linter flags on any function without a pinned search_path.
-- 2. is_admin() is security definer and, like create_order() before the
--    0007 migration, Postgres grants EXECUTE to PUBLIC by default on
--    creation — anon inherited it through that PUBLIC grant even though
--    only `authenticated` was explicitly granted. Revoke from anon/public
--    explicitly, matching the precedent in 0007_revoke_create_order_from_public.sql.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.sync_product_stock_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.stock := case
    when new.stock_count <= 0 then 'out'
    when new.stock_count <= new.low_stock_threshold then 'low'
    else 'in'
  end;
  return new;
end;
$$;

create or replace function public.adjust_product_stock(p_product_id uuid, p_delta int)
returns void
language sql
set search_path = public
as $$
  update public.products
  set stock_count = greatest(0, stock_count + p_delta)
  where id = p_product_id;
$$;

revoke execute on function public.adjust_product_stock(uuid, int) from public, anon;
grant execute on function public.adjust_product_stock(uuid, int) to authenticated;
