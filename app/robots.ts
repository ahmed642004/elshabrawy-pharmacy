import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
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
