# PLAN: Admin promo-code management UI

**Leverage rank: 4 of 5.**

## Goal

The `promo_codes` table exists (migration 0016) with a `promo_admin_all` RLS policy granting admins full CRUD, and `WELCOME20` is seeded — but there is **zero UI**: creating or disabling a code today requires raw SQL. Build `/admin/promos`: list, create, edit, toggle active, delete. **No schema change needed.**

**Explicitly out of scope**: usage counts / redemption stats. `orders` stores only the discount amount, not which code was used — usage tracking is impossible without a schema change. Note this in a code comment; do not attempt it.

## Table shape (from migration 0016 — verify before coding)

- `code text primary key check (code = upper(code))`
- `discount_egp numeric(10,2) not null check (discount_egp > 0)`
- `min_subtotal numeric(10,2) not null default 0`
- `active boolean not null default true`
- `expires_at timestamptz null`
- `created_at timestamptz not null default now()`

Customers have NO select policy on this table (codes are validated via the `validate_promo` SECURITY DEFINER RPC) — keep it that way.

## Exact files to touch

| File | Change |
|---|---|
| `lib/queries.ts` | `getAdminPromoCodes()` + `AdminPromoCode` interface |
| `lib/actions.ts` | `createPromoCode`, `updatePromoCode`, `togglePromoActive`, `deletePromoCode` |
| `app/admin/promos/page.tsx` | NEW server page |
| `app/admin/promos/loading.tsx` | NEW — copy skeleton convention from `app/admin/inventory/loading.tsx` |
| `components/admin/PromosClient.tsx` | NEW — modeled on `InventoryClient.tsx` |
| `components/admin/PromoFormModal.tsx` | NEW — modeled on `ProductFormModal.tsx` |
| `components/admin/AdminSidebar.tsx` | Add nav item |

No `messages/*.json` changes — admin is deliberately English/LTR (repo rule).

## Step-by-step implementation order

### Step 1 — `lib/queries.ts`

```ts
export interface AdminPromoCode {
  code: string;
  discountEgp: number;
  minSubtotal: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export async function getAdminPromoCodes(): Promise<AdminPromoCode[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  // PostgREST returns numeric columns as strings — Number() them.
  return data.map((r) => ({
    code: r.code,
    discountEgp: Number(r.discount_egp),
    minSubtotal: Number(r.min_subtotal),
    active: r.active,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  }));
}
```

(RLS scopes results: non-admin sessions simply get zero rows; the page is additionally gated by `app/admin/layout.tsx`.)

### Step 2 — `lib/actions.ts` (all behind `assertAdmin()`)

Typed-args style (like `adjustProductStock`), not FormData:

```ts
interface PromoInput { code: string; discountEgp: number; minSubtotal: number; expiresAt: string | null }

export async function createPromoCode(input: PromoInput): Promise<void> {
  await assertAdmin();
  const code = input.code.trim().toUpperCase();          // DB check requires upper
  if (!/^[A-Z0-9]{3,24}$/.test(code)) throw new Error("INVALID_CODE");
  if (!Number.isFinite(input.discountEgp) || input.discountEgp <= 0) throw new Error("INVALID_AMOUNT");
  if (!Number.isFinite(input.minSubtotal) || input.minSubtotal < 0) throw new Error("INVALID_MIN");
  const supabase = await createClient();
  const { error } = await supabase.from("promo_codes").insert({
    code,
    discount_egp: input.discountEgp,
    min_subtotal: input.minSubtotal,
    expires_at: input.expiresAt,
  });
  if (error) {
    // 23505 = duplicate PK. Map to a short code — raw PostgrestErrors are
    // redacted crossing the action boundary (repo convention).
    throw new Error(error.code === "23505" ? "CODE_EXISTS" : "PROMO_SAVE_FAILED");
  }
  revalidatePath("/admin/promos");
}
```

- `updatePromoCode(code, { discountEgp, minSubtotal, expiresAt })` — same validation minus the code regex; `.update(...).eq("code", code)`. **Code is the PK and immutable in the UI** (matches the products-slug convention); renaming = delete + create.
- `togglePromoActive(code: string, active: boolean)` — `.update({ active }).eq("code", code)`.
- `deletePromoCode(code: string)` — `.delete().eq("code", code)`. Safe for history: orders store only the discount amount.
- All end with `revalidatePath("/admin/promos")`.

### Step 3 — `app/admin/promos/page.tsx` + `loading.tsx`

```tsx
export default async function AdminPromosPage() {
  const promos = await getAdminPromoCodes();
  return <PromosClient promos={promos} />;
}
```

No extra auth check — `app/admin/layout.tsx` gates all children; actions re-check via `assertAdmin`; RLS is the backstop. `loading.tsx`: copy the skeleton pattern from `app/admin/inventory/loading.tsx` (table-ish skeleton rows).

### Step 4 — `components/admin/PromosClient.tsx`

Model on `InventoryClient.tsx` (read it first; reuse its shell classes and `useTransition` + pending-ids pattern):

- Header row: title "Promo codes", count, primary "Add code" `Button` opening the modal in create mode.
- Table (`rounded-[20px] border ... overflow-x-auto` shell, grid header row) columns:
  - **Code** — mono/bold
  - **Discount** — `formatEGP(discountEgp)` (reuse the repo's EGP formatter)
  - **Min subtotal** — `formatEGP` or "—" when 0
  - **Expires** — en-US date in Africa/Cairo tz, "—" if null
  - **Status** — pill: `Expired` if `expiresAt && new Date(expiresAt) < new Date()` (regardless of `active`), else `Active`/`Inactive`
  - **Actions** — toggle active (primary affordance), Pencil (edit modal), Trash (two-tap inline confirm, like the pattern used elsewhere in admin)
- Derive list from props (server revalidation refreshes it) — do NOT keep a duplicated local copy; follow `OrdersClient`'s approach.
- Per-row pending state during transitions; surface action errors (e.g. `CODE_EXISTS`) inline.

### Step 5 — `components/admin/PromoFormModal.tsx`

Model on `ProductFormModal.tsx` (overlay + panel + `ccOverlayIn`/`ccScaleIn` animations):

- Fields: **Code** (text, auto-uppercase on change via `value.toUpperCase()`, `disabled` in edit mode), **Discount (EGP)** (number, min 0.01, step 0.01), **Min subtotal (EGP)** (number, min 0), **Expires** (`<input type="datetime-local">`, optional, empty = never).
- On submit: convert the `datetime-local` string via `value ? new Date(value).toISOString() : null` (the input has no timezone; `new Date` interprets it as admin's local time — correct for a Cairo-based admin; do NOT hand-roll offsets, Egypt has DST).
- Inline error area mapping `CODE_EXISTS` → "A code with this name already exists." and generic failures → "Could not save the promo code."

### Step 6 — `components/admin/AdminSidebar.tsx`

Add to `NAV_ITEMS`: `{ href: "/admin/promos", label: "Promos", icon: TicketPercent }` (lucide `TicketPercent`). The active-state logic uses `startsWith` — no other change. Check whether the mobile pill nav derives from the same array (it should) — if it's a separate list, add there too.

## Edge cases a weaker model would miss

- **`check (code = upper(code))`**: the action MUST uppercase before insert, otherwise admins see a raw constraint violation.
- **PostgREST numerics arrive as strings** — `Number()` before math/format, exactly like other admin queries do.
- **`datetime-local` timezone**: naive string; `new Date(v).toISOString()` is the whole conversion. Empty string → `null`, not `Invalid Date`.
- **Duplicate PK (23505)** must surface as a friendly inline error, not an unhandled rejection.
- **No i18n**: admin UI is English/LTR by repo rule — a weaker model will reflexively add `messages/` keys; don't.
- **Expired ≠ inactive**: `validate_promo` rejects expired codes regardless of `active`; the Status pill must reflect that so the admin isn't confused about why an "Active" code doesn't work.
- **Deactivate as primary affordance**, delete behind confirm — deleting loses the record; toggling preserves it.
- **Stale admin session**: `assertAdmin()` throwing "Not authorized" mid-session must land in the modal's error area, not crash the page.

## Acceptance criteria

1. "Promos" appears in the admin sidebar (desktop + mobile nav); `/admin/promos` lists `WELCOME20` — EGP 20, min EGP 100, Active.
2. Creating a code typed as `summer10` (lowercase) stores and lists `SUMMER10`; immediately applying `SUMMER10` in the storefront cart promo box succeeds (subtotal ≥ min).
3. Toggling a code inactive → the cart promo box rejects it on next validate; toggling back re-enables.
4. Editing the discount changes the amount the cart reports for that code.
5. Setting an expiry in the past shows the "Expired" pill and `validate_promo` rejects the code.
6. Creating a duplicate `WELCOME20` shows an inline "already exists" error — no crash.
7. As a non-admin: `/admin/promos` is unreachable (layout gate), the actions throw "Not authorized", and an anon REST `select` on `promo_codes` returns zero rows.
8. `npx tsc --noEmit` and `npm run lint` clean.
