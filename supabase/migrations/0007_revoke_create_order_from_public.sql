-- Postgres grants EXECUTE to PUBLIC by default when a function is created,
-- so revoking from `anon` specifically (0006) wasn't enough — `anon` still
-- inherited execute via the PUBLIC grant. Revoke from PUBLIC so only
-- `authenticated` (and the function owner/service_role) can call it.
revoke execute on function public.create_order (jsonb, numeric, numeric, numeric, numeric, payment_method, jsonb) from public;
