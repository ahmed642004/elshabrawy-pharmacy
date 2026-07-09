-- Public Storage bucket for category tile photography. Public read (same as
-- product-images); writes restricted to admins from the start (unlike
-- product-images' original 0003, which had to be tightened later in 0012 —
-- is_admin() already exists, so there's no reason to open this up first).
insert into storage.buckets (id, name, public)
values ('category-images', 'category-images', true);

create policy "Public read category-images"
on storage.objects for select
using (bucket_id = 'category-images');

create policy "Admins upload category-images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'category-images' and public.is_admin());

create policy "Admins update category-images"
on storage.objects for update
to authenticated
using (bucket_id = 'category-images' and public.is_admin())
with check (bucket_id = 'category-images' and public.is_admin());

create policy "Admins delete category-images"
on storage.objects for delete
to authenticated
using (bucket_id = 'category-images' and public.is_admin());

alter table public.categories add column image_url text;
