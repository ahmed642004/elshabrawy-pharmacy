-- Reviews were seed-data only -- no write path existed. Attribute reviews to
-- the signed-in customer who wrote them and let them write one review per
-- product (re-reviewing edits instead of duplicating).

alter table public.reviews add column user_id uuid references auth.users (id) on delete set null;

-- Partial index, not a table constraint: legacy seed rows have NULL user_id
-- and must not collide with each other.
create unique index reviews_one_per_user_product
  on public.reviews (product_id, user_id) where user_id is not null;

-- RLS is already enabled on public.reviews with a public read policy
-- ("Public read reviews", see 0001) -- only the write policies are new here.
-- Upsert (insert ... on conflict do update) needs BOTH policies since
-- Postgres RLS checks the insert branch and the conflict-update branch
-- separately.
create policy reviews_insert_own on public.reviews for insert to authenticated
  with check (user_id = auth.uid());
create policy reviews_update_own on public.reviews for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Verified-purchase gate. order_items stores product_slug (a snapshot, not a
-- product_id FK -- see 0001), so the join goes through the slug rather than
-- products.id.
create or replace function public.has_purchased(p_product_slug text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.user_id = auth.uid() and oi.product_slug = p_product_slug
  );
$$;

grant execute on function public.has_purchased(text) to authenticated;
