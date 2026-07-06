-- Public Storage bucket for product photography. Public read (product images
-- are marketing content, same as the catalog tables), writes restricted to
-- authenticated users only (there's no admin UI yet — uploads happen via the
-- Supabase dashboard/API for now).

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true);

create policy "Public read product-images"
on storage.objects for select
using (bucket_id = 'product-images');

create policy "Authenticated upload product-images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images');

create policy "Authenticated update product-images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images')
with check (bucket_id = 'product-images');

create policy "Authenticated delete product-images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images');
