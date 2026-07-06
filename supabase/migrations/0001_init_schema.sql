-- Elshabrawy Pharmacy — initial schema
-- Enums, catalog tables, user tables, orders, RLS, and triggers/functions.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type stock_state as enum ('in', 'low', 'out');
create type badge_tone as enum ('sale', 'bestseller', 'new');
create type payment_method as enum ('cod', 'card', 'wallet');
create type order_status as enum ('placed', 'confirmed', 'delivered', 'cancelled');

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.categories (
  id text primary key,
  label text not null,
  sort_order int not null default 0
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  brand text,
  sub text,
  category_id text references public.categories (id),
  price numeric(10, 2) not null,
  was_price numeric(10, 2),
  stock stock_state not null default 'in',
  badge_label text,
  badge_tone badge_tone,
  image_url text,
  rating numeric(2, 1),
  review_count int not null default 0,
  is_popular boolean not null default false,
  description text,
  dosage text,
  ingredients text,
  warnings text,
  storage text,
  created_at timestamptz not null default now()
);
create index products_category_id_idx on public.products (category_id);
create index products_is_popular_idx on public.products (is_popular);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null,
  position int not null default 0
);
create index product_images_product_id_idx on public.product_images (product_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  author_name text not null,
  rating int not null check (rating between 1 and 5),
  body text,
  created_at timestamptz not null default now()
);
create index reviews_product_id_idx on public.reviews (product_id);

-- ---------------------------------------------------------------------------
-- Users (profiles + addresses)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipient text,
  phone text,
  street text,
  city text,
  governorate text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index addresses_user_id_idx on public.addresses (user_id);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  user_id uuid references auth.users (id) on delete set null,
  status order_status not null default 'placed',
  subtotal numeric(10, 2) not null,
  delivery_fee numeric(10, 2) not null default 0,
  discount numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  payment_method payment_method not null,
  shipping jsonb,
  created_at timestamptz not null default now()
);
create index orders_user_id_idx on public.orders (user_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_slug text,
  name text not null,
  brand text,
  price numeric(10, 2) not null,
  qty int not null check (qty > 0)
);
create index order_items_order_id_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.reviews enable row level security;
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Catalog is public, read-only to clients.
create policy "Public read categories" on public.categories for select using (true);
create policy "Public read products" on public.products for select using (true);
create policy "Public read product_images" on public.product_images for select using (true);
create policy "Public read reviews" on public.reviews for select using (true);

-- Profiles: owner only.
create policy "Own profile select" on public.profiles for select using (auth.uid() = id);
create policy "Own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "Own profile update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Addresses: owner only.
create policy "Own addresses select" on public.addresses for select using (auth.uid() = user_id);
create policy "Own addresses insert" on public.addresses for insert with check (auth.uid() = user_id);
create policy "Own addresses update" on public.addresses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own addresses delete" on public.addresses for delete using (auth.uid() = user_id);

-- Orders: a signed-in user may read their own orders. Inserts happen only
-- through the create_order() security-definer function below, so there is no
-- direct client INSERT policy (guest COD orders would otherwise be readable by
-- anyone). This keeps order writes atomic and RLS strict.
create policy "Select own orders" on public.orders for select using (auth.uid() = user_id);
create policy "Select own order_items" on public.order_items for select using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- Functions & triggers
-- ---------------------------------------------------------------------------

-- Mirror new auth users into public.profiles, pulling the full_name/phone that
-- the sign-up form sends via options.data (see app/auth/page.tsx).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Place an order atomically: creates the order + its items and returns the
-- generated order number. security definer so it can write past RLS while the
-- caller (anon guest or signed-in user) only ever reads their own orders.
create or replace function public.create_order(
  p_items jsonb,
  p_subtotal numeric,
  p_delivery_fee numeric,
  p_discount numeric,
  p_total numeric,
  p_payment_method payment_method,
  p_shipping jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
begin
  v_order_number := 'EP-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));

  insert into public.orders (
    order_number, user_id, subtotal, delivery_fee, discount, total, payment_method, shipping
  )
  values (
    v_order_number, auth.uid(), p_subtotal, p_delivery_fee, p_discount, p_total, p_payment_method, p_shipping
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (order_id, product_slug, name, brand, price, qty)
    values (
      v_order_id,
      v_item ->> 'slug',
      v_item ->> 'name',
      v_item ->> 'brand',
      (v_item ->> 'price')::numeric,
      (v_item ->> 'qty')::int
    );
  end loop;

  return v_order_number;
end;
$$;

grant execute on function public.create_order (jsonb, numeric, numeric, numeric, numeric, payment_method, jsonb) to anon, authenticated;
