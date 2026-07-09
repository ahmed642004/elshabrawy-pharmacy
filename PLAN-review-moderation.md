# PLAN: Review moderation (admin hide/delete)

**Leverage rank: 1 of 5.**

## Goal

`reviews` has zero moderation lever — no admin can hide or delete an abusive/spam review today (checked migrations 0001, 0009, 0011, 0013, 0018-0021: no such policy exists). Add a `hidden` column, admin RLS policies, storefront filtering, and a small `/admin/reviews` moderation list. Mirrors the `PromosClient.tsx` pattern closely but simpler (no create modal — reviews aren't admin-authored).

## Current shape (verified)

- `reviews`: `id uuid pk, product_id uuid, author_name text, rating int, body text, created_at timestamptz, user_id uuid` (0001 + 0018).
- `reviews_insert_own`/`reviews_update_own` (0021) require `has_purchased_product()` — owner-scoped, not admin-usable for moderation.
- `sync_product_review_aggregate()` trigger (0020) recomputes `products.rating`/`review_count` off **all** rows in `reviews` for a product on every insert/update/delete — currently has no `hidden` concept.
- `getProductBySlug()` (`lib/queries.ts:137-171`) selects `reviews(author_name, rating, body, created_at)` — no `id`, no `hidden` today.
- `is_admin()` SECURITY DEFINER function exists (0009) — reuse it, don't reinvent.

## Exact files to touch

| File | Change |
|---|---|
| `supabase/migrations/0024_reviews_moderation.sql` | NEW — `hidden` column, admin update/delete RLS, aggregate-trigger fix |
| `lib/database.types.ts` | Regenerate |
| `lib/queries.ts` | `getProductBySlug` reviews select gains `.eq("reviews.hidden", false)`; new `AdminReview` + `getAdminReviews()` |
| `lib/actions.ts` | `hideReview(reviewId, hidden)`, `deleteReviewAdmin(reviewId)` (both `assertAdmin()`) |
| `app/admin/reviews/page.tsx` | NEW server page |
| `app/admin/reviews/loading.tsx` | NEW — copy `app/admin/inventory/loading.tsx` skeleton |
| `components/admin/ReviewsClient.tsx` | NEW — modeled on `PromosClient.tsx` (no modal needed) |
| `components/admin/AdminSidebar.tsx` | Add nav item |

No `messages/*.json` changes — moderation UI is admin-only (English/LTR).

## Step-by-step implementation order

### Step 1 — Migration `0024_reviews_moderation.sql`

```sql
alter table public.reviews add column hidden boolean not null default false;

-- Admin moderation lever. Separate from reviews_update_own/reviews_insert_own
-- (0021) which are owner+purchase-gated — an admin isn't the review's author
-- and must not need to have purchased the product.
create policy "Admins update reviews" on public.reviews
  for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete reviews" on public.reviews
  for delete using (public.is_admin());

-- A hidden review must stop counting toward the public rating/review_count.
-- Redefine the 0020 trigger function's WHERE clauses to exclude hidden rows;
-- the trigger itself (fires after insert/update/delete on reviews) already
-- covers hide/unhide since that's an UPDATE.
create or replace function public.sync_product_review_aggregate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
begin
  v_product_id := coalesce(new.product_id, old.product_id);
  update public.products
  set
    review_count = (select count(*) from public.reviews where product_id = v_product_id and hidden = false),
    rating = (select round(avg(rating)::numeric, 1) from public.reviews where product_id = v_product_id and hidden = false)
  where id = v_product_id;
  return coalesce(new, old);
end;
$$;

-- Backfill: recompute now that hidden=false is part of the aggregate (all
-- existing rows are hidden=false so this is a no-op today, but keeps the
-- migration self-consistent/idempotent).
update public.products p
set
  review_count = (select count(*) from public.reviews r where r.product_id = p.id and r.hidden = false),
  rating = (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.product_id = p.id and r.hidden = false)
where exists (select 1 from public.reviews r where r.product_id = p.id);
```

### Step 2 — Regenerate `lib/database.types.ts` via Supabase MCP.

### Step 3 — `lib/queries.ts`

- `getProductBySlug`: change the reviews embed to `reviews(id, author_name, rating, body, created_at)` and chain `.eq("reviews.hidden", false)` on the query builder (PostgREST embedded-resource filter — filters which nested rows appear, does **not** turn it into an inner join, so a product with zero visible reviews still returns normally).
- New:
```ts
export interface AdminReview {
  id: string;
  productSlug: string;
  productName: string;
  authorName: string;
  rating: number;
  body: string | null;
  createdAt: string;
  hidden: boolean;
}

export async function getAdminReviews(): Promise<AdminReview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, author_name, rating, body, created_at, hidden, products(slug, name)")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    productSlug: r.products?.slug ?? "",
    productName: r.products?.name ?? "Unknown product",
    authorName: r.author_name,
    rating: r.rating,
    body: r.body,
    createdAt: r.created_at,
    hidden: r.hidden,
  }));
}
```
(RLS's existing `"Public read reviews"` policy is `using (true)` — it already lets this query see hidden rows too; that's fine, this query only ever runs from `/admin/reviews`, gated by the layout + `assertAdmin()` on the mutating actions.)

### Step 4 — `lib/actions.ts`

```ts
export async function hideReview(reviewId: string, hidden: boolean): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("reviews")
    .update({ hidden })
    .eq("id", reviewId)
    .select("products(slug)")
    .maybeSingle();
  if (error) throw new Error("REVIEW_MODERATE_FAILED");
  revalidatePath("/admin/reviews");
  if (row?.products?.slug) revalidatePath(`/product/${row.products.slug}`);
}

export async function deleteReviewAdmin(reviewId: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { data: row } = await supabase.from("reviews").select("products(slug)").eq("id", reviewId).maybeSingle();
  const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
  if (error) throw new Error("REVIEW_MODERATE_FAILED");
  revalidatePath("/admin/reviews");
  if (row?.products?.slug) revalidatePath(`/product/${row.products.slug}`);
}
```

### Step 5 — `app/admin/reviews/page.tsx` + `loading.tsx`

```tsx
export default async function AdminReviewsPage() {
  const reviews = await getAdminReviews();
  return <ReviewsClient reviews={reviews} />;
}
```

### Step 6 — `components/admin/ReviewsClient.tsx`

Model on `PromosClient.tsx`'s pending/error-per-row pattern, but table columns: **Product** (name, link to `/product/[slug]`), **Author**, **Rating** (plain "4/5" text is fine), **Body** (truncated, `line-clamp-2`), **Date**, **Status** (Visible/Hidden pill), **Actions** (Eye/EyeOff toggle as primary affordance — same "toggle before delete" philosophy as promos; Trash2 two-tap confirm). Add a simple client-side filter tab row (All / Visible / Hidden) — no server round-trip needed, list is small.

### Step 7 — `AdminSidebar.tsx`

Add `{ href: "/admin/reviews", label: "Reviews", icon: Star }` to `NAV_ITEMS` (the single shared array drives both mobile pills and desktop sidebar — no second list to update).

## Edge cases a weaker model would miss

- **Rating/review_count drift**: hiding a review must decrement the product's public `rating`/`review_count`, not just remove it from the visible list — the trigger fix in Step 1 is not optional, and it must fire on the hide UPDATE (it already does, since the trigger is unconditional on `insert or update or delete`).
- **Embedded-filter syntax**: `.eq("reviews.hidden", false)` must be chained on the query builder, not put inside the `.select()` string — putting it in the select string is a silent no-op (PostgREST ignores unknown modifiers there).
- **Admin's own RLS policy must be separate from `reviews_update_own`**: the owner policy's `WITH CHECK` requires `has_purchased_product()`, which an admin moderating someone else's review will never satisfy — Postgres RLS OR's multiple policies for the same command, so adding a distinct admin policy (not editing the owner one) is required.
- **Delete is real deletion**: unlike promo codes (safe to delete because orders don't reference them), a deleted review has no downstream reference either (`reviews` isn't FK'd from anywhere) — safe, but the trigger still needs to fire on delete to recompute the aggregate (it does).
- **No i18n**: admin-only, stays English/LTR.
- **Stale admin session**: `assertAdmin()` throwing mid-session must land in the row's error slot, not crash the page (copy `PromosClient`'s `withPending`/`rowError` pattern exactly).

## Acceptance criteria

1. `/admin/reviews` lists every review (including ones with `hidden = true` if any exist) with correct product name/author/rating/date.
2. Hiding a review: it disappears from the product's public `/product/[slug]` reviews list and stops counting in the product's rating average and `review_count` (verify via SQL on `products`); it still appears in `/admin/reviews` marked Hidden.
3. Unhiding restores both the display and the aggregate numbers.
4. Deleting a review (two-tap confirm) permanently removes it from `/admin/reviews` and the storefront; aggregate recomputes correctly.
5. As a non-admin: `/admin/reviews` unreachable, `hideReview`/`deleteReviewAdmin` throw "Not authorized", and a direct anon REST `update`/`delete` on `reviews` is rejected by RLS.
6. `npx tsc --noEmit` and `npm run lint` clean.
