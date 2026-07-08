# PLAN: Make the Offers page real

## Goal

"العروض / Offers" is the most visually prominent nav link (red, in the header nav AND footer — `components/HeaderClient.tsx:20`, `components/Footer.tsx:7`, both pointing at `/category/offers`). But "offers" is not a category: `resolveCategorySlug("offers", ...)` returns `undefined` (`lib/categories.ts:51`), so the page silently renders **all products, unfiltered** — the link is a lie. Make it a real sale listing: products whose `was_price` is a genuine discount.

## Files to touch

1. `supabase/migrations/0017_products_on_sale.sql` (new)
2. `lib/queries.ts` — `getFilteredProducts` gains `onSale?: boolean`
3. `app/(shop)/category/[slug]/page.tsx` — special-case `offers`
4. `components/listing/CategoryListingClient.tsx` — heading/breadcrumb for offers mode
5. `messages/en.json` + `messages/ar.json` — offers title strings
6. `lib/database.types.ts` — regenerate

## Implementation order

### Step 1 — Migration: generated column

**Critical constraint**: PostgREST/supabase-js CANNOT compare two columns to each other (`.gt("was_price", "price")` compares against the *string* `'price'`). The clean fix is a stored generated column:

```sql
alter table public.products add column on_sale boolean
  generated always as (was_price is not null and was_price > price) stored;
create index products_on_sale_idx on public.products (on_sale) where on_sale;
```

Apply via Supabase MCP, regenerate `lib/database.types.ts`.

### Step 2 — `lib/queries.ts`

In `getFilteredProducts` params add `onSale?: boolean`; in the query builder add `if (onSale) query = query.eq("on_sale", true);` following the existing filter-composition style in that function (read it first — filters/sort compose on one builder).

### Step 3 — Route special-case

In `app/(shop)/category/[slug]/page.tsx`, before `resolveCategorySlug`:

```ts
const isOffers = slug === "offers";
```

- Pass `onSale: isOffers` into `getFilteredProducts`.
- Keep the rest of the URL-driven filters working ON TOP of the sale filter (cat/brand/price/sort all still compose — no code change needed beyond passing the flag).
- Pass a new prop `offersMode` (boolean) to `CategoryListingClient` so it renders the offers title instead of a category label. Do NOT treat `offers` as `initialCategoryId`.

### Step 4 — Listing client heading

`CategoryListingClient` currently derives its heading from the selected category. Add an `offersMode?: boolean` prop: when true, heading = `t("offersTitle")`, breadcrumb current = same, and the category checkbox group stays fully functional (it filters within sale items via the `cat` URL param).

### Step 5 — i18n (parity in both files, `listing` namespace)

- `offersTitle`: en "Offers & deals" / ar "العروض والتخفيضات"
- `offersEmpty`: en "No offers right now — check back soon." / ar "لا توجد عروض حاليًا — عد قريبًا."
  (Wire `offersEmpty` into the existing empty-state block only when `offersMode`; the generic empty state stays for other pages.)

## Edge cases a weaker model would miss

- **The column-to-column comparison trap** (Step 1). Do not attempt `.filter("was_price", "gt", "price")` or raw `or=` strings — the generated column is the reliable, indexable route.
- Generated columns are read-only: the admin product form (`lib/actions.ts` insert/update) must NOT include `on_sale` in its column set or inserts will error. `parseProductFields` doesn't touch it today — keep it that way. Note the regenerated `database.types.ts` marks it accordingly.
- The was-price validation shipped earlier (client `min` + server clamp in `parseProductFields`) means `was_price >= price` — equality is NOT a sale; the generated column's strict `>` handles the boundary. One legacy product ("cenrum women") has `was_price < price` from before validation existed; it correctly won't appear as an offer, but fix its data in admin while testing anyway.
- `/category/offers?cat=skincare` must show *discounted skincare only* — verify composition, don't assume.
- The static `app/(shop)/category/loading.tsx` skeleton covers this route automatically — no new loading file.
- RTL: no new layout primitives; reuse existing listing markup.

## Acceptance criteria

1. tsc + lint clean.
2. Preview: give 2+ products a `was_price` above `price` in admin. `/category/offers` shows exactly those products, with sale strikethrough prices, under the "العروض والتخفيضات" heading (ar default).
3. A product with `was_price` equal to `price` does NOT appear.
4. `/category/offers?cat=<some-category>` intersects correctly.
5. With zero sale products, the offers empty state (not the generic one) renders.
6. `/category/skincare` and `/category` behave exactly as before (regression check).
