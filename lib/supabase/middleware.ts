import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the auth session cookie if expired — required for Server
  // Components to read a valid session via lib/supabase/server.ts.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Edge gate for the ops dashboard: reject non-admins before any /admin
  // server rendering happens. app/admin/layout.tsx re-checks as a backstop
  // (defense in depth, same layering as checkout's UI gate + create_order()'s
  // own auth.uid() check), so a matcher misconfiguration here can't silently
  // expose the dashboard.
  const path = request.nextUrl.pathname;
  if (path === "/admin" || path.startsWith("/admin/")) {
    const redirectPreservingCookies = (url: URL) => {
      const redirect = NextResponse.redirect(url);
      // Carry over any refreshed session cookies so the redirect doesn't
      // drop the renewed auth token.
      supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    };

    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth";
      url.search = `?redirect=${encodeURIComponent(path)}`;
      return redirectPreservingCookies(url);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_admin) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return redirectPreservingCookies(url);
    }
  }

  return supabaseResponse;
}
