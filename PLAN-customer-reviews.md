# PLAN: Let customers write reviews

## Goal

Product pages render reviews (`ProductReviews`, fed by the `reviews` join in `getProductBySlug`) but there is **no write path** — the table is seed-data only. Add "write a review" for signed-in customers who bought the product, with one review per customer per product.

## Files to touch

1. `supabase/migrations/0018_reviews_user_writes.sql` (new)
2. `lib/actions.ts` — `submitReview` server action
3. `components/product/ProductReviews.tsx` — review form (needs a small client child component; check whether the file is currently a server component and keep the page server-rendered)
4. `app/(shop)/product/[slug]/page.tsx` — pass `slug` + signed-in state down if not already available
5. `messages/en.json` + `messages/ar.json` — `product.reviewForm.*` namespace
6. `lib/database.types.ts` — regenerate

## Implementation order

### Step 1 — Migration

The `reviews` table (0001) has NO `user_id` — reviews can't be attributed or deduplicated without it:

```sql
alter table public.reviews add column user_id uuid references auth.users (id) on delete set null;
-- Partial unique index, NOT a table constraint: legacy seed rows have NULL
-- user_id and must not collide.
create unique index reviews_one_per_user_product
  on public.reviews (product_id, user_id) where user_id is not null;

alter table public.reviews enable row level security;  -- check 0001/0009 first; enable only if not already
create policy reviews_public_read on public.reviews for select using (true);
create policy reviews_insert_own on public.reviews for insert to authenticated
  with check (user_id = auth.uid());
```

Verified-purchase gate as a security-definer helper (order_items stores `product_slug`, NOT product_id — join through it):

```sql
create or replace function public.has_purchased(p_product_slug text)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.user_id = auth.uid() and oi.product_slug = p_product_slug
  );
$$;
```

Enforce it in the insert policy (`and public.has_purchased(...)` needs the slug — simpler: enforce in the server action and keep RLS to identity + rate assumptions; state clearly in a comment that the purchase check is app-level).

### Step 2 — `lib/actions.ts`

`submitReview({ productSlug, rating, body })`:
- Get user from the server client; throw if not signed in.
- `rating` int 1-5 (server-side check — don't rely on the `<select>`); `body` trimmed, max ~1000 chars, empty → null.
- Call `has_purchased` RPC; throw a typed `NOT_PURCHASED` error if false.
- Resolve `product_id` from the slug; `upsert` on `(product_id, user_id)` (`onConflict: "product_id,user_id"`) so re-reviewing edits instead of erroring.
- `author_name`: fetch `profiles.full_name`, fallback en/ar handled client-side — store the name string.
- `revalidatePath(/product/${productSlug})`.

### Step 3 — UI

In `ProductReviews`: a client `ReviewForm` (stars via 5 radio buttons styled with the existing `Star` icon pattern, textarea styled like `ProductFormModal`'s `textareaClass`, submit `Button`). States: not signed in → link to `/auth?redirect=/product/<slug>` using existing gate-string style; signed in but `NOT_PURCHASED` error → hint text; success → form collapses into a "thanks" line and the new review appears (server revalidate + `router.refresh()`).

### Step 4 — i18n (both files, parity)

`product.reviewForm`: `title`, `ratingLabel`, `bodyPlaceholder`, `submit`, `submitting`, `signInPrompt`, `notPurchased` ("Only customers who bought this product can review it." / "فقط العملاء الذين اشتروا هذا المنتج يمكنهم تقييمه."), `thanks`, `error`.

## Edge cases a weaker model would miss

- **Partial unique index vs. constraint** (seed rows with NULL user_id).
- **Check whether RLS is already enabled** on `reviews` before adding `enable row level security` blindly — 0009 touched policies broadly; read it.
- `order_items.product_slug` is nullable and a *snapshot* — a renamed/deleted product breaks the purchase join; acceptable, but don't join through products.id.
- Rating aggregates (`product.rating`, `reviewCount`) are computed in `lib/queries.ts` from the joined rows — a new review updates them automatically after revalidation; do NOT add a counter column.
- The star input must be RTL-correct: use logical ordering (render 1→5 and let `dir` mirror it; don't absolutely position stars).
- Arabic review bodies are user content — they render fine, but ensure the textarea inherits the page `dir` (it does by default; don't force `dir="ltr"`).
- `t.rich` is available if the sign-in prompt needs an inline link (pattern exists in `DeliveryStep`).

## Acceptance criteria

1. tsc + lint clean; message parity holds.
2. Preview (signed-in test user who has an order containing product X): submit a 4-star review with body on X → it appears in the list with the profile name, and the header rating/count update.
3. Submit again → the existing review is updated (no duplicate row).
4. A signed-in user who never bought X sees the `notPurchased` message on submit (or the form pre-blocked if you pre-check — either is acceptable, but the server must enforce regardless).
5. Signed-out users see the sign-in prompt, not the form.
6. Direct RPC/table insert as a non-purchaser authenticated user is rejected or at minimum the server action path is closed (document which layer enforces).
