-- Server-synced cart for signed-in users. Rows store only the cart identity
-- (slug) + qty + saved-for-later flag; product details (name/price/stock) are
-- re-joined from products on load so a synced cart always reflects current
-- prices, unlike the localStorage snapshot.
create table public.cart_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_slug text not null references public.products (slug) on delete cascade on update cascade,
  qty int not null check (qty > 0),
  saved_for_later boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, product_slug)
);

alter table public.cart_items enable row level security;

create policy "Own cart select" on public.cart_items for select using (auth.uid() = user_id);
create policy "Own cart insert" on public.cart_items for insert with check (auth.uid() = user_id);
create policy "Own cart update" on public.cart_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own cart delete" on public.cart_items for delete using (auth.uid() = user_id);

-- Replaces the caller's whole server cart in one transaction — the client
-- pushes its full merged cart state (debounced) rather than diffing per-op.
-- Security invoker: the owner RLS policies above are the enforcement.
-- Items whose product no longer exists are skipped, not fatal.
create or replace function public.replace_cart(p_items jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_item jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required to sync a cart';
  end if;

  delete from public.cart_items where user_id = auth.uid();

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.cart_items (user_id, product_slug, qty, saved_for_later)
    select auth.uid(), v_item ->> 'slug', greatest(1, (v_item ->> 'qty')::int), coalesce((v_item ->> 'saved')::boolean, false)
    where exists (select 1 from public.products p where p.slug = v_item ->> 'slug')
    on conflict (user_id, product_slug) do update
      set qty = excluded.qty, saved_for_later = excluded.saved_for_later, updated_at = now();
  end loop;
end;
$$;

revoke execute on function public.replace_cart(jsonb) from public, anon;
grant execute on function public.replace_cart(jsonb) to authenticated;

-- 0009 gave admins INSERT on product_images (for new products); editing an
-- existing product's photo also needs UPDATE (replace url) and DELETE.
create policy "Admins update product_images" on public.product_images for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete product_images" on public.product_images for delete using (public.is_admin());
