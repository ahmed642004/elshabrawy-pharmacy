# PLAN: Dead-UI cleanup — real footer links, working Share, cart guards

**Leverage rank: 2 of 5.**

## Goal

Stop the storefront lying to users. Today: every footer link is a dead `<span>`, the product-page Share button has no `onClick`, the wishlist heart is a `useState` that forgets on reload, cart quantity is unbounded, and a cart containing an out-of-stock item lets you proceed to checkout only to fail server-side. Fix all five. Pure app code — no schema changes.

## Exact files to touch

| File | Change |
|---|---|
| `components/Footer.tsx` | Real `<Link>`s for pages that exist |
| `components/product/ProductPurchasePanel.tsx` | Working Share; remove fake wishlist heart; qty cap |
| `components/cart/CartItemRow.tsx` | Disable `+` at qty cap |
| `components/cart/CartPageClient.tsx` | Out-of-stock checkout guard |
| `lib/cart-context.tsx` | Clamp qty in `addItem`/`updateQty`/hydration/merge |
| `lib/cart-totals.ts` | `export const MAX_ITEM_QTY = 10;` |
| `messages/en.json` + `messages/ar.json` | `product.linkCopied`, `cart.removeOutOfStock`; REMOVE wishlist keys from BOTH |

## Step-by-step implementation order

### Step 1 — `MAX_ITEM_QTY` constant

In `lib/cart-totals.ts`: `export const MAX_ITEM_QTY = 10;` (the `create_order` RPC hard-caps at 99; 10 is the UX cap).

### Step 2 — Clamp in `lib/cart-context.tsx`

The clamp must live in the context, not just the buttons, because localStorage can already hold qty > 10 (hand-edited or pre-cap sessions) and the sign-in merge (`mergeCartLists` / `mergeItemInto`) can sum two carts above the cap. Clamp in three places:

- inside `mergeItemInto`: `qty: Math.min(existing.qty + incoming.qty, MAX_ITEM_QTY)` (and for new lines `Math.min(qty, MAX_ITEM_QTY)`);
- in `updateQty`: `Math.min(Math.max(1, qty), MAX_ITEM_QTY)`;
- on localStorage hydration: map loaded items through the same clamp.

### Step 3 — Disable `+` at cap

- `components/cart/CartItemRow.tsx` (~lines 76-83): the increment button gets `disabled={item.qty >= MAX_ITEM_QTY}` plus the repo's existing disabled styling.
- `components/product/ProductPurchasePanel.tsx` qty stepper (~lines 103-110): `setQty(q => Math.min(MAX_ITEM_QTY, q + 1))` and disable `+` at the cap.

### Step 4 — Working Share (`ProductPurchasePanel.tsx` ~lines 140-142)

```tsx
async function handleShare() {
  const url = window.location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: productName, url });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      showToast(t("linkCopied"));
    }
  } catch (err) {
    // User dismissed the native share sheet — not an error, stay silent.
    if ((err as Error).name !== "AbortError") {
      /* silent no-op; do not toast an error for a share */
    }
  }
}
```

Use the existing `useToast` from `components/ui/ToastProvider.tsx`. Add key `product.linkCopied` to both message files (ar: «تم نسخ الرابط»).

### Step 5 — Remove the fake wishlist heart (`ProductPurchasePanel.tsx` ~lines 128-139)

Delete the heart button, its `wishlisted` state, and the `Heart` lucide import. A heart that forgets on reload erodes trust; a real wishlist can come later with its own table (see back-in-stock plan for the pattern). Remove the now-unused wishlist i18n keys (e.g. `product.addToWishlist` / `product.wishlisted` — grep first for the exact names) from **BOTH** `en.json` and `ar.json` in the same commit — removing from only one breaks key parity.

### Step 6 — Footer real links (`components/Footer.tsx`)

Currently a server component rendering pure `<span>`s (lines ~6-33) with a stale comment saying no destinations exist. Restructure the column data to `{ key, href? }` and render `<Link>` when `href` is present, `<span>` otherwise:

- `skincare` → `/category/skincare`
- `vitamins` → `/category/vitamins`
- `hair` → `/category/hair`
- `offers` → `/category/offers` (this page EXISTS now — the comment is stale)
- `track` → `/account/orders` (handles signed-out state itself)
- Keep `about, careers, pharmacies, help, ask, privacy, terms, licensing` as spans — those pages genuinely don't exist. Do NOT invent routes for them.

Links get a hover style consistent with the header (`hover:text-...` per existing palette). `next/link` + `useTranslations` both work in RSC — the component stays a server component. Update the stale comment.

### Step 7 — Out-of-stock checkout guard

There are TWO Proceed buttons that push `/checkout` unconditionally: the mobile sticky bar in `components/cart/CartPageClient.tsx` (~line 119) AND the desktop summary card in `components/cart/OrderSummary.tsx` (~line 63). Guard both. Compute once:

```tsx
const hasOutOfStock = items.some((i) => i.stock === "out");
```

In `CartPageClient` (which owns the items) and pass a `disabled`/`hasOutOfStock` prop down to `OrderSummary` if it doesn't already receive the items. Disable both Proceed buttons when `hasOutOfStock` and render a small hint line: `t("cart.removeOutOfStock")` (en: "Remove out-of-stock items to continue", ar: «احذف المنتجات غير المتوفرة للمتابعة»). Out-of-stock rows are already greyed by `CartItemRow` — this just closes the gap where failure only surfaced as a server error at `create_order`.

## Edge cases a weaker model would miss

- **Clamp in the context, not the UI**: pre-existing localStorage carts and the sign-in server-merge both bypass button-level caps. The context is the single source of truth and syncs to `cart_items` via `replace_cart` — a >10 qty there would persist server-side.
- **`navigator.share` throws `AbortError`** when the user closes the sheet — must not surface as an error. It also requires HTTPS + user gesture; `navigator.clipboard` can be `undefined` on insecure origins — guard both, fall through silently.
- **i18n parity**: every key added or removed must change in BOTH message files. The wishlist-key removal is where a weaker model will forget `ar.json`.
- **Footer is RSC**: don't add `"use client"` — `next/link` and next-intl's `useTranslations` work in server components.
- **RTL**: no physical `ml-`/`mr-` classes; use `gap`/logical properties like the rest of the repo.
- **Don't touch the ProductCard bell**: the out-of-stock bell on `components/ProductCard.tsx` stays as-is — the back-in-stock plan (rank 5) makes it functional. Touching it twice creates merge pain.
- **UI copy is emoji-free** (repo rule).

## Acceptance criteria

1. In both locales (flip the language switcher), footer links for skincare/vitamins/hair/offers/track navigate to real pages; the other footer items remain plain text; RTL layout unaffected.
2. Share on a mobile/HTTPS context opens the native sheet; on desktop it copies the URL and shows the "link copied" toast; cancelling the native sheet produces no toast and no console error.
3. No heart button remains on the product page; `grep -r wishlist` (case-insensitive) over `components/`, `messages/` returns nothing.
4. Cart `+` stops at 10 on both the PDP stepper and the cart row; hand-editing localStorage to qty 50 clamps back to 10 on reload; the server-synced cart never receives qty > 10.
5. With an out-of-stock item in the cart, Proceed is disabled with the hint line; removing that item re-enables it.
6. `npx tsc --noEmit` and `npm run lint` clean; message files in key parity.
