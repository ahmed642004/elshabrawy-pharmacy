import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /search stays disallowed (infinite query-param space) — /product and
      // /category are the pages this whole plan is SEO'ing, never disallow them.
      disallow: ["/admin", "/account", "/cart", "/checkout", "/auth", "/search"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
