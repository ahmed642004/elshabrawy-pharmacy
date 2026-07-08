# PLAN: Multi-image product galleries in admin

## Goal

Exactly one product in the catalog has an image. The admin form supports only a single "thumbnail" upload wired to the `product_images` row at `position = 0` (`setProductThumbnail` in `lib/actions.ts`). Meanwhile the storefront is built for galleries: `ProductGallery` renders a thumbnail rail from `images: string[]`, the hero showcase rotates products *with images*, and cards/carousels all degrade to a pill icon without them. Let admins upload, view, and delete multiple gallery images per product.

## Files to touch

1. `lib/actions.ts` — new `addProductImages` + `deleteProductImage` server actions (reuse the upload validation + storage patterns already inside `setProductThumbnail`; read it fully first)
2. `lib/queries.ts` — `AdminInventoryItem` gains a `galleryImages: { id, url, position }[]` (extend the existing `product_images` join in `getAdminInventory`)
3. `components/admin/ProductFormModal.tsx` — gallery management section (edit mode only)
4. No migration needed — `product_images (id, product_id, url, position)` and admin-only storage policies (0012/0013) already exist

## Implementation order

### Step 1 — `lib/actions.ts`

- `export async function addProductImages(formData: FormData)`: `assertAdmin()`, read `productId` + `files` (`formData.getAll("images")`), validate each `File` with the same mime/size rules `setProductThumbnail` uses (extract that validation into a small shared helper rather than duplicating). Compute `next position = max(position) + 1` for that product (query `product_images`), upload each to the `product-images` bucket under the product's slug prefix (mirror the existing object-path convention — read `setProductThumbnail` for the exact pattern), insert rows. `revalidatePath("/admin/inventory")` and `revalidatePath(`/product/${slug}`)`.
- `export async function deleteProductImage(imageId: string)`: `assertAdmin()`, fetch the row, delete the DB row, then best-effort delete the storage object (the existing code has this exact pattern with a comment about orphans — copy it). Guard: **refuse to delete the `position = 0` row** (that's the card/carousel thumbnail; it's replaced via the existing photo field, not deleted). Revalidate the same paths.

### Step 2 — `lib/queries.ts`

`getAdminInventory`'s select already joins `product_images` for the thumbnail; extend it to return all rows ordered by position and map into `galleryImages`. Keep `imageUrl` (position 0) untouched — the admin table row and modal preview use it.

### Step 3 — `ProductFormModal.tsx`

In edit mode only, under the existing photo field, add a "Gallery images" section:
- Grid of current `galleryImages` (skip position 0 — it's the photo field above) as 64px thumbs, each with a small × `IconButton` calling `deleteProductImage` then refreshing (the modal receives fresh props via the revalidated server component — follow how the existing form handles post-submit refresh; if the modal stays open, track deletions in local state too).
- A `<input type="file" multiple accept="image/*" name="images">` + "Upload" button posting to `addProductImages` with `submitting` state, matching the form's existing visual style (`labelClass`, rounded-[10px] etc.).
- Keep this OUTSIDE the main `<form>` element (nested forms are invalid HTML and silently break submission) — use a separate `<form>` or button handlers with a manually-built FormData.

## Edge cases a weaker model would miss

- **Nested `<form>` trap** in Step 3 — the modal is already one big form.
- **Position 0 is special**: storefront cards and the hero showcase read the position-0 url. Never let gallery deletion remove it; never let gallery uploads claim position 0 (start at max+1 — if a product somehow has NO images, gallery upload should start at 1 anyway and the photo field remains the way to set the thumbnail... actually if there is no position-0 row, make the FIRST uploaded gallery image position 0 so the product gets a card thumbnail — state this rule in a code comment).
- Storage RLS: uploads must run in the server action with the user's session (admin) — the bucket policies from 0012/0013 allow admin writes only; anonymous client-side upload will 403.
- Multiple files in one FormData: `formData.getAll("images")` returns `(File | string)[]` — filter with `instanceof File && size > 0`.
- `ProductGallery` on the product page orders by `position` via `getProductBySlug` — verify after upload that ordering holds (no code change expected).
- Don't regenerate `database.types.ts` — no schema change.
- Windows path note: none — storage keys are forward-slash strings.

## Acceptance criteria

1. tsc + lint clean.
2. In admin (requires an admin session in the preview): edit a product → upload 2 gallery images at once → both appear in the modal grid; product page (`/product/<slug>`) now shows a thumbnail rail with 3 images (thumbnail + 2) in order, crossfading on switch.
3. Delete one gallery image → gone from modal + product page; the storage object is removed (check the bucket via Supabase MCP or accept the best-effort log).
4. The position-0 thumbnail cannot be deleted from the gallery section; replacing it still works via the existing photo field.
5. With 2+ products holding images, the home hero showcase now rotates (crossfade every 4s) — this is the payoff feature; verify visually.
