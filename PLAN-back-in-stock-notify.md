# PLAN: Back-in-stock notifications (make the "notify me" UI real)

**Leverage rank: 5 of 5.**

## Goal

Two storefront affordances are pure decoration today: the "Notify me" button on out-of-stock product pages (`ProductPurchasePanel.tsx` — sets a local `useState` that forgets on reload) and the bell icon on out-of-stock `ProductCard`s (rendered `disabled`, unclickable). Make them real: a `notify_requests` table, a toggle server action, and an **in-app restock banner** for signed-in users (there is no email infrastructure — v1 is in-app only, following the `getPendingReviews` layout-fetch pattern).

## Exact files to touch

| File | Change |
|---|---|
| `supabase/migrations/0023_notify_requests.sql` | NEW table + RLS |
| `lib/database.types.ts` | Regenerate after migration |
| `lib/actions.ts` | `toggleNotifyRequest`, `dismissRestockNotice` |
| `lib/queries.ts` | `getRestockedNotifies()`, `hasNotifyRequest(slug)` |
| `components/product/ProductPurchasePanel.tsx` | Real notify toggle (`notifyRequested` prop) |
| `app/(shop)/product/[slug]/page.tsx` | Fetch initial notify state in existing `Promise.all` |
| `components/ProductCard.tsx` | Enable the bell (~lines 100-113) |
| `components/RestockBanner.tsx` | NEW client component |
| `app/(shop)/layout.tsx` | Fetch + mount banner beside `ReviewPrompt` |
| `messages/en.json` + `messages/ar.json` | `product.notifySignIn`, `product.notifyRemoved`, `restock.*` |

## Step-by-step implementation order

### Step 1 — Migration `0023_notify_requests.sql`

Apply via Supabase MCP `apply_migration` AND save the same SQL to the migrations folder:

```sql
create table public.notify_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (user_id, product_id)
);

alter table public.notify_requests enable row level security;

-- Own-rows only, same shape as the addresses policies.
create policy notify_requests_own on public.notify_requests
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index notify_requests_user_pending
  on public.notify_requests (user_id) where notified_at is null;
```

### Step 2 — Regenerate `lib/database.types.ts` (Supabase MCP).

### Step 3 — `lib/actions.ts`

```ts
export type NotifyToggleResult = "added" | "removed" | "unauthenticated";

export async function toggleNotifyRequest(productSlug: string): Promise<NotifyToggleResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // RETURN, don't throw: thrown action errors get redacted client-side, and
  // "sign in to get notified" is an expected state, not a failure.
  if (!user) return "unauthenticated";

  const { data: product } = await supabase.from("products").select("id").eq("slug", productSlug).single();
  if (!product) return "removed"; // product vanished; nothing to do

  const { data: existing } = await supabase
    .from("notify_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("product_id", product.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("notify_requests").delete().eq("id", existing.id);
    revalidatePath(`/product/${productSlug}`);
    return "removed";
  }

  // Upsert on the unique pair absorbs double-clicks (23505). Resetting
  // notified_at to null lets a user re-request after a dismissed notice.
  await supabase.from("notify_requests").upsert(
    { user_id: user.id, product_id: product.id, notified_at: null },
    { onConflict: "user_id,product_id" }
  );
  revalidatePath(`/product/${productSlug}`);
  return "added";
}

export async function dismissRestockNotice(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  // RLS scopes the update to own rows anyway; the eq is belt-and-braces.
  await supabase.from("notify_requests")
    .update({ notified_at: new Date().toISOString() })
    .in("id", ids.slice(0, 100))
    .eq("user_id", user.id);
}
```

### Step 4 — `lib/queries.ts`

```ts
export interface RestockedNotify { id: string; slug: string; name: string; imageUrl: string | null }

// Signed-in user's pending notify requests whose product is back in stock.
// KEY INSIGHT: no trigger/cron/transition-detection is needed. "Pending
// request AND product currently not out-of-stock" IS the restock signal —
// the 0010 trigger keeps products.stock derived from stock_count.
// Fails closed to [] — this runs in the shop layout; an error here must
// never take down every storefront page (same contract as getPendingReviews).
export async function getRestockedNotifies(): Promise<RestockedNotify[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("notify_requests")
    .select("id, products(slug, name, stock, product_images(url, position))")
    .is("notified_at", null);
  if (error || !data) return [];
  return data
    .filter((r) => r.products && r.products.stock !== "out")
    .map((r) => ({ id: r.id, slug: r.products!.slug, name: r.products!.name, imageUrl: /* lowest-position image url or null */ }));
}

export async function hasNotifyRequest(productSlug: string): Promise<boolean> {
  // user null → false; join products by slug; select id; return !!row.
}
```

(Adjust the embed typing to whatever the regenerated types produce — the `products` embed may type as an object or array depending on the FK; handle accordingly like other embeds in this file.)

### Step 5 — `ProductPurchasePanel.tsx`

- Add prop `notifyRequested: boolean`. Replace the fake `notified` local state with `useState(notifyRequested)` + `useTransition`.
- Button click → `toggleNotifyRequest(slug)`; on `"added"` set true (label flips to the existing "notified/we'll let you know" copy), on `"removed"` set false + toast `t("notifyRemoved")`, on `"unauthenticated"` toast `t("notifySignIn")` and do not change state.
- `app/(shop)/product/[slug]/page.tsx`: add `hasNotifyRequest(slug)` to the existing `Promise.all` and pass the prop. (Note: `await params` — Next 16.)

### Step 6 — `ProductCard.tsx` bell (~lines 100-113)

- Remove `disabled={outOfStock}` for the bell case; keep the visual neutral styling.
- `onClick`: `e.preventDefault(); e.stopPropagation();` (the card has a full-surface link overlay — the button's existing `z-20` must stay), then `toggleNotifyRequest(slug)` in a transition and toast per result. The card stays "dumb": no per-card server fetch of existing-request state; clicking twice simply toggles.

### Step 7 — `components/RestockBanner.tsx` + layout mount

- Client component, props `items: RestockedNotify[]`. Renders `null` when empty.
- A dismissible banner bar (below the header, above `children` — NOT a modal; `ReviewPrompt` already owns the modal slot): small product thumbnails/names, each linking to `/product/[slug]`, copy `t("restock.title", { count })` with ICU plural, and an X button.
- On dismiss → `dismissRestockNotice(items.map(i => i.id))` then hide locally. Also fire the same dismissal when a user clicks through to a product (they've seen it).
- `app/(shop)/layout.tsx`: fetch in parallel — `const [pendingReviews, restocked] = await Promise.all([getPendingReviews(), getRestockedNotifies()]);` — do not serialize two awaits in the layout. Mount `<RestockBanner items={restocked} />` in the JSX (inside the fragment, before `{children}` if the banner sits under the header visually — match the design by placing it at the top of the main content flow).

### Step 8 — i18n (both files, parity)

`product.notifySignIn` (en: "Sign in to get notified when it's back", ar: «سجّل الدخول ليصلك إشعار عند التوفر»), `product.notifyRemoved`, `restock.title` (ICU plural over `{count}`, e.g. "Good news — {count, plural, one {a product you wanted is} other {# products you wanted are}} back in stock"), `restock.dismiss`. Natural Arabic; match existing ICU plural style (`account.itemCount`).

## Edge cases a weaker model would miss

- **No trigger/cron**: deriving "restocked" at read time (`pending ∧ stock ≠ 'out'`) sidesteps all transition-detection machinery a weaker model would build (products trigger writing notification rows). The 0010 trigger already keeps `stock` accurate.
- **Layout queries fail closed to `[]`** — an exception in `getRestockedNotifies` would 500 every storefront page. Copy `getPendingReviews`' error handling exactly.
- **Return `"unauthenticated"`, never throw** for the signed-out case — thrown server-action errors are redacted to a generic message client-side (documented convention in `lib/actions.ts`).
- **Re-request after dismissal**: the upsert must set `notified_at: null`, otherwise a second request after a dismissed notice never banners again.
- **Unique pair + upsert** absorbs rapid double-taps that would otherwise 23505.
- **ProductCard overlay link**: without `preventDefault/stopPropagation` (and the existing `z-20`), tapping the bell navigates to the product page instead.
- **Guests**: everything no-ops gracefully — `getRestockedNotifies` returns `[]`, bell taps toast a sign-in hint, zero DB writes.
- **RTL**: banner uses logical properties/`gap`; ICU plurals differ structurally in Arabic (zero/one/two/few/many/other) — provide at least `zero/one/two/other` forms if following the existing file's style.
- **`revalidatePath` on the PDP** after toggling so the server-passed `notifyRequested` prop is correct on the next visit.
- **Emoji-free copy** (repo rule).

## Acceptance criteria

1. Signed-out: bell tap (card or PDP) shows the sign-in toast; `notify_requests` stays empty.
2. Signed-in: PDP notify toggles on → survives a full reload (state comes from the server prop); row visible in `notify_requests`; toggling off deletes it.
3. Flow: admin sets a product's stock to 0 → customer requests notify → admin raises stock above 0 → customer's next storefront navigation shows the banner naming that product, linking to its page.
4. Dismissing the banner sets `notified_at` (verify SQL) and it does not reappear on subsequent navigations; requesting again after another out→in cycle banners again.
5. RLS: user A cannot read or modify user B's rows via direct REST calls.
6. Guest browsing is completely unaffected (no banner, no errors, layout query returns `[]`).
7. `npx tsc --noEmit`, `npm run lint` clean; message-file parity holds; Arabic banner renders correctly in RTL.
