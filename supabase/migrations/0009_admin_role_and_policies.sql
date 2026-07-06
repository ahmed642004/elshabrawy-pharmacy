-- Adds a staff/admin role to profiles for the new Pharmacy Ops Dashboard
-- (/admin), and the RLS policies that let an admin see/manage all orders,
-- order_items, products, product_images, and profiles rather than only
-- their own rows. Existing owner-only policies are untouched — Postgres
-- RLS policies for the same command are OR'd together.

alter table public.profiles add column is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

grant execute on function public.is_admin() to authenticated;

-- Orders: admins can see and update every order (first-ever UPDATE policy on
-- this table — previously nothing could update orders directly, only the
-- create_order() function could insert).
create policy "Admins select all orders" on public.orders for select using (public.is_admin());
create policy "Admins update orders" on public.orders for update using (public.is_admin()) with check (public.is_admin());

-- Order items: admins can see every order's line items.
create policy "Admins select all order_items" on public.order_items for select using (public.is_admin());

-- Products: admins can adjust stock and add new catalog items.
create policy "Admins update products" on public.products for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins insert products" on public.products for insert with check (public.is_admin());

-- Product images: admins can attach a photo to a newly-added product.
create policy "Admins insert product_images" on public.product_images for insert with check (public.is_admin());

-- Profiles: admins can count/list all customers (needed for the Overview
-- "new customers today" KPI, which requires seeing every profile, not just
-- the caller's own row).
create policy "Admins select all profiles" on public.profiles for select using (public.is_admin());

-- One-time data fix for this deployment: grant admin to the pharmacist's
-- real signed-up account.
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'ahmedabokhial2123@gmail.com');
