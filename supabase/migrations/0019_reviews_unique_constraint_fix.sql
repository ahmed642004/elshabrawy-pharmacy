-- 0018's partial unique index (product_id, user_id) where user_id is not
-- null can't be used as an ON CONFLICT arbiter by PostgREST's upsert --
-- Postgres requires the ON CONFLICT target to match a real unique
-- constraint/index with no extra predicate, and errors with 42P10
-- ("no unique or exclusion constraint matching the ON CONFLICT
-- specification") otherwise. A plain unique constraint works identically for
-- the NULL case anyway: Postgres never considers two NULLs equal for
-- uniqueness purposes, so legacy seed rows (user_id is null) still never
-- collide with each other -- the WHERE predicate was never actually needed.
drop index if exists public.reviews_one_per_user_product;
alter table public.reviews add constraint reviews_product_user_unique unique (product_id, user_id);
