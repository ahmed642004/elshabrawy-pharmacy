-- The "Offers" nav link (header + footer) points at /category/offers, but
-- "offers" isn't a real category -- resolveCategorySlug() returns undefined
-- for it, so the page silently showed ALL products unfiltered. Make it a
-- real sale listing: a stored generated column so Postgres/PostgREST can
-- filter on "was_price > price" without the column-to-column comparison
-- trap (.gt("was_price", "price") would compare against the literal string
-- 'price', not the column).
alter table public.products add column on_sale boolean
  generated always as (was_price is not null and was_price > price) stored;

create index products_on_sale_idx on public.products (on_sale) where on_sale;
