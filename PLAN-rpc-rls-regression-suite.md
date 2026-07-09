# PLAN: RPC/RLS regression suite

**Leverage rank: 4 of 5.**

## Goal

Real business logic now lives in Postgres SECURITY DEFINER RPCs + RLS (`create_order`, `cancel_order`, `validate_promo`, `has_purchased`/`has_purchased_product`, `is_admin`, `get_pending_reviews`, plus the two new admin RLS policy sets from PLAN-review-moderation and PLAN-category-management). Manual testing alone has found 3 real bugs in this project (oversell, upsert conflict target, admin-cancel stock loss). Add a lightweight, repeatable **SQL regression suite** that asserts each RPC's/policy's core guarantees — no new npm dependency, no local Postgres/CLI stack (none exists in this repo), runnable today via the Supabase MCP's `execute_sql` against the real project inside rolled-back transactions (zero persisted side effects).

**Explicitly not**: pgTAP (needs a local `pg_prove`/Postgres install this repo doesn't have) or a JS test framework (adds a new devDependency + local Supabase stack this repo deliberately doesn't run — see CLAUDE.md: "no local Supabase CLI stack"). This is a pragmatic v1; wiring it into CI is a real follow-up but out of scope here.

**Sequencing note**: run this after PLAN-review-moderation and PLAN-category-management ship, so it can cover their new RLS policies too (see Steps 5-6 below).

## Design

Each test file wraps its assertions in `begin; ... rollback;` so nothing persists regardless of pass/fail. RLS-as-a-specific-user is simulated with Supabase's standard impersonation trick — **both** lines are required, a weaker attempt often does only the first:

```sql
select set_config('request.jwt.claim.sub', '<test-user-uuid>', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;  -- REQUIRED: without this, the session stays
                                 -- as the privileged connection role and RLS
                                 -- is bypassed entirely regardless of claims.
```

Each assertion is a `do $$ begin if not (<condition>) then raise exception 'FAIL: <description>'; end if; raise notice 'PASS: <description>'; end $$;` block — an unhandled exception aborts the transaction (which `rollback;` then cleans up) and is loud in the `execute_sql` tool output, which is the point for a manually-run suite.

## Exact files to touch

| File | Change |
|---|---|
| `supabase/tests/README.md` | NEW — how to run, the impersonation snippet, fixture setup |
| `supabase/tests/010_create_order.sql` | NEW |
| `supabase/tests/020_cancel_order.sql` | NEW |
| `supabase/tests/030_validate_promo.sql` | NEW |
| `supabase/tests/040_reviews_rls.sql` | NEW |
| `supabase/tests/050_admin_gating.sql` | NEW |

## Step-by-step implementation order

### Step 1 — Fixture users (one-time, manual, documented in README, not scripted)

Sign up 3 real accounts through the actual `/auth` flow (same convention already used for manual testing per `ROADMAP.md`'s "temporarily-admin'd test account" entries): `qa-buyer@<yourdomain>`, `qa-other@<yourdomain>`, `qa-admin@<yourdomain>`. Grant admin to the third via the same one-off `update profiles set is_admin = true where id = (select id from auth.users where email = '...')` pattern already established in migration 0009. Record their UUIDs in `supabase/tests/README.md` (not secret — just ids). This step must happen before any test file can run; sequence it first.

### Step 2 — `supabase/tests/010_create_order.sql`

Assertions, each in its own rolled-back transaction:
- Happy path: seed a throwaway product with `stock_count = 5`, call `create_order()` as `qa-buyer` for qty 2 → order row exists, `stock_count` is now 3, `subtotal`/`total` match the product's current price (not a client-supplied one — this is the exact class of bug 0015 fixed).
- Insufficient stock: `stock_count = 1`, request qty 2 → RPC raises, **no** order row inserted, `stock_count` unchanged (regression test for the exact oversell bug this session already found once).
- Duplicate-slug collapsing: `p_items` with the same slug twice (qty 1 + qty 1) against `stock_count = 1` → must reject as insufficient (1 < 2 combined), proving the two rows don't each pass an independent per-row check.
- Signed-out: `auth.uid()` null → RPC raises "Sign in is required."

### Step 3 — `supabase/tests/020_cancel_order.sql`

- Owner cancels their own `placed` order → status becomes `cancelled`, `stock_count` restored by exactly the ordered qty (regression test for the stock-loss bug this session found).
- Owner cannot cancel `qa-other`'s order (RLS/RPC ownership check).
- Owner cannot re-cancel an already-cancelled order (`CANCEL_NOT_ALLOWED`, and critically: stock is **not** restored a second time — assert `stock_count` after the second attempt equals after the first, not double-incremented).
- Admin (`qa-admin`) can cancel a `confirmed` order (a status an owner cannot self-cancel per `cancel_order`'s branching).
- Non-owner, non-admin (`qa-other`) cannot cancel `qa-buyer`'s order.

### Step 4 — `supabase/tests/030_validate_promo.sql`

- Active code, subtotal ≥ min → returns `discount_egp`.
- Inactive code → returns null.
- Expired code (`expires_at` in the past) → returns null even if `active = true` (this exact "expired ≠ inactive" distinction was called out as a UI edge case in the admin-promo-codes plan — worth a DB-level regression test too).
- Subtotal below `min_subtotal` → returns null.
- Case-insensitive/whitespace: `' welcome20 '` → same result as `WELCOME20` (per `upper(trim(p_code))` in the function).

### Step 5 — `supabase/tests/040_reviews_rls.sql`

- `qa-buyer` who has NOT purchased the seeded test product: direct RLS insert attempt (not through `submitReview`, a raw `insert` as the impersonated role) is rejected — proves the RLS purchase gate (0021) works independent of the `lib/actions.ts` application-level check, which is the entire point of that migration.
- `qa-buyer` who HAS purchased (seed an order first) can insert, and a second insert for the same product upserts (one row, not two — regression test for the exact `ON CONFLICT` bug this session found once, migration 0019).
- **Extend this file once review moderation ships**: add a case where `qa-admin` can update `hidden` on `qa-buyer`'s review (admin policy) and note that `qa-buyer` can also set `hidden=true` on their own review via the owner policy (RLS doesn't do column-level grants — this is an accepted limitation, not a bug, since a customer hiding their own review is harmless).

### Step 6 — `supabase/tests/050_admin_gating.sql`

- `is_admin()` returns false for `qa-buyer`, true for `qa-admin`.
- `qa-buyer` cannot insert/update/delete `promo_codes` (existing RLS); `qa-admin` can.
- **Extend once category management ships**: same three assertions against `categories`.

### Step 7 — `supabase/tests/README.md`

Document the fixture UUIDs, the impersonation snippet, and "run by pasting each file's contents into the Supabase MCP `execute_sql` tool one at a time; a `PASS:` notice per assertion and a clean finish (no thrown exception) means the suite passed for that file."

## Edge cases a weaker model would miss

- **`set local role authenticated` is not optional** — setting only the JWT claim without switching role leaves the connection as its privileged default role, which bypasses RLS entirely; every RLS-testing file would silently "pass" for the wrong reason (no policy was ever actually evaluated).
- **`begin; ... rollback;` around every file, including ones that intentionally trigger a rejection** — an intentionally-failing `create_order()` call (insufficient stock) still needs to run inside a transaction that gets rolled back cleanly, otherwise a partial write from an earlier passing assertion in the same file could leak into the next run.
- **Don't hardcode fixture UUIDs as magic strings scattered across files** — put them in one place (README) so rotating a fixture account doesn't require touching 5 files.
- **`get_pending_reviews()` and `has_purchased()` are SECURITY DEFINER and read `auth.uid()` internally** — impersonation must be set up *before* calling them, not passed as a parameter (they don't take a user-id argument, by design, so they can't be spoofed by a malicious caller).
- **Timing-sensitive stock assertions**: the insufficient-stock test must seed `stock_count` fresh inside its own transaction (not rely on a shared seed row that a prior test file might have mutated) — each file must be independently runnable in any order.

## Acceptance criteria

1. Running `010_create_order.sql` against the real project shows 4 `PASS:` notices and completes with no unhandled exception; the throwaway product's `stock_count` is unchanged afterward (rolled back) — verify via a follow-up `select` outside the transaction.
2. Running `020_cancel_order.sql` catches the exact double-restore bug if intentionally reintroduced (temporarily comment out the row lock in `cancel_order()` and confirm the suite goes red) — this is the sanity check that the suite actually tests something real, not just happy paths.
3. All 6 files run clean against the current (already-correct) schema.
4. No test file leaves any row behind in `products`, `orders`, `order_items`, `promo_codes`, `reviews`, or `categories` after running (verify via `select count(*)` before/after on each table).
5. `supabase/tests/README.md` alone is sufficient for someone unfamiliar with this project to reproduce the fixture setup and run the suite.
