-- 0003 opened product-images bucket writes to all authenticated users
-- because no admin role existed yet ("uploads happen via the Supabase
-- dashboard for now"). The ops dashboard's addProduct() upload flow is
-- admin-gated, so tighten storage writes to match: any signed-in customer
-- could otherwise upload/overwrite/delete product photos via the storage API.

drop policy "Authenticated upload product-images" on storage.objects;
drop policy "Authenticated update product-images" on storage.objects;
drop policy "Authenticated delete product-images" on storage.objects;

create policy "Admins upload product-images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and public.is_admin());

create policy "Admins update product-images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

create policy "Admins delete product-images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and public.is_admin());
