# CLAUDE.md

Concise guidance for agents working in this repository.

## Project

Elshabrawy Pharmacy storefront (OTC cosmetics/supplements only).

- Stack: Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, Supabase (`@supabase/supabase-js`, `@supabase/ssr`).
- Shared UI chrome: `Header` + `Footer` in `app/(shop)/layout.tsx`.
- Auth page is outside `(shop)` with custom minimal chrome.

## Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
npx tsc --noEmit
```

No test runner is configured.

## Environment

Use `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Without these, Supabase-backed pages fail at build/runtime.

## Core implementation rules

1. **Next.js 16 async params**
   - In dynamic pages/layouts, always `await params` / `await searchParams`.

2. **Supabase client usage**
   - Never instantiate Supabase directly in app code.
   - Browser: `lib/supabase/client.ts`
   - Server: `lib/supabase/server.ts`
   - Middleware refresh path: `proxy.ts` -> `lib/supabase/middleware.ts`

3. **Category/listing behavior**
   - Canonical all-products route is `/category`.
   - `lib/queries.ts` is the server data-access layer (`getCategories`, `getFilteredProducts`, etc.).
   - Listing filters/sort are URL-driven (`cat`, `brand`, `price`, `sort`) and applied server-side.

4. **Cart**
   - Source of truth for UI is `lib/cart-context.tsx`.
   - Guest cart: localStorage.
   - Signed-in cart: localStorage + server sync (`cart_items` + `replace_cart()` RPC).
   - Keep cart math in `lib/cart-totals.ts`.

5. **Checkout**
   - Requires signed-in user.
   - Order creation goes through server action in `lib/actions.ts`, calling DB `create_order()`.
   - Do not add payment gateway logic; payment methods are UI + enum persistence only.

6. **Admin**
   - `/admin*` is staff-only (`profiles.is_admin`) with both middleware and server checks.
   - Admin writes must re-check admin authorization in server actions.

## Architecture map (high level)

- `app/(shop)/page.tsx`: Home
- `app/(shop)/category/page.tsx`: All products listing
- `app/(shop)/category/[slug]/page.tsx`: Category listing
- `app/(shop)/product/[slug]/page.tsx`: Product detail
- `app/(shop)/cart/page.tsx`: Cart
- `app/(shop)/checkout/page.tsx`: Checkout
- `app/(shop)/search/page.tsx`: Search
- `app/(shop)/account/orders/page.tsx`: Customer order history
- `app/auth/page.tsx`: Sign in/up
- `app/admin/*`: Ops dashboard

Shared building blocks:

- `components/ProductCard.tsx`
- `components/Header.tsx`, `components/HeaderClient.tsx`
- `components/Footer.tsx`
- `components/ui/*`
- `lib/queries.ts`, `lib/actions.ts`, `lib/cart-context.tsx`, `lib/cart-totals.ts`

## Database / migrations

- Migrations are hand-written SQL in `supabase/migrations/`.
- Apply via Supabase MCP (no local Supabase CLI stack in this repo).
- Regenerate `lib/database.types.ts` after schema changes.

Key entities: `categories`, `products`, `product_images`, `reviews`, `profiles`, `addresses`, `orders`, `order_items`, `cart_items`.

## Internationalization

- Storefront supports Arabic + English using `next-intl` (cookie-based locale, no URL prefix).
- Arabic is default storefront locale; admin remains English/LTR.
- Keep `messages/ar.json` and `messages/en.json` in key parity.

## Design system / conversion workflow

- Source design project: **Pharmacy E-Commerce Website**
  - `projectId: 9d35f47e-f429-46c2-9665-0e3bce2f60a7`
- Convert `.dc.html` exports into real Next.js components manually.
- Reuse existing primitives/components; do not duplicate page-specific markup patterns.

Token reminders (already wired in `app/globals.css`):

- Primary: `#0F52FF`
- Secondary: `#0D9488`
- Tertiary: `#F0F9FF`
- Neutral: `#64748B`
- Fonts: Public Sans (headline), Inter (body), Cairo for Arabic UI.

## Domain constraints

- No prescription products/flows.
- Checkout methods: COD, card, mobile wallet (no processor integration).
- Delivery fee logic currently flat placeholder rule in `lib/cart-totals.ts`.
- Browsing/cart are public; placing orders requires auth.

## Coding conventions

- Reuse shared components (`ProductCard`, `Header`, `Footer`, `components/ui/*`).
- Mobile-first (target breakpoints: 375 / 768 / 1440).
- Keep UI copy emoji-free.
- Follow current Tailwind and component patterns in the repo.
