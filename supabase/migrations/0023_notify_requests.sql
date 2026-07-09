-- Back-in-stock notify requests. Makes the "Notify me" button on out-of-
-- stock products (ProductPurchasePanel) and the out-of-stock ProductCard
-- bell real instead of decorative local state that forgets on reload.
--
-- Restock detection is deliberately trigger-free: "pending request (
-- notified_at is null) AND products.stock <> 'out'" IS the restock signal
-- at read time, since the 0010 trigger already keeps products.stock derived
-- from stock_count. See getRestockedNotifies() in lib/queries.ts.
create table public.notify_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (user_id, product_id)
);

alter table public.notify_requests enable row level security;

-- Own-rows only, same shape as the addresses policies.
create policy notify_requests_own on public.notify_requests
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index notify_requests_user_pending
  on public.notify_requests (user_id) where notified_at is null;
