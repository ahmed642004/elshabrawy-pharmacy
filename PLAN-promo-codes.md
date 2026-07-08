# PLAN: Real promo codes (currently ANY code gives EGP 20 off)

## Goal

The promo field is decorative security theater: `lib/cart-context.tsx:216` sets `promoApplied` whenever the typed code is non-empty, and `lib/cart-totals.ts` hardcodes `PROMO_DISCOUNT = 20`. Typing "asdf" gets a discount. Replace with a `promo_codes` table, server-side validation, and server-side application inside `create_order`.

**Dependency: do PLAN-secure-order-totals.md FIRST** — this plan changes the `p_promo_applied boolean` parameter introduced there into `p_promo_code text`.

## Files to touch

1. `supabase/migrations/0016_promo_codes.sql` (new)
2. `lib/actions.ts` — new `validatePromo` server action + `placeOrder` input change
3. `lib/cart-context.tsx` — promo state (`promoCode`, `promoApplied`, `applyPromo`) becomes `{ code, discount } | null` validated via server
4. `lib/cart-totals.ts` — `getCartTotals(items, promoDiscount: number)` (amount, not boolean)
5. Call sites of `getCartTotals` / `promoApplied` — grep for both; expect `CartPageClient.tsx`, `OrderSummary.tsx`, `CheckoutSummary.tsx`, `CheckoutClient.tsx`
6. `messages/en.json` + `messages/ar.json` — invalid/expired promo strings (check the existing `cart` namespace for current promo keys first; reuse where possible)
7. `lib/database.types.ts` — regenerate

## Implementation order

### Step 1 — Migration

```sql
create table public.promo_codes (
  code text primary key check (code = upper(code)),
  discount_egp numeric(10,2) not null check (discount_egp > 0),
  min_subtotal numeric(10,2) not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.promo_codes enable row level security;
-- NO select policy for anon/authenticated: customers must not enumerate codes.
-- Admins manage rows via the is_admin() pattern from 0009:
create policy promo_admin_all on public.promo_codes for all
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.validate_promo(p_code text, p_subtotal numeric)
returns numeric language sql security definer set search_path = public stable as $$
  select discount_egp from public.promo_codes
  where code = upper(trim(p_code)) and active
    and (expires_at is null or expires_at > now())
    and p_subtotal >= min_subtotal
$$;
grant execute on function public.validate_promo(text, numeric) to authenticated, anon;

insert into public.promo_codes (code, discount_egp, min_subtotal) values ('WELCOME20', 20, 100);
```

Inside `create_order` (modify the 0015 version in this same migration): replace `p_promo_applied boolean` with `p_promo_code text default null`; compute `v_discount := coalesce(public.validate_promo(p_promo_code, v_subtotal), 0)` and clamp with `least(v_discount, v_subtotal)`. Drop the 0015 signature (overload rule again).

### Step 2 — Server action

In `lib/actions.ts`: `export async function validatePromo(code: string, subtotal: number): Promise<number | null>` calling the RPC and returning the discount (null = invalid).

### Step 3 — Cart context

Replace the `promoCode`/`promoApplied` pair with `promo: { code: string; discount: number } | null` plus `applyPromo(code, subtotal)` (async, calls the action) and `clearPromo()`. Persist `promo` in the existing localStorage payload. **Keep the context API surface minimal and update every consumer in the same pass.**

### Step 4 — Totals + UI

`getCartTotals(items, promoDiscount: number)`; discount line renders only when > 0. The promo input's Apply button shows the invalid state (reuse/extend existing cart namespace strings; add `promoInvalid` en "This code isn't valid" / ar "هذا الكود غير صالح" if no equivalent exists).

### Step 5 — Checkout

`placeOrder` sends `promoCode: promo?.code ?? null`. Server revalidates — a code that expired between cart and checkout silently drops to 0 discount server-side; surface the server-computed discount on the confirmation via `/account/orders` (already reads DB).

## Edge cases a weaker model would miss

- **Function overload again**: dropping the previous `create_order` signature is mandatory.
- **No SELECT policy on promo_codes for customers** — validation must go through the `security definer` function or anyone can `select *` the code list.
- Uppercase normalization on BOTH sides (`upper(trim(...))` in SQL; display whatever the user typed).
- localStorage-persisted promo can be stale: revalidate at checkout inside `create_order` (already in design) — do not trust the cached discount amount for the DB write.
- `min_subtotal` interacts with cart edits: if the user removes items after applying, `getCartTotals` must clamp `discount` to ≤ subtotal, and the checkout revalidation handles the rest.
- The Arabic locale is default: test the promo input in RTL (icon/button order uses logical utilities already — follow existing markup in `OrderSummary.tsx`).

## Acceptance criteria

1. tsc + lint clean; both message files in key parity.
2. In preview: applying `WELCOME20` with subtotal ≥ 100 shows -EGP 20; applying `asdf` shows the invalid message and NO discount (this is the regression the whole plan exists to fix).
3. Applying `WELCOME20` with subtotal < 100 is rejected.
4. Place an order with the code: DB `orders.discount = 20`. Place one without: `discount = 0`.
5. Direct RPC call to `create_order` with a fake code yields discount 0.
