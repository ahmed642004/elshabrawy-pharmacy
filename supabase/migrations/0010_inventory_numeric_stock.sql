-- Real numeric inventory tracking for the Pharmacy Ops Dashboard. products.stock
-- was previously just a badge-state enum (in/low/out) with no numeric backing —
-- the dashboard's +/- stock adjust buttons and low-stock threshold need real
-- counts. A trigger keeps the existing `stock` enum derived from stock_count vs
-- low_stock_threshold automatically, so ProductCard/getFilteredProducts and
-- every other customer-facing read of `stock` need zero changes.

alter table public.products
  add column stock_count integer not null default 0,
  add column low_stock_threshold integer not null default 10,
  add column sku text unique;

create or replace function public.sync_product_stock_state()
returns trigger
language plpgsql
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

create trigger trg_sync_product_stock_state
before insert or update of stock_count, low_stock_threshold on public.products
for each row execute function public.sync_product_stock_state();

-- Atomic stock adjustment — avoids a read-then-write race when two +/- clicks
-- land close together (a plain client-side "read count, add delta, write"
-- could lose an increment under concurrent admin use).
create or replace function public.adjust_product_stock(p_product_id uuid, p_delta int)
returns void
language sql
as $$
  update public.products
  set stock_count = greatest(0, stock_count + p_delta)
  where id = p_product_id;
$$;

grant execute on function public.adjust_product_stock(uuid, int) to authenticated;

-- Backfill the 16 seeded products so they don't all read as "low stock" at
-- the 0/10 defaults, and give them a placeholder SKU since nothing
-- previously populated one.
update public.products set
  stock_count = case stock
    when 'in' then 150
    when 'low' then 15
    when 'out' then 0
  end,
  low_stock_threshold = 20,
  sku = 'EP-' || upper(substr(id::text, 1, 6));
