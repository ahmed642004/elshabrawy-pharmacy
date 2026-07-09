import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { siteUrl } from "@/lib/site";

// sitemap.ts is generated at build time with no request context, so it
// can't use lib/supabase/server.ts (that createClient() calls next/headers'
// cookies(), which throws outside a request scope). A bare anon client is
// fine here — products/categories are publicly readable via RLS anyway.
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from("products").select("slug, created_at"),
    supabase.from("categories").select("id"),
  ]);

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/category`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/category/offers`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.4 },
    ...(categories ?? []).map((c) => ({
      url: `${base}/category/${c.id}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...(products ?? []).map((p) => ({
      url: `${base}/product/${p.slug}`,
      lastModified: new Date(p.created_at),
      priority: 0.6,
    })),
  ];
}
