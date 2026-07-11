import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Next streams metadata for dynamic pages by default (meta tags land in
  // <body> and are hoisted client-side), which HTML-limited crawlers, link
  // preview bots, and Lighthouse/PSI can miss. Matching every UA forces
  // blocking metadata in <head> for everyone — effectively free here, since
  // generateMetadata shares its data fetches with the page body via cache().
  htmlLimitedBots: /.*/,
  images: {
    // AVIF first (smallest), WebP fallback for older browsers.
    formats: ["image/avif", "image/webp"],
    // Product/category images are immutable per URL (new upload = new path),
    // so let the optimizer cache aggressively.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "gjwkuhbhhueoxkmhoyrm.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

// Defaults to ./i18n/request.ts for the per-request locale/messages config.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
