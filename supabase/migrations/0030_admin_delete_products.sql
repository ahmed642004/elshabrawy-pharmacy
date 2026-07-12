-- Products had admin insert/update policies (0009) but no delete policy, so
-- lib/actions.ts's deleteProduct() silently deleted zero rows: RLS filters a
-- row out of a DELETE's target set the same as it would a SELECT, and a
-- DELETE matching zero rows returns no error, not a permission failure.
create policy "Admins delete products" on public.products for delete using (public.is_admin());
