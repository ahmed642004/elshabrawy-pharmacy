-- Consolidate on product_images as the single source of truth for product
-- photography (position 0 = the card/carousel thumbnail, all positions = the
-- Product Detail gallery) instead of maintaining both product_images and a
-- separate products.image_url column pointing at the same bucket.
alter table public.products drop column image_url;
