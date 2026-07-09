alter table public.reviews add column hidden boolean not null default false;

-- Admin moderation lever. Separate from reviews_update_own/reviews_insert_own
-- (0021) which are owner+purchase-gated — an admin isn't the review's author
-- and must not need to have purchased the product.
create policy "Admins update reviews" on public.reviews
  for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete reviews" on public.reviews
  for delete using (public.is_admin());

-- A hidden review must stop counting toward the public rating/review_count.
-- Redefine the 0020 trigger function's WHERE clauses to exclude hidden rows;
-- the trigger itself (fires after insert/update/delete on reviews) already
-- covers hide/unhide since that's an UPDATE.
create or replace function public.sync_product_review_aggregate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
begin
  v_product_id := coalesce(new.product_id, old.product_id);
  update public.products
  set
    review_count = (select count(*) from public.reviews where product_id = v_product_id and hidden = false),
    rating = (select round(avg(rating)::numeric, 1) from public.reviews where product_id = v_product_id and hidden = false)
  where id = v_product_id;
  return coalesce(new, old);
end;
$$;

-- Backfill: recompute now that hidden=false is part of the aggregate (all
-- existing rows are hidden=false so this is a no-op today, but keeps the
-- migration self-consistent/idempotent).
update public.products p
set
  review_count = (select count(*) from public.reviews r where r.product_id = p.id and r.hidden = false),
  rating = (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.product_id = p.id and r.hidden = false)
where exists (select 1 from public.reviews r where r.product_id = p.id);
