# PLAN: Live admin order feed (Supabase Realtime)

**New-batch rank: 3 of 5 (turns the admin from a report you refresh into ops software that taps you on the shoulder).**

## Goal

The pharmacist currently learns about a new order only by manually refreshing `/admin` or `/admin/orders` — for a 2-hour-delivery pharmacy that's an operational hole (grep confirms zero Realtime usage in the repo; `@supabase/realtime-js` ships inside supabase-js but is never used). Add a realtime listener mounted across the whole admin shell that, on any new order: plays a notification sound, shows a toast with the order number/total, shows an unseen-count badge on the sidebar's Orders item, and refreshes the current page's data.

## Current shape (verified)

- Admin shell: `app/admin/layout.tsx` (server, gates on `profiles.is_admin`) renders `AdminSidebar` + children. All admin pages are server components hydrated with client "…Client" components.
- Orders inserts happen ONLY via the `create_order()` SECURITY DEFINER RPC — inserts on `public.orders` are the exact signal for "new order".
- RLS: 0009 added admin policies — **executor must verify** an "admins read all orders" SELECT policy exists on `public.orders` (query `pg_policies` via the Supabase MCP). Realtime `postgres_changes` respects RLS: no read policy for the subscribing admin = no events delivered, silently.
- Browser Supabase client: `lib/supabase/client.ts` (the only allowed way to instantiate).
- Toast pattern: the shop side has a ToastProvider (from the earlier "fancy pass"); check whether it's mounted for admin routes — if it's shop-layout-scoped, the new component renders its own minimal toast (admin is English-only, so no i18n).
- `useRouter().refresh()` re-fetches the current route's server data — the established pattern after admin mutations.

## Exact files to touch

| File | Change |
|---|---|
| `supabase/migrations/00XX_orders_realtime.sql` | NEW — add `orders` to the realtime publication (next free number at execution time) |
| `components/admin/NewOrderListener.tsx` | NEW — client component: subscription + sound + toast + badge state |
| `components/admin/AdminSidebar.tsx` | Consume unseen-count badge on the Orders nav item |
| `app/admin/layout.tsx` | Mount the listener once for all admin routes |
| `public/` | NO audio file — synthesize the beep with the Web Audio API (no asset, no licensing) |

## Step-by-step implementation order

### Step 1 — Migration

```sql
-- Broadcast INSERTs on orders to Realtime subscribers. RLS still applies at
-- delivery time: only sessions that can SELECT the row receive the event,
-- which for orders means the owner or an admin (0009).
alter publication supabase_realtime add table public.orders;
```

Before writing it, verify via MCP: `select * from pg_publication_tables where pubname = 'supabase_realtime'` (skip the migration if already present) and confirm the admin SELECT policy on orders exists (`select policyname, cmd from pg_policies where tablename = 'orders'`). If no admin SELECT policy exists, add one in this same migration mirroring 0009's pattern: `create policy "Admins read all orders" on public.orders for select using (public.is_admin());`

### Step 2 — `components/admin/NewOrderListener.tsx`

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface NewOrderToast {
  orderNumber: string;
  total: number;
}

export default function NewOrderListener() {
  const router = useRouter();
  const [toast, setToast] = useState<NewOrderToast | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-new-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const row = payload.new as { order_number: string; total: number };
          setToast({ orderNumber: row.order_number, total: Number(row.total) });
          playChime();
          bumpUnseenOrders();
          router.refresh(); // re-pulls whatever admin page is open
          if (hideTimer.current) clearTimeout(hideTimer.current);
          hideTimer.current = setTimeout(() => setToast(null), 8000);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [router]);

  if (!toast) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 ..." role="status">
      New order {toast.orderNumber} — EGP {toast.total.toLocaleString()}
      {/* click → link to /admin/orders */}
    </div>
  );
}
```

`playChime()`: Web Audio two-tone chime, ~0.3s, created lazily:

```ts
function playChime() {
  try {
    const ctx = new AudioContext();
    for (const [freq, at] of [[880, 0], [1320, 0.12]] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.3);
    }
  } catch {
    // Autoplay policy blocked it (no user gesture yet this session) — the
    // toast + badge still carry the signal; never let sound failure throw.
  }
}
```

### Step 3 — Unseen-count badge

Simplest robust mechanism (no context provider ceremony): module-level state + a tiny subscriber hook in the same file, exported for `AdminSidebar`:

- `NewOrderListener` increments a module-scoped counter + notifies subscribers (`bumpUnseenOrders()`).
- `AdminSidebar` (already a client component — verify; if not, its nav list part is) calls `useUnseenOrders()` and renders a small primary-500 dot/count pill on the Orders item when > 0.
- Navigating to `/admin/orders` (pathname check via `usePathname()` inside the hook) resets the count to 0.

State resets on full page reload — acceptable by design (the Orders page itself shows ground truth; the badge is a session-level attention cue, not a database).

### Step 4 — Mount in `app/admin/layout.tsx`

`<NewOrderListener />` rendered once alongside the sidebar so it lives across all admin routes. It renders nothing except the transient toast.

## Edge cases a weaker model would miss

- **RLS gates event delivery silently** (Step 1's policy check is not optional): with no admin SELECT policy the subscription "works" — `SUBSCRIBED` status, zero events, no errors. Verify with a real inserted order during testing, not just channel status.
- **Autoplay policy**: browsers block `AudioContext` before the first user gesture in the tab. The try/catch (and creating the context lazily inside the handler, never at module load) makes sound best-effort; the toast/badge are the reliable channel.
- **Don't stack timers**: a second order arriving within the 8s window must reset the hide timer (see `hideTimer` ref), or the newest toast disappears almost immediately.
- **Cleanup on unmount**: `supabase.removeChannel(channel)` — hot-reload in dev otherwise piles up duplicate subscriptions and you get N toasts per order.
- **`router.refresh()` is cheap but not free**: it refetches the current admin page's server data. Do NOT also add polling; realtime + refresh-on-event is the whole mechanism.
- **The payload's `total` is a string** in Supabase's serialization of numerics (same PostgREST quirk the repo already handles) — `Number(row.total)` before `toLocaleString`.
- **Toast is admin-only English** — no i18n keys (repo rule), plain LTR fixed positioning (`right-4` literal, not `end-4`, since admin is force-LTR).
- **Cancelled/status updates are NOT new orders**: subscribe to `INSERT` only; `UPDATE` events would double-fire on every status change the admin themself makes.

## Acceptance criteria

1. With `/admin` open in one browser (admin session) and a customer placing a real order in another (or via the checkout flow on a second profile): within ~2s the admin tab shows the toast with the correct order number + total, plays the chime (after at least one prior click in the tab), and the sidebar Orders item shows a badge.
2. The open page's data refreshes (e.g. `/admin` KPI order count increments without manual reload).
3. Clicking through to `/admin/orders` clears the badge; the new order is in the list.
4. Two orders in quick succession: two toasts sequentially (second replaces first, timer resets), badge shows 2 before visiting Orders.
5. No duplicate toasts after dev-server hot reloads (cleanup works); no console errors when sound is autoplay-blocked.
6. A non-admin session receives no admin toasts anywhere on the storefront (listener only mounts in the admin layout).
7. `npx tsc --noEmit` and `npm run lint` clean.
