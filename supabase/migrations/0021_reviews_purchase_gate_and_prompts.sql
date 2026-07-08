-- Defense-in-depth for reviews. 0018 enforced "must have purchased" only in
-- the submitReview() server action -- the RLS policy checked identity
-- (user_id = auth.uid()) but NOT purchase history, so a client bypassing the
-- website (calling the REST API directly with their own session) could still
-- insert a review for a product they never bought. Push the purchase check
-- into RLS itself so the database refuses it regardless of entry point.

-- product_id variant of has_purchased() (0018's version takes a slug, for the
-- action). SECURITY DEFINER + explicit auth.uid() filter so it can read
-- orders/order_items past their own RLS while still scoping to the caller.
create or replace function public.has_purchased_product(p_product_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    join public.products p on p.slug = oi.product_slug
    where o.user_id = auth.uid() and p.id = p_product_id
  );
$$;

grant execute on function public.has_purchased_product(uuid) to authenticated;

-- Rebuild the write policies to also require the purchase.
drop policy reviews_insert_own on public.reviews;
create policy reviews_insert_own on public.reviews for insert to authenticated
  with check (user_id = auth.uid() and public.has_purchased_product(product_id));

drop policy reviews_update_own on public.reviews;
create policy reviews_update_own on public.reviews for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_purchased_product(product_id));

-- Backs the delivery-app-style "rate your delivered order" prompt: products
-- from the caller's DELIVERED orders that they haven't reviewed yet. Distinct
-- per product, with the position-0 thumbnail for the prompt card.
create or replace function public.get_pending_reviews()
returns table (slug text, name text, image_url text)
language sql
security definer
set search_path = public
stable
as $$
  select distinct on (p.slug)
    p.slug,
    p.name,
    (select url from public.product_images pi where pi.product_id = p.id order by position limit 1) as image_url
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  join public.products p on p.slug = oi.product_slug
  where o.user_id = auth.uid()
    and o.status = 'delivered'
    and not exists (
      select 1 from public.reviews r where r.product_id = p.id and r.user_id = auth.uid()
    )
  order by p.slug;
$$;

grant execute on function public.get_pending_reviews() to authenticated;
