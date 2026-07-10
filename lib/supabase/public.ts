import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Cookie-less anon client for public catalog reads wrapped in
// unstable_cache() — cookies() is not allowed inside the data cache, and
// this data is identical for every visitor and publicly readable via RLS
// (same pattern app/sitemap.ts uses). Everything user-specific must keep
// going through lib/supabase/server.ts.
export const publicClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
