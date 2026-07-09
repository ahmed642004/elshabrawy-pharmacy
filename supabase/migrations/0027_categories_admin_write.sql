-- categories had only a public-read policy (0001) — no admin write policy
-- ever existed, so setCategoryImage()'s update() silently affected 0 rows
-- (RLS-filtered updates return success with an empty result, not an error).
-- Mirrors the "Admins insert/update/delete products" policies in
-- 0009_admin_role_and_policies.sql. This is the same policy set
-- PLAN-category-management.md's Step 1 migration calls for — landing it here
-- means that plan's migration should check for existing policies first.
create policy "Admins insert categories" on public.categories for insert with check (public.is_admin());
create policy "Admins update categories" on public.categories for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete categories" on public.categories for delete using (public.is_admin());
