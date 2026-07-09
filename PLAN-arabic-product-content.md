# PLAN: Arabic product content (full catalog localization)

**New-batch rank: 2 of 5 (the single biggest "next level" gap — transformative, but the widest-touching plan in the batch).**

## Goal

The storefront is **Arabic-by-default**, yet every product renders in English: `products` has only English `name, sub, description, dosage, ingredients, warnings, storage` (verified in 0001; only `categories` ever got an `_ar` column, in 0014). An Egyptian customer browsing in Arabic sees Arabic chrome around entirely English product content. Add per-product Arabic fields, locale-aware rendering everywhere products appear, Arabic-capable search, and admin form inputs to maintain them.

**Fallback rule (core design)**: every `_ar` column is nullable; whenever an Arabic value is missing, render the English value. The site must never show a blank because a translation hasn't been entered yet. Brand names (`brand`) stay untranslated by design — "CeraVe" is "CeraVe" in both languages.

## Current shape (verified)

- `products` columns: `slug, name, brand, sub, price, was_price, stock, badge_label, badge_tone, rating, review_count, is_popular, description, dosage, ingredients, warnings, storage, ...` (0001; `image_url` dropped in 0005, `on_sale` added in 0017).
- `lib/queries.ts` is the single read layer: `PRODUCT_SELECT_WITH_IMAGES` (shared select string), `toProduct()` (shared row→`Product` mapper), `getPopularProducts`, `getFilteredProducts`, `getProductBySlug`, `getRelatedProducts`, `searchProducts` (`:283`, `.or(name.ilike/brand.ilike/sub.ilike)`), `getAllProductSlugs`. Header live-search duplicates the ilike query client-side in `components/HeaderClient.tsx:151`.
- Locale: cookie-based via next-intl. Server: `getLocale()` from `next-intl/server`. Client: `useLocale()`.
- Cart (`lib/cart-context.tsx`) snapshots `name` into localStorage + `cart_items`; `order_items` snapshots `name` at order time (0001/0015).
- Admin form: `components/admin/ProductFormModal.tsx` edits the English fields today; admin UI stays English/LTR but Arabic *data* fields belong in it (same convention as `label_ar` handling in PLAN-category-management.md).
- `badge_label` is also customer-visible English text (e.g. "Bestseller") — include `badge_label_ar`.

## Exact files to touch

| File | Change |
|---|---|
| `supabase/migrations/00XX_products_arabic_content.sql` | NEW — 8 nullable text columns (use next free number; check `ls supabase/migrations` at execution time) |
| `lib/database.types.ts` | Regenerate via Supabase MCP |
| `lib/queries.ts` | Locale-aware selection + mapping (the heart of the change) |
| `components/HeaderClient.tsx` | Live-search query + result rendering localized |
| `components/admin/ProductFormModal.tsx` | Arabic input fields (`dir="rtl"`), save via existing actions |
| `lib/actions.ts` | `createProduct`/`updateProduct` (whatever the existing admin product actions are named — locate them) accept + persist the `_ar` fields |
| `app/(shop)/product/[slug]/page.tsx` | Localized metadata already flows if queries are localized — verify only |
| No `messages/*.json` changes | This is data localization, not UI strings |

## Step-by-step implementation order

### Step 1 — Migration

```sql
-- Arabic product content. All nullable: missing Arabic falls back to English
-- at read time (lib/queries.ts), so partial translation is always safe.
alter table public.products
  add column name_ar text,
  add column sub_ar text,
  add column description_ar text,
  add column dosage_ar text,
  add column ingredients_ar text,
  add column warnings_ar text,
  add column storage_ar text,
  add column badge_label_ar text;
```

No RLS change (public read already covers new columns). Regenerate types.

### Step 2 — `lib/queries.ts` localization layer

1. Extend `PRODUCT_SELECT_WITH_IMAGES` (and `getProductBySlug`'s select) with all 8 new columns.
2. Add ONE small helper and route every mapper through it:

```ts
// Arabic-first with English fallback. `loc` is the request locale ("ar"|"en").
function pickLocalized(en: string | null, ar: string | null, loc: string): string | null {
  return loc === "ar" ? (ar?.trim() ? ar : en) : en;
}
```

3. `toProduct()` (and any sibling mappers like the listing/admin mappers) become locale-aware. The least-invasive shape: make the exported query functions call `const locale = await getLocale()` (from `next-intl/server` — works in server components AND server actions) once at the top and pass it into the mapper. Do **not** call `getLocale()` inside the mapper per-row.
4. Localize: `name`, `sub`, `description`, `dosage`, `ingredients`, `warnings`, `storage`, `badgeLabel`. Do NOT localize `brand` or `slug`.
5. **Admin queries must stay English**: `getAdminInventory()` etc. keep reading the raw English columns (plus expose the raw `_ar` values so the form can edit them) — the admin edits both languages side by side, it doesn't want fallback-resolved values.
6. `searchProducts()`: extend the `.or(...)` to `name.ilike.${p},brand.ilike.${p},sub.ilike.${p},name_ar.ilike.${p},sub_ar.ilike.${p}` — Arabic queries then match Arabic columns and English queries keep working. (ILIKE on Arabic text works fine in Postgres; no index needed at this catalog size.)

### Step 3 — `components/HeaderClient.tsx` live search

Mirror Step 2.6's `.or(...)` extension in the client-side query at `:151`, add the `_ar` columns to its select, and pick the display name with the same fallback rule using `useLocale()`.

### Step 4 — Admin form (`components/admin/ProductFormModal.tsx` + actions)

- Locate the existing product create/update server actions in `lib/actions.ts` and extend their input interfaces + insert/update payloads with the 8 fields (trim; empty string → `null`).
- In the modal, group each Arabic field directly under its English sibling (label suffix "(Arabic)"), each input with `dir="rtl"` — the modal shell stays LTR.
- The long-text fields (`description_ar` etc.) use the same textarea component the English ones use.

### Step 5 — Sweep every customer-facing render of product text

Grep for consumers of `Product`/`ListingProduct` and verify they all read the (now locale-resolved) mapped fields rather than re-fetching raw rows: `ProductCard`, `ProductPurchasePanel`, `ProductTabs`, `RelatedProducts`, `ProductCarousel`, `Hero`, cart pages, checkout review step, `RestockBanner`, `ReviewPrompt`. Because localization happens in the query layer, most of these need **zero changes** — the sweep is to catch any component doing its own Supabase read of product columns (HeaderClient is the known one; flag any others found).

### Step 6 — Cart & order snapshots (document, don't over-engineer)

- Cart items snapshot `name` at add-time → a product added while browsing Arabic shows its Arabic name in the cart even after switching to English. Accept this for v1; note it in the final report. (Fixing it properly means storing both names per cart line — real cost, marginal benefit.)
- `order_items.name` snapshots likewise — the order history shows the language active at purchase time. Same acceptance.

### Step 7 — Seed translations for the existing catalog

The live catalog (~20 seeded products) has no Arabic. Author a **data migration** (separate file from Step 1's DDL) with `update public.products set name_ar = ..., sub_ar = ..., description_ar = ... where slug = ...` per product. Translate `name` conservatively: keep Latin brand/product names, translate the descriptive part (e.g. "CeraVe Moisturising Lotion" → «لوشن سيرافي المرطب» is fine; when unsure, translating only `sub`/`description` and leaving `name_ar` null is safer than a bad name). `description/dosage/warnings/storage` get full Arabic translations. This step is where most of the executor's care goes — clinical text (dosage/warnings) must be translated accurately, not loosely.

## Edge cases a weaker model would miss

- **Fallback must be per-field, not per-product**: a product with `name_ar` but no `description_ar` shows Arabic name + English description. `pickLocalized` per field handles this; a "has Arabic?" product-level switch does not.
- **Empty string ≠ translated**: admin saving an empty Arabic field must store `null` (the fallback trigger), not `""` (which would render as blank). Trim-and-nullify in the action, and `?.trim()` in `pickLocalized` as the second guard.
- **`getLocale()` in the query layer, not the component layer**: pushing locale resolution into `lib/queries.ts` keeps ~10 consumer components untouched; resolving per-component would fan the change out everywhere and inevitably miss one.
- **Admin must see raw values**: if `getAdminInventory()` returned fallback-resolved names, an admin couldn't tell "translated" from "falling back" — raw English + raw Arabic side by side is the only editable representation.
- **Search must match BOTH languages regardless of UI locale**: a user typing "cerave" while in Arabic must still find the product — that's why Step 2.6 adds `_ar` columns to the `.or()` instead of switching columns by locale.
- **`generateMetadata` inherits localization for free** (it calls `getProductBySlug`, which is now locale-aware via the request's cookie) — but verify the `<title>` actually flips with the locale cookie, since metadata rendering also runs server-side per request.
- **`revalidatePath` after admin edits**: existing product actions already revalidate; confirm the paths cover `/product/[slug]` and listing pages so a saved translation appears without a rebuild.
- **RTL inside LTR modal**: only the Arabic `<input>/<textarea>` elements get `dir="rtl"`; the labels/layout stay LTR (same rule as PLAN-category-management's `labelAr` field).
- **`sort`/filter unaffected**: sorting by name still sorts by whatever the mapper returned — acceptable (Arabic collation nuances are out of scope; note if asked).

## Acceptance criteria

1. With the locale set to Arabic: home carousel, category listings, search results, product page (name, sub, tabs content, badge), cart, and checkout review all show Arabic product content for a fully-translated product — and English fallback (no blanks) for an untranslated one.
2. Switching to English shows the original English content everywhere (no Arabic leakage).
3. Searching «لوشن» (Arabic) and "lotion" (English) both return the translated product, from both the header live-search and `/search`.
4. Admin edits an Arabic description, saves → the Arabic product page shows it on next navigation without a dev-server restart.
5. Clearing an Arabic field in admin (saving it empty) cleanly reverts that field to English fallback.
6. Product page `<title>`/OG description follow the locale cookie.
7. All seeded products have accurate Arabic `description`/`dosage`/`warnings` (spot-check 3 against their English source for meaning drift).
8. `npx tsc --noEmit`, `npm run lint`, `npm run build` clean.
