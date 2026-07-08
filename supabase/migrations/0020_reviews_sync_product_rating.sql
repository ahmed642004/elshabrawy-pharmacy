-- getProductBySlug() reads rating/review_count straight off the products
-- table (seed data), not by aggregating the reviews table -- so a new review
-- never moved either number. Keep them in sync with a trigger, mirroring the
-- stock_count -> stock derivation pattern already established in
-- 0010_inventory_numeric_stock.sql's sync_product_stock_state trigger.
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
    review_count = (select count(*) from public.reviews where product_id = v_product_id),
    rating = (select round(avg(rating)::numeric, 1) from public.reviews where product_id = v_product_id)
  where id = v_product_id;
  return coalesce(new, old);
end;
$$;

create trigger trg_sync_product_review_aggregate
after insert or update or delete on public.reviews
for each row execute function public.sync_product_review_aggregate();

-- Backfill: recompute for every product with at least one review so
-- pre-existing seed reviews (which predate this trigger) are consistent too.
update public.products p
set
  review_count = (select count(*) from public.reviews r where r.product_id = p.id),
  rating = (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.product_id = p.id)
where exists (select 1 from public.reviews r where r.product_id = p.id);
