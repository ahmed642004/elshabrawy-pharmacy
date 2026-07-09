# PLAN: Password reset (make "Forgot password?" real)

**New-batch rank: 1 of 5 (cheapest, closes a permanent-churn hole).**

## Goal

`app/auth/page.tsx:249-251` renders a "Forgot password?" `<a>` with **no href and no onClick** — it does nothing. A customer who forgets their password can never get back into their account (orders, addresses, cart sync) and there is no recovery path at all. Build the full Supabase password-recovery flow: request email → email link → set new password.

## Current shape (verified)

- Auth page is a single client component `app/auth/page.tsx` (sign-in/sign-up tabs, outside the `(shop)` group, minimal chrome). It uses `createClient()` from `lib/supabase/client.ts` and the `auth` i18n namespace (`messages/*.json:~316` has `forgotPassword` already).
- `@supabase/ssr` middleware refresh runs via `proxy.ts` → `lib/supabase/middleware.ts`. There is **no** `app/auth/callback` or code-exchange route anywhere (grep `exchangeCodeForSession` → nothing).
- Supabase project id: `gjwkuhbhhueoxkmhoyrm` (use the Supabase MCP).

## Flow design

1. **Request**: on the sign-in tab, "Forgot password?" switches the card into a small "reset" mode (email input + submit) — same-page mode switch, matching how the page already flips between sign-in/sign-up. Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password` })`.
2. **Callback**: new route handler `app/auth/callback/route.ts` completes authentication from the email link and redirects to `next`.
3. **Update**: new page `app/auth/update-password/page.tsx` (client component, same minimal chrome as `/auth`) with new-password + confirm fields, calling `supabase.auth.updateUser({ password })`, then redirecting to `/` signed in.

## Exact files to touch

| File | Change |
|---|---|
| `app/auth/callback/route.ts` | NEW — code/token exchange route handler |
| `app/auth/update-password/page.tsx` | NEW — set-new-password form |
| `app/auth/page.tsx` | Wire the dead link → reset-request mode |
| `messages/en.json` + `messages/ar.json` | New `auth.reset.*` keys, keep parity |
| Supabase Auth config (dashboard/MCP, not repo) | Allow-list the redirect URL; note Site URL |

## Step-by-step implementation order

### Step 1 — `app/auth/callback/route.ts`

Handle **both** link shapes Supabase can produce (PKCE `?code=` and OTP `?token_hash=&type=`), so the flow works regardless of the project's email-template state:

```ts
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  // Only allow same-origin relative paths — never redirect off-site.
  const rawNext = url.searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const supabase = await createClient();
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/auth?error=link", url.origin));
}
```

Check `lib/supabase/server.ts` first: if its `createClient` is read-only for cookies in route handlers, follow the same cookie-writing pattern `lib/supabase/middleware.ts` uses — the session **must** be persisted here or the update-password page will think the user is signed out.

### Step 2 — Reset-request mode in `app/auth/page.tsx`

- Add a `mode` state: `"signin" | "signup" | "reset"` (today it's a boolean `isSignIn` — refactor minimally or add a `resetMode` boolean alongside, whichever touches less).
- The dead `<a>` becomes a `<button type="button">` switching to reset mode.
- Reset mode UI: heading `t("reset.title")`, one email input, submit button, "back to sign in" link.
- On submit:

```ts
const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
  redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
});
// ALWAYS show the same success message, even on error/unknown email —
// anything else lets an attacker probe which emails have accounts.
setResetSent(true);
```

- Success state: a calm confirmation card — `t("reset.sent")` ("If an account exists for this email, a reset link is on its way.").
- If the page loads with `?error=link` (from Step 1's failure branch), show `t("reset.linkInvalid")` as the error banner on the sign-in tab.

### Step 3 — `app/auth/update-password/page.tsx`

Client component, minimal chrome copied from `/auth`'s shell (it is NOT inside `(shop)`):

- On mount, check `supabase.auth.getUser()`; if no user, show `t("reset.linkInvalid")` with a link back to `/auth` (the email link is single-use and expires — default 1 hour).
- Form: new password + confirm (reuse the show/hide-password input pattern already in `app/auth/page.tsx`), client validation: min 8 chars, both match.
- Submit: `await supabase.auth.updateUser({ password })`. Success → `router.replace("/")` (user is already signed in via the recovery session) after a brief `t("reset.updated")` confirmation. Map the "New password should be different from the old password" Supabase error to `t("reset.samePassword")`.

### Step 4 — i18n (`auth.reset.*`, both locales, translated Arabic not transliterated)

`title`, `subtitle`, `submit`, `sent`, `backToSignIn`, `newPassword`, `confirmPassword`, `updateSubmit`, `updated`, `linkInvalid`, `samePassword`, `mismatch`, `tooShort`.

### Step 5 — Supabase configuration (manual/MCP, do this BEFORE testing)

- Auth → URL Configuration: add `http://localhost:3000/auth/callback` to the **Redirect URLs** allow-list (and the production origin when one exists). Without this, `resetPasswordForEmail`'s `redirectTo` is silently replaced by the Site URL and the flow breaks confusingly.
- Note in the final report: the project uses Supabase's **built-in SMTP**, which is rate-limited to a handful of emails/hour and is fine for testing only — production sending should ride the same provider decision already gated in PLAN-order-lifecycle-email.md (Step 0 there).

## Edge cases a weaker model would miss

- **Email enumeration**: the request form must show the identical success message whether the email exists or not; never surface Supabase's error for unknown emails.
- **Open-redirect guard** on `next` (Step 1 code): only same-origin relative paths.
- **Cookie writes in the route handler**: if `lib/supabase/server.ts`'s client can't set cookies from a route handler context, the exchanged session evaporates and update-password sees a signed-out user — test this specifically; it's the most likely silent failure.
- **The recovery session is a real session**: after clicking the link the user IS signed in (limited by Supabase to allow the password update). If they navigate away without updating, that's fine — but the update page must not assume a fresh anonymous visitor.
- **Rate limiting**: Supabase enforces its own resend cooldown (~60s); surface its "over rate limit" error as the generic sent-confirmation anyway (see enumeration point) — do not retry loops.
- **Locale**: the two new pages are outside `(shop)` but `NextIntlClientProvider` wraps the ROOT layout (verify in `app/layout.tsx`) — `useTranslations` works; keep RTL styling logical-property-based like `/auth` already does.
- **Existing sessions unaffected**: `updateUser({ password })` does not sign out other devices by default — acceptable, don't add global sign-out complexity.

## Acceptance criteria

1. "Forgot password?" on `/auth` opens the reset form; submitting a **registered** email shows the sent-confirmation, and the email arrives with a working link.
2. The link lands on `/auth/update-password` signed-in; setting a valid new password redirects home, and signing out + signing in with the NEW password works (old one rejected).
3. Submitting an **unregistered** email shows the exact same confirmation (no enumeration).
4. A tampered/expired link lands on `/auth?error=link` with the localized error banner, not a crash.
5. `next=https://evil.com` in a hand-crafted callback URL redirects to `/`, never off-site.
6. Both locales render correctly (Arabic RTL) on all three states (request / sent / update).
7. `npx tsc --noEmit` and `npm run lint` clean.
