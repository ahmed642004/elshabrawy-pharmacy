-- Powers the Listing page's brand filter checkboxes. A plain SELECT DISTINCT
-- in Postgres (via this function) scales with the number of distinct brands,
-- not the number of products — unlike fetching every product row to derive
-- the brand list in JS, which is what the client used to do.
create or replace function public.get_distinct_brands()
returns table (brand text)
language sql
stable
as $$
  select distinct brand from public.products where brand is not null order by brand;
$$;

grant execute on function public.get_distinct_brands() to anon, authenticated;
