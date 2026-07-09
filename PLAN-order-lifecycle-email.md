# PLAN: Order-confirmation / status-change email

**Leverage rank: 5 of 5 (biggest single trust gap, but sequenced last due to effort + external decision).**

## Goal

Zero email/notification infrastructure exists (no `supabase/functions/` dir, no email dependency in `package.json`). `createOrder`, `updateOrderStatus`, `cancelOrderAdmin`, `cancelMyOrder` are all completely silent — a customer gets no receipt and no notice their order was confirmed/delivered/cancelled unless they manually check `/account/orders`. Send a transactional email on order placement and on each subsequent status change, via a Supabase Edge Function.

## Step 0 — Decision required before any implementation

This plan needs the user to pick an email provider before code is written — do not hardcode a specific paid vendor. Tradeoffs:

| Provider | Notes |
|---|---|
| **Resend** | Simplest DX, generous free tier (3,000 emails/mo), built for exactly this (transactional, React-Email-style templates), most common pairing with Next.js apps today. Recommended default if there's no existing preference. |
| **Postmark** | Best-in-class deliverability for transactional mail specifically, no meaningful free tier (paid from day one), slightly more setup. |
| **AWS SES** | Cheapest at real scale, most setup friction (sandbox mode, DNS, IAM) — overkill for a single small pharmacy's order volume today. |
| **SendGrid** | Well-known, free tier has shrunk over the years, more enterprise-oriented API. |

Whichever is chosen, a sending domain also needs to be verified via DNS (SPF/DKIM records) with the domain registrar — this is a manual prerequisite outside the codebase; do not assume it's done.

The design below is written provider-agnostically (one `sendViaProvider()` function is the only place a provider's specific API shape lives) so switching later only touches one function.

## Architecture decision

Call the Edge Function **from `lib/actions.ts`** right after each successful DB mutation (`createOrder`, `updateOrderStatus`, `cancelOrderAdmin`, `cancelMyOrder`), rather than a DB trigger/webhook (`pg_net`). Rejected alternative: DB webhooks/triggers would work but add invisible-to-the-codebase magic (a trigger nobody sees when reading `lib/actions.ts`) in a repo whose entire convention is "every mutation is a visible, readable server action." Calling the function explicitly from the action that already owns the mutation keeps the side effect co-located and debuggable, matches existing conventions (`revalidatePath` calls already live right next to their mutations), and is trivially made best-effort/non-blocking.

Use Next.js's `after()` API (`next/server`, stable since Next 15 — confirm the import resolves cleanly on this repo's Next 16.2.10) so the customer's checkout response returns immediately and the email send happens in the background without risking being killed mid-flight by the serverless function exiting — a bare unawaited `fetch()` promise is not safe to fire-and-forget in a serverless action.

## Exact files to touch

| File | Change |
|---|---|
| `supabase/functions/send-order-email/index.ts` | NEW — Deno Edge Function |
| `lib/email.ts` | NEW — `sendOrderEmail(kind, orderNumber)` thin caller |
| `lib/actions.ts` | Hook into `createOrder`, `updateOrderStatus`, `cancelOrderAdmin`, `cancelMyOrder` via `after()` |
| `.env.local` (documented, not committed) | No new `NEXT_PUBLIC_*` vars needed — the internal-call secret lives server-side only |
| Supabase project secrets (via MCP, not in repo) | `EMAIL_PROVIDER_API_KEY`, `INTERNAL_CALL_SECRET` |

## Step-by-step implementation order

### Step 1 — Confirm provider choice with the user (see Step 0). Do not proceed past this without an answer.

### Step 2 — Provision secrets

Once provider is chosen: set `EMAIL_PROVIDER_API_KEY` (from the provider dashboard) and a self-generated `INTERNAL_CALL_SECRET` (random string, shared between the Next app and the edge function — used so the function only accepts calls from this app, not the public internet, since the function is deployed with JWT verification disabled) as Supabase Edge Function secrets via the Supabase MCP, and add `INTERNAL_CALL_SECRET` to `.env.local` (server-only, no `NEXT_PUBLIC_` prefix) plus document it in the environment section of `CLAUDE.md`.

### Step 3 — `supabase/functions/send-order-email/index.ts`

```ts
// Deno edge function. Deployed with verify_jwt disabled (server-to-server
// call from lib/actions.ts, not a user-facing endpoint) — instead validates
// a shared secret header so it can't be hit by arbitrary internet traffic.
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.headers.get("x-internal-secret") !== Deno.env.get("INTERNAL_CALL_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orderNumber, kind } = await req.json(); // kind: "confirmation" | "status_change"

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // auto-injected, never in repo
  );

  const { data: order, error } = await supabase
    .from("orders")
    .select("*, order_items(name, brand, price, qty)")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (error || !order) return new Response("Order not found", { status: 404 });

  const { data: authUser } = await supabase.auth.admin.getUserById(order.user_id);
  const to = authUser?.user?.email;
  if (!to) return new Response("No email on file", { status: 200 }); // not an error — guest/legacy edge case, no-op

  const html = renderOrderEmail(order, kind); // simple template fn in this same file
  const sent = await sendViaProvider(to, `Order ${order.order_number}`, html);
  return new Response(null, { status: sent ? 200 : 500 });
});
```
`sendViaProvider()` is the single function whose body depends on the chosen provider's API — write it last, after Step 1's decision.

### Step 4 — `lib/email.ts`

```ts
// Best-effort, fire-and-forget from the caller's perspective — see the
// after() usage in lib/actions.ts. A short timeout so a slow/broken email
// provider can never hang a background task indefinitely.
export async function sendOrderEmail(kind: "confirmation" | "status_change", orderNumber: string): Promise<void> {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-order-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": process.env.INTERNAL_CALL_SECRET! },
      body: JSON.stringify({ orderNumber, kind }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Never throw — a broken email provider must never affect checkout or
    // an admin's order-status update. Log for later; don't surface to the UI.
    console.error(`sendOrderEmail failed for ${orderNumber} (${kind})`);
  }
}
```

### Step 5 — Wire into `lib/actions.ts`

```ts
import { after } from "next/server";
import { sendOrderEmail } from "@/lib/email";

export async function createOrder(input: CreateOrderInput): Promise<string> {
  // ...existing RPC call...
  after(() => sendOrderEmail("confirmation", data));
  return data;
}
```
Same `after(() => sendOrderEmail("status_change", orderNumber))` added at the end of `updateOrderStatus`, `cancelOrderAdmin`, and `cancelMyOrder` — but only for `confirmed`/`delivered`/`cancelled` (the full `order_status` enum per `lib/database.types.ts`: `"placed" | "confirmed" | "delivered" | "cancelled"` — `placed` is covered by the confirmation email from `createOrder` itself, so `updateOrderStatus` should only fire for the other two transitions it can produce, and cancellation paths always fire).

## Edge cases a weaker model would miss

- **`after()` import path** (`next/server`) must be verified against this exact Next 16.2.10 install — if it's not available/stable in this version, fall back to an awaited `fetch()` with the same 5s timeout inside a `try/catch` (slightly slower checkout response, but never hangs indefinitely and never fails the order).
- **Never let an email failure fail the underlying mutation** — `sendOrderEmail` must never throw out of its own `try/catch`; if it did, a broken `EMAIL_PROVIDER_API_KEY` would start failing checkouts, which is strictly worse than the current silent-but-working state.
- **No stored locale** — orders don't have an Arabic/English preference column. v1 emails are English-only by design (documented limitation, not a bug); a follow-up would need an `orders.locale` snapshot column captured at `createOrder` time from the request's locale cookie. Flag this explicitly rather than guessing at bilingual templates now.
- **Guest/legacy edge case**: `auth.admin.getUserById` returning no email must no-op with a 200, not 500 — checkout must never depend on email deliverability succeeding.
- **Service-role key never touches the Next.js app** — it's injected automatically into the Edge Function's Deno runtime by Supabase, never added to `.env.local` or any client-reachable code; only `INTERNAL_CALL_SECRET` (an app↔function shared secret, not a Supabase credential) lives in `.env.local`.
- **`updateOrderStatus`'s existing `USE_CANCEL_ORDER` guard**: cancellations never reach `updateOrderStatus`'s email hook (they throw before it) — the cancel email must be added to `cancelOrderAdmin`/`cancelMyOrder` specifically, not assumed to be covered by `updateOrderStatus`.
- **Idempotency isn't critical here but note it**: a double-click on "confirm" in the admin UI (already guarded client-side by the existing pending-state pattern) could in theory fire two status-change emails for the same transition — acceptable for v1 (an extra email is a minor annoyance, not a correctness bug), not worth a dedup mechanism yet.

## Acceptance criteria

1. User has explicitly confirmed a provider before any code lands (Step 0 gate).
2. Placing a real order sends a confirmation email to the signed-in customer's address within a few seconds, containing the order number, items, and total that match the order detail page.
3. Admin changing an order to `confirmed` and then `delivered` each send a status-change email; changing to `cancelled` (customer or admin path) sends a cancellation email.
4. Killing the `EMAIL_PROVIDER_API_KEY` (temporarily, in a test) does not prevent `createOrder`/`updateOrderStatus`/cancel actions from succeeding — only the email silently fails (verify via edge function logs, not a broken checkout).
5. A direct unauthenticated POST to the edge function's public URL without the `x-internal-secret` header is rejected with 401.
6. `npx tsc --noEmit` and `npm run lint` clean; `supabase/functions/send-order-email` deploys cleanly via Supabase MCP.
