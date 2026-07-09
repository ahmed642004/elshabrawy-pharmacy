# PLAN: Installable PWA (home-screen app like the delivery apps)

**New-batch rank: 4 of 5 (cheap, and it's the feature customers can *see* — the store becomes an app icon on their phone).**

## Goal

There is no `app/manifest.ts`, no icons, no PWA anything (verified by glob). On a phone, the store is just a browser tab; Talabat/Breadfast live on the home screen. Ship a proper web-app manifest + icons + install affordance so Android/Chrome offers "Add to Home Screen" with a branded icon and the site opens standalone (no browser chrome), plus the iOS-specific meta equivalents.

**Deliberately out of scope for v1**: a service worker / offline mode / push notifications. Chrome no longer requires a service worker for installability (manifest + icons suffice), and offline for a live-priced store is a real design problem, not a checkbox. Note it as the follow-up.

## Current shape (verified)

- `app/layout.tsx` already exports `metadata` with `metadataBase` (from the SEO plan). Next.js supports a typed `app/manifest.ts` metadata route — use it (it serves `/manifest.webmanifest` and wires the `<link>` automatically).
- Brand: primary `#0F52FF`, the logo mark used across the app is a white `Plus` (lucide) in a `rounded-[10px]` primary-blue square (see `components/Footer.tsx`/`Header`). Site name: "Elshabrawy Pharmacy" / «صيدلية الشبراوي».
- Arabic is the default storefront locale → the manifest ships Arabic-first (`lang: "ar"`, `dir: "rtl"`) with the Arabic name. (A manifest is a single static document — it cannot follow the locale cookie; picking the default locale is correct.)
- No icon assets exist beyond `app/favicon.ico`.

## Exact files to touch

| File | Change |
|---|---|
| `app/manifest.ts` | NEW — typed manifest route |
| `public/icons/icon.svg` | NEW — master icon (hand-written SVG) |
| `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png` (180) | NEW — rasterized from the SVG |
| `scripts/generate-icons.mjs` | NEW — one-off rasterizer (sharp as devDependency) |
| `package.json` | `sharp` devDependency + `"generate-icons"` script |
| `app/layout.tsx` | `icons.apple` in metadata + `viewport` export with `themeColor` |

## Step-by-step implementation order

### Step 1 — Master icon `public/icons/icon.svg`

Hand-write it — the existing logo is geometrically trivial (rounded square + plus):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="120" fill="#0F52FF"/>
  <rect x="216" y="128" width="80" height="256" rx="24" fill="#fff"/>
  <rect x="128" y="216" width="256" height="80" rx="24" fill="#fff"/>
</svg>
```

### Step 2 — `scripts/generate-icons.mjs`

```js
// One-off: node scripts/generate-icons.mjs
import sharp from "sharp";
const src = "public/icons/icon.svg";
await sharp(src).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(src).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(src).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");
// Maskable: same art but padded — the safe zone is the inner 80%; rebuild the
// SVG with the mark scaled to ~70% on a full-bleed background so Android's
// circle/squircle masks don't clip the plus.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0F52FF"/>
  <g transform="translate(76.8,76.8) scale(0.7)">
    <rect x="216" y="128" width="80" height="256" rx="24" fill="#fff"/>
    <rect x="128" y="216" width="256" height="80" rx="24" fill="#fff"/>
  </g>
</svg>`;
await sharp(Buffer.from(maskable)).resize(512, 512).png().toFile("public/icons/icon-512-maskable.png");
console.log("icons written");
```

Install `sharp` as a **devDependency** (it's a build-time tool here, not shipped), run the script once, commit the PNGs. Add `"generate-icons": "node scripts/generate-icons.mjs"` to package.json scripts.

### Step 3 — `app/manifest.ts`

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "صيدلية الشبراوي",
    short_name: "الشبراوي",
    description: "صيدلية مرخّصة — عناية بالبشرة وفيتامينات ومكملات توصلك لحد باب البيت.",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0F52FF",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

### Step 4 — `app/layout.tsx`

- Add to the existing `metadata` export: `icons: { apple: "/icons/apple-touch-icon.png" }` (iOS ignores the manifest for its icon).
- Add a `viewport` export (Next's typed API): `export const viewport: Viewport = { themeColor: "#0F52FF" };` — colors the Android status bar in standalone mode.

### Step 5 — Verify installability

In the preview browser: DevTools → Application → Manifest must show no warnings (name, icons incl. maskable, start_url, display all green) and `/manifest.webmanifest` must return 200 with `content-type` including `manifest`. Lighthouse's installability audit passing is the acceptance proof.

## Edge cases a weaker model would miss

- **Maskable is its own asset, not a `purpose` flag on the same PNG**: the normal icon's plus reaches too close to the edges — Android's circular mask would clip it. The padded maskable variant (safe-zone = inner 80%) is required for a non-broken launcher icon.
- **iOS doesn't read manifest icons**: without `icons.apple` in metadata (→ `<link rel="apple-touch-icon">`), "Add to Home Screen" on Safari falls back to a page screenshot. iOS also ignores `display: standalone` unless `apple-mobile-web-app-capable` is implied — Next emits the right meta from the metadata API; verify the rendered `<head>` includes `apple-touch-icon`.
- **`themeColor` moved to the `viewport` export** in modern Next — putting it in `metadata` logs a warning and gets ignored.
- **Manifest is locale-static**: it can't follow the NEXT_LOCALE cookie. Arabic-first matches the default audience; the English UI still works inside the installed app (the app content itself stays bilingual — only the launcher name is fixed).
- **`start_url: "/"` + cookie locale means the installed app opens in whatever locale the user last chose** — correct behavior for free, worth stating in the report.
- **sharp on Windows**: installs prebuilt binaries — if `npm i -D sharp` fails in this environment, fall back to generating the PNGs with any available tool and note it; do NOT ship SVG-only icons (iOS + maskable both need PNG).
- **No service worker also means no offline error page**: opening the installed app with no network shows the browser dinosaur — accepted v1 limitation, listed in the report as the natural follow-up (SW + offline shell + push notifications ride the same registration).
- **Don't cache-bust the icons with hashed names**: launcher icons are referenced by fixed manifest URLs; renaming them later orphans installed icons until re-install.

## Acceptance criteria

1. DevTools → Application → Manifest: zero installability warnings; all three icons render in the panel, the maskable preview shows the plus uncropped inside the circle mask.
2. Lighthouse (mobile) installability check passes.
3. Chrome on desktop shows the install icon in the omnibox; installing opens the site standalone (no browser chrome) with the blue status/title bar.
4. `GET /manifest.webmanifest` returns the Arabic name/dir and correct icon paths (curl-verifiable).
5. Rendered `<head>` contains `apple-touch-icon` link and theme-color meta.
6. `npm run build` clean; no `sharp` in production `dependencies` (devDependencies only).
