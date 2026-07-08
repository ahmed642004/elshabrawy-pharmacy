# PLAN: SEO metadata, sitemap/robots, and error/404 pages

**Leverage rank: 3 of 5.**

## Goal

Every product and category page currently shares the single generic site title from `app/layout.tsx` — no per-page `<title>`, description, OpenGraph, sitemap, or robots. There are also **zero** `error.tsx` / `not-found.tsx` files: `notFound()` on the product page renders the unstyled Next default, and any thrown error white-screens. Add localized per-page metadata, `sitemap.ts`, `robots.ts`, and styled 404/error surfaces. Pure app code — no schema change.

## Exact files to touch

| File | Change |
|---|---|
| `lib/queries.ts` | Wrap `getProductBySlug` in React `cache()`; add `getAllProductSlugs()` |
| `app/(shop)/product/[slug]/page.tsx` | Add `generateMetadata` |
| `app/(shop)/category/[slug]/page.tsx` | Add `generateMetadata` |
| `app/layout.tsx` | Add `metadataBase` + default OpenGraph |
| `app/sitemap.ts` | NEW |
| `app/robots.ts` | NEW |
| `app/not-found.tsx` | NEW (root 404) |
| `app/(shop)/product/[slug]/not-found.tsx` | NEW (shop-chrome 404 for `notFound()`) |
| `app/(shop)/error.tsx` | NEW (client, localized) |
| `app/admin/error.tsx` | NEW (client, English) |
| `messages/en.json` + `messages/ar.json` | `notFound.*`, `errorPage.*` namespaces |
| `.env.local` | `NEXT_PUBLIC_SITE_URL` (document in README/CLAUDE if desired) |

## Step-by-step implementation order

### Step 1 — `lib/queries.ts`

```ts
import { cache } from "react";
// Wrap so generateMetadata + the page body share ONE Supabase fetch per request:
export const getProductBySlug = cache(async (slug: string): Promise<...> => { ...existing body... });
```

Add a lightweight sitemap query:

```ts
export async function getAllProductSlugs(): Promise<{ slug: string; createdAt: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("slug, created_at");
  if (error || !data) return [];
  return data.map((r) => ({ slug: r.slug, createdAt: r.created_at }));
}
```

### Step 2 — Product `generateMetadata` (`app/(shop)/product/[slug]/page.tsx`)

```tsx
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;               // Next 16: params is a Promise here too
  const [product, t] = await Promise.all([getProductBySlug(slug), getTranslations("common")]);
  if (!product) return { title: t("siteTitle") }; // page will 404 anyway
  const description = truncateForMeta(product.description ?? "", 160) || t("siteDescription");
  return {
    title: `${product.name} | ${t("siteTitle")}`,
    description,
    alternates: { canonical: `/product/${slug}` },
    openGraph: {
      title: product.name,
      description,
      images: product.images[0] ? [product.images[0]] : undefined, // Supabase URLs are absolute
    },
  };
}
```

`truncateForMeta`: strip newlines (`replace(/\s+/g, " ")`), and if longer than 160 slice at the last space before 160 and append `…` — do not slice mid-word (Arabic text especially). Small local helper; put it near the top of the page file or in `lib/format.ts` if that exists.

Check the exact shape returned by `getProductBySlug` (field names for images/description) before writing — use what's there.

### Step 3 — Category `generateMetadata` (`app/(shop)/category/[slug]/page.tsx`)

Await `params`; fetch `getCategories()` (cheap, cached by Next fetch dedupe within the request via `cache()` if you also wrap it — optional). Resolve the label using the existing locale-aware label logic in that page (there is a `categoryLabel`-style helper or inline `locale === "ar" ? label_ar : label` — reuse it). Special cases:

- `slug === "offers"` → use the existing `listing.offersTitle` translation.
- Unknown slug → return generic site title (page handles its own empty state).

Title: `${label} | ${siteTitle}`.

### Step 4 — `app/layout.tsx`

In the existing `generateMetadata`, add:

```ts
metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
openGraph: { siteName: t("siteTitle"), type: "website" },
```

Add `NEXT_PUBLIC_SITE_URL=` to `.env.local` (production value when deployed). Without `metadataBase`, Next 16 warns on every OG resolution.

### Step 5 — `app/sitemap.ts`

```ts
import type { MetadataRoute } from "next";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [products, categories] = await Promise.all([getAllProductSlugs(), getCategories()]);
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/category`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/category/offers`, changeFrequency: "daily", priority: 0.8 },
    ...categories.map((c) => ({ url: `${base}/category/${c.id}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...products.map((p) => ({ url: `${base}/product/${p.slug}`, lastModified: new Date(p.createdAt), priority: 0.6 })),
  ];
}
```

**Caveat**: `lib/supabase/server.ts` `createClient` calls `cookies()`. If `next build` errors on the sitemap route because of that, create the client inline in `sitemap.ts` with bare `@supabase/supabase-js` `createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)` (anon read of public tables — RLS allows product/category SELECT). Leave a comment explaining why.

Check `getCategories()`'s return shape for the category identifier field (`id` vs `slug`) — use what routes actually use (`/category/[slug]` pages are keyed by the category id strings like `skincare`).

### Step 6 — `app/robots.ts`

```ts
import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/cart", "/checkout", "/auth", "/search"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
```

Do NOT disallow `/product` or `/category` — those are the pages being SEO'd.

### Step 7 — 404 pages

- `app/not-found.tsx` — **server component** (may use `getTranslations`). Renders inside the root layout (fonts/dir/providers apply, but NO shop header — that's fine; it also catches `/admin/junk`). Content: card styled like the repo's empty states (`rounded-[28px]` card, icon, heading `t("notFound.title")`, body `t("notFound.body")`, `Button` linking home with `t("notFound.home")`).
- `app/(shop)/product/[slug]/not-found.tsx` — same card, but this one automatically gets the shop Header/Footer from the segment layout; shown when `page.tsx` calls `notFound()` for an unknown slug. Copy: `notFound.productTitle` / `notFound.productBody` + a Button to `/category`.

### Step 8 — Error boundaries

Both must be `"use client"` with `({ error, reset }: { error: Error & { digest?: string }; reset: () => void })`.

- `app/(shop)/error.tsx` — uses `useTranslations("errorPage")` (works: `NextIntlClientProvider` sits in the root layout above this segment). Card with `t("title")`, `t("body")`, and a Button calling `reset()` labeled `t("retry")`.
- `app/admin/error.tsx` — hardcoded English strings (admin is deliberately unlocalized/LTR). Same structure, no i18n.

### Step 9 — i18n keys (both files)

`notFound.title/body/home/productTitle/productBody/browse`, `errorPage.title/body/retry`. Natural Arabic in `ar.json`.

## Edge cases a weaker model would miss

- **`params` is a Promise in `generateMetadata` too** (Next 16) — must `await params`, exactly like the page component.
- **Without `cache()`** around `getProductBySlug`, each product request hits Supabase twice (metadata + body).
- **`error.tsx` must be a client component** and therefore cannot use `getTranslations` (server-only) — `useTranslations` works only because the intl provider is in the ROOT layout, above both `(shop)` and `admin` segments.
- **No hreflang/`alternates.languages`**: the locale is cookie-based on a single URL — emitting hreflang pairs pointing at the same URL is invalid SEO. Canonical only.
- **Metadata language follows the cookie**: crawlers (no cookie) get the default locale (Arabic) — that is the intended primary market; don't try to force English for bots.
- **OG description hygiene**: strip newlines, truncate at a word boundary (~160 chars); Arabic must not be chopped mid-word.
- **`metadataBase` required** even though Supabase image URLs are absolute — Next 16 warns and OG URL resolution needs it for canonical.
- **robots**: keep `/search` disallowed (infinite query-param space) but never `/product` / `/category`.
- **Root `not-found.tsx` renders without shop chrome** — expected; the product-segment one has chrome. Don't try to mount `Header` in the root 404 (it would drag shop data fetching into every unmatched URL, including admin typos).
- **`npm run build`** is the real verification for sitemap/robots (they're build-time routes in dev too, but build surfaces the `cookies()` issue if present).

## Acceptance criteria

1. `curl -s localhost:3000/product/vitamin-c-1000mg | grep -i "<title>"` → contains the product name + site title; page source has `og:image` pointing at the Supabase image and `og:description`. Repeat with the `NEXT_LOCALE=en` cookie → English title.
2. Category pages show `<title>` with the localized category label; `/category/offers` uses the offers title.
3. `curl localhost:3000/sitemap.xml` lists home, `/category`, `/category/offers`, every category, every product — all absolute URLs. `curl localhost:3000/robots.txt` disallows `/admin` etc. and references the sitemap.
4. `/product/does-not-exist` returns HTTP 404 with the styled, localized card INSIDE shop chrome; `/some-junk` returns the root styled 404.
5. Temporarily throwing inside a shop page shows the localized error card whose "Try again" calls `reset()`; an admin page error shows the English card inside admin chrome. (Remove the test throw after.)
6. `npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass; message files in parity.
