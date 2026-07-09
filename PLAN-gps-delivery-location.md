# PLAN: GPS delivery location ("use my location" like delivery apps)

## Goal

Let a customer capture their real GPS position at checkout (and in account address management) instead of typing everything by hand — the way Talabat/Breadfast do it. Concretely:

1. A **"Use my current location"** button in the checkout new-address form and the account address form. Tapping it asks the browser for GPS coordinates, reverse-geocodes them to a human-readable street/city, prefills those fields (still editable), and stores the exact `lat`/`lng` with the address.
2. Coordinates ride along in the order's existing `shipping` jsonb snapshot, so the **admin orders screen gets a "View on map" link** that opens the exact pin in Google Maps — that's the actual delivery payoff.
3. Kill the misleading hardcoded header chip copy `"Cairo · Nasr City"` (`messages/en.json` `header.location`; ar.json has the Arabic equivalent) — it's static marketing text, not anyone's real location.

GPS is always **optional and additive**. Manual entry keeps working unchanged; a denied permission must never block checkout.

## How it works (mechanism overview, for the user)

- **Getting coordinates**: the browser's built-in Geolocation API (`navigator.geolocation.getCurrentPosition`) — no SDK, no API key, works on mobile + desktop. It requires a secure context (HTTPS, or localhost in dev) and fires the OS permission prompt on first use.
- **Turning coordinates into an address** (reverse geocoding): an external service is required. **Recommended: Nominatim (OpenStreetMap)** — free, no API key, no signup, CORS-enabled for browser calls, supports Arabic output via `accept-language`. Its fair-use policy (max 1 req/sec, no heavy autocomplete) is trivially satisfied here since we geocode once per button tap. Alternatives if quality in Egypt proves lacking: Google Geocoding API (best data for Cairo, but needs a billing-enabled API key) or Mapbox (key, generous free tier). The provider lives in exactly one function so swapping later is a one-function change.
- **No map widget in v1**: showing/dragging a pin needs a map library (Leaflet + OSM tiles is the no-key option) — deliberately deferred. v1 is: tap button → fields prefill → coords saved → admin gets a maps link. A draggable-pin refinement is a natural follow-up.

## Current shape (verified)

- `addresses` (0001): `id, user_id, recipient, phone, street, city, governorate, is_default, created_at` — **no lat/lng columns**. Owner-only RLS on all four verbs.
- `orders.shipping` is **freeform jsonb** written by `create_order(p_shipping jsonb)` (0001/0015/0016) — extra keys pass through with **zero migration and zero RPC signature change**.
- Checkout: `CheckoutClient.tsx` builds `shipping = { fullName, phone, address, city, notes }` at `placeOrder()` (line ~119) from either the selected saved address or the new-address `DeliveryForm`. New-address fields live in `components/checkout/DeliveryStep.tsx` (`DeliveryForm` interface: fullName/phone/address/city/notes).
- Saved addresses: `getAddresses()` (`lib/queries.ts:331`) and `getAccountData()` (`lib/queries.ts:603`) both select from `addresses`; `saveAddress`/`updateAddress` (`lib/actions.ts:111/:173`) insert/update `recipient, phone, street, city`.
- Admin: `toAdminOrder()` (`lib/queries.ts:419`) reads the shipping jsonb into `customerName/customerPhone/customerAddress`; `components/admin/OrdersClient.tsx` renders them. `ShippingSnapshot` type is defined in `lib/queries.ts`.
- Delivery fee is a flat rule in `lib/cart-totals.ts` (free ≥ EGP 300, else EGP 40) — **not** city-dependent; distance-based fees are explicitly out of scope here.
- Header chip: `components/HeaderClient.tsx:232` renders `t("location")` = the hardcoded "Cairo · Nasr City" string.

## Exact files to touch

| File | Change |
|---|---|
| `supabase/migrations/00XX_addresses_geolocation.sql` | NEW — add nullable `lat`, `lng`, `geo_accuracy_m` to `addresses`. Use the next free number at execution time (`ls supabase/migrations` first — PLAN-review-moderation and PLAN-category-management also claim 0024/0025 if they run before this) |
| `lib/database.types.ts` | Regenerate via Supabase MCP |
| `lib/geolocation.ts` | NEW — `getBrowserPosition()` + `reverseGeocode()` (the only provider-specific code) |
| `components/checkout/UseLocationButton.tsx` | NEW — self-contained client button + status line, reused in both forms |
| `components/checkout/DeliveryStep.tsx` | Add `lat`/`lng`/`geoAccuracyM` to `DeliveryForm` (as `number \| null`); mount `UseLocationButton` in the new-address form |
| `components/checkout/CheckoutClient.tsx` | Include coords in the `shipping` snapshot + `saveAddress` call; extend `Address` interface pass-through for saved addresses |
| `lib/actions.ts` | `SaveAddressInput`/`AddressInput` gain optional `lat`/`lng`/`geoAccuracyM`; range-validate server-side before insert/update |
| `lib/queries.ts` | `getAddresses()`/`getAccountData()` select + map the new columns; `ShippingSnapshot` gains optional `lat`/`lng`; `toAdminOrder()` maps them to a new `AdminOrder.geo` field |
| `components/account/AccountClient.tsx` | Mount `UseLocationButton` in the address form; carry coords through save/update |
| `components/admin/OrdersClient.tsx` | "View on map" link (`https://www.google.com/maps?q={lat},{lng}`, `target="_blank" rel="noopener"`) in the order detail when coords exist |
| `messages/en.json` + `messages/ar.json` | New `checkout.geo.*` keys; replace `header.location` copy |

## Step-by-step implementation order

### Step 1 — Migration

```sql
-- GPS capture is optional; all three stay nullable forever. accuracy is the
-- radius in meters reported by the Geolocation API — the admin UI can use it
-- to signal "pin is approximate" on poor fixes.
alter table public.addresses
  add column lat double precision check (lat between -90 and 90),
  add column lng double precision check (lng between -180 and 180),
  add column geo_accuracy_m real check (geo_accuracy_m >= 0);
```

No RLS changes (existing owner-only policies cover the new columns). Regenerate `lib/database.types.ts`.

### Step 2 — `lib/geolocation.ts` (client-only helpers)

```ts
// Client-side only — both functions are called from browser event handlers.

export interface GeoFix {
  lat: number;
  lng: number;
  accuracyM: number;
}

export type GeoError = "unsupported" | "denied" | "unavailable" | "timeout";

export function getBrowserPosition(): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    // Geolocation exists only in secure contexts (HTTPS / localhost).
    if (typeof window === "undefined" || !window.isSecureContext || !navigator.geolocation) {
      reject("unsupported" satisfies GeoError);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        }),
      (err) =>
        reject(
          (err.code === err.PERMISSION_DENIED
            ? "denied"
            : err.code === err.TIMEOUT
              ? "timeout"
              : "unavailable") satisfies GeoError,
        ),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

export interface ReverseGeocodeResult {
  street: string; // best-effort "road, suburb" line — user refines it
  city: string;   // city/town/state fallback chain
}

// Nominatim (OpenStreetMap). Free, no key, CORS-enabled. Fair-use policy is
// fine at our volume (one call per explicit button tap). This is the ONLY
// provider-specific function — swap the body to Google/Mapbox later without
// touching any caller.
export async function reverseGeocode(fix: GeoFix, locale: string): Promise<ReverseGeocodeResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${fix.lat}&lon=${fix.lng}&accept-language=${locale}&zoom=18`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address ?? {};
    const street = [a.road, a.neighbourhood ?? a.suburb].filter(Boolean).join(", ");
    const city = a.city ?? a.town ?? a.village ?? a.state ?? "";
    if (!street && !city) return null;
    return { street, city };
  } catch {
    return null; // coords are still useful without a readable address
  }
}
```

### Step 3 — `components/checkout/UseLocationButton.tsx`

Client component, props: `{ onCaptured: (fix: GeoFix, geocoded: ReverseGeocodeResult | null) => void; onCleared: () => void; captured: GeoFix | null }`.

Behavior:
- Renders nothing (return `null`) when `typeof navigator === "undefined" || !("geolocation" in navigator)` after mount (use a `useEffect` + state flag to avoid SSR/hydration mismatch — never branch on `navigator` during render).
- Idle state: outlined button, `LocateFixed` lucide icon + `t("geo.useMyLocation")`.
- Loading: disabled + `t("geo.locating")` (getting fix, then geocoding).
- Captured: swap to a small confirmation row — `MapPin` icon, `t("geo.captured", { accuracy: Math.round(captured.accuracyM) })` ("Location pinned (±{accuracy}m)"), plus an X button calling `onCleared`.
- Error: inline `text-danger-500` line under the button — map `GeoError` to `t("geo.denied") / t("geo.unavailable") / t("geo.timeout")`; `unsupported` just hides the button. Errors never block the manual form.
- Get the active locale for `reverseGeocode` via `useLocale()` from `next-intl`.

### Step 4 — Checkout wiring

- `DeliveryForm` (DeliveryStep.tsx) gains `lat: number | null; lng: number | null; geoAccuracyM: number | null`. Update `CheckoutClient`'s initial form state accordingly.
- Mount `<UseLocationButton>` at the top of the `addingNew` form panel in DeliveryStep. `onCaptured`: set coords into form state; if `geocoded` is non-null, prefill `address`/`city` **only when those fields are currently empty** (never clobber what the user already typed). `onCleared`: null out the three coord fields.
- `CheckoutClient.placeOrder()`: the new-address `shipping` object gains `lat/lng/geoAccuracyM` (omit keys when null rather than sending nulls); the saved-address branch passes through the coords now returned by `getAddresses()`. The `Address` interface in DeliveryStep.tsx gains optional `lat`/`lng`/`geoAccuracyM`.
- The post-order `saveAddress()` call passes the coords too.
- `create_order` RPC and its `p_shipping` parameter are **untouched** — jsonb carries the extra keys as-is.

### Step 5 — Server actions (`lib/actions.ts`)

`SaveAddressInput` and `AddressInput` gain `lat?: number | null; lng?: number | null; geoAccuracyM?: number | null`. Before insert/update, validate: if any coord key is present, both `lat`/`lng` must be finite numbers in range (−90..90 / −180..180), else strip all three (silently save without coords — bad coords must not fail an address save; the DB checks are the backstop). Include the columns in the insert/update payloads.

### Step 6 — Queries (`lib/queries.ts`)

- `getAddresses()`: map `lat: row.lat`, `lng: row.lng`, `geoAccuracyM: row.geo_accuracy_m` into the checkout `Address` shape.
- `getAccountData()`: add the three columns to the select + `AccountAddress` mapping so account edits round-trip coords (editing an address's text must not silently drop its pin).
- `ShippingSnapshot`: add `lat?: number; lng?: number`. `AdminOrder` gains `geo: { lat: number; lng: number } | null`; `toAdminOrder()` sets it only when **both** are finite numbers (`typeof === "number" && Number.isFinite`) — old orders' snapshots simply lack the keys.

### Step 7 — Account page (`components/account/AccountClient.tsx`)

- `AddressForm` state gains the three coord fields (initialized from the row when editing, nulls when adding).
- Mount `<UseLocationButton>` in the address form (same prefill-only-empty-fields rule).
- Pass coords through the `saveAddress`/`updateAddress` calls.

### Step 8 — Admin orders (`components/admin/OrdersClient.tsx`)

Where the order detail shows `customerAddress`, append when `order.geo` exists:

```tsx
<a href={`https://www.google.com/maps?q=${order.geo.lat},${order.geo.lng}`} target="_blank" rel="noopener noreferrer" className="...">
  <MapPin className="h-3.5 w-3.5" /> View on map
</a>
```

Plain English label (admin is English/LTR, no i18n).

### Step 9 — i18n (both `messages/en.json` + `messages/ar.json`, keep parity)

New `checkout.geo` namespace: `useMyLocation`, `locating`, `captured` (with `{accuracy}` param), `denied` ("Location access was denied — you can still type the address."), `unavailable`, `timeout`. Arabic translations required (e.g. `useMyLocation` → «استخدم موقعي الحالي»).

Replace `header.location` in both files with non-fake copy, e.g. EN "Delivery across Cairo" / AR «التوصيل داخل القاهرة» (key stays, only the value changes — `HeaderClient.tsx` is untouched).

## Edge cases a weaker model would miss

- **SSR/hydration**: `navigator` doesn't exist on the server. Feature-detect inside `useEffect`, not during render, or the button causes a hydration mismatch.
- **iOS Safari requires a user gesture** for `getCurrentPosition` — it must be called directly from the button's onClick handler chain, never automatically on mount/step-change.
- **Permission denied is a normal path, not an error path**: show the friendly hint and leave the manual form fully functional. Do not retry automatically (re-prompting after an explicit deny is impossible anyway — the browser silently rejects).
- **Never overwrite user-typed text**: reverse-geocode prefill applies only to empty `address`/`city` fields. GPS street names from Nominatim in Egypt are often imprecise — the coords are the ground truth for the driver; the text is just a convenience draft.
- **Coords without geocode is still a win**: `reverseGeocode` returning null (offline, Nominatim hiccup, unnamed road) must still keep the captured coords and show the "pinned" state — the fields just stay manual.
- **Old data everywhere is coordless**: every saved address and every historical order's shipping jsonb lacks the keys. Every read path (`getAddresses`, `getAccountData`, `toAdminOrder`, admin link rendering) must treat missing coords as the normal case.
- **Don't gate checkout validation on coords**: `validateDelivery()` in CheckoutClient must not change — fullName/phone/address/city remain the only required fields.
- **`maximumAge: 60_000`** avoids a second GPS spin-up when the user taps the button again after clearing; `enableHighAccuracy: true` is what makes mobile use actual GPS instead of coarse wifi positioning.
- **Nominatim etiquette**: one request per explicit tap only — no autocomplete-style calls on keystroke, ever. The 6s abort keeps a slow response from hanging the button.
- **Server-side range validation strips instead of throws**: a malformed coord from a stale client must not turn into a failed address save (and `saveAddress` runs best-effort post-order — a throw there would be swallowed anyway, silently losing the address).
- **RTL**: the captured-state row and error lines use logical properties (`start`/`end`, `gap`) like the rest of the codebase — no `left`/`right`.
- **Production requires HTTPS** for geolocation. Localhost works in dev; on any future real deployment the site must be served over HTTPS or the button self-hides (the `isSecureContext` check makes this graceful, but note it).

## Acceptance criteria

1. On `/checkout` → "Add new address" (mobile viewport, dev server = localhost so geolocation works), tapping "Use my current location" prompts for permission; granting it prefills street/city within a few seconds and shows "Location pinned (±Nm)" — in both locales, with the Arabic UI RTL-correct.
2. Placing that order stores `lat`/`lng` inside `orders.shipping` (verify via SQL) and the saved address row has `lat`/`lng`/`geo_accuracy_m` populated.
3. That order in `/admin/orders` shows a "View on map" link opening Google Maps at the exact pin; older orders show no link and no errors.
4. Denying the permission shows the inline hint, and manual entry + order placement work exactly as before (regression).
5. Clearing a captured location (X button) then submitting saves the address with null coords.
6. An account-page address edited without touching location keeps its original coords (verify via SQL before/after).
7. Header chip no longer says "Nasr City" in either locale.
8. `npx tsc --noEmit` and `npm run lint` clean; `npm run build` passes.
