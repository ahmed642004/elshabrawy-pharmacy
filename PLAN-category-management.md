# PLAN: Admin category management

**Leverage rank: 2 of 5.**

## Goal

`categories` (0001) has only a public-read policy; no admin write policy exists in any later migration (checked 0009/0011/0012/0013 — all skip it), and there's no admin UI. Adding a category today requires raw SQL. Build `/admin/categories`: list, create, edit, delete — closely mirroring `/admin/promos`.

## Current shape (verified)

- `categories`: `id text primary key, label text not null, sort_order int not null default 0, label_ar text` (0001 + 0014's Arabic-label addition).
- `getCategories()` (`lib/queries.ts:39-47`) selects `id, label, label_ar` ordered by `sort_order` — used by `CategoryGrid.tsx` (home), `app/(shop)/category/page.tsx`, `app/(shop)/category/[slug]/page.tsx`, and `app/admin/inventory/page.tsx` (feeds `ProductFormModal`'s category `<select>`).
- `lib/categories.ts`'s `CATEGORY_VISUALS` map is a **hardcoded** id→icon/tone lookup with an explicit fallback (`DEFAULT_VISUAL`) for any id not in the map — by design, per its own comment. A brand-new category will render with the generic `Pill`/neutral tile on the home grid until someone manually adds an entry there. Not a bug to fix in this plan — just don't be surprised by it, and don't try to "fix" `lib/categories.ts` since its comment explicitly documents this as intentional.
- `slugify()` already exists in `lib/actions.ts:355-363` (used for product slugs) — reuse it verbatim for category ids.
- Products FK `category_id text references public.categories (id)` with no `ON DELETE` clause → default `NO ACTION`, so deleting a category that still has products raises Postgres error `23503` (foreign_key_violation).

## Exact files to touch

| File | Change |
|---|---|
| `supabase/migrations/0025_categories_admin_write.sql` | NEW — 3 RLS policies, no table change |
| `lib/queries.ts` | `getCategoryProductCounts()` helper (see Step 4) — table shape unchanged |
| `lib/actions.ts` | `createCategory`, `updateCategory`, `deleteCategory` |
| `app/admin/categories/page.tsx` | NEW server page |
| `app/admin/categories/loading.tsx` | NEW |
| `components/admin/CategoriesClient.tsx` | NEW — modeled on `PromosClient.tsx` |
| `components/admin/CategoryFormModal.tsx` | NEW — modeled on `PromoFormModal.tsx` |
| `components/admin/AdminSidebar.tsx` | Add nav item |

No `messages/*.json` changes for the admin UI (English/LTR), but the form does capture `labelAr` since that's customer-facing Arabic copy — not a UI-string translation, just a data field.

## Step-by-step implementation order

### Step 1 — Migration `0025_categories_admin_write.sql`

```sql
-- Admins can manage the catalog's category list. Mirrors the "Admins
-- insert/update products" policies in 0009_admin_role_and_policies.sql.
create policy "Admins insert categories" on public.categories for insert with check (public.is_admin());
create policy "Admins update categories" on public.categories for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete categories" on public.categories for delete using (public.is_admin());
```

No `lib/database.types.ts` regeneration needed — no column/table shape changed, only RLS.

### Step 2 — `lib/actions.ts`

```ts
interface CategoryInput { label: string; labelAr: string; sortOrder: number }

export async function createCategory(input: CategoryInput): Promise<void> {
  await assertAdmin();
  const label = input.label.trim();
  if (!label) throw new Error("INVALID_LABEL");
  const id = slugify(label); // reuse the existing helper — same rules as product slugs
  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({
    id,
    label,
    label_ar: input.labelAr.trim() || null,
    sort_order: input.sortOrder,
  });
  if (error) throw new Error(error.code === "23505" ? "CATEGORY_EXISTS" : "CATEGORY_SAVE_FAILED");
  revalidatePath("/", "layout"); // categories feed the shared shop layout's nav/filter sidebar
  revalidatePath("/admin/categories");
  revalidatePath("/admin/inventory"); // ProductFormModal's category select
}

// id is the PK and immutable in the UI (matches products.slug/promo_codes.code
// convention) — renaming would silently orphan every product's category_id
// display until re-picked, so it isn't offered.
export async function updateCategory(id: string, input: CategoryInput): Promise<void> {
  await assertAdmin();
  const label = input.label.trim();
  if (!label) throw new Error("INVALID_LABEL");
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ label, label_ar: input.labelAr.trim() || null, sort_order: input.sortOrder })
    .eq("id", id);
  if (error) throw new Error("CATEGORY_SAVE_FAILED");
  revalidatePath("/", "layout");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/inventory");
}

export async function deleteCategory(id: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    // 23503 = FK violation — products.category_id still points at this row.
    throw new Error(error.code === "23503" ? "CATEGORY_IN_USE" : "CATEGORY_SAVE_FAILED");
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/inventory");
}
```

### Step 3 — `app/admin/categories/page.tsx` + `loading.tsx`

```tsx
export default async function AdminCategoriesPage() {
  const [categories, productCounts] = await Promise.all([getCategories(), getCategoryProductCounts()]);
  return <CategoriesClient categories={categories} productCounts={productCounts} />;
}
```
`getCategories()` already exists and returns exactly the shape needed for the list itself.

### Step 4 — in-use count (`lib/queries.ts`)

To let the admin see *why* a delete failed before they try (rather than only after a 23503):

```ts
export async function getCategoryProductCounts(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("category_id");
  if (error || !data) return {};
  return data.reduce<Record<string, number>>((acc, r) => {
    if (r.category_id) acc[r.category_id] = (acc[r.category_id] ?? 0) + 1;
    return acc;
  }, {});
}
```
Pass to `CategoriesClient` to show a "3 products" chip per row and disable/soften the delete affordance when count > 0 (still allow the attempt — the RLS/FK is the real backstop — but the UI hint avoids a surprising error).

### Step 5 — `components/admin/CategoriesClient.tsx`

Model on `PromosClient.tsx`: header with "Add category" button, table columns **Label** (bold), **Arabic label** (or "—"), **Sort order**, **Products** (count from Step 4), **Actions** (Pencil edit, Trash two-tap — disabled/tooltipped when `count > 0`, still clickable to surface the `CATEGORY_IN_USE` inline error if they insist).

### Step 6 — `components/admin/CategoryFormModal.tsx`

Model on `PromoFormModal.tsx`: fields **Label** (English, required — id auto-derives via `slugify()`, shown live as read-only preview text under the field like "will save as: `hair-care`"), **Arabic label** (optional, RTL `dir="rtl"` on that one input since it's Arabic text even though the rest of the modal is LTR), **Sort order** (number). Id field itself is not directly editable (same immutable-PK convention as promo codes); in edit mode, show the existing id read-only instead of re-deriving it from a (possibly edited) label.

### Step 7 — `AdminSidebar.tsx`

Add `{ href: "/admin/categories", label: "Categories", icon: Tags }` to `NAV_ITEMS`.

## Edge cases a weaker model would miss

- **`revalidatePath("/", "layout")`**: categories feed `Header`'s nav and `CategoryGrid`/filter sidebar across the whole `(shop)` route group. Calling `revalidatePath("/admin/categories")` alone leaves the storefront nav stale — the `"layout"` type argument busts every route sharing that layout in one call.
- **`slugify()` collisions**: two categories with similar labels ("Hair Care" and "Hair-Care") slugify to the same id → 23505, must surface as `CATEGORY_EXISTS`, not crash.
- **Delete blocked by FK, not soft-deleted**: don't attempt to null out `products.category_id` before deleting — let the FK constraint do its job and map `23503` to a friendly message; silently reassigning every product's category as a side effect of a delete would be a much bigger surprise than a blocked delete.
- **New category's home-grid icon**: falls back to the generic `Pill`/neutral tile via `lib/categories.ts`'s documented fallback — this is expected, not a regression to chase.
- **Arabic label field is RTL even in the LTR admin shell** — needs its own `dir="rtl"` on that specific input, not the whole modal.
- **No i18n keys needed** — `labelAr` is data, not a translated UI string.
- **Id immutability on edit**: like promo codes' `code` and products' `slug`, don't let editing the label silently change the id — that would break every product row currently pointing at the old id (FK is fine since it's an update not a delete/recreate, but every other Postgres reference by the old id string, e.g. `lib/categories.ts`'s `CATEGORY_VISUALS` map and `SLUG_ALIASES`, would silently stop matching).

## Acceptance criteria

1. "Categories" appears in the admin sidebar; `/admin/categories` lists the 6 seeded categories with correct English/Arabic labels and sort order.
2. Creating "Hair Care" (English) + «العناية بالشعر الإضافية» (Arabic) saves as a slugified id and immediately appears on the storefront home page's category grid and in `/category` filters, in both locales, without a server restart.
3. Editing a category's Arabic label updates the storefront Arabic UI on next navigation (no i18n file touched).
4. Attempting to delete a category with existing products shows an inline "still has products" error (or is pre-disabled via the product-count chip) — no crash, no orphaned products.
5. Deleting an empty category removes it from the storefront nav/filters and the admin's product-add category select.
6. As non-admin: `/admin/categories` unreachable; actions throw "Not authorized"; anon REST insert/update/delete on `categories` rejected by RLS; anon `select` still works (storefront nav intact).
7. `npx tsc --noEmit` and `npm run lint` clean.
